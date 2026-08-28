import { describe, test, expect } from 'vitest';
import { runDynamicPricing, estimateMonthlySavings } from './dynamicPricing';
import type { BillingEntry, MenuItem } from '../../types';

// Helper: N entries for one dish, one per distinct date, so "days of data" == N.
function daysOf(dishName: string, n: number, quantity = 1, price = 100): BillingEntry[] {
  const out: BillingEntry[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(2026, 0, 1 + i).toISOString().slice(0, 10);
    out.push({ id: `${dishName}-${i}`, date: d, dishName, quantity, sellingPrice: price });
  }
  return out;
}

describe('runDynamicPricing — Lerner markup rule (fallback price-tier elasticity branch)', () => {
  // Only 2 menu items => dishStats.size < 3 => the cross-sectional OLS branch is skipped
  // and estimateElasticity falls back to the fixed price-tier elasticity table, which is
  // fully hand-calculable.
  const menu: MenuItem[] = [
    { id: 'burger', name: 'Burger', sellingPrice: 200, rawMaterialCost: 80 }, // >150 tier -> ε = -1.8
    { id: 'tea', name: 'Tea', sellingPrice: 50, rawMaterialCost: 15 },        // <=80 tier -> ε = -0.9
  ];
  const entries = [...daysOf('Burger', 10), ...daysOf('Tea', 35)];

  const recs = runDynamicPricing(entries, menu);

  test('elastic dish (Burger, ε=-1.8): Lerner price P*=C·|ε|/(|ε|-1), rounded to nearest ₹5', () => {
    const burger = recs.find(r => r.dishName === 'Burger')!;
    expect(burger).toBeDefined();
    // P* = 80 * 1.8 / 0.8 = 180 (within [minPrice=80/0.65=123.08, maxPrice=260])
    expect(burger.recommendedPrice).toBe(180);
    expect(burger.elasticity).toBe(-1.8);
    // priceDiffPct = (180-200)/200*100 = -10; demandChangePct = -1.8*-10 = 18
    expect(burger.projectedDemandChangePct).toBe(18);
    // newRevenue = 180*(1+18/100) = 212.4; revenueChangePct = (212.4-200)/200*100 = 6.2
    expect(burger.projectedRevenueChangePct).toBe(6.2);
    // days=10 < 30 -> low confidence
    expect(burger.confidence).toBe('low');
  });

  test('inelastic dish (Tea, ε=-0.9): raises price by 15%, rounded to nearest ₹5', () => {
    const tea = recs.find(r => r.dishName === 'Tea')!;
    expect(tea).toBeDefined();
    // P* = 50*1.15 = 57.49999999999999 (JS float) -> round(11.499999...)*5 = 11*5 = 55
    expect(tea.recommendedPrice).toBe(55);
    expect(tea.elasticity).toBe(-0.9);
    // priceDiffPct = (55-50)/50*100 = 10; demandChangePct = -0.9*10 = -9
    expect(tea.projectedDemandChangePct).toBe(-9);
    // newRevenue = 55*(1-0.09) = 50.05; revenueChangePct = (50.05-50)/50*100 = 0.1
    expect(tea.projectedRevenueChangePct).toBe(0.1);
    // days=35 >= 30 -> medium confidence
    expect(tea.confidence).toBe('medium');
  });

  test('recommendations are ranked by |projectedRevenueChangePct| descending', () => {
    expect(recs.map(r => r.dishName)).toEqual(['Burger', 'Tea']);
  });
});

describe('runDynamicPricing — insufficient-data / empty-input thresholds', () => {
  const menu: MenuItem[] = [{ id: 'x', name: 'X', sellingPrice: 100, rawMaterialCost: 40 }];

  test('no billing entries -> []', () => {
    expect(runDynamicPricing([], menu)).toEqual([]);
  });

  test('no menu items -> []', () => {
    expect(runDynamicPricing(daysOf('X', 10), [])).toEqual([]);
  });
});

describe('runDynamicPricing — zero/negative price or cost edge cases', () => {
  test('menu item with sellingPrice <= 0 is skipped entirely', () => {
    const menu: MenuItem[] = [{ id: 'free', name: 'Free Sample', sellingPrice: 0, rawMaterialCost: 10 }];
    const recs = runDynamicPricing(daysOf('Free Sample', 10), menu);
    expect(recs.find(r => r.dishName === 'Free Sample')).toBeUndefined();
  });

  test('menu item with rawMaterialCost <= 0 is skipped entirely', () => {
    const menu: MenuItem[] = [{ id: 'gift', name: 'Gift Item', sellingPrice: 100, rawMaterialCost: 0 }];
    const recs = runDynamicPricing(daysOf('Gift Item', 10), menu);
    expect(recs.find(r => r.dishName === 'Gift Item')).toBeUndefined();
  });

  test('menu item priced at or below its cost (P<=C) is skipped', () => {
    const menu: MenuItem[] = [{ id: 'loss', name: 'Loss Leader', sellingPrice: 50, rawMaterialCost: 60 }];
    const recs = runDynamicPricing(daysOf('Loss Leader', 10), menu);
    expect(recs.find(r => r.dishName === 'Loss Leader')).toBeUndefined();
  });
});

describe('runDynamicPricing — single-data-point edge case', () => {
  test('a single billing row still produces a recommendation via the fallback elasticity branch', () => {
    const menu: MenuItem[] = [{ id: 'burger', name: 'Burger', sellingPrice: 200, rawMaterialCost: 80 }];
    const entries: BillingEntry[] = [{ id: '1', date: '2026-01-01', dishName: 'Burger', quantity: 1, sellingPrice: 200 }];
    const recs = runDynamicPricing(entries, menu);
    const burger = recs.find(r => r.dishName === 'Burger')!;
    expect(burger).toBeDefined();
    expect(burger.elasticity).toBe(-1.8);
    expect(burger.recommendedPrice).toBe(180);
    // 1 day of data -> low confidence
    expect(burger.confidence).toBe('low');
  });
});

describe('estimateMonthlySavings', () => {
  test('projects a single dish/single day recommendation out to a 30-day month', () => {
    const entries: BillingEntry[] = [{ id: '1', date: '2026-01-01', dishName: 'X', quantity: 5, sellingPrice: 100 }];
    const rec = {
      dishId: 'x', dishName: 'X', currentPrice: 100, recommendedPrice: 110, elasticity: -0.5,
      projectedRevenueChangePct: 10, projectedDemandChangePct: 0, confidence: 'low' as const,
      reasoning: '', isApplied: false,
    };
    // monthlyQty = (1 entry / 1 unique date) * 30 = 30
    // currentMonthlyRevenue = 100*30 = 3000; projected = 3000*1.10 = 3300; savings = 300
    expect(estimateMonthlySavings([rec], entries)).toBe(300);
  });
});
