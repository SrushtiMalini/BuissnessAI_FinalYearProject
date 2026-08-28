import { describe, test, expect } from 'vitest';
import { runWorkforceForecast, buildWorkforceHeatmap, getWeeklyStaffCost } from './workforceForecast';
import type { BillingEntry } from '../../types';

// Historical hour-12 (lunch) orders of exactly 8 on the 4 Thursdays preceding the
// forecast target (2026-08-20, a Thursday), plus one same-value row on 2026-08-19
// (the most recent date, so lastDate=2026-08-19 and daysAhead=1 forecasts exactly
// 2026-08-20). All values equal 8, so the percentile bin thresholds (p25=p60=p85=8)
// collapse to a single boundary and the "low" bin is unambiguous — no festival/weekend
// multiplier applies to 2026-08-20 (Thursday, no festival within 1 day).
function hourlyFixture(): BillingEntry[] {
  const thursdays = ['2026-07-23', '2026-07-30', '2026-08-06', '2026-08-13'];
  const entries: BillingEntry[] = thursdays.map((date, i) => ({
    id: `h${i}`, date, time: '12:00', dishName: 'Thali', quantity: 8, sellingPrice: 100,
  }));
  entries.push({ id: 'last', date: '2026-08-19', time: '12:00', dishName: 'Thali', quantity: 8, sellingPrice: 100 });
  return entries;
}

describe('runWorkforceForecast — hand-calculated', () => {
  const recs = runWorkforceForecast(hourlyFixture(), 1);

  test('produces one recommendation per hour of the single forecast day', () => {
    expect(recs).toHaveLength(16); // HOURS.length
    expect(recs.every(r => r.date === '2026-08-20')).toBe(true);
  });

  test('hour=12 (lunch, has historical data): predictedOrders=8, demand bin "low", staffing {1,1,1}', () => {
    const noon = recs.find(r => r.hour === 12)!;
    expect(noon).toBeDefined();
    expect(noon.predictedOrders).toBe(8);
    expect(noon.demandBin).toBe('low'); // 8 <= p25(8)
    expect(noon.recommendedStaff).toEqual({ kitchen: 1, service: 1, cashier: 1 });
    expect(noon.shiftLabel).toBe('lunch');
  });

  test('hour=7 (no historical data at that hour, but the day-of-week still matched 4x): predictedOrders=0', () => {
    const early = recs.find(r => r.hour === 7)!;
    expect(early).toBeDefined();
    expect(early.predictedOrders).toBe(0);
    expect(early.demandBin).toBe('low'); // 0 <= p25(8)
    expect(early.recommendedStaff).toEqual({ kitchen: 1, service: 1, cashier: 1 });
    expect(early.shiftLabel).toBe('morning');
  });
});

describe('buildWorkforceHeatmap', () => {
  test('maps a recommendation into a labeled heatmap cell', () => {
    const recs = runWorkforceForecast(hourlyFixture(), 1);
    const noon = recs.find(r => r.hour === 12)!;
    const cells = buildWorkforceHeatmap([noon]);
    expect(cells).toEqual([{ day: 'Thu', hour: 12, value: 8, label: '3 staff' }]);
  });
});

describe('getWeeklyStaffCost', () => {
  test('sums max-staff-per-shift across the 4 shifts present in the fixture', () => {
    const recs = runWorkforceForecast(hourlyFixture(), 1);
    // Every hour lands in the "low" bin (staff total 3), grouped into 4 shifts
    // (morning/lunch/afternoon/evening cover all HOURS 7..22) for the 1 forecast day.
    // cost = 4 shifts * 3 staff * (600/4 per shift) = 1800
    expect(getWeeklyStaffCost(recs)).toBe(1800);
  });
});

describe('runWorkforceForecast — edge cases', () => {
  test('no billing entries -> []', () => {
    expect(runWorkforceForecast([])).toEqual([]);
  });

  test('single data point, forecasting only 1 day ahead: no 7-day-back lookback exists yet -> [] gracefully', () => {
    // With the default daysAhead=7, the single historical row would actually get reused
    // (its date is exactly 7 days before the 7-days-out target, i.e. "last week, same day"),
    // producing non-empty output. Forcing daysAhead=1 removes that coincidence and exercises
    // the true "not enough lookback history" path.
    const entries: BillingEntry[] = [{ id: '1', date: '2026-08-19', time: '12:00', dishName: 'Thali', quantity: 8, sellingPrice: 100 }];
    expect(runWorkforceForecast(entries, 1)).toEqual([]);
  });

  test('entries without a time column fall back to the meal-period-weight distribution and still produce recommendations', () => {
    const dates = ['2026-07-23', '2026-07-30', '2026-08-06', '2026-08-13', '2026-08-19'];
    const entries: BillingEntry[] = dates.map((date, i) => ({
      id: `n${i}`, date, dishName: 'Thali', quantity: 40, sellingPrice: 100,
    }));
    const recs = runWorkforceForecast(entries, 1);
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(['low', 'medium', 'high', 'peak']).toContain(r.demandBin);
      expect(r.recommendedStaff.kitchen).toBeGreaterThanOrEqual(1);
    }
  });
});
