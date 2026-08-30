import { describe, test, expect } from 'vitest';
import { determineNextDate, generateNextDayEntries } from './testDataGenerator';
import type { BillingEntry, MenuItem } from '../types';

const MENU: MenuItem[] = [
  { id: 'dal-fry', name: 'Dal Fry', sellingPrice: 100, rawMaterialCost: 35 },
  { id: 'naan', name: 'Naan', sellingPrice: 30, rawMaterialCost: 10 },
];

describe('determineNextDate', () => {
  test('no billing history -> today', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(determineNextDate([])).toBe(today);
  });

  test('with history -> the day after the most recent date on file', () => {
    const billing: BillingEntry[] = [
      { id: '1', date: '2026-03-01', dishName: 'Dal Fry', quantity: 1, sellingPrice: 100 },
      { id: '2', date: '2026-03-03', dishName: 'Naan', quantity: 1, sellingPrice: 30 },
    ];
    expect(determineNextDate(billing)).toBe('2026-03-04');
  });
});

describe('generateNextDayEntries', () => {
  test('only generates dishes that exist in the menu, never invented names', () => {
    const entries = generateNextDayEntries(MENU, [], '2026-03-04');
    const menuNames = new Set(MENU.map(m => m.name));
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) expect(menuNames.has(e.dishName)).toBe(true);
  });

  test('every generated row is dated exactly nextDate with a positive quantity and price', () => {
    const entries = generateNextDayEntries(MENU, [], '2026-03-04');
    for (const e of entries) {
      expect(e.date).toBe('2026-03-04');
      expect(e.quantity).toBeGreaterThan(0);
      expect(e.sellingPrice).toBeGreaterThan(0);
    }
  });

  test('empty menu produces no rows', () => {
    expect(generateNextDayEntries([], [], '2026-03-04')).toEqual([]);
  });

  test('selling price stays within the +/-5% jitter band around the menu price', () => {
    const entries = generateNextDayEntries(MENU, [], '2026-03-04');
    for (const e of entries) {
      const menuItem = MENU.find(m => m.name === e.dishName)!;
      expect(e.sellingPrice).toBeGreaterThanOrEqual(Math.floor(menuItem.sellingPrice * 0.95));
      expect(e.sellingPrice).toBeLessThanOrEqual(Math.ceil(menuItem.sellingPrice * 1.05));
    }
  });

  test('a dish with steady 10/day history generates roughly that many orders (within weekend/noise bounds)', () => {
    const billing: BillingEntry[] = Array.from({ length: 10 }, (_, i) => ({
      id: `h${i}`, date: `2026-02-1${i}`, dishName: 'Dal Fry', quantity: 10, sellingPrice: 100,
    }));
    const entries = generateNextDayEntries(MENU, billing, '2026-03-04'); // 2026-03-04 is a Wednesday, no festival
    const dalFryQty = entries.filter(e => e.dishName === 'Dal Fry').reduce((s, e) => s + e.quantity, 0);
    expect(dalFryQty).toBeGreaterThanOrEqual(7);
    expect(dalFryQty).toBeLessThanOrEqual(13);
  });

  test('generated rows for a dish sum to a single coherent day (meal periods split, not duplicated)', () => {
    const entries = generateNextDayEntries(MENU, [], '2026-03-04');
    const periods = entries.filter(e => e.dishName === 'Dal Fry').map(e => e.mealPeriod);
    expect(new Set(periods).size).toBe(periods.length); // no duplicate meal period for the same dish
  });
});
