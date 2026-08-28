import { describe, test, expect } from 'vitest';
import { runWastagePredictions, analyzeWastage } from './wastagePredictor';
import type { BillingEntry, MenuItem } from '../../types';

// 14 consecutive days (2026-08-06 .. 2026-08-19, a Thu..Wed span) with constant
// quantity=10/day for "Thali". Target date 2026-08-20 is a Thursday, not a weekend,
// not a festival, not within 2 days of one (the festival table has nothing between
// 2026-01-26 and later), and not month-end (Aug has 31 days, threshold is >=29) —
// so every multiplier in forecastDishDemand is neutral and only the Newsvendor
// formula itself is exercised.
function flatThaliHistory(days = 14, qty = 10): BillingEntry[] {
  const out: BillingEntry[] = [];
  const start = new Date('2026-08-19T00:00:00Z');
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - i);
    out.push({ id: `t${i}`, date: d.toISOString().slice(0, 10), dishName: 'Thali', quantity: qty, sellingPrice: 0 });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

describe('runWastagePredictions — Newsvendor model (hand-calculated)', () => {
  const entries = flatThaliHistory(14, 10);
  const menu: MenuItem[] = [{ id: 'thali', name: 'Thali', sellingPrice: 100, rawMaterialCost: 40 }];

  test('constant demand (avg=10, std=0): critical ratio 0.6 -> z≈0.2533, recommends prep=10 vs usual=12', () => {
    const preds = runWastagePredictions(entries, menu, '2026-08-20');
    const thali = preds.find(p => p.dishName === 'Thali')!;
    expect(thali).toBeDefined();
    // forecastedDemand = 10 (weighted avg of two constant Thursdays, all multipliers neutral)
    // CR = (100-40)/100 = 0.6 -> normalInverseCDF(0.6) ≈ 0.253347
    // q = 10 + 0.253347 * max(std=0, 10*0.15=1.5) = 10 + 0.380... -> round = 10
    expect(thali.recommendedPrepQty).toBe(10);
    // usualPrep = round(avgQty*1.15) = round(11.5) = 12
    expect(thali.usualPrepQty).toBe(12);
    expect(thali.predictedWasteQty).toBe(2); // 12 - 10
    expect(thali.predictedWasteRupees).toBe(80); // 2 * rawCost(40)
    expect(thali.estimatedSaving).toBe(80);
    expect(thali.confidence).toBe('low'); // 14 days < 30
    expect(thali.preventionAction).toBe('Reduce preparation batch size.');
  });
});

describe('runWastagePredictions — minimum-data thresholds', () => {
  const menu: MenuItem[] = [{ id: 'thali', name: 'Thali', sellingPrice: 100, rawMaterialCost: 40 }];

  test('fewer than 14 total billing rows -> []', () => {
    const entries = flatThaliHistory(13, 10);
    expect(runWastagePredictions(entries, menu, '2026-08-20')).toEqual([]);
  });

  test('a dish with fewer than 7 distinct days of its own history is excluded even if entries.length>=14', () => {
    const entries = [
      ...flatThaliHistory(6, 10), // only 6 days for Thali
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `o${i}`, date: `2026-08-${String(1 + i).padStart(2, '0')}`,
        dishName: 'Other', quantity: 5, sellingPrice: 50,
      })),
    ];
    const preds = runWastagePredictions(entries, menu, '2026-08-20');
    expect(preds.find(p => p.dishName === 'Thali')).toBeUndefined();
  });
});

describe('runWastagePredictions — single-data-point edge case', () => {
  test('a single billing row (below the 14-row threshold) returns [] without crashing', () => {
    const entries: BillingEntry[] = [{ id: '1', date: '2026-08-19', dishName: 'Thali', quantity: 10, sellingPrice: 100 }];
    const menu: MenuItem[] = [{ id: 'thali', name: 'Thali', sellingPrice: 100, rawMaterialCost: 40 }];
    expect(runWastagePredictions(entries, menu, '2026-08-20')).toEqual([]);
  });
});

describe('runWastagePredictions — zero-price edge case', () => {
  test('sellingPrice=0 hits the "no profitable range" branch: optimal qty = forecasted demand exactly', () => {
    const entries = flatThaliHistory(14, 10);
    const menu: MenuItem[] = [{ id: 'thali', name: 'Thali', sellingPrice: 0, rawMaterialCost: 40 }];
    const preds = runWastagePredictions(entries, menu, '2026-08-20');
    const thali = preds.find(p => p.dishName === 'Thali')!;
    expect(thali).toBeDefined();
    // unitRevenue(0) <= unitCost(40) -> newsvendorOptimalQty returns meanDemand (10) directly
    expect(thali.recommendedPrepQty).toBe(10);
    expect(thali.usualPrepQty).toBe(12);
    expect(thali.estimatedSaving).toBe(80); // rawCost still 40 (menuItem?.rawMaterialCost, price doesn't affect it)
  });
});

describe('analyzeWastage — minimum-data threshold', () => {
  test('fewer than 14 days of history returns the empty-shape result', () => {
    const entries = flatThaliHistory(10, 10);
    const menu: MenuItem[] = [{ id: 'thali', name: 'Thali', sellingPrice: 100, rawMaterialCost: 40 }];
    expect(analyzeWastage(entries, menu)).toEqual({
      topWasteDishes: [], totalWeeklyWasteRupees: 0, totalMonthlyWasteRupees: 0, wasteAsPctRevenue: 0, dailyWaste30d: [],
    });
  });
});
