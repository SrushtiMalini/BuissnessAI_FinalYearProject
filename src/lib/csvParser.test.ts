import { describe, test, expect } from 'vitest';
import { parseMenuCSV } from './csvParser';

describe('parseMenuCSV', () => {
  test('parses dish/price/cost columns (flexible header aliases)', () => {
    const csv = 'dish,price,cost\nDal Fry,100,35\nNaan,30,10\n';
    const { items, errors } = parseMenuCSV(csv);
    expect(errors).toEqual([]);
    expect(items).toEqual([
      { name: 'Dal Fry', sellingPrice: 100, rawMaterialCost: 35 },
      { name: 'Naan', sellingPrice: 30, rawMaterialCost: 10 },
    ]);
  });

  test('accepts alternate header names (item_name, selling_price, raw_material_cost)', () => {
    const csv = 'item_name,selling_price,raw_material_cost\nButter Chicken,220,90\n';
    const { items, errors } = parseMenuCSV(csv);
    expect(errors).toEqual([]);
    expect(items).toEqual([{ name: 'Butter Chicken', sellingPrice: 220, rawMaterialCost: 90 }]);
  });

  test('missing price/cost columns default to 0 rather than dropping the row', () => {
    const csv = 'dish\nMystery Dish\n';
    const { items, errors } = parseMenuCSV(csv);
    expect(errors).toEqual([]);
    expect(items).toEqual([{ name: 'Mystery Dish', sellingPrice: 0, rawMaterialCost: 0 }]);
  });

  test('rows with no dish name are skipped', () => {
    const csv = 'dish,price,cost\n,100,35\nNaan,30,10\n';
    const { items } = parseMenuCSV(csv);
    expect(items).toEqual([{ name: 'Naan', sellingPrice: 30, rawMaterialCost: 10 }]);
  });

  test('no dish/name column at all -> error, no items', () => {
    const csv = 'price,cost\n100,35\n';
    const { items, errors } = parseMenuCSV(csv);
    expect(items).toEqual([]);
    expect(errors[0]).toMatch(/dish name column/);
  });

  test('empty file (header only, or nothing) -> error, no items', () => {
    const { items, errors } = parseMenuCSV('dish,price,cost\n');
    expect(items).toEqual([]);
    expect(errors[0]).toMatch(/empty/);
  });

  test('currency symbols and commas in price/cost are stripped', () => {
    const csv = 'dish,price,cost\nThali,"₹1,200",₹400\n';
    const { items } = parseMenuCSV(csv);
    expect(items).toEqual([{ name: 'Thali', sellingPrice: 1200, rawMaterialCost: 400 }]);
  });
});
