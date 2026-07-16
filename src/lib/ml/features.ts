// Shared feature engineering utilities for all ML modules

import type { BillingEntry } from '../../types';

const INDIAN_FESTIVALS_2024_2025: Record<string, string> = {
  '2024-01-15': 'Makar Sankranti',
  '2024-01-26': 'Republic Day',
  '2024-03-25': 'Holi',
  '2024-04-14': 'Baisakhi',
  '2024-04-17': 'Ram Navami',
  '2024-04-21': 'Easter',
  '2024-06-17': 'Eid ul-Adha',
  '2024-08-15': 'Independence Day',
  '2024-08-26': 'Janmashtami',
  '2024-09-07': 'Ganesh Chaturthi',
  '2024-10-02': 'Gandhi Jayanti',
  '2024-10-12': 'Navratri Start',
  '2024-10-24': 'Dussehra',
  '2024-10-31': 'Halloween',
  '2024-11-01': 'Diwali',
  '2024-11-15': 'Guru Nanak Jayanti',
  '2024-12-25': 'Christmas',
  '2024-12-31': 'New Year Eve',
  '2025-01-14': 'Makar Sankranti',
  '2025-01-26': 'Republic Day',
  '2025-03-14': 'Holi',
  '2025-04-06': 'Ram Navami',
  '2025-04-13': 'Baisakhi',
  '2025-04-14': 'Ambedkar Jayanti',
  '2025-04-18': 'Good Friday',
  '2025-08-15': 'Independence Day',
  '2025-08-16': 'Janmashtami',
  '2025-08-27': 'Ganesh Chaturthi',
  '2025-10-02': 'Gandhi Jayanti',
  '2025-10-20': 'Dussehra',
  '2025-10-21': 'Navratri',
  '2025-11-01': 'Diwali',
  '2025-11-05': 'Guru Nanak Jayanti',
  '2025-12-25': 'Christmas',
  '2025-12-31': 'New Year Eve',
  '2026-01-14': 'Makar Sankranti',
  '2026-01-26': 'Republic Day',
};

export function isFestival(dateStr: string): boolean {
  return dateStr in INDIAN_FESTIVALS_2024_2025;
}

export function festivalProximity(dateStr: string): number {
  const date = new Date(dateStr).getTime();
  const festDates = Object.keys(INDIAN_FESTIVALS_2024_2025).map(d => new Date(d).getTime());
  const distances = festDates.map(f => Math.abs(Math.round((f - date) / 86400000)));
  return Math.min(...distances.filter(d => d <= 7), 7);
}

export function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

export function isMonthEnd(dateStr: string): boolean {
  const d = new Date(dateStr);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() >= lastDay - 2;
}

export function mealPeriodForHour(hour: number): number {
  if (hour >= 6 && hour <= 10) return 0;  // breakfast
  if (hour >= 11 && hour <= 15) return 1; // lunch
  if (hour >= 16 && hour <= 17) return 2; // snack
  if (hour >= 18 && hour <= 22) return 3; // dinner
  return 4; // late
}

// Daily revenue indexed by date
export function buildDailyRevenue(entries: BillingEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    map.set(e.date, (map.get(e.date) ?? 0) + e.sellingPrice * e.quantity);
  }
  return map;
}

// Daily orders indexed by date
export function buildDailyOrders(entries: BillingEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    map.set(e.date, (map.get(e.date) ?? 0) + e.quantity);
  }
  return map;
}

// Get sorted unique dates from entries
export function getSortedDates(entries: BillingEntry[]): string[] {
  return [...new Set(entries.map(e => e.date))].sort();
}

// Lag feature: value from N days ago
export function lagValue(dateMap: Map<string, number>, dateStr: string, lagDays: number): number {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - lagDays);
  return dateMap.get(d.toISOString().slice(0, 10)) ?? 0;
}

// Rolling mean over last N days
export function rollingMean(dateMap: Map<string, number>, dateStr: string, windowDays: number): number {
  const vals: number[] = [];
  const d = new Date(dateStr);
  for (let i = 1; i <= windowDays; i++) {
    const dd = new Date(d);
    dd.setDate(dd.getDate() - i);
    const v = dateMap.get(dd.toISOString().slice(0, 10));
    if (v !== undefined) vals.push(v);
  }
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

export function rollingStd(dateMap: Map<string, number>, dateStr: string, windowDays: number): number {
  const vals: number[] = [];
  const d = new Date(dateStr);
  for (let i = 1; i <= windowDays; i++) {
    const dd = new Date(d);
    dd.setDate(dd.getDate() - i);
    const v = dateMap.get(dd.toISOString().slice(0, 10));
    if (v !== undefined) vals.push(v);
  }
  if (vals.length < 2) return 0;
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  return Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1));
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
