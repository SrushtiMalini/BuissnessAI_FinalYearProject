import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Info, Sparkles } from 'lucide-react';
import { storage, type TrainSummary, type CompareResult } from '../lib/storage';
import { runWMAForecast } from '../lib/forecasting';
import type { ForecastAccuracyPoint } from '../types';
import { Card, Badge, PageHeader, MetricTile, EmptyState, Tooltip } from '../design-system/components';
import { LineChart } from '../design-system/charts';
import { CHART_COLORS } from '../design-system/charts';

// Minimum days of billing history before the WMA baseline itself produces a
// forecast (see runWMAForecast in forecasting.ts) — reused here so the
// "Train Model" button gates on the same threshold as the rest of this page.
const MIN_DAYS_FOR_FORECAST = 7;
const COMPARISON_DISH_COUNT = 3;

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ForecastPage() {
  const billing = storage.getBilling();
  const forecast = useMemo(() => runWMAForecast(billing, 7), [billing]);
  const [accuracySeries, setAccuracySeries] = useState<ForecastAccuracyPoint[] | null>(null);

  const uniqueDayCount = useMemo(() => new Set(billing.map(e => e.date)).size, [billing]);
  const [training, setTraining] = useState(false);
  const [trainSummary, setTrainSummary] = useState<TrainSummary | null>(null);
  const [comparisons, setComparisons] = useState<Record<string, CompareResult> | null>(null);
  const [loadingComparisons, setLoadingComparisons] = useState(false);

  useEffect(() => {
    let cancelled = false;
    storage.getForecastAccuracySeries()
      .then(series => { if (!cancelled) setAccuracySeries(series); })
      .catch(() => { if (!cancelled) setAccuracySeries([]); });
    return () => { cancelled = true; };
  }, []);

  const topDishes = useMemo(
    () => forecast.dishForecasts.slice(0, COMPARISON_DISH_COUNT),
    [forecast.dishForecasts]
  );

  async function loadComparisons() {
    if (!topDishes.length) return;
    setLoadingComparisons(true);
    try {
      const dates = forecast.totalRevenueForecast.map(f => f.date);
      const pairs = topDishes.flatMap(df => dates.map(date => ({ dish: df.dishName, date })));
      const results = await Promise.all(pairs.map(p => storage.compareForecast(p.dish, p.date)));
      const next: Record<string, CompareResult> = {};
      pairs.forEach((p, i) => { next[`${p.dish}|${p.date}`] = results[i]; });
      setComparisons(next);
    } catch {
      setComparisons({});
    } finally {
      setLoadingComparisons(false);
    }
  }

  async function handleTrain() {
    setTraining(true);
    try {
      const summary = await storage.trainDemandModel();
      setTrainSummary(summary);
      if (summary.ok) await loadComparisons();
    } finally {
      setTraining(false);
    }
  }

  if (!billing.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Upload size={40} />}
          title="No data to forecast"
          description="Upload at least 7 days of billing data to enable forecasting."
          action={<Link to="/upload"><div className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-[var(--text-sm)] font-medium bg-[var(--color-unity)] text-[var(--color-text-inverse)]">Upload Data</div></Link>}
        />
      </div>
    );
  }

  if (!forecast.totalRevenueForecast.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          title="More data needed"
          description="Need at least 7 days of data. Upload more billing records."
        />
      </div>
    );
  }

  const totalForecast7d = forecast.totalRevenueForecast.reduce((s, f) => s + f.predicted, 0);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Demand Forecast"
        subtitle="Weighted Moving Average — custom model built from scratch (no external ML library)"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricTile label="7-Day Forecast" value={fmtCurrency(totalForecast7d)} valueFont="display" subtext="Next 7 days" />
        <MetricTile label="Model MAE" value={`₹${forecast.mae}`} valueFont="mono" subtext="Mean Absolute Error" />
        <MetricTile label="Model RMSE" value={`₹${forecast.rmse}`} valueFont="mono" subtext="Root Mean Square Error" />
        <MetricTile label="Dishes Tracked" value={forecast.dishForecasts.length.toString()} valueFont="mono" subtext="Individual forecasts" />
      </div>

      <Card title="7-Day Revenue Forecast" className="mb-6">
        <LineChart
          data={forecast.totalRevenueForecast}
          lines={[{ key: 'predicted', name: 'Predicted Revenue', color: CHART_COLORS[0] }]}
          xKey="date"
          height={250}
          xFormatter={(d) => new Date(String(d)).toLocaleDateString('en-IN', { weekday: 'short' })}
          yFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
          tooltipFormatter={(v, _) => [fmtCurrency(v), 'Predicted']}
        />
      </Card>

      <Card title="Day-by-Day Forecast" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-[var(--text-sm)]">
            <thead>
              <tr className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border-default)]">
                {['Date', 'Day', 'Predicted Revenue', 'Confidence'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[var(--text-xs)] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.totalRevenueForecast.map((f, i) => {
                const day = new Date(f.date).toLocaleDateString('en-IN', { weekday: 'long' });
                const isWeekend = [0, 6].includes(new Date(f.date).getDay());
                return (
                  <tr key={i} className="border-b border-[var(--color-border-default)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors">
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] font-mono">{f.date}</td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium">{day}</td>
                    <td className="px-4 py-3 font-semibold font-mono" style={{ color: 'var(--color-unity)' }}>{fmtCurrency(f.predicted)}</td>
                    <td className="px-4 py-3">
                      {isWeekend
                        ? <Badge variant="success" dot>High (weekend)</Badge>
                        : <Badge variant="neutral" dot>Normal</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Per-Dish Prep Forecast"
        subtitle="Plates to prepare per dish for the next 7 days"
        action={
          <Tooltip content="Based on WMA with 40/30/20/10 weights for last 4 same-weekday occurrences">
            <Info size={16} className="text-[var(--color-text-muted)]" />
          </Tooltip>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[var(--text-sm)]">
            <thead>
              <tr className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border-default)]">
                <th className="px-4 py-3 text-left text-[var(--text-xs)] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">Dish</th>
                {forecast.totalRevenueForecast.map(f => (
                  <th key={f.date} className="px-4 py-3 text-left text-[var(--text-xs)] uppercase tracking-wider text-[var(--color-text-muted)] font-medium whitespace-nowrap">
                    {new Date(f.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.dishForecasts.slice(0, 10).map(df => (
                <tr key={df.dishName} className="border-b border-[var(--color-border-default)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors">
                  <td className="px-4 py-2.5 text-[var(--color-text-primary)] font-medium">{df.dishName}</td>
                  {df.forecasts.map((f, i) => (
                    <td key={i} className="px-4 py-2.5 font-mono text-[var(--text-sm)]">
                      {f.predicted > 0
                        ? <span className="text-[var(--color-text-primary)]">{f.predicted}</span>
                        : <span className="text-[var(--color-text-muted)]">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-4 pt-4 border-t border-[var(--color-border-default)]">
          Model: Weighted Moving Average (40% last week · 30% 2 weeks ago · 20% 3 weeks ago · 10% 4 weeks ago) per day-of-week.
          MAE ₹{forecast.mae} means the model is off by ±₹{forecast.mae} per day on average.
        </p>
      </Card>

      <Card
        title="Trained Model (Beta)"
        subtitle="A real GradientBoostingRegressor, trained on this restaurant's own history — compared against the WMA baseline above"
        className="mb-6"
        action={
          uniqueDayCount >= MIN_DAYS_FOR_FORECAST ? (
            <button
              onClick={handleTrain}
              disabled={training}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-[var(--text-sm)] font-medium bg-[var(--color-unity)] text-[var(--color-text-inverse)] disabled:opacity-60"
            >
              <Sparkles size={14} />
              {training ? 'Training…' : trainSummary?.ok ? 'Retrain Model' : 'Train Model'}
            </button>
          ) : null
        }
      >
        {uniqueDayCount < MIN_DAYS_FOR_FORECAST ? (
          <EmptyState
            title="Not enough data yet"
            description={`Need at least ${MIN_DAYS_FOR_FORECAST} days of billing history to train a model. Upload more data first.`}
          />
        ) : trainSummary && !trainSummary.ok ? (
          <EmptyState
            title="Training failed"
            description={trainSummary.error ?? 'Could not train a model with the current data.'}
          />
        ) : !trainSummary ? (
          <EmptyState
            title="Model not trained yet"
            description="Click Train Model to fit a GradientBoostingRegressor on this restaurant's billing history and see it compared against the baseline WMA forecast."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricTile label="Trained On" value={`${trainSummary.daysUsed ?? 0}d`} valueFont="mono" subtext="Days of history" />
              <MetricTile label="Validation MAE" value={`${trainSummary.mae ?? 0}`} valueFont="mono" subtext="Units, held-out days" />
              <MetricTile label="Dishes Learned" value={`${trainSummary.dishCount ?? 0}`} valueFont="mono" subtext="Distinct dishes" />
              <MetricTile label="Training Rows" value={`${trainSummary.rowsUsed ?? 0}`} valueFont="mono" subtext="(dish, day) samples" />
            </div>

            {loadingComparisons ? (
              <div className="h-[120px] flex items-center justify-center text-[var(--color-text-muted)] text-[var(--text-sm)]">
                Loading comparison…
              </div>
            ) : !comparisons || !topDishes.length ? null : (
              <div className="overflow-x-auto">
                <table className="w-full text-[var(--text-sm)]">
                  <thead>
                    <tr className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border-default)]">
                      <th className="px-4 py-3 text-left text-[var(--text-xs)] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">Dish</th>
                      <th className="px-4 py-3 text-left text-[var(--text-xs)] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">Date</th>
                      <th className="px-4 py-3 text-left text-[var(--text-xs)] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">Baseline (WMA)</th>
                      <th className="px-4 py-3 text-left text-[var(--text-xs)] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">Trained Model (Beta)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDishes.flatMap(df => forecast.totalRevenueForecast.map(f => {
                      const c = comparisons[`${df.dishName}|${f.date}`];
                      return (
                        <tr key={`${df.dishName}|${f.date}`} className="border-b border-[var(--color-border-default)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors">
                          <td className="px-4 py-2.5 text-[var(--color-text-primary)] font-medium">{df.dishName}</td>
                          <td className="px-4 py-2.5 text-[var(--color-text-secondary)] font-mono">{fmtDate(f.date)}</td>
                          <td className="px-4 py-2.5 font-mono">{c?.wma ?? '–'}</td>
                          <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-unity)' }}>
                            {c?.trainedModel ?? (c?.trainedModelStatus ? '–' : '…')}
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      <Card
        title="Forecast Accuracy Over Time"
        subtitle="Mean Absolute Error (units) per day, averaged across dishes — lower is better"
      >
        {accuracySeries === null ? (
          <div className="h-[220px] flex items-center justify-center text-[var(--color-text-muted)] text-[var(--text-sm)]">
            Loading...
          </div>
        ) : accuracySeries.length === 0 ? (
          <EmptyState
            title="Still collecting data"
            description="Every forecast this model makes is now recorded and checked against real sales the next day. Come back once a few forecasted days have passed to see accuracy trend over time."
          />
        ) : (
          <>
            <LineChart
              data={accuracySeries}
              lines={[{ key: 'mae', name: 'Avg MAE', color: CHART_COLORS[1] }]}
              xKey="date"
              height={220}
              xFormatter={(d) => new Date(String(d)).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              yFormatter={v => v.toFixed(1)}
              tooltipFormatter={(v) => [v.toFixed(2), 'Avg MAE']}
            />
            <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-4 pt-4 border-t border-[var(--color-border-default)]">
              Each point is the average absolute difference between a predicted and actual per-dish quantity for that date, across dishes forecasted that day. This is the accuracy baseline the trained ML model (planned separately) will be judged against.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
