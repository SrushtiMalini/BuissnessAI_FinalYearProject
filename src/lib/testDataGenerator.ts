/**
 * Test Data Generator — powers the "Generate Next Day" testing tool (UploadPage's
 * Testing Tools section / POST /api/test-data/generate-next-day). Produces one
 * plausible day of sales for a restaurant's own locked menu — never invented dish
 * names — so the team can watch ML forecasts and Opportunity Engine recommendations
 * evolve day by day without waiting for real time to pass or hand-building CSVs.
 */

import { randomUUID } from 'crypto';
import type { BillingEntry, MenuItem } from '../types';
import { isWeekend, isFestival, addDays } from './ml/features';

const MEAL_PERIOD_SPLIT: { period: NonNullable<BillingEntry['mealPeriod']>; share: number; time: string }[] = [
  { period: 'breakfast', share: 0.2, time: '08:30' },
  { period: 'lunch', share: 0.45, time: '13:00' },
  { period: 'dinner', share: 0.35, time: '20:00' },
];

const WEEKEND_MULTIPLIER = 1.25;
const FESTIVAL_MULTIPLIER = 1.4;
const NOISE_RANGE = 0.2; // order-count jitter: +/-20% around the baseline
const PRICE_FLUCTUATION = 0.05; // selling-price jitter: +/-5% around the menu price
const NO_HISTORY_BASE_MIN = 3;
const NO_HISTORY_BASE_MAX = 15;

function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Next day to generate: one day after the most recent billing date on file, or today if there's no history yet. */
export function determineNextDate(billing: BillingEntry[]): string {
  const lastDate = billing.reduce((max, e) => (e.date > max ? e.date : max), '');
  return lastDate ? addDays(lastDate, 1) : new Date().toISOString().slice(0, 10);
}

function historicalDailyQuantities(billing: BillingEntry[], dishKey: string): number[] {
  const byDate = new Map<string, number>();
  for (const e of billing) {
    if (normalizedName(e.dishName) !== dishKey) continue;
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.quantity);
  }
  return [...byDate.values()];
}

/**
 * Generates one realistic day of sales for `nextDate`, using only dishes present in
 * `menu`. Order counts lean on each dish's historical daily average where billing
 * history exists, bumped for weekends/festivals and jittered with random noise; a dish
 * with no sales history yet falls back to a plausible baseline range. Selling price
 * fluctuates a few percent around the dish's menu price, same as real day-to-day
 * pricing variance (taxes rounding, small discounts, etc).
 */
export function generateNextDayEntries(menu: MenuItem[], billing: BillingEntry[], nextDate: string): BillingEntry[] {
  const dayMultiplier = (isWeekend(nextDate) ? WEEKEND_MULTIPLIER : 1) * (isFestival(nextDate) ? FESTIVAL_MULTIPLIER : 1);
  const entries: BillingEntry[] = [];

  for (const item of menu) {
    const history = historicalDailyQuantities(billing, normalizedName(item.name));
    const baseline = history.length
      ? history.reduce((s, v) => s + v, 0) / history.length
      : randomInRange(NO_HISTORY_BASE_MIN, NO_HISTORY_BASE_MAX);

    const noise = 1 + randomInRange(-NOISE_RANGE, NOISE_RANGE);
    const totalQty = Math.max(1, Math.round(baseline * dayMultiplier * noise));

    let remaining = totalQty;
    MEAL_PERIOD_SPLIT.forEach((slot, i) => {
      const isLast = i === MEAL_PERIOD_SPLIT.length - 1;
      const qty = isLast ? remaining : Math.min(remaining, Math.round(totalQty * slot.share));
      remaining -= qty;
      if (qty <= 0) return;

      const priceJitter = 1 + randomInRange(-PRICE_FLUCTUATION, PRICE_FLUCTUATION);
      const sellingPrice = Math.max(1, Math.round(item.sellingPrice * priceJitter));

      entries.push({
        id: randomUUID(),
        date: nextDate,
        time: slot.time,
        dishName: item.name,
        quantity: qty,
        sellingPrice,
        mealPeriod: slot.period,
      });
    });
  }

  return entries;
}
