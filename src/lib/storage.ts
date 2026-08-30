import type {
  Restaurant, MenuItem, BillingEntry, Report, ChatMessage,
  IngredientMapping, WastagePrediction, PricingRecommendation,
  PromotionRecord, Opportunity, OpportunityStatus,
  ForecastAccuracyEntry, ForecastAccuracyPoint,
} from '../types';
import { authClient } from './authClient';

// Local-only keys. Billing/menu/reports/opportunities/restaurant profile live on the
// server now (see below) — they are NOT namespaced client-side anymore; the server
// scopes every query by the restaurantId it reads from the verified JWT, which is
// what makes tenant isolation real.
const KEYS = {
  chat: 'biq_chat',
  ingredientMappings: 'biq_ingredient_mappings',
  wastageLog: 'biq_wastage_log',
  pricingRecs: 'biq_pricing_recs',
  promotions: 'biq_promotions',
} as const;

// Legacy client-namespaced keys from before the backend migration — read once for
// migrateLegacyLocalData(), never written again.
const LEGACY_KEYS = {
  billing: 'biq_billing',
  menu: 'biq_menu',
  reports: 'biq_reports',
  opportunities: 'biq_opportunities',
  // The restaurant profile (onboarding identity/format/tracking/priorities) was
  // local-only until this fix — completion state lived in the browser, not the
  // account, so a fresh device/browser saw a completed account as un-onboarded.
  // Migrated to the server exactly once, same as the others above.
  restaurant: 'biq_restaurant',
} as const;

function nsKey(base: string): string {
  const restaurantId = localStorage.getItem('biq_restaurant_id') ?? 'anon';
  return `${base}_${restaurantId}`;
}

function get<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(nsKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function set<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(nsKey(key), JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Failed to set item in localStorage:', error);
    return false;
  }
}

function remove(key: string): void {
  localStorage.removeItem(nsKey(key));
}

// ─── Server-backed data layer (billing, menu, reports, opportunities) ────────
//
// Reads stay synchronous (same signatures every page already calls) via an in-memory
// cache; writes are async (network round-trip) and refresh that cache on success.
// The cache is populated by hydrate(), which must run once after login/signup and
// once on app boot for an already-authenticated session (see App.tsx) — until then,
// reads return [] rather than throwing, same as the old "key not set yet" behavior.

export interface TrainSummary {
  ok: boolean;
  error?: string;
  rowsUsed?: number;
  daysUsed?: number;
  dishCount?: number;
  trainRows?: number;
  testRows?: number;
  mae?: number;
  trainedAt?: string;
}

export interface CompareResult {
  wma: number | null;
  trainedModel: number | null;
  trainedModelStatus: string | null;
}

