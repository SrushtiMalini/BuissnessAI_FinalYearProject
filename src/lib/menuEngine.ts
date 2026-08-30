import type { MenuItem, BillingEntry, MenuQuadrant } from '../types';

/** A menu is "locked" once it has at least one item — from that point on, new billing rows
 *  are matched against it instead of silently expanding it (see matchAgainstLockedMenu). */
export function isMenuLocked(menu: MenuItem[]): boolean {
  return menu.length > 0;
}

export interface MenuMatchResult {
  matched: BillingEntry[];
  unmatched: BillingEntry[];
  unmatchedDishNames: string[];
}

/**
 * Matches billing rows against a restaurant's already-locked menu (used by UploadPage's
 * unmatched-dish confirmation for both manual CSV upload and the manual "Import Today's
 * Sales" trigger). A dish name with no case/whitespace-insensitive match in `menu` is held
 * out as "unmatched" instead of silently expanding the menu, so the owner explicitly
 * decides whether it's a real new dish or a POS naming mismatch/typo before it's imported.
 */
export function matchAgainstLockedMenu(entries: BillingEntry[], menu: MenuItem[]): MenuMatchResult {
  const menuNames = new Set(menu.map(m => m.name.trim().toLowerCase()));
  const matched: BillingEntry[] = [];
  const unmatched: BillingEntry[] = [];
  const unmatchedNamesByKey = new Map<string, string>(); // case/whitespace-insensitive key -> first-seen display casing
  for (const e of entries) {
    const key = e.dishName.trim().toLowerCase();
    if (menuNames.has(key)) {
      matched.push(e);
    } else {
      unmatched.push(e);
      if (!unmatchedNamesByKey.has(key)) unmatchedNamesByKey.set(key, e.dishName.trim());
    }
  }
  return { matched, unmatched, unmatchedDishNames: [...unmatchedNamesByKey.values()] };
}

export interface DishMetrics {
  name: string;
  totalQuantity: number;
  totalRevenue: number;
  rawMaterialCost: number;
  contributionMargin: number;
  marginPct: number;
  menuItem?: MenuItem;
}

export function computeDishMetrics(entries: BillingEntry[], menu: MenuItem[]): DishMetrics[] {
  const menuMap = new Map(menu.map(m => [m.name.toLowerCase(), m]));
  const map = new Map<string, { qty: number; rev: number }>();

  for (const e of entries) {
    const agg = map.get(e.dishName) ?? { qty: 0, rev: 0 };
    agg.qty += e.quantity;
    agg.rev += e.sellingPrice * e.quantity;
    map.set(e.dishName, agg);
  }

  return [...map.entries()].map(([name, { qty, rev }]) => {
    const menuItem = menuMap.get(name.toLowerCase());
    const rawMaterialCost = menuItem ? menuItem.rawMaterialCost * qty : 0;
    const contributionMargin = rev - rawMaterialCost;
    const marginPct = rev > 0 ? (contributionMargin / rev) * 100 : 0;
    return { name, totalQuantity: qty, totalRevenue: rev, rawMaterialCost, contributionMargin, marginPct, menuItem };
  });
}

export function classifyMenu(metrics: DishMetrics[]): MenuQuadrant {
  if (!metrics.length) return { star: [], hiddenGem: [], volumeTrap: [], deadWeight: [] };

  const avgQty = metrics.reduce((s, m) => s + m.totalQuantity, 0) / metrics.length;
  const avgMarginPct = metrics.reduce((s, m) => s + m.marginPct, 0) / metrics.length;

  const result: MenuQuadrant = { star: [], hiddenGem: [], volumeTrap: [], deadWeight: [] };

  for (const m of metrics) {
    const highSales = m.totalQuantity >= avgQty;
    const highMargin = m.marginPct >= avgMarginPct;
    const menuItem: MenuItem = m.menuItem ?? {
      id: m.name,
      name: m.name,
      sellingPrice: m.totalRevenue / (m.totalQuantity || 1),
      rawMaterialCost: 0,
    };

    if (highSales && highMargin) result.star.push(menuItem);
    else if (!highSales && highMargin) result.hiddenGem.push(menuItem);
    else if (highSales && !highMargin) result.volumeTrap.push(menuItem);
    else result.deadWeight.push(menuItem);
  }

  return result;
}

// ─── Owner resolution of unmatched dishes (UploadPage's confirmation panel) ──

export type UnmatchedDishResolution =
  | { action: 'add'; sellingPrice: number; rawMaterialCost: number }
  | { action: 'exclude' };

export interface ResolvedImport {
  /** Originally-matched rows plus rows for dishes the owner just added to the menu. */
  entriesToSave: BillingEntry[];
  /** New menu items to append to the existing (otherwise untouched) menu. */
  newMenuItems: MenuItem[];
  /** Rows left out because the owner marked that dish "not from this restaurant". */
  excluded: { name: string; rowCount: number }[];
}

/**
 * Applies the owner's explicit per-dish decision from the unmatched-dish
 * confirmation panel to a MenuMatchResult. Every name in
 * `match.unmatchedDishNames` must have an entry in `resolutions` — a dish with
 * no resolution is silently skipped (excluded from both save and menu) rather
 * than guessed at, so callers must enforce full resolution before calling this.
 */
export function applyDishResolutions(
  match: MenuMatchResult,
  existingMenu: MenuItem[],
  resolutions: Record<string, UnmatchedDishResolution>
): ResolvedImport {
  const newMenuItems: MenuItem[] = [];
  const excluded: { name: string; rowCount: number }[] = [];
  const addedKeys = new Set<string>();

  for (const name of match.unmatchedDishNames) {
    const resolution = resolutions[name];
    if (!resolution) continue;
    const key = name.trim().toLowerCase();
    const rowCount = match.unmatched.filter(e => e.dishName.trim().toLowerCase() === key).length;

    if (resolution.action === 'exclude') {
      excluded.push({ name, rowCount });
      continue;
    }

    addedKeys.add(key);
    const existingIds = new Set([...existingMenu, ...newMenuItems].map(m => m.id));
    const idBase = key.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'dish';
    const id = existingIds.has(idBase) ? `${idBase}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : idBase;
    newMenuItems.push({ id, name: name.trim(), sellingPrice: resolution.sellingPrice, rawMaterialCost: resolution.rawMaterialCost });
  }

  const entriesToSave = [
    ...match.matched,
    ...match.unmatched.filter(e => addedKeys.has(e.dishName.trim().toLowerCase())),
  ];

  return { entriesToSave, newMenuItems, excluded };
}

export function getMenuProfitabilityInsight(quadrant: MenuQuadrant): string {
  const insights: string[] = [];
  if (quadrant.star.length) insights.push(`${quadrant.star.length} star dish${quadrant.star.length > 1 ? 'es' : ''} (protect these)`);
  if (quadrant.hiddenGem.length) insights.push(`${quadrant.hiddenGem.length} hidden gem${quadrant.hiddenGem.length > 1 ? 's' : ''} (promote these more)`);
  if (quadrant.volumeTrap.length) insights.push(`${quadrant.volumeTrap.length} volume trap${quadrant.volumeTrap.length > 1 ? 's' : ''} (consider repricing)`);
  if (quadrant.deadWeight.length) insights.push(`${quadrant.deadWeight.length} dead weight item${quadrant.deadWeight.length > 1 ? 's' : ''} (consider removing)`);
  return insights.join(', ');
}
