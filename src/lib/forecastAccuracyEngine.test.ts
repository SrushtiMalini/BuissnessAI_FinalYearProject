import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { trackForecastAccuracy } from './forecastAccuracyEngine';
import { resetCache } from './storage';
import type { BillingEntry } from '../types';

// Stubs fetch with a tiny in-memory fake of the real /api/forecast-accuracy* server
// routes (whose actual SQL is covered against a real server in tests/api.test.ts).
// This lets trackForecastAccuracy's two-phase (backfill, then record) logic be
// exercised across multiple simulated days without a running server.
interface FakeRow { id: string; date: string; dishName: string; predictedValue: number; actualValue: number | null; absoluteError: number | null }

function stubForecastAccuracyServer() {
  let nextId = 1;
  const rows: FakeRow[] = [];

  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/forecast-accuracy/raw') {
      return { ok: true, status: 200, json: async () => rows.map(r => ({ ...r })) } as Response;
    }
    if (url === '/api/forecast-accuracy' && (!options || options.method === undefined)) {
      // GET aggregated series — not exercised by the engine itself, but keep it honest.
      const byDate = new Map<string, number[]>();
      for (const r of rows) {
        if (r.absoluteError === null) continue;
        byDate.set(r.date, [...(byDate.get(r.date) ?? []), r.absoluteError]);
      }
      const series = [...byDate.entries()].map(([date, errs]) => ({ date, mae: errs.reduce((a, b) => a + b, 0) / errs.length }));
      return { ok: true, status: 200, json: async () => series } as Response;
    }
    if (url === '/api/forecast-accuracy' && options?.method === 'POST') {
      const body = JSON.parse(options.body as string) as {
        inserts: { date: string; dishName: string; predictedValue: number }[];
        updates: { id: string; actualValue: number; absoluteError: number }[];
      };
      for (const i of body.inserts) {
        rows.push({ id: `f${nextId++}`, date: i.date, dishName: i.dishName, predictedValue: i.predictedValue, actualValue: null, absoluteError: null });
      }
      for (const u of body.updates) {
        const row = rows.find(r => r.id === u.id);
        if (row) { row.actualValue = u.actualValue; row.absoluteError = u.absoluteError; }
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  }));

  return { rows };
}

function dailyEntries(dishName: string, dates: string[], quantity: number, price = 100): BillingEntry[] {
  return dates.map((date, i) => ({ id: `${dishName}-${date}`, date, dishName, quantity, sellingPrice: price }));
}

beforeEach(() => {
  localStorage.clear();
  resetCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('trackForecastAccuracy — record then backfill across two days', () => {
  test('day 1: no prior data, so it only records new predictions with null actuals', async () => {
    const { rows } = stubForecastAccuracyServer();
    const dates = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'];
    const billing = dailyEntries('Biryani', dates, 10);

    await trackForecastAccuracy(billing);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.actualValue === null)).toBe(true);
    // Forecasts should be for the 7 days after the last known date (Aug 8–14).
    expect(rows.every(r => r.date > '2026-08-07' && r.date <= '2026-08-14')).toBe(true);
    expect(rows.every(r => r.dishName === 'Biryani')).toBe(true);
  });

  test('day 2: once a forecasted date has real billing data, that row is backfilled with actual + absolute error', async () => {
    const { rows } = stubForecastAccuracyServer();
    const day1Dates = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'];
    await trackForecastAccuracy(dailyEntries('Biryani', day1Dates, 10));

    const forecastedForAug8 = rows.find(r => r.date === '2026-08-08');
    expect(forecastedForAug8).toBeDefined();
    const predicted = forecastedForAug8!.predictedValue;

    // Day 2: real sales land for Aug 8 (12 units actually sold, not the predicted amount).
    const day2Billing = [...dailyEntries('Biryani', day1Dates, 10), ...dailyEntries('Biryani', ['2026-08-08'], 12)];
    await trackForecastAccuracy(day2Billing);

    const resolved = rows.find(r => r.date === '2026-08-08');
    expect(resolved!.actualValue).toBe(12);
    expect(resolved!.absoluteError).toBe(Math.abs(predicted - 12));

    // Rows for dates still in the future (no real data yet) remain unresolved.
    const stillPending = rows.filter(r => r.actualValue === null);
    expect(stillPending.length).toBeGreaterThan(0);

    // A new forecast day (Aug 15) should have been appended without re-inserting
    // the dates that were already on file (no duplicate rows per date+dish).
    const byDateDish = new Map<string, number>();
    for (const r of rows) {
      const key = `${r.date}|${r.dishName}`;
      byDateDish.set(key, (byDateDish.get(key) ?? 0) + 1);
    }
    expect([...byDateDish.values()].every(count => count === 1)).toBe(true);
    expect(rows.some(r => r.date === '2026-08-15')).toBe(true);
  });
});
