/**
 * Opportunity Engine — synthesis/orchestration layer over the 5 existing analytical
 * modules (Menu Engineering, Dynamic Pricing, Wastage Prediction, Promotion Analysis,
 * and simple week-over-week trend detection). It does not reimplement any of their
 * math — it calls their existing exported functions and reads their existing output
 * shapes, then scores, ranks, and turns the results into plain-English recommendations.
 */

import type {
  BillingEntry, MenuItem, Opportunity, OpportunitySignalType, PromotionRecord,
} from '../types';
import { computeDishMetrics, classifyMenu } from './menuEngine';
import { runDynamicPricing } from './ml/dynamicPricing';
import { runWastagePredictions } from './ml/wastagePredictor';
import { analyzePromotion } from './ml/promotionAnalyzer';
import { getSortedDates, addDays } from './ml/features';
import { storage } from './storage';

const CONFIDENCE_WEIGHT: Record<Opportunity['confidence'], number> = { high: 1.0, medium: 0.6, low: 0.3 };
const TREND_THRESHOLD_PCT = 20;
const TREND_MIN_BASELINE_REVENUE = 100; // ignore dishes too small to matter
const WASTAGE_MIN_SAVING = 50;
const MAX_NEW_OPPORTUNITIES_PER_RUN = 5;
const EXPIRE_AFTER_DAYS = 14;
const OUTCOME_CHECK_AFTER_DAYS = 7;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86400000);
}

function fmtCurrency(n: number): string {
  return `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
}

function revenueByDish(entries: BillingEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.dishName, (map.get(e.dishName) ?? 0) + e.sellingPrice * e.quantity);
  return map;
}

function quadrantOf(dishName: string, quadrant: ReturnType<typeof classifyMenu>): keyof ReturnType<typeof classifyMenu> | null {
  for (const key of ['star', 'hiddenGem', 'volumeTrap', 'deadWeight'] as const) {
    if (quadrant[key].some(m => m.name === dishName)) return key;
  }
  return null;
}

const QUADRANT_LABEL: Record<string, string> = {
  star: 'a Star dish', hiddenGem: 'a Hidden Gem', volumeTrap: 'a Volume Trap', deadWeight: 'Dead Weight',
};

interface Candidate {
  dishName: string;
  signalType: OpportunitySignalType;
  recommendationText: string;
  projectedImpact: number;
  confidence: Opportunity['confidence'];
}

/** Signal 1: last-7-days vs prior-7-days revenue per dish, flagged at +/-20%. */
function detectTrendSignals(billing: BillingEntry[], menu: MenuItem[]): Candidate[] {
  const sortedDates = getSortedDates(billing);
  if (sortedDates.length < 14) return [];

  const latest = sortedDates[sortedDates.length - 1];
  const last7Start = addDays(latest, -6);
  const prior7End = addDays(last7Start, -1);
  const prior7Start = addDays(prior7End, -6);

  const last7 = billing.filter(e => e.date >= last7Start && e.date <= latest);
  const prior7 = billing.filter(e => e.date >= prior7Start && e.date <= prior7End);
  if (!prior7.length) return [];

  const last7Rev = revenueByDish(last7);
  const prior7Rev = revenueByDish(prior7);
  const currentQuadrant = classifyMenu(computeDishMetrics(last7, menu));

  const candidates: Candidate[] = [];
  for (const [dishName, priorRev] of prior7Rev) {
    if (priorRev < TREND_MIN_BASELINE_REVENUE) continue;
    const curRev = last7Rev.get(dishName) ?? 0;
    const pctChange = ((curRev - priorRev) / priorRev) * 100;
    if (Math.abs(pctChange) < TREND_THRESHOLD_PCT) continue;

    const daysOfData = new Set(billing.filter(e => e.dishName === dishName).map(e => e.date)).size;
    const confidence: Opportunity['confidence'] = daysOfData >= 30 ? 'high' : daysOfData >= 14 ? 'medium' : 'low';
    const quadrantKey = quadrantOf(dishName, currentQuadrant);
    const quadrantLabel = quadrantKey ? QUADRANT_LABEL[quadrantKey] : 'on your menu';

    if (pctChange >= TREND_THRESHOLD_PCT) {
      const impact = curRev - priorRev;
      const action = quadrantKey === 'deadWeight' || quadrantKey === 'volumeTrap'
        ? 'consider featuring it more prominently while demand is up'
        : 'protect its placement and stock levels';
      candidates.push({
        dishName, signalType: 'trending_up', projectedImpact: Math.round(impact), confidence,
        recommendationText: `${dishName} sales are up ${pctChange.toFixed(0)}% this week. It's ${quadrantLabel} — ${action} for an estimated +${fmtCurrency(impact)}/week.`,
      });
    } else {
      const impact = priorRev - curRev;
      candidates.push({
        dishName, signalType: 'trending_down', projectedImpact: Math.round(impact), confidence,
        recommendationText: `${dishName} sales are down ${Math.abs(pctChange).toFixed(0)}% this week. It's ${quadrantLabel} — investigate why before you lose an estimated ${fmtCurrency(impact)}/week for good.`,
      });
    }
  }
  return candidates;
}

