import type { BillingEntry, MenuItem, DailySummary } from '../types';

export function groupByDate(entries: BillingEntry[]): Record<string, BillingEntry[]> {
  return entries.reduce<Record<string, BillingEntry[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});
}

export function getDailySummaries(
  entries: BillingEntry[],
  menu: MenuItem[]
): DailySummary[] {
  const menuMap = new Map(menu.map(m => [m.name.toLowerCase(), m]));
  const byDate = groupByDate(entries);

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => {
      const dishTotals = new Map<string, { quantity: number; revenue: number }>();
      let totalRevenue = 0;
      let totalOrders = 0;
      let rawMaterialCost = 0;

      for (const row of rows) {
        totalRevenue += row.sellingPrice * row.quantity;
        totalOrders += row.quantity;
        const agg = dishTotals.get(row.dishName) ?? { quantity: 0, revenue: 0 };
        agg.quantity += row.quantity;
        agg.revenue += row.sellingPrice * row.quantity;
        dishTotals.set(row.dishName, agg);

        const menuItem = menuMap.get(row.dishName.toLowerCase());
        if (menuItem) rawMaterialCost += menuItem.rawMaterialCost * row.quantity;
      }

      const topDishes = [...dishTotals.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      const foodCostPct = totalRevenue > 0 ? (rawMaterialCost / totalRevenue) * 100 : 0;
      const grossProfit = totalRevenue - rawMaterialCost;

      return { date, totalRevenue, totalOrders, topDishes, foodCostPct, grossProfit };
    });
}

export function getRevenueByDay(summaries: DailySummary[], days = 30) {
  return summaries.slice(-days).map(s => ({
    date: s.date,
    revenue: s.totalRevenue,
    profit: s.grossProfit,
  }));
}

export function getTopDishes(entries: BillingEntry[], topN = 10) {
  const map = new Map<string, { quantity: number; revenue: number }>();
  for (const e of entries) {
    const agg = map.get(e.dishName) ?? { quantity: 0, revenue: 0 };
    agg.quantity += e.quantity;
    agg.revenue += e.sellingPrice * e.quantity;
    map.set(e.dishName, agg);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, topN);
}

export function getPeakHours(entries: BillingEntry[]) {
  const hourMap: Record<number, number> = {};
  for (let h = 0; h < 24; h++) hourMap[h] = 0;
  for (const e of entries) {
    if (!e.time) continue;
    const h = parseInt(e.time.split(':')[0], 10);
    if (!isNaN(h)) hourMap[h] = (hourMap[h] ?? 0) + e.quantity;
  }
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: hourMap[h] ?? 0 }));
}

export function getMealPeriodSplit(entries: BillingEntry[]) {
  const map: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, other: 0 };
  for (const e of entries) {
    const period = e.mealPeriod ?? 'other';
    map[period] += e.sellingPrice * e.quantity;
  }
  return map;
}

export function getWeeklyComparison(summaries: DailySummary[]) {
  const thisWeek = summaries.slice(-7).reduce((s, d) => s + d.totalRevenue, 0);
  const lastWeek = summaries.slice(-14, -7).reduce((s, d) => s + d.totalRevenue, 0);
  const pctChange = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;
  return { thisWeek, lastWeek, pctChange };
}

export function computeKPIs(summaries: DailySummary[]) {
  if (!summaries.length) return { avgDailyRevenue: 0, avgFoodCost: 0, bestDay: null, totalRevenue: 0 };
  const totalRevenue = summaries.reduce((s, d) => s + d.totalRevenue, 0);
  const avgDailyRevenue = totalRevenue / summaries.length;
  const avgFoodCost = summaries.reduce((s, d) => s + d.foodCostPct, 0) / summaries.length;
  const bestDay = summaries.reduce((best, d) => d.totalRevenue > best.totalRevenue ? d : best);
  return { avgDailyRevenue, avgFoodCost, bestDay, totalRevenue };
}
