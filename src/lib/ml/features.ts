// Shared feature engineering utilities for all ML modules

import type { BillingEntry } from '../../types';
import FESTIVAL_CALENDAR from './festival_calendar.json';

// Shared reference: also read directly by server/ml/train_demand_model.py and
// server/ml/predict_demand.py so the Python-trained model uses the exact same
// festival dates as every TS-side ML module.
const INDIAN_FESTIVALS_2024_2025: Record<string, string> = FESTIVAL_CALENDAR;

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
