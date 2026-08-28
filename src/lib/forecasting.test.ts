import { describe, test, expect } from 'vitest';
import { runWMAForecast } from './forecasting';
import type { BillingEntry } from '../types';

// Two full weeks (2026-08-03 Mon .. 2026-08-16 Sun). Week 1 revenue is a flat
// 1000/day; week 2 repeats that exactly except Sunday jumps to 1500. Since each
// day-of-week appears exactly once in "train" (week 1, sortedDates.slice(0,-7))
// and once in "test" (week 2, the last 7 days), the WMA of a single historical
// value is just that value (the weight cancels itself out) — so every backtested
// prediction equals week 1's same-weekday figure exactly, and the resulting
// MAE/RMSE are hand-calculable off a single non-zero error (Sunday, +500).
function twoWeekFixture(): BillingEntry[] {
  const week1Start = new Date('2026-08-03T00:00:00Z'); // Monday
  const entries: BillingEntry[] = [];
  for (let week = 0; week < 2; week++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(week1Start);
      date.setUTCDate(date.getUTCDate() + week * 7 + d);
      const iso = date.toISOString().slice(0, 10);
      const isSecondWeekSunday = week === 1 && d === 6;
      const quantity = isSecondWeekSunday ? 15 : 10;
      entries.push({ id: `${iso}`, date: iso, dishName: 'Coffee', quantity, sellingPrice: 100 });
    }
  }
  return entries;
}

describe('runWMAForecast — hand-calculated (14-day, one deviating day)', () => {
  const result = runWMAForecast(twoWeekFixture(), 7);

  test('backtest MAE/RMSE reflect the single +500 error on the repeated Sunday', () => {
    // errors: 6 days @ 0, 1 day @ 500 -> MAE = 500/7 = 71.43 -> round 71
    expect(result.mae).toBe(71);
    // RMSE = sqrt(500^2/7) = 189.0 -> round 189
    expect(result.rmse).toBe(189);
  });

  test('future forecast: unchanged days predict 1000, the Sunday slot uses both weeks weighted 0.4/0.3', () => {
    // Future Sunday (2026-08-23) has 2 historical Sundays: week1=1000, week2=1500.
    // wma weights most-recent-first: (1500*0.4 + 1000*0.3) / 0.7 = 900/0.7 = 1285.71 -> round 1286
    const sunday = result.totalRevenueForecast.find(f => f.date === '2026-08-23')!;
    expect(sunday).toBeDefined();
    expect(sunday.predicted).toBe(1286);

    const monday = result.totalRevenueForecast.find(f => f.date === '2026-08-17')!;
    expect(monday.predicted).toBe(1000);
  });

  test('per-dish forecast is present for the one dish in the fixture, 7 days out', () => {
    const dish = result.dishForecasts.find(d => d.dishName === 'Coffee')!;
    expect(dish).toBeDefined();
    expect(dish.forecasts).toHaveLength(7);
  });
});

describe('runWMAForecast — minimum-data threshold', () => {
  test('fewer than 7 distinct days of history returns the empty-shape result', () => {
    const entries: BillingEntry[] = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`, date: `2026-08-0${i + 1}`, dishName: 'Coffee', quantity: 10, sellingPrice: 100,
    }));
    const result = runWMAForecast(entries);
    expect(result.totalRevenueForecast).toEqual([]);
    expect(result.dishForecasts).toEqual([]);
    expect(result.mae).toBe(0);
    expect(result.rmse).toBe(0);
  });
});

describe('runWMAForecast — single-data-point edge case', () => {
  test('a single billing row (well below the 7-day threshold) returns the empty-shape result, not a crash', () => {
    const entries: BillingEntry[] = [{ id: '1', date: '2026-08-01', dishName: 'Coffee', quantity: 10, sellingPrice: 100 }];
    const result = runWMAForecast(entries);
    expect(result.totalRevenueForecast).toEqual([]);
    expect(result.mae).toBe(0);
  });
});

describe('runWMAForecast — zero-price edge case', () => {
  test('a day with zero revenue does not crash the WMA and forecasts 0 for its unique weekday', () => {
    // 7 days, day index 3 (2026-08-06, Thursday) has price=0 -> revenue 0 for that day,
    // and it is the ONLY Thursday in the 7-day history, so the weighted average for
    // future Thursdays is exactly that single 0 value.
    const entries: BillingEntry[] = Array.from({ length: 7 }, (_, i) => {
      const date = new Date('2026-08-03T00:00:00Z');
      date.setUTCDate(date.getUTCDate() + i);
      const iso = date.toISOString().slice(0, 10);
      const isZeroDay = i === 3;
      return { id: iso, date: iso, dishName: 'Coffee', quantity: isZeroDay ? 10 : 10, sellingPrice: isZeroDay ? 0 : 100 };
    });
    const result = runWMAForecast(entries, 7);
    const thursday = result.totalRevenueForecast.find(f => f.date === '2026-08-13')!;
    expect(thursday).toBeDefined();
    expect(thursday.predicted).toBe(0);
  });
});
