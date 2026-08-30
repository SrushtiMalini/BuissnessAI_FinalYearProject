import { describe, test, expect } from 'vitest';
import {
  computeDishMetrics, classifyMenu, getMenuProfitabilityInsight, isMenuLocked, matchAgainstLockedMenu, applyDishResolutions,
} from './menuEngine';
import type { DishMetrics, UnmatchedDishResolution } from './menuEngine';
import type { BillingEntry, MenuItem } from '../types';

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

describe('isMenuLocked', () => {
  test('empty menu is not locked', () => {
    expect(isMenuLocked([])).toBe(false);
  });

  test('any menu item locks it', () => {
    expect(isMenuLocked([{ id: 'x', name: 'X', sellingPrice: 1, rawMaterialCost: 1 }])).toBe(true);
  });
});

describe('matchAgainstLockedMenu', () => {
  const menu: MenuItem[] = [
    { id: 'dal-fry', name: 'Dal Fry', sellingPrice: 100, rawMaterialCost: 35 },
    { id: 'naan', name: 'Naan', sellingPrice: 30, rawMaterialCost: 10 },
  ];

  test('rows whose dish matches the menu (case/whitespace-insensitively) are matched, not unmatched', () => {
    const entries: BillingEntry[] = [
      { id: '1', date: '2026-01-01', dishName: ' dal fry ', quantity: 2, sellingPrice: 100 },
      { id: '2', date: '2026-01-01', dishName: 'NAAN', quantity: 1, sellingPrice: 30 },
    ];
    const result = matchAgainstLockedMenu(entries, menu);
    expect(result.matched).toHaveLength(2);
    expect(result.unmatched).toHaveLength(0);
    expect(result.unmatchedDishNames).toEqual([]);
  });

  test('a dish not on the menu is held out as unmatched instead of silently passing through', () => {
    const entries: BillingEntry[] = [
      { id: '1', date: '2026-01-01', dishName: 'Dal Fry', quantity: 2, sellingPrice: 100 },
      { id: '2', date: '2026-01-01', dishName: 'Butter Chicken', quantity: 1, sellingPrice: 220 },
    ];
    const result = matchAgainstLockedMenu(entries, menu);
    expect(result.matched.map(e => e.dishName)).toEqual(['Dal Fry']);
    expect(result.unmatched.map(e => e.dishName)).toEqual(['Butter Chicken']);
    expect(result.unmatchedDishNames).toEqual(['Butter Chicken']);
  });

  test('unmatchedDishNames de-duplicates repeated unmatched dish names', () => {
    const entries: BillingEntry[] = [
      { id: '1', date: '2026-01-01', dishName: 'Butter Chicken', quantity: 1, sellingPrice: 220 },
      { id: '2', date: '2026-01-02', dishName: 'butter chicken', quantity: 2, sellingPrice: 220 },
    ];
    const result = matchAgainstLockedMenu(entries, menu);
    expect(result.unmatched).toHaveLength(2);
    expect(result.unmatchedDishNames).toEqual(['Butter Chicken']);
  });

  test('empty menu passed in (bootstrap case) leaves everything unmatched — callers should check isMenuLocked first', () => {
    const entries: BillingEntry[] = [{ id: '1', date: '2026-01-01', dishName: 'Dal Fry', quantity: 1, sellingPrice: 100 }];
    const result = matchAgainstLockedMenu(entries, []);
    expect(result.unmatched).toHaveLength(1);
  });
});

describe('applyDishResolutions', () => {
  const menu: MenuItem[] = [{ id: 'dal-fry', name: 'Dal Fry', sellingPrice: 100, rawMaterialCost: 35 }];

  test('"add" resolution creates a menu item and includes that dish\'s rows in entriesToSave', () => {
    const entries: BillingEntry[] = [
      { id: '1', date: '2026-01-01', dishName: 'Dal Fry', quantity: 1, sellingPrice: 100 },
      { id: '2', date: '2026-01-01', dishName: 'Butter Chicken', quantity: 2, sellingPrice: 220 },
    ];
    const match = matchAgainstLockedMenu(entries, menu);
    const resolutions: Record<string, UnmatchedDishResolution> = {
      'Butter Chicken': { action: 'add', sellingPrice: 220, rawMaterialCost: 90 },
    };
    const resolved = applyDishResolutions(match, menu, resolutions);

    expect(resolved.newMenuItems).toEqual([{ id: 'butter-chicken', name: 'Butter Chicken', sellingPrice: 220, rawMaterialCost: 90 }]);
    expect(resolved.entriesToSave.map(e => e.dishName)).toEqual(['Dal Fry', 'Butter Chicken']);
    expect(resolved.excluded).toEqual([]);
  });

  test('"exclude" resolution keeps that dish\'s rows out of entriesToSave and reports it in excluded with its row count', () => {
    const entries: BillingEntry[] = [
      { id: '1', date: '2026-01-01', dishName: 'Dal Fry', quantity: 1, sellingPrice: 100 },
      { id: '2', date: '2026-01-01', dishName: 'Foreign Dish', quantity: 3, sellingPrice: 50 },
      { id: '3', date: '2026-01-02', dishName: 'Foreign Dish', quantity: 1, sellingPrice: 50 },
    ];
    const match = matchAgainstLockedMenu(entries, menu);
    const resolutions: Record<string, UnmatchedDishResolution> = { 'Foreign Dish': { action: 'exclude' } };
    const resolved = applyDishResolutions(match, menu, resolutions);

    expect(resolved.newMenuItems).toEqual([]);
    expect(resolved.entriesToSave.map(e => e.dishName)).toEqual(['Dal Fry']);
    expect(resolved.excluded).toEqual([{ name: 'Foreign Dish', rowCount: 2 }]);
  });

  test('a dish with no resolution is skipped entirely — never a silent default (neither saved nor added)', () => {
    const entries: BillingEntry[] = [{ id: '1', date: '2026-01-01', dishName: 'Unresolved Dish', quantity: 1, sellingPrice: 10 }];
    const match = matchAgainstLockedMenu(entries, menu);
    const resolved = applyDishResolutions(match, menu, {}); // no resolution provided
    expect(resolved.entriesToSave).toEqual([]);
    expect(resolved.newMenuItems).toEqual([]);
    expect(resolved.excluded).toEqual([]);
  });

  test('id collision with an existing menu item falls back to a randomized id', () => {
    const menuWithRiceId: MenuItem[] = [{ id: 'rice', name: 'Some Other Dish', sellingPrice: 1, rawMaterialCost: 1 }];
    const entries: BillingEntry[] = [{ id: '1', date: '2026-01-01', dishName: 'Rice', quantity: 1, sellingPrice: 50 }];
    const match = matchAgainstLockedMenu(entries, menuWithRiceId);
    const resolved = applyDishResolutions(match, menuWithRiceId, { Rice: { action: 'add', sellingPrice: 50, rawMaterialCost: 20 } });
    expect(resolved.newMenuItems).toHaveLength(1);
    expect(resolved.newMenuItems[0].id).not.toBe('rice');
    expect(resolved.newMenuItems[0].id.startsWith('rice-')).toBe(true);
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