/** Signal 2: quadrant membership this week vs the prior week, flagged only for moves into/out of Star. */
function detectQuadrantShiftSignals(billing: BillingEntry[], menu: MenuItem[]): Candidate[] {
  const sortedDates = getSortedDates(billing);
  if (sortedDates.length < 14) return [];

  const latest = sortedDates[sortedDates.length - 1];
  const last7Start = addDays(latest, -6);
  const prior7End = addDays(last7Start, -1);
  const prior7Start = addDays(prior7End, -6);

  const last7 = billing.filter(e => e.date >= last7Start && e.date <= latest);
  const prior7 = billing.filter(e => e.date >= prior7Start && e.date <= prior7End);
  if (!prior7.length) return [];

  const curMetrics = computeDishMetrics(last7, menu);
  const priorMetrics = computeDishMetrics(prior7, menu);
  const curQuadrant = classifyMenu(curMetrics);
  const priorQuadrant = classifyMenu(priorMetrics);

  const candidates: Candidate[] = [];
  for (const m of curMetrics) {
    const priorHasIt = priorMetrics.some(p => p.name === m.name);
    if (!priorHasIt) continue;

    const curKey = quadrantOf(m.name, curQuadrant);
    const priorKey = quadrantOf(m.name, priorQuadrant);
    if (!curKey || !priorKey || curKey === priorKey) continue;
    if (curKey !== 'star' && priorKey !== 'star') continue; // only care about moves into/out of Star

    const movedIn = curKey === 'star';
    const impact = movedIn ? m.contributionMargin : (priorMetrics.find(p => p.name === m.name)?.contributionMargin ?? 0);
    candidates.push({
      dishName: m.name,
      signalType: 'quadrant_shift',
      projectedImpact: Math.round(Math.abs(impact)),
      confidence: 'medium',
      recommendationText: movedIn
        ? `${m.name} moved from ${QUADRANT_LABEL[priorKey]} to Star this week — protect it and keep it visible on the menu (~${fmtCurrency(impact)}/week in contribution margin).`
        : `${m.name} dropped out of Star into ${QUADRANT_LABEL[curKey]} this week — investigate before you lose ~${fmtCurrency(impact)}/week in contribution margin.`,
    });
  }
  return candidates;
}

/** Signal 3: existing Dynamic Pricing output, positive-impact recs not already applied via the Pricing page. */
function detectPricingSignals(billing: BillingEntry[], menu: MenuItem[]): Candidate[] {
  const recs = runDynamicPricing(billing, menu);
  const appliedDishNames = new Set(storage.getPricingRecs().filter(r => r.isApplied).map(r => r.dishName));
  const totalDays = Math.max(1, getSortedDates(billing).length);

  const candidates: Candidate[] = [];
  for (const rec of recs) {
    if (rec.projectedRevenueChangePct <= 0 || appliedDishNames.has(rec.dishName)) continue;
    const dishRevenue = billing
      .filter(e => e.dishName === rec.dishName)
      .reduce((s, e) => s + e.sellingPrice * e.quantity, 0);
    const weeklyBaseline = (dishRevenue / totalDays) * 7;
    const impact = weeklyBaseline * (rec.projectedRevenueChangePct / 100);
    candidates.push({
      dishName: rec.dishName,
      signalType: 'pricing',
      projectedImpact: Math.round(Math.abs(impact)),
      confidence: rec.confidence,
      recommendationText: `${rec.dishName} can support a price change to ₹${rec.recommendedPrice} with minimal demand impact (${rec.projectedRevenueChangePct >= 0 ? '+' : ''}${fmtCurrency(impact)}/week projected).`,
    });
  }
  return candidates;
}

/** Signal 4: existing Wastage Prediction output, above a small ₹ threshold. */
function detectWastageSignals(billing: BillingEntry[], menu: MenuItem[]): Candidate[] {
  const predictions = runWastagePredictions(billing, menu);
  return predictions
    .filter(p => p.estimatedSaving >= WASTAGE_MIN_SAVING)
    .map(p => ({
      dishName: p.dishName,
      signalType: 'wastage' as const,
      projectedImpact: Math.round(p.estimatedSaving * 7), // estimatedSaving is a per-day figure; project to a week
      confidence: p.confidence,
      recommendationText: `Reduce ${p.dishName} prep from ${p.usualPrepQty} to ${p.recommendedPrepQty} units/day to save an estimated ${fmtCurrency(p.estimatedSaving * 7)}/week in wastage.`,
    }));
}

