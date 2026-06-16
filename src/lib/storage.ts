import type { Restaurant, MenuItem, BillingEntry, Report, ChatMessage } from '../types';

const KEYS = {
  restaurant: 'biq_restaurant',
  menu: 'biq_menu',
  billing: 'biq_billing',
  reports: 'biq_reports',
  chat: 'biq_chat',
} as const;

function get<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function set<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  getRestaurant: () => get<Restaurant>(KEYS.restaurant),
  setRestaurant: (r: Restaurant) => set(KEYS.restaurant, r),

  getMenu: (): MenuItem[] => get<MenuItem[]>(KEYS.menu) ?? [],
  setMenu: (items: MenuItem[]) => set(KEYS.menu, items),

  getBilling: (): BillingEntry[] => get<BillingEntry[]>(KEYS.billing) ?? [],
  appendBilling: (entries: BillingEntry[]) => {
    const existing = get<BillingEntry[]>(KEYS.billing) ?? [];
    // Deduplicate by id
    const existingIds = new Set(existing.map(e => e.id));
    const newEntries = entries.filter(e => !existingIds.has(e.id));
    set(KEYS.billing, [...existing, ...newEntries]);
    return newEntries.length;
  },
  clearBilling: () => localStorage.removeItem(KEYS.billing),

  getReports: (): Report[] => get<Report[]>(KEYS.reports) ?? [],
  appendReport: (report: Report) => {
    const existing = get<Report[]>(KEYS.reports) ?? [];
    set(KEYS.reports, [report, ...existing].slice(0, 30)); // keep last 30
  },

  getChat: (): ChatMessage[] => get<ChatMessage[]>(KEYS.chat) ?? [],
  appendChat: (msg: ChatMessage) => {
    const existing = get<ChatMessage[]>(KEYS.chat) ?? [];
    set(KEYS.chat, [...existing, msg].slice(-100)); // keep last 100 messages
  },
  clearChat: () => localStorage.removeItem(KEYS.chat),

  clearAll: () => Object.values(KEYS).forEach(k => localStorage.removeItem(k)),
};
