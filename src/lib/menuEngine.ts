import type { MenuItem, BillingEntry, MenuQuadrant } from '../types';

export function buildMenuFromBilling(entries: BillingEntry[], existingMenu: MenuItem[]): MenuItem[] {
  const menuMap = new Map<string, MenuItem>(existingMenu.map(m => [m.name.trim().toLowerCase(), m]));
  const dishPrices = new Map<string, number[]>();

  for (const e of entries) {
    const key = e.dishName.trim().toLowerCase();
    const prices = dishPrices.get(key) ?? [];
    prices.push(e.sellingPrice);
    dishPrices.set(key, prices);
  }

  const result: MenuItem[] = [];
  for (const [key, prices] of dishPrices.entries()) {
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    const existing = menuMap.get(key);
    if (existing) {
      result.push(existing);
    } else {
      const avgPrice = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
      const rawMaterialCost = Math.round(avgPrice * 0.35);
      const idBase = key.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const id = existingMenu.some(m => m.id === idBase) || result.some(m => m.id === idBase)
        ? `${idBase}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        : idBase;
      result.push({ id, name, sellingPrice: avgPrice, rawMaterialCost });
    }
  }

  return result;
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

export function getMenuProfitabilityInsight(quadrant: MenuQuadrant): string {
  const insights: string[] = [];
  if (quadrant.star.length) insights.push(`${quadrant.star.length} star dish${quadrant.star.length > 1 ? 'es' : ''} (protect these)`);
  if (quadrant.hiddenGem.length) insights.push(`${quadrant.hiddenGem.length} hidden gem${quadrant.hiddenGem.length > 1 ? 's' : ''} (promote these more)`);
  if (quadrant.volumeTrap.length) insights.push(`${quadrant.volumeTrap.length} volume trap${quadrant.volumeTrap.length > 1 ? 's' : ''} (consider repricing)`);
  if (quadrant.deadWeight.length) insights.push(`${quadrant.deadWeight.length} dead weight item${quadrant.deadWeight.length > 1 ? 's' : ''} (consider removing)`);
  return insights.join(', ');
}
