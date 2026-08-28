import type { BillingEntry, MenuItem, DailySummary } from '../types';
import { getDailySummaries, getTopDishes, getWeeklyComparison, computeKPIs } from './analytics';
import { computeDishMetrics, classifyMenu, getMenuProfitabilityInsight } from './menuEngine';
import { callAI } from './aiClient';

function fmt(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function buildReportContext(
  entries: BillingEntry[],
  menu: MenuItem[],
  targetDate?: string
): string {
  if (!entries.length) return 'No billing data available yet.';

  const summaries = getDailySummaries(entries, menu);
  const kpis = computeKPIs(summaries);
  const weekly = getWeeklyComparison(summaries);
  const topDishes = getTopDishes(entries, 5);
  const dishMetrics = computeDishMetrics(entries, menu);
  const quadrant = classifyMenu(dishMetrics);
  const menuInsight = getMenuProfitabilityInsight(quadrant);

  const today = targetDate ?? summaries[summaries.length - 1]?.date ?? 'today';
  const todaySummary = summaries.find(s => s.date === today) ?? summaries[summaries.length - 1];

  const lines: string[] = [
    `RESTAURANT BUSINESS DATA (as of ${today})`,
    '',
    '=== TODAY\'S PERFORMANCE ===',
  ];

  if (todaySummary) {
    lines.push(`Revenue: ${fmt(todaySummary.totalRevenue)}`);
    lines.push(`Orders: ${todaySummary.totalOrders}`);
    lines.push(`Gross Profit: ${fmt(todaySummary.grossProfit)}`);
    lines.push(`Food Cost %: ${todaySummary.foodCostPct.toFixed(1)}% (industry benchmark: 30%)`);
    lines.push(`Top dishes today: ${todaySummary.topDishes.map(d => `${d.name} (${d.quantity} plates)`).join(', ')}`);
  }

  lines.push('', '=== WEEKLY OVERVIEW ===');
  lines.push(`This week revenue: ${fmt(weekly.thisWeek)}`);
  lines.push(`Last week revenue: ${fmt(weekly.lastWeek)}`);
  lines.push(`Change: ${weekly.pctChange >= 0 ? '+' : ''}${weekly.pctChange.toFixed(1)}%`);

  lines.push('', '=== TOP DISHES (all time) ===');
  topDishes.forEach((d, i) => {
    lines.push(`${i + 1}. ${d.name}: ${d.quantity} plates, ${fmt(d.revenue)}`);
  });

  lines.push('', '=== MENU PROFITABILITY ===');
  lines.push(menuInsight);
  if (quadrant.star.length) lines.push(`Stars: ${quadrant.star.map(m => m.name).join(', ')}`);
  if (quadrant.hiddenGem.length) lines.push(`Hidden Gems (promote!): ${quadrant.hiddenGem.map(m => m.name).join(', ')}`);
  if (quadrant.volumeTrap.length) lines.push(`Volume Traps (reprice): ${quadrant.volumeTrap.map(m => m.name).join(', ')}`);
  if (quadrant.deadWeight.length) lines.push(`Dead Weight (consider removing): ${quadrant.deadWeight.map(m => m.name).join(', ')}`);

  lines.push('', '=== OVERALL KPIs ===');
  lines.push(`Total revenue (all time): ${fmt(kpis.totalRevenue)}`);
  lines.push(`Average daily revenue: ${fmt(kpis.avgDailyRevenue)}`);
  lines.push(`Average food cost %: ${kpis.avgFoodCost.toFixed(1)}%`);
  if (kpis.bestDay) lines.push(`Best day: ${kpis.bestDay.date} (${fmt(kpis.bestDay.totalRevenue)})`);

  return lines.join('\n');
}

export interface AIReportResult {
  text: string;
  error?: string;
}

export async function generateDailyReport(
  entries: BillingEntry[],
  menu: MenuItem[],
  restaurantName: string,
  type: 'morning' | 'evening' = 'evening',
  targetDate?: string
): Promise<AIReportResult> {
  const context = buildReportContext(entries, menu, targetDate);
  const instruction = type === 'evening'
    ? `You are a friendly AI business analyst for "${restaurantName}". Based on the data below, generate an end-of-day business report. Include: overall performance verdict (strong/decent/weak day), key wins, one or two specific things that need attention, and a short actionable suggestion for tomorrow. Write in plain, warm, human language. Do not use bullet points. Keep it under 200 words. End by asking how the day felt from the owner's perspective.`
    : `You are a friendly AI business analyst for "${restaurantName}". Based on the data below, generate a morning brief. Include: yesterday's performance summary, what to expect today based on patterns, and one specific preparation tip for today. Write in plain, warm language. Under 150 words.`;

  const result = await callAI('/api/ai/report', {
    context: `${instruction}\n\n${context}`,
  });

  return result.error ? { text: '', error: result.error } : { text: result.text };
}
