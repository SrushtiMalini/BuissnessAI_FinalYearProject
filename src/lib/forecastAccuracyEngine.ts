/**
 * Forecast Accuracy Tracker — records every forecast the WMA model makes and later
 * checks it against what actually happened, so real improvement-over-time history
 * accumulates. Reuses runWMAForecast from forecasting.ts unchanged; this module only
 * decides what to persist and when. Call once after any billing data save/import
 * (same trigger point as generateOpportunities).
 */

import type { BillingEntry } from '../types';
import { runWMAForecast } from './forecasting';
import { storage } from './storage';

export async function trackForecastAccuracy(billing: BillingEntry[]): Promise<void> {
  const raw = await storage.getForecastAccuracyRaw();

  // Actual quantity sold per (date, dish), from the billing history we have now.
  const actualQtyByDateDish = new Map<string, number>();
  for (const e of billing) {
    const key = `${e.date}|${e.dishName}`;
    actualQtyByDateDish.set(key, (actualQtyByDateDish.get(key) ?? 0) + e.quantity);
  }

  // Step a: backfill any previously-stored forecast whose date now has real data.
  const updates = raw
    .filter(r => r.actualValue === null && actualQtyByDateDish.has(`${r.date}|${r.dishName}`))
    .map(r => {
      const actual = actualQtyByDateDish.get(`${r.date}|${r.dishName}`)!;
      return { id: r.id, actualValue: actual, absoluteError: Math.abs(r.predictedValue - actual) };
    });

  // Step b: record a fresh 7-day forecast, skipping (date, dish) pairs already on file
  // (so a repeated run the same day doesn't insert duplicates).
  const forecast = runWMAForecast(billing, 7);
  const alreadyForecast = new Set(raw.map(r => `${r.date}|${r.dishName}`));
  const inserts = forecast.dishForecasts.flatMap(df =>
    df.forecasts
      .filter(f => !alreadyForecast.has(`${f.date}|${df.dishName}`))
      .map(f => ({ date: f.date, dishName: df.dishName, predictedValue: f.predicted }))
  );

  if (updates.length || inserts.length) {
    await storage.syncForecastAccuracy(inserts, updates);
  }
}
