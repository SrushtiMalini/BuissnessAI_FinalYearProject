import { describe, test, expect } from 'vitest';
import { runIngredientForecast, computeIngredientForecastMetrics } from './ingredientForecast';
import type { BillingEntry, IngredientMapping } from '../../types';

// Same 14-day flat history trick as wastagePredictor.test.ts: constant quantity=5/day
// for "Dosa" over 2026-08-06..2026-08-19, forecasting a single day ahead (2026-08-20,
// a non-weekend/non-monthend Thursday) so the day-of-week weighted average and the
// 7d-vs-30d trend ratio both collapse to the historical constant exactly.
function flatDosaHistory(days = 14, qty = 5): BillingEntry[] {
  const out: BillingEntry[] = [];
  const start = new Date('2026-08-19T00:00:00Z');
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - i);
    out.push({ id: `d${i}`, date: d.toISOString().slice(0, 10), dishName: 'Dosa', quantity: qty, sellingPrice: 0 });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const mappings: IngredientMapping[] = [
  { dishId: 'dosa', dishName: 'Dosa', ingredients: [{ name: 'Rice Batter', quantityPerServing: 2, unit: 'kg' }] },
];

describe('runIngredientForecast — feature-weighted WMA (hand-calculated)', () => {
  test('constant historical demand + 1-day horizon: predicted=demand*1.08 (far-from-festival multiplier), +20% safety buffer', () => {
    const entries = flatDosaHistory(14, 5);
    const results = runIngredientForecast(entries, mappings, 1);
    const riceBatter = results.find(r => r.ingredientName === 'Rice Batter')!;
    expect(riceBatter).toBeDefined();
    // predictDishDemand: base=5 (constant weighted avg), trend ratio 7d/30d = 1 (no change),
    // festivalProximity() has no listed festival within range so it returns its 7-day sentinel,
    // which satisfies the `<= 7` branch -> base *= 1.08 -> 5.4 -> round -> 5
    // qty = predicted(5) * quantityPerServing(2) = 10; + 20% safety buffer -> ceil(12) = 12
    expect(riceBatter.dailyForecasts).toEqual([
      { date: '2026-08-20', predicted: 12, lower: 12, upper: 12 },
    ]);
    expect(riceBatter.totalNeeded).toBe(12);
    expect(riceBatter.confidence).toBe('low'); // 14 days < 30
  });
});

describe('runIngredientForecast — insufficient-data thresholds', () => {
  test('no billing entries -> []', () => {
    expect(runIngredientForecast([], mappings)).toEqual([]);
  });

  test('no ingredient mappings -> []', () => {
    expect(runIngredientForecast(flatDosaHistory(14, 5), [])).toEqual([]);
  });
});

describe('runIngredientForecast — single-data-point edge case', () => {
  test('a single historical row with no same-day-of-week match forecasts 0, not a crash', () => {
    // 2026-08-19 is a Wednesday; forecast target (2026-08-20, Thursday via daysAhead=1)
    // has zero same-day-of-week history, so predictDishDemand's early-return (0) kicks in.
    const entries: BillingEntry[] = [{ id: '1', date: '2026-08-19', dishName: 'Dosa', quantity: 5, sellingPrice: 0 }];
    const results = runIngredientForecast(entries, mappings, 1);
    expect(results).toEqual([
      { ingredientName: 'Rice Batter', unit: 'kg', dailyForecasts: [{ date: '2026-08-20', predicted: 0, lower: 0, upper: 0 }], totalNeeded: 0, confidence: 'low' },
    ]);
  });
});

describe('computeIngredientForecastMetrics — minimum-data threshold', () => {
  test('fewer than 14 days of history returns zeroed metrics with the actual day count', () => {
    const entries = flatDosaHistory(5, 5);
    expect(computeIngredientForecastMetrics(entries, mappings)).toEqual({ mae: 0, mape: 0, trainingDays: 5 });
  });
});
