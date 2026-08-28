import type {
  Restaurant, MenuItem, BillingEntry, Report, ChatMessage,
  IngredientMapping, WastagePrediction, PricingRecommendation,
  PromotionRecord, Opportunity, OpportunityStatus,
} from '../types';

// Local-only keys. Billing/menu/reports/opportunities live on the server now (see below) —
// they are NOT namespaced client-side anymore; the server scopes every query by the
// restaurantId it reads from the verified JWT, which is what makes tenant isolation real.
const KEYS = {
  restaurant: 'biq_restaurant',
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

let billingCache: BillingEntry[] | null = null;
let menuCache: MenuItem[] | null = null;
let reportsCache: Report[] | null = null;
let opportunitiesCache: Opportunity[] | null = null;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('biq_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return res.json();
}

async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
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

  if (!legacyBilling.length && !legacyMenu.length && !legacyReports.length && !legacyOpportunities.length) return;

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

    remove(LEGACY_KEYS.billing);
    remove(LEGACY_KEYS.menu);
    remove(LEGACY_KEYS.reports);
    remove(LEGACY_KEYS.opportunities);
  } catch (error) {
    console.error('Legacy data migration failed — will retry on next login:', error);
  }
}

/** Call once after login/signup, and once on app boot if already authenticated. */
export async function hydrate(): Promise<void> {
  if (!localStorage.getItem('biq_auth_token')) return;
  try {
    await migrateLegacyLocalData();
    const [billing, menu, reports, opportunities] = await Promise.all([
      apiGet<BillingEntry[]>('/api/billing'),
      apiGet<MenuItem[]>('/api/menu'),
      apiGet<Report[]>('/api/reports'),
      apiGet<Opportunity[]>('/api/opportunities'),
    ]);
    billingCache = billing;
    menuCache = menu;
    reportsCache = reports;
    opportunitiesCache = opportunities;
  } catch (error) {
    console.error('Failed to load restaurant data from the server:', error);
  }
}

/** Clears the in-memory cache on logout so the next login's hydrate() starts clean. */
export function resetCache(): void {
  billingCache = null;
  menuCache = null;
  reportsCache = null;
  opportunitiesCache = null;
}

export const storage = {
  getRestaurant: () => get<Restaurant>(KEYS.restaurant),
  setRestaurant: (r: Restaurant) => set(KEYS.restaurant, r),

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
  /** Adds new rows to existing history; the server dedupes identical (date, time, dish, quantity, price) rows. */
  appendBilling: async (newEntries: BillingEntry[]): Promise<{ added: number; total: number; ok: boolean }> => {
    try {
      const { added, total } = await apiSend<{ added: number; total: number }>('/api/billing', 'POST', newEntries);
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
