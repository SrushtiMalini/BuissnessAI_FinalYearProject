import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateOpportunities, scoreOf } from './opportunityEngine';
import { storage, resetCache } from './storage';
import type { BillingEntry, MenuItem, Opportunity } from '../types';

// generateOpportunities awaits storage.setOpportunities(), which POSTs to
// /api/opportunities (the real dedupe/tenant-isolation guarantees for that endpoint
// are covered against a real server in tests/api.test.ts). Here we only need that
// network call to succeed so the in-memory cache updates — so fetch is stubbed to a
// blanket success for every call.
function stubFetchAlwaysOk() {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) } as Response)));
}

// Builds `days` consecutive daily entries for one dish at a constant quantity, ending
// on `endDate`, so "last 7 days vs prior 7 days" revenue windows are fully controlled.
function dailyEntries(dishName: string, endDate: string, days: number, quantity: number, price = 100): BillingEntry[] {
  const out: BillingEntry[] = [];
  const end = new Date(`${endDate}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    out.push({ id: `${dishName}-${i}`, date: d.toISOString().slice(0, 10), dishName, quantity, sellingPrice: price });
  }
  return out;
}

const menu: MenuItem[] = [
  { id: 'biryani', name: 'Biryani', sellingPrice: 100, rawMaterialCost: 40 },
  { id: 'rice', name: 'Rice', sellingPrice: 100, rawMaterialCost: 40 },
];

beforeEach(() => {
  localStorage.clear();
  resetCache();
  stubFetchAlwaysOk();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('generateOpportunities — trend signal detection', () => {
  test('a dish with >=20% week-over-week revenue increase produces a trending_up signal', async () => {
    // Biryani: prior 7 days @ qty 10/day (rev 1000/day, total 7000); last 7 days @ qty 13/day (rev 1300/day, total 9100) -> +30%
    const priorBiryani = dailyEntries('Biryani', '2026-08-12', 7, 10);
    const lastBiryani = dailyEntries('Biryani', '2026-08-19', 7, 13);
    const billing = [...priorBiryani, ...lastBiryani];

    const opportunities = await generateOpportunities(billing, menu);
    const signal = opportunities.find(o => o.dishName === 'Biryani' && o.signalType === 'trending_up');
    expect(signal).toBeDefined();
    expect(signal!.projectedImpact).toBe(2100); // 9100 - 7000
    expect(signal!.status).toBe('new');
  });

  test('a dish with an insignificant (<20%) change produces no trend signal', async () => {
    const priorRice = dailyEntries('Rice', '2026-08-12', 7, 10);
    const lastRice = dailyEntries('Rice', '2026-08-19', 7, 10.5); // +5%
    const billing = [...priorRice, ...lastRice];

    const opportunities = await generateOpportunities(billing, menu);
    expect(opportunities.find(o => o.dishName === 'Rice' && o.signalType === 'trending_up')).toBeUndefined();
    expect(opportunities.find(o => o.dishName === 'Rice' && o.signalType === 'trending_down')).toBeUndefined();
  });
});

describe('generateOpportunities — ranking', () => {
  test('higher-score candidates (projectedImpact * confidenceWeight) rank before lower-score ones', async () => {
    // DishA: +100% jump, 14 days of data -> confidence 'medium' (0.6). impact=7000. score=4200.
    const dishAPrior = dailyEntries('DishA', '2026-08-12', 7, 10);
    const dishALast = dailyEntries('DishA', '2026-08-19', 7, 20);
    // DishB: +25% jump, but 35 days of data -> confidence 'high' (1.0). impact=1750. score=1750.
    const dishBOld = dailyEntries('DishB', '2026-07-15', 21, 10); // padding history for confidence only
    const dishBPrior = dailyEntries('DishB', '2026-08-12', 7, 10);
    const dishBLast = dailyEntries('DishB', '2026-08-19', 7, 12.5);
    const billing = [...dishAPrior, ...dishALast, ...dishBOld, ...dishBPrior, ...dishBLast];

    // Empty menu: keeps the pricing/wastage detectors from emitting any candidates for
    // DishA/DishB (they iterate over `menu`, not billing), so the only candidates in play
    // are these 2 trend signals (plus, harmlessly, up to 2 quadrant_shift ones) — well
    // under MAX_NEW_OPPORTUNITIES_PER_RUN(5), so nothing gets cut from the ranking.
    const opportunities = await generateOpportunities(billing, []);
    const scored = opportunities.filter(o => o.status === 'new' && o.signalType === 'trending_up');
    expect(scored.map(o => o.dishName)).toEqual(['DishA', 'DishB']);
    expect(scoreOf(scored[0])).toBeGreaterThan(scoreOf(scored[1]));
  });
});

describe('generateOpportunities — expiry', () => {
  test('a "new" opportunity older than 14 days is marked expired; a 10-day-old one is not', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));

    const stale: Opportunity = {
      id: 'stale1', dishName: 'Old Dish', signalType: 'trending_up', recommendationText: 'x',
      projectedImpact: 500, confidence: 'medium', status: 'new', createdDate: '2026-08-05', // 15 days ago
      resolvedDate: null, outcome: null, actedOnDate: null,
    };
    const fresh: Opportunity = {
      ...stale, id: 'fresh1', dishName: 'Recent Dish', createdDate: '2026-08-10', // 10 days ago
    };
    await storage.setOpportunities([stale, fresh]);

    const result = await generateOpportunities([], []);
    expect(result.find(o => o.id === 'stale1')!.status).toBe('expired');
    expect(result.find(o => o.id === 'fresh1')!.status).toBe('new');
  });
});

describe('generateOpportunities — acted_on dedup', () => {
  test('re-running with the same live trend signal does not duplicate an already acted_on opportunity', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));

    const actedOn: Opportunity = {
      id: 'acted1', dishName: 'Biryani', signalType: 'trending_up', recommendationText: 'x',
      projectedImpact: 2100, confidence: 'medium', status: 'acted_on', createdDate: '2026-08-19',
      resolvedDate: null, outcome: null, actedOnDate: '2026-08-18', // within the 7-day outcome-check window
    };
    await storage.setOpportunities([actedOn]);

    const priorBiryani = dailyEntries('Biryani', '2026-08-12', 7, 10);
    const lastBiryani = dailyEntries('Biryani', '2026-08-19', 7, 13); // same +30% signal as before
    const billing = [...priorBiryani, ...lastBiryani];

    const result = await generateOpportunities(billing, menu);
    const biryaniTrendUp = result.filter(o => o.dishName === 'Biryani' && o.signalType === 'trending_up');
    expect(biryaniTrendUp).toHaveLength(1);
    expect(biryaniTrendUp[0].status).toBe('acted_on');
    expect(biryaniTrendUp[0].id).toBe('acted1');
  });
});

describe('scoreOf', () => {
  test('multiplies projected impact by the confidence weight', () => {
    expect(scoreOf({ projectedImpact: 1000, confidence: 'high' })).toBe(1000);
    expect(scoreOf({ projectedImpact: 1000, confidence: 'medium' })).toBe(600);
    expect(scoreOf({ projectedImpact: 1000, confidence: 'low' })).toBe(300);
  });
});
