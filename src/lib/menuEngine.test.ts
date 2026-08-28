import { describe, test, expect } from 'vitest';
import { buildMenuFromBilling, computeDishMetrics, classifyMenu, getMenuProfitabilityInsight } from './menuEngine';
import type { DishMetrics } from './menuEngine';
import type { BillingEntry, MenuItem } from '../types';

describe('buildMenuFromBilling', () => {
  test('new dish: avg price and 35% assumed cost, id slugified, name only first-letter-capitalized', () => {
    const entries: BillingEntry[] = [
      { id: '1', date: '2026-01-01', dishName: 'Dal Fry', quantity: 1, sellingPrice: 100 },
      { id: '2', date: '2026-01-02', dishName: 'Dal Fry', quantity: 1, sellingPrice: 120 },
    ];
    const menu = buildMenuFromBilling(entries, []);
    expect(menu).toHaveLength(1);
    // avgPrice = (100+120)/2 = 110; rawMaterialCost = round(110*0.35) = round(38.5) = 39
    expect(menu[0]).toMatchObject({ id: 'dal-fry', name: 'Dal fry', sellingPrice: 110, rawMaterialCost: 39 });
  });

  test('existing menu item is reused verbatim (billing prices do not overwrite it)', () => {
    const existing: MenuItem[] = [{ id: 'dal-fry', name: 'Dal Fry', sellingPrice: 999, rawMaterialCost: 400 }];
    const entries: BillingEntry[] = [{ id: '1', date: '2026-01-01', dishName: 'dal fry', quantity: 1, sellingPrice: 5 }];
    const menu = buildMenuFromBilling(entries, existing);
    expect(menu).toEqual([existing[0]]);
  });

  test('dish names are merged case/whitespace-insensitively', () => {
    const entries: BillingEntry[] = [
      { id: '1', date: '2026-01-01', dishName: ' Dal Fry ', quantity: 1, sellingPrice: 100 },
      { id: '2', date: '2026-01-02', dishName: 'DAL FRY', quantity: 1, sellingPrice: 100 },
      { id: '3', date: '2026-01-03', dishName: 'dal fry', quantity: 1, sellingPrice: 100 },
    ];
    const menu = buildMenuFromBilling(entries, []);
    expect(menu).toHaveLength(1);
    expect(menu[0].sellingPrice).toBe(100);
  });

  test('an id collision with an existing (unmatched-by-name) item falls back to a randomized id', () => {
    const existing: MenuItem[] = [{ id: 'rice', name: 'Some Other Dish', sellingPrice: 1, rawMaterialCost: 1 }];
    const entries: BillingEntry[] = [{ id: '1', date: '2026-01-01', dishName: 'Rice', quantity: 1, sellingPrice: 50 }];
    const menu = buildMenuFromBilling(entries, existing);
    expect(menu).toHaveLength(1);
    expect(menu[0].id).not.toBe('rice');
    expect(menu[0].id.startsWith('rice-')).toBe(true);
  });
});

describe('computeDishMetrics', () => {
  test('aggregates quantity/revenue and computes contribution margin against the menu cost', () => {
    const entries: BillingEntry[] = [
      { id: '1', date: '2026-01-01', dishName: 'X', quantity: 2, sellingPrice: 50 },
      { id: '2', date: '2026-01-02', dishName: 'X', quantity: 3, sellingPrice: 50 },
    ];
    const menu: MenuItem[] = [{ id: 'x', name: 'X', sellingPrice: 50, rawMaterialCost: 20 }];
    const [m] = computeDishMetrics(entries, menu);
    expect(m.totalQuantity).toBe(5);
    expect(m.totalRevenue).toBe(250);
    expect(m.rawMaterialCost).toBe(100); // 20 * 5
    expect(m.contributionMargin).toBe(150);
    expect(m.marginPct).toBe(60); // 150/250*100
  });

  test('zero-revenue dish (e.g. price=0) does not divide by zero: marginPct=0', () => {
    const entries: BillingEntry[] = [{ id: '1', date: '2026-01-01', dishName: 'Free Sample', quantity: 5, sellingPrice: 0 }];
    const [m] = computeDishMetrics(entries, []);
    expect(m.totalRevenue).toBe(0);
    expect(m.marginPct).toBe(0);
  });
});

describe('classifyMenu', () => {
  test('four dishes engineered to land exactly one in each quadrant', () => {
    const metrics: DishMetrics[] = [
      { name: 'Star', totalQuantity: 100, totalRevenue: 1000, rawMaterialCost: 500, contributionMargin: 500, marginPct: 50 },
      { name: 'HiddenGem', totalQuantity: 10, totalRevenue: 100, rawMaterialCost: 50, contributionMargin: 50, marginPct: 50 },
      { name: 'VolumeTrap', totalQuantity: 100, totalRevenue: 1000, rawMaterialCost: 900, contributionMargin: 100, marginPct: 10 },
      { name: 'DeadWeight', totalQuantity: 10, totalRevenue: 100, rawMaterialCost: 90, contributionMargin: 10, marginPct: 10 },
    ];
    // avgQty = (100+10+100+10)/4 = 55; avgMarginPct = (50+50+10+10)/4 = 30
    const q = classifyMenu(metrics);
    expect(q.star.map(m => m.name)).toEqual(['Star']);
    expect(q.hiddenGem.map(m => m.name)).toEqual(['HiddenGem']);
    expect(q.volumeTrap.map(m => m.name)).toEqual(['VolumeTrap']);
    expect(q.deadWeight.map(m => m.name)).toEqual(['DeadWeight']);
  });

  test('empty input -> all-empty quadrant', () => {
    expect(classifyMenu([])).toEqual({ star: [], hiddenGem: [], volumeTrap: [], deadWeight: [] });
  });
});

describe('getMenuProfitabilityInsight', () => {
  test('joins one clause per non-empty quadrant', () => {
    const metrics: DishMetrics[] = [
      { name: 'Star', totalQuantity: 100, totalRevenue: 1000, rawMaterialCost: 500, contributionMargin: 500, marginPct: 50 },
      { name: 'HiddenGem', totalQuantity: 10, totalRevenue: 100, rawMaterialCost: 50, contributionMargin: 50, marginPct: 50 },
      { name: 'VolumeTrap', totalQuantity: 100, totalRevenue: 1000, rawMaterialCost: 900, contributionMargin: 100, marginPct: 10 },
      { name: 'DeadWeight', totalQuantity: 10, totalRevenue: 100, rawMaterialCost: 90, contributionMargin: 10, marginPct: 10 },
    ];
    const insight = getMenuProfitabilityInsight(classifyMenu(metrics));
    expect(insight).toBe(
      '1 star dish (protect these), 1 hidden gem (promote these more), 1 volume trap (consider repricing), 1 dead weight item (consider removing)'
    );
  });
});