let billingCache: BillingEntry[] | null = null;
let menuCache: MenuItem[] | null = null;
let reportsCache: Report[] | null = null;
let opportunitiesCache: Opportunity[] | null = null;
let restaurantProfileCache: Restaurant | null = null;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('biq_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Wraps fetch with the access-token-expiry dance: on a 401, try exactly one
 * silent refresh (rotates the refresh token server-side) and retry the same
 * request once with the new access token. If the refresh itself fails (refresh
 * token also expired/revoked), the session is over — clear it and hard-redirect
 * to /login rather than leaving the app stuck on a request that will never
 * succeed. A non-401 response (including a 401 that survives the retry) is
 * simply returned for the caller to handle as before.
 */
async function fetchWithRefresh(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (res.status !== 401) return res;

  const newAccessToken = await authClient.refreshAccessToken();
  if (!newAccessToken) {
    authClient.clearSession();
    if (typeof window !== 'undefined') window.location.href = '/login';
    return res;
  }

  const headers = { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${newAccessToken}` };
  return fetch(path, { ...init, headers });
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithRefresh(path, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return res.json();
}

async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetchWithRefresh(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status})`);
  return res.json();
}

/**
 * One-time upgrade path: if this browser still has data from before the backend
 * migration (old client-namespaced localStorage keys) and the server has nothing yet
 * for this restaurant, push the local copy up once, then clear it so it never runs
 * again or drifts out of sync with the server copy.
 */
async function migrateLegacyLocalData(): Promise<void> {
  const restaurantId = localStorage.getItem('biq_restaurant_id');
  if (!restaurantId) return;

  const legacyBilling = get<BillingEntry[]>(LEGACY_KEYS.billing) ?? [];
  const legacyMenu = get<MenuItem[]>(LEGACY_KEYS.menu) ?? [];
  const legacyReports = get<Report[]>(LEGACY_KEYS.reports) ?? [];
  const legacyOpportunities = get<Opportunity[]>(LEGACY_KEYS.opportunities) ?? [];
  const legacyRestaurant = get<Restaurant>(LEGACY_KEYS.restaurant);

  if (!legacyBilling.length && !legacyMenu.length && !legacyReports.length && !legacyOpportunities.length && !legacyRestaurant) return;

  try {
    const serverBilling = await apiGet<BillingEntry[]>('/api/billing');
    if (serverBilling.length > 0) return; // server already has real data — don't clobber it

    if (legacyBilling.length) await apiSend('/api/billing', 'POST', legacyBilling);
    if (legacyMenu.length) await apiSend('/api/menu', 'PUT', legacyMenu);
    // Reports were stored newest-first; insert oldest-first so server insertion order matches history.
    for (const report of [...legacyReports].reverse()) {
      await apiSend('/api/reports', 'POST', report);
    }
    if (legacyOpportunities.length) await apiSend('/api/opportunities', 'POST', legacyOpportunities);
    if (legacyRestaurant) {
      const serverProfile = await apiGet<Restaurant | null>('/api/restaurant-profile');
      if (!serverProfile) await apiSend('/api/restaurant-profile', 'PUT', legacyRestaurant);
    }

    remove(LEGACY_KEYS.billing);
    remove(LEGACY_KEYS.menu);
    remove(LEGACY_KEYS.reports);
    remove(LEGACY_KEYS.opportunities);
    remove(LEGACY_KEYS.restaurant);
  } catch (error) {
    console.error('Legacy data migration failed — will retry on next login:', error);
  }
}

/**
 * Call once after login/signup, and once on app boot if already authenticated.
 *
 * Uses allSettled, not all: these 5 requests are independent resources, and an
 * `all`-with-one-throw wipes out every cache (nothing gets assigned), not just the
 * one that failed. That turned a single unavailable endpoint into "this session
 * can't restaurant-profile / has no menu / has no billing" simultaneously — this
 * is exactly how a version-skewed or partially-deployed backend (missing one new
 * route/table) manifested as "app keeps bouncing back to onboarding," even though
 * the other 4 endpoints were healthy the whole time. Each resource now succeeds or
 * fails independently; a failed one keeps its previous cached value (or null) and
 * is retried on the next hydrate(), instead of dragging the healthy ones down.
 */
export async function hydrate(): Promise<void> {
  if (!localStorage.getItem('biq_auth_token')) return;
  await migrateLegacyLocalData();
  const [billing, menu, reports, opportunities, restaurantProfile] = await Promise.allSettled([
    apiGet<BillingEntry[]>('/api/billing'),
    apiGet<MenuItem[]>('/api/menu'),
    apiGet<Report[]>('/api/reports'),
    apiGet<Opportunity[]>('/api/opportunities'),
    apiGet<Restaurant | null>('/api/restaurant-profile'),
  ]);
  if (billing.status === 'fulfilled') billingCache = billing.value;
  else console.error('Failed to load billing:', billing.reason);
  if (menu.status === 'fulfilled') menuCache = menu.value;
  else console.error('Failed to load menu:', menu.reason);
  if (reports.status === 'fulfilled') reportsCache = reports.value;
  else console.error('Failed to load reports:', reports.reason);
  if (opportunities.status === 'fulfilled') opportunitiesCache = opportunities.value;
  else console.error('Failed to load opportunities:', opportunities.reason);
  if (restaurantProfile.status === 'fulfilled') restaurantProfileCache = restaurantProfile.value;
  else console.error('Failed to load restaurant profile:', restaurantProfile.reason);
}

/** Clears the in-memory cache on logout so the next login's hydrate() starts clean. */
export function resetCache(): void {
  billingCache = null;
  menuCache = null;
  reportsCache = null;
  opportunitiesCache = null;
  restaurantProfileCache = null;
}

export const storage = {
  // Server-backed (see hydrate()) — so "has this restaurant finished onboarding"
  // is a fact about the account, not the browser. Read stays sync off the cache,
  // same pattern as menu/billing.
  getRestaurant: (): Restaurant | null => restaurantProfileCache,
  setRestaurant: async (r: Restaurant): Promise<boolean> => {
    try {
      await apiSend('/api/restaurant-profile', 'PUT', r);
      restaurantProfileCache = r;
      return true;
    } catch (error) {
      console.error('Failed to save restaurant profile:', error);
      return false;
    }
  },

  getMenu: (): MenuItem[] => menuCache ?? [],
  setMenu: async (items: MenuItem[]): Promise<boolean> => {
    try {
      await apiSend('/api/menu', 'PUT', items);
      menuCache = items;
      return true;
    } catch (error) {
      console.error('Failed to save menu:', error);
      return false;
    }
  },

  getBilling: (): BillingEntry[] => billingCache ?? [],
  /**
   * Adds new rows to existing history; the server dedupes identical (date, time, dish,
   * quantity, price) rows. Sent in chunks, not one request — a single large POS export
   * (e.g. ~16,800 rows / ~2.3MB as JSON) exceeds the server's `express.json({limit:"2mb"})`
   * body-size cap on its own, which previously surfaced as a generic "could not reach the
   * server" failure (a 413 PayloadTooLargeError, not a network/auth failure). Each chunk
   * comfortably clears that cap even for verbose POS data with long dish names.
   */
  appendBilling: async (newEntries: BillingEntry[]): Promise<{ added: number; total: number; ok: boolean }> => {
    const CHUNK_SIZE = 3000;
    const chunks: BillingEntry[][] = [];
    for (let i = 0; i < newEntries.length; i += CHUNK_SIZE) chunks.push(newEntries.slice(i, i + CHUNK_SIZE));
    if (chunks.length === 0) chunks.push([]); // still round-trip once so `total` reflects the server, same as before chunking existed

    try {
      let added = 0;
      let total = billingCache?.length ?? 0;
      for (const chunk of chunks) {
        const res = await apiSend<{ added: number; total: number }>('/api/billing', 'POST', chunk);
        added += res.added;
        total = res.total;
      }
      billingCache = await apiGet<BillingEntry[]>('/api/billing');
      return { added, total, ok: true };
    } catch (error) {
      console.error('Failed to append billing data:', error);
      return { added: 0, total: billingCache?.length ?? 0, ok: false };
    }
  },
  clearBilling: async (): Promise<void> => {
    try {
      await apiSend('/api/billing', 'DELETE');
      billingCache = [];
    } catch (error) {
      console.error('Failed to clear billing data:', error);
    }
  },

  getReports: (): Report[] => reportsCache ?? [],
  appendReport: async (report: Report): Promise<void> => {
    try {
      await apiSend('/api/reports', 'POST', report);
      reportsCache = await apiGet<Report[]>('/api/reports');
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  },

  getChat: (): ChatMessage[] => get<ChatMessage[]>(KEYS.chat) ?? [],
  appendChat: (msg: ChatMessage) => {
    const existing = get<ChatMessage[]>(KEYS.chat) ?? [];
    set(KEYS.chat, [...existing, msg].slice(-100));
  },
  clearChat: () => remove(KEYS.chat),

  // ML: Ingredient mappings
  getIngredientMappings: (): IngredientMapping[] =>
    get<IngredientMapping[]>(KEYS.ingredientMappings) ?? [],
  setIngredientMappings: (mappings: IngredientMapping[]) =>
    set(KEYS.ingredientMappings, mappings),

  // ML: Wastage log (actuals)
  getWastageLog: (): WastagePrediction[] =>
    get<WastagePrediction[]>(KEYS.wastageLog) ?? [],
  appendWastageLog: (entry: WastagePrediction) => {
    const existing = get<WastagePrediction[]>(KEYS.wastageLog) ?? [];
    set(KEYS.wastageLog, [...existing, entry].slice(-500));
  },

  // ML: Pricing recommendations
  getPricingRecs: (): PricingRecommendation[] =>
    get<PricingRecommendation[]>(KEYS.pricingRecs) ?? [],
  setPricingRecs: (recs: PricingRecommendation[]) => set(KEYS.pricingRecs, recs),

  // ML: Promotions
  getPromotions: (): PromotionRecord[] =>
    get<PromotionRecord[]>(KEYS.promotions) ?? [],
  setPromotions: (promos: PromotionRecord[]) => set(KEYS.promotions, promos),
  addPromotion: (promo: PromotionRecord) => {
    const existing = get<PromotionRecord[]>(KEYS.promotions) ?? [];
    set(KEYS.promotions, [...existing, promo]);
  },
  updatePromotion: (promo: PromotionRecord) => {
    const existing = get<PromotionRecord[]>(KEYS.promotions) ?? [];
    set(KEYS.promotions, existing.map(p => p.id === promo.id ? promo : p));
  },

  // Opportunity Engine
  getOpportunities: (): Opportunity[] => opportunitiesCache ?? [],
  /** Full replace — mirrors the old contract. All scoring/dedup/expiry logic lives in opportunityEngine.ts. */
  setOpportunities: async (opportunities: Opportunity[]): Promise<void> => {
    try {
      await apiSend('/api/opportunities', 'POST', opportunities);
      opportunitiesCache = opportunities;
    } catch (error) {
      console.error('Failed to save opportunities:', error);
    }
  },
  updateOpportunityStatus: async (id: string, status: OpportunityStatus): Promise<void> => {
    try {
      await apiSend(`/api/opportunities/${id}`, 'PATCH', { status });
      const today = new Date().toISOString().slice(0, 10);
      opportunitiesCache = (opportunitiesCache ?? []).map(o => o.id === id
        ? { ...o, status, actedOnDate: status === 'acted_on' ? today : o.actedOnDate }
        : o);
    } catch (error) {
      console.error('Failed to update opportunity status:', error);
    }
  },

  // Forecast Accuracy Tracking — no client-side cache; ForecastPage fetches fresh.
  getForecastAccuracySeries: (): Promise<ForecastAccuracyPoint[]> =>
    apiGet<ForecastAccuracyPoint[]>('/api/forecast-accuracy'),
  getForecastAccuracyRaw: (): Promise<ForecastAccuracyEntry[]> =>
    apiGet<ForecastAccuracyEntry[]>('/api/forecast-accuracy/raw'),
  syncForecastAccuracy: async (
    inserts: { date: string; dishName: string; predictedValue: number }[],
    updates: { id: string; actualValue: number; absoluteError: number }[]
  ): Promise<void> => {
    try {
      await apiSend('/api/forecast-accuracy', 'POST', { inserts, updates });
    } catch (error) {
      console.error('Failed to sync forecast accuracy:', error);
    }
  },

  // Test Data Generator ("Generate Next Day" testing tool) — generate() only
  // previews and holds data server-side; confirm() inserts it (refreshing the
  // billing cache exactly like appendBilling does) and hands back the rows so
  // the caller can run them through the rest of the real import pipeline.
  generateNextDayTestData: (): Promise<{ requestId: string; date: string; totalOrders: number; totalRevenue: number; rowCount: number }> =>
    apiSend('/api/test-data/generate-next-day', 'POST'),
  confirmNextDayTestData: async (requestId: string): Promise<{ added: number; total: number; entries: BillingEntry[] }> => {
    const result = await apiSend<{ added: number; total: number; entries: BillingEntry[] }>(
      '/api/test-data/confirm-next-day', 'POST', { requestId }
    );
    billingCache = await apiGet<BillingEntry[]>('/api/billing');
    return result;
  },
  discardNextDayTestData: async (requestId: string): Promise<void> => {
    await apiSend('/api/test-data/discard-next-day', 'POST', { requestId });
  },

  // Trained Demand Model (GradientBoostingRegressor) — runs alongside the WMA
  // baseline in forecasting.ts, does not replace it. Not cached: always fresh.
  trainDemandModel: async (): Promise<TrainSummary> => {
    const res = await fetchWithRefresh('/api/forecast/train', { method: 'POST', headers: authHeaders() });
    return res.json();
  },
  compareForecast: (dish: string, date: string): Promise<CompareResult> =>
    apiGet<CompareResult>(`/api/forecast/compare?dish=${encodeURIComponent(dish)}&date=${encodeURIComponent(date)}`),

  clearAll: async (): Promise<void> => {
    Object.values(KEYS).forEach(k => remove(k));
    try {
      await Promise.all([
        apiSend('/api/billing', 'DELETE'),
        apiSend('/api/menu', 'PUT', []),
        apiSend('/api/reports', 'DELETE'),
        apiSend('/api/opportunities', 'POST', []),
      ]);
    } catch (error) {
      console.error('Failed to clear server-side restaurant data:', error);
    }
    billingCache = [];
    menuCache = [];
    reportsCache = [];
    opportunitiesCache = [];
  },
};

// Re-export type for convenience
export type { IngredientMapping };
