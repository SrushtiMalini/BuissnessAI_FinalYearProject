import type {
  Restaurant, MenuItem, BillingEntry, Report, ChatMessage,
  IngredientMapping, WastagePrediction, PricingRecommendation,
  PromotionRecord, Opportunity, OpportunityStatus,
} from '../types';

const KEYS = {
  restaurant: 'biq_restaurant',
  menu: 'biq_menu',
  billing: 'biq_billing',
  reports: 'biq_reports',
  chat: 'biq_chat',
  ingredientMappings: 'biq_ingredient_mappings',
  wastageLog: 'biq_wastage_log',
  pricingRecs: 'biq_pricing_recs',
  promotions: 'biq_promotions',
  opportunities: 'biq_opportunities',
} as const;

// Every key is namespaced by the logged-in restaurant so accounts never see each other's data.
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

// Identity for dedup: same date+time+dish+quantity+price is treated as the same row
// (protects against re-uploading the same day's export twice).
function billingRowKey(e: BillingEntry): string {
  return `${e.date}|${e.time ?? ''}|${e.dishName}|${e.quantity}|${e.sellingPrice}`;
}

export const storage = {
  getRestaurant: () => get<Restaurant>(KEYS.restaurant),
  setRestaurant: (r: Restaurant) => set(KEYS.restaurant, r),

  getMenu: (): MenuItem[] => get<MenuItem[]>(KEYS.menu) ?? [],
  setMenu: (items: MenuItem[]) => set(KEYS.menu, items),

  getBilling: (): BillingEntry[] => get<BillingEntry[]>(KEYS.billing) ?? [],
  /** Full replace. Not called by any upload/import path — those must use appendBilling. */
  setBilling: (entries: BillingEntry[]) => set(KEYS.billing, entries),
  /** Adds new rows to existing history, deduping identical (date, time, dish, quantity, price) rows. */
  appendBilling: (newEntries: BillingEntry[]): { added: number; total: number; ok: boolean } => {
    const existing = get<BillingEntry[]>(KEYS.billing) ?? [];
    const seen = new Set(existing.map(billingRowKey));
    const deduped: BillingEntry[] = [];
    for (const e of newEntries) {
      const key = billingRowKey(e);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(e);
    }
    const merged = [...existing, ...deduped];
    const ok = set(KEYS.billing, merged);
    return { added: deduped.length, total: ok ? merged.length : existing.length, ok };
  },
  clearBilling: () => remove(KEYS.billing),

  getReports: (): Report[] => get<Report[]>(KEYS.reports) ?? [],
  appendReport: (report: Report) => {
    const existing = get<Report[]>(KEYS.reports) ?? [];
    set(KEYS.reports, [report, ...existing].slice(0, 30));
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
  getOpportunities: (): Opportunity[] => get<Opportunity[]>(KEYS.opportunities) ?? [],
  setOpportunities: (opportunities: Opportunity[]) => set(KEYS.opportunities, opportunities),
  updateOpportunityStatus: (id: string, status: OpportunityStatus) => {
    const existing = get<Opportunity[]>(KEYS.opportunities) ?? [];
    const today = new Date().toISOString().slice(0, 10);
    set(KEYS.opportunities, existing.map(o => o.id === id
      ? { ...o, status, actedOnDate: status === 'acted_on' ? today : o.actedOnDate }
      : o));
  },

  clearAll: () => Object.values(KEYS).forEach(k => remove(k)),
};

// Re-export type for convenience
export type { IngredientMapping };