/** Signal 5: existing Promotion Analysis output, "repeat" verdicts. */
function detectPromotionSignals(billing: BillingEntry[], promotions: PromotionRecord[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const promo of promotions) {
    const result = analyzePromotion(billing, promo);
    if (!result || result.recommendation !== 'repeat') continue;

    const baselineRows = result.analysisData.filter(d => !d.isPromotion);
    const baselineDailyAvg = baselineRows.length
      ? baselineRows.reduce((s, d) => s + d.revenue, 0) / baselineRows.length
      : 0;
    const impact = baselineDailyAvg * 7 * (result.revenueImpactPct / 100);

    candidates.push({
      dishName: promo.affectedDishes.length === 1 ? promo.affectedDishes[0] : promo.name,
      signalType: 'promotion',
      projectedImpact: Math.round(Math.abs(impact)),
      confidence: result.isSignificant ? 'high' : result.pValue < 0.3 ? 'medium' : 'low',
      recommendationText: `"${promo.name}" drove ${result.revenueImpactPct >= 0 ? '+' : ''}${result.revenueImpactPct.toFixed(1)}% revenue last time — repeat it for an estimated +${fmtCurrency(impact)}/week.`,
    });
  }
  return candidates;
}

export function scoreOf(o: Pick<Opportunity, 'projectedImpact' | 'confidence'>): number {
  return o.projectedImpact * CONFIDENCE_WEIGHT[o.confidence];
}

/**
 * Detects signals across all 5 modules, ranks the top 5 newly-detected ones, appends
 * them to storage (never touching existing acted_on/dismissed/expired records),
 * expires stale "new" opportunities, and resolves outcomes for "acted_on" ones that
 * are old enough to measure. Call this once after any billing data save/import.
 */
export async function generateOpportunities(billing: BillingEntry[], menu: MenuItem[]): Promise<Opportunity[]> {
  const existing = storage.getOpportunities();
  const today = todayISO();

  // Expire stale "new" opportunities.
  const withExpiry = existing.map(o =>
    o.status === 'new' && daysBetween(o.createdDate, today) > EXPIRE_AFTER_DAYS
      ? { ...o, status: 'expired' as const }
      : o
  );

  // Resolve outcomes for "acted_on" opportunities old enough to measure.
  const withOutcomes = withExpiry.map(o => {
    if (o.status !== 'acted_on' || o.outcome !== null || !o.actedOnDate) return o;
    if (daysBetween(o.actedOnDate, today) < OUTCOME_CHECK_AFTER_DAYS) return o;

    const afterStart = o.actedOnDate;
    const afterEnd = addDays(afterStart, 6);
    const beforeEnd = addDays(afterStart, -1);
    const beforeStart = addDays(beforeEnd, -6);

    const afterEntries = billing.filter(e => e.dishName === o.dishName && e.date >= afterStart && e.date <= afterEnd);
    const beforeEntries = billing.filter(e => e.dishName === o.dishName && e.date >= beforeStart && e.date <= beforeEnd);
    if (!afterEntries.length) return o; // not enough post-action data yet, try again next run

    const afterRev = afterEntries.reduce((s, e) => s + e.sellingPrice * e.quantity, 0);
    const beforeRev = beforeEntries.reduce((s, e) => s + e.sellingPrice * e.quantity, 0);
    const actualImpact = Math.round(afterRev - beforeRev);

    return { ...o, outcome: actualImpact, resolvedDate: today };
  });

  // Detect fresh candidates from all 5 signal sources.
  const promotions = storage.getPromotions();
  const candidates: Candidate[] = [
    ...detectTrendSignals(billing, menu),
    ...detectQuadrantShiftSignals(billing, menu),
    ...detectPricingSignals(billing, menu),
    ...detectWastageSignals(billing, menu),
    ...detectPromotionSignals(billing, promotions),
  ];

  // Dedup: skip a candidate if a "live" (new/acted_on) opportunity already covers this dish+signal.
  const liveKeys = new Set(
    withOutcomes.filter(o => o.status === 'new' || o.status === 'acted_on').map(o => `${o.dishName}|${o.signalType}`)
  );
  const fresh = candidates.filter(c => !liveKeys.has(`${c.dishName}|${c.signalType}`));

  // Score, rank, take top 5.
  const ranked = fresh
    .sort((a, b) => scoreOf(b) - scoreOf(a))
    .slice(0, MAX_NEW_OPPORTUNITIES_PER_RUN);

  const newOpportunities: Opportunity[] = ranked.map(c => ({
    id: `${today}-${c.signalType}-${c.dishName}-${Math.random().toString(36).slice(2, 8)}`,
    dishName: c.dishName,
    signalType: c.signalType,
    recommendationText: c.recommendationText,
    projectedImpact: c.projectedImpact,
    confidence: c.confidence,
    status: 'new',
    createdDate: today,
    resolvedDate: null,
    outcome: null,
    actedOnDate: null,
  }));

  const finalList = [...withOutcomes, ...newOpportunities];
  await storage.setOpportunities(finalList);
  return finalList;
}
