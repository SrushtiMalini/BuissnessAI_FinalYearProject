import type { BillingEntry, ForecastEntry, ForecastResult, DishForecast } from '../types';
import { groupByDate } from './analytics';

const WMA_WEIGHTS = [0.4, 0.3, 0.2, 0.1]; // most recent first

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay();
}

function wma(values: number[]): number {
  if (!values.length) return 0;
  const n = Math.min(values.length, WMA_WEIGHTS.length);
  let sum = 0, weightSum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[values.length - 1 - i] * WMA_WEIGHTS[i];
    weightSum += WMA_WEIGHTS[i];
  }
  return sum / weightSum;
}

function getDailyRevenue(byDate: Record<string, BillingEntry[]>, date: string): number {
  return (byDate[date] ?? []).reduce((s, e) => s + e.sellingPrice * e.quantity, 0);
}

function getDailyDishQty(byDate: Record<string, BillingEntry[]>, date: string, dish: string): number {
  return (byDate[date] ?? []).filter(e => e.dishName === dish).reduce((s, e) => s + e.quantity, 0);
}

function computeMAE(forecasts: ForecastEntry[]): number {
  const withActual = forecasts.filter(f => f.actual !== undefined);
  if (!withActual.length) return 0;
  return withActual.reduce((s, f) => s + Math.abs(f.predicted - f.actual!), 0) / withActual.length;
}

function computeRMSE(forecasts: ForecastEntry[]): number {
  const withActual = forecasts.filter(f => f.actual !== undefined);
  if (!withActual.length) return 0;
  return Math.sqrt(
    withActual.reduce((s, f) => s + (f.predicted - f.actual!) ** 2, 0) / withActual.length
  );
}

export function runWMAForecast(entries: BillingEntry[], forecastDays = 7): ForecastResult {
  const byDate = groupByDate(entries);
  const sortedDates = Object.keys(byDate).sort();

  if (sortedDates.length < 7) {
    return {
      totalRevenueForecast: [],
      dishForecasts: [],
      mae: 0,
      rmse: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  const lastDate = sortedDates[sortedDates.length - 1];

  // For accuracy evaluation, use last 7 days as test, rest as train
  const trainDates = sortedDates.slice(0, -7);
  const testDates = sortedDates.slice(-7);

  // --- Total revenue forecast (for future days) ---
  const totalRevenueForecast: ForecastEntry[] = [];

  for (let d = 1; d <= forecastDays; d++) {
    const futureDate = addDays(lastDate, d);
    const futureDow = getDayOfWeek(futureDate);

    // Find same day-of-week from last 4 weeks
    const sameDowRevenues: number[] = sortedDates
      .filter(date => getDayOfWeek(date) === futureDow)
      .slice(-4)
      .map(date => getDailyRevenue(byDate, date));

    const predicted = wma(sameDowRevenues);
    totalRevenueForecast.push({ date: futureDate, predicted: Math.round(predicted) });
  }

  // --- Evaluation on test set (backtesting) ---
  const evalForecasts: ForecastEntry[] = testDates.map(testDate => {
    const dow = getDayOfWeek(testDate);
    const trainingDow = trainDates
      .filter(d => getDayOfWeek(d) === dow)
      .slice(-4)
      .map(d => getDailyRevenue(byDate, d));
    const predicted = wma(trainingDow);
    const actual = getDailyRevenue(byDate, testDate);
    return { date: testDate, predicted: Math.round(predicted), actual };
  });

  // --- Per-dish forecasts ---
  const allDishes = [...new Set(entries.map(e => e.dishName))];
  const dishForecasts: DishForecast[] = allDishes.slice(0, 15).map(dish => {
    const forecasts: ForecastEntry[] = [];
    for (let d = 1; d <= forecastDays; d++) {
      const futureDate = addDays(lastDate, d);
      const futureDow = getDayOfWeek(futureDate);
      const sameDow = sortedDates
        .filter(date => getDayOfWeek(date) === futureDow)
        .slice(-4)
        .map(date => getDailyDishQty(byDate, date, dish));
      forecasts.push({ date: futureDate, predicted: Math.max(0, Math.round(wma(sameDow))) });
    }
    return { dishName: dish, forecasts };
  });

  return {
    totalRevenueForecast,
    dishForecasts,
    mae: Math.round(computeMAE(evalForecasts)),
    rmse: Math.round(computeRMSE(evalForecasts)),
    generatedAt: new Date().toISOString(),
  };
}
