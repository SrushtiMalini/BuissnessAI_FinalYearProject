import { describe, test, expect } from 'vitest';
import { analyzePromotion } from './promotionAnalyzer';
import type { BillingEntry, PromotionRecord } from '../../types';

// A perfect noiseless step function: flat baseline revenue/orders before and after
// the promo, with a clean jump during it. Because there is zero residual (an exact
// fit exists: intercept=baseline, time-trend=0, promo-jump=exact, after-drift=0), OLS
// finds that exact solution — so β2 (the promo coefficient) is hand-calculable exactly,
// not approximated.
//   before: 10 days @ revenue 1000/day (qty 10 @ price 100)
//   during: 3 days  @ revenue 1500/day (qty 15 @ price 100)
//   after:  7 days  @ revenue 1000/day (qty 10 @ price 100)
function stepFixture(): { entries: BillingEntry[]; promo: PromotionRecord } {
  const dates: string[] = [];
  const start = new Date('2026-08-01T00:00:00Z');
  for (let i = 0; i < 20; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const before = dates.slice(0, 10);
  const during = dates.slice(10, 13);
  const after = dates.slice(13, 20);

  const entries: BillingEntry[] = [
    ...before.map((date, i) => ({ id: `b${i}`, date, dishName: 'Combo', quantity: 10, sellingPrice: 100 })),
    ...during.map((date, i) => ({ id: `d${i}`, date, dishName: 'Combo', quantity: 15, sellingPrice: 100 })),
    ...after.map((date, i) => ({ id: `a${i}`, date, dishName: 'Combo', quantity: 10, sellingPrice: 100 })),
  ];

  const promo: PromotionRecord = {
    id: 'promo1', name: 'Combo Deal', startDate: during[0], endDate: during[during.length - 1],
    type: 'discount', discountValue: 10, affectedDishes: ['Combo'],
  };

  return { entries, promo };
}

describe('analyzePromotion — Interrupted Time Series / OLS (hand-calculated, exact fit)', () => {
  test('a clean revenue/order step during the promo yields exact β2 coefficients', () => {
    const { entries, promo } = stepFixture();
    const result = analyzePromotion(entries, promo)!;
    expect(result).toBeDefined();

    // revEffect = 1500-1000 = 500; baselineRevMean = 1000 -> revenueImpactPct = 50
    expect(result.revenueImpactPct).toBe(50);
    // ordEffect = 15-10 = 5; baselineOrdMean = 10 -> orderVolumeImpactPct = 50
    expect(result.orderVolumeImpactPct).toBe(50);
    // profitabilityImpactPct = revenueImpactPct(50) - discountValue(10) = 40
    expect(result.profitabilityImpactPct).toBe(40);
    // Near-zero residual (exact fit, modulo floating-point noise from Gaussian elimination)
    // drives SE and therefore p toward 0 -> highly significant.
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.isSignificant).toBe(true);
    // Perfect fit -> R² = 1
    expect(result.rSquared).toBe(1);
    expect(result.recommendation).toBe('repeat');
    expect(result.naturalLanguageFinding).toContain('increased profitability by 40.0%');
    expect(result.naturalLanguageFinding).toContain('+50.0%');
  });

  test('negative discountValue (a surcharge, not a discount) adds to profitability instead of subtracting', () => {
    const { entries, promo } = stepFixture();
    const result = analyzePromotion(entries, { ...promo, discountValue: -10 })!;
    expect(result.revenueImpactPct).toBe(50);
    expect(result.profitabilityImpactPct).toBe(60); // 50 - (-10)
    expect(result.recommendation).toBe('repeat');
  });
});

describe('analyzePromotion — minimum-data thresholds', () => {
  test('fewer than 14 total days of billing history -> null', () => {
    const { promo } = stepFixture();
    const shortEntries: BillingEntry[] = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`, date: `2026-08-${String(1 + i).padStart(2, '0')}`, dishName: 'Combo', quantity: 10, sellingPrice: 100,
    }));
    expect(analyzePromotion(shortEntries, promo)).toBeNull();
  });

  test('fewer than 7 days of pre-promo baseline -> null', () => {
    const { entries, promo } = stepFixture();
    // Drop all but 5 of the 10 "before" days, keep during/after intact (total still >= 14).
    const trimmed = entries.filter(e => e.date >= '2026-08-06');
    expect(analyzePromotion(trimmed, promo)).toBeNull();
  });

  test('fewer than 2 promo days -> null', () => {
    const { entries, promo } = stepFixture();
    const singleDayPromo = { ...promo, endDate: promo.startDate };
    expect(analyzePromotion(entries, singleDayPromo)).toBeNull();
  });
});

describe('analyzePromotion — single-data-point edge case', () => {
  test('a single billing row (well below the 14-day threshold) returns null without crashing', () => {
    const { promo } = stepFixture();
    const entries: BillingEntry[] = [{ id: '1', date: '2026-08-01', dishName: 'Combo', quantity: 10, sellingPrice: 100 }];
    expect(analyzePromotion(entries, promo)).toBeNull();
  });
});
