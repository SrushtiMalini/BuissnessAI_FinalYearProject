import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sun, Moon, Upload, ChevronLeft, ChevronRight, BarChart3, Sparkles,
  Clock, Trophy, PieChart as PieChartIcon, TrendingUp,
} from 'lucide-react';
import { storage } from '../lib/storage';
import { generateDailyReport } from '../lib/reportGenerator';
import { getDailySummaries, getPeakHours, getTopDishes, getMealPeriodSplit } from '../lib/analytics';
import { Button, Card, Badge, EmptyState, PageHeader, Alert, formInputClass, IconTitle } from '../design-system/components';
import { BarChart, DonutChart, LineChart, CHART_COLORS } from '../design-system/charts';
import type { Report } from '../types';

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function fmtShortDate(d: unknown): string {
  if (typeof d !== 'string') return '';
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

export default function ReportPage() {
  const billing = storage.getBilling();
  const menu = storage.getMenu();
  const restaurant = storage.getRestaurant();
  const [reports, setReports] = useState<Report[]>(() => storage.getReports());
  const [generating, setGenerating] = useState<'morning' | 'evening' | null>(null);
  const [aiError, setAiError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Ascending — oldest to newest, matching the actual range of uploaded billing data.
  const summaries = useMemo(() => getDailySummaries(billing, menu), [billing, menu]);
  const availableDates = useMemo(() => summaries.map(s => s.date), [summaries]);

  useEffect(() => {
    if (!selectedDate && availableDates.length) {
      setSelectedDate(availableDates[availableDates.length - 1]);
    }
  }, [availableDates, selectedDate]);

  // Everything below is scoped to just this date's billing rows — same functions Dashboard uses, just fed a narrower slice.
  // (All hooks must run unconditionally, before the no-data early return below.)
  const dateEntries = useMemo(() => billing.filter(e => e.date === selectedDate), [billing, selectedDate]);
  const hourlyData = useMemo(() => getPeakHours(dateEntries), [dateEntries]);
  const dishRevenueData = useMemo(() => getTopDishes(dateEntries, 8), [dateEntries]);
  const mealSplitForDate = useMemo(() => getMealPeriodSplit(dateEntries), [dateEntries]);
  const mealPieDataForDate = useMemo(() => [
    { name: 'Breakfast', value: mealSplitForDate.breakfast },
    { name: 'Lunch', value: mealSplitForDate.lunch },
    { name: 'Dinner', value: mealSplitForDate.dinner },
    { name: 'Other', value: mealSplitForDate.other },
  ].filter(d => d.value > 0), [mealSplitForDate]);
  const trendWindow = useMemo(() => {
    const idx = summaries.findIndex(s => s.date === selectedDate);
    if (idx === -1) return [];
    const start = Math.max(0, idx - 3);
    const end = Math.min(summaries.length, idx + 4);
    return summaries.slice(start, end).map(s => ({ date: s.date, revenue: s.totalRevenue }));
  }, [summaries, selectedDate]);

  if (!billing.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Upload size={40} />}
          title="No data yet"
          description="Upload billing data to generate reports."
          action={<Link to="/upload"><Button>Upload Data</Button></Link>}
        />
      </div>
    );
  }

  const dateIndex = availableDates.indexOf(selectedDate);
  const selectedSummary = summaries.find(s => s.date === selectedDate) ?? null;
  const dateReports = reports.filter(r => r.date === selectedDate);
  const hasHourlyData = hourlyData.some(h => h.orders > 0);
  const windowAvg = trendWindow.length ? trendWindow.reduce((s, d) => s + d.revenue, 0) / trendWindow.length : 0;
  const trendDiffPct = windowAvg > 0 ? (((selectedSummary?.totalRevenue ?? 0) - windowAvg) / windowAvg) * 100 : 0;

  function goToDate(offset: number) {
    const next = availableDates[dateIndex + offset];
    if (next) setSelectedDate(next);
  }

  async function generateReport(type: 'morning' | 'evening') {
    setGenerating(type);
    setAiError('');
    try {
      const name = restaurant?.name ?? 'your restaurant';
      const result = await generateDailyReport(billing, menu, name, type, selectedDate);
      if (result.error) {
        setAiError(result.error);
        return;
      }
      const report: Report = {
        id: Date.now().toString(),
        date: selectedDate,
        generatedAt: new Date().toISOString(),
        summary: selectedSummary ?? { date: selectedDate, totalRevenue: 0, totalOrders: 0, topDishes: [], foodCostPct: 0, grossProfit: 0 },
        aiText: result.text,
        type,
      };
      await storage.appendReport(report);
      setReports(storage.getReports());
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Business Reports"
        subtitle="Real data for any date — AI commentary is optional and grounded in that data"
      />

      {/* Date selector */}
      <Card className="mb-6" padding="sm">
        <div className="flex items-center gap-3">
          <button onClick={() => goToDate(-1)} disabled={dateIndex <= 0}
            className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={16} />
          </button>
          <select
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className={`${formInputClass} max-w-xs`}
          >
            {[...availableDates].reverse().map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={() => goToDate(1)} disabled={dateIndex === -1 || dateIndex >= availableDates.length - 1}
            className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronRight size={16} />
          </button>
          <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] ml-auto">
            {availableDates.length} day{availableDates.length === 1 ? '' : 's'} of data available
          </span>
        </div>
      </Card>

      {/* Real data report — always renders from computed analytics, zero AI involvement */}
      {selectedSummary && (
        <Card className="mb-6">
          <p className="text-[var(--text-xs)] uppercase tracking-wider text-[var(--color-text-muted)] mb-4 font-medium flex items-center gap-2">
            <BarChart3 size={14} /> Data Report — {selectedSummary.date}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">Revenue</p>
              <p className="font-semibold text-[var(--text-xl)] text-[var(--color-text-accent)]">{fmtCurrency(selectedSummary.totalRevenue)}</p>
            </div>
            <div>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">Orders</p>
              <p className="font-semibold text-[var(--text-xl)] text-[var(--color-text-primary)]">{selectedSummary.totalOrders}</p>
            </div>
            <div>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">Gross Profit</p>
              <p className="font-semibold text-[var(--text-xl)] text-[var(--color-text-primary)]">{fmtCurrency(selectedSummary.grossProfit)}</p>
            </div>
            <div>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">Food Cost</p>
              <p className={`font-semibold text-[var(--text-xl)] ${selectedSummary.foodCostPct > 35 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}>
                {selectedSummary.foodCostPct.toFixed(1)}%
              </p>
            </div>
          </div>
          {selectedSummary.topDishes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border-default)]">
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-2">Top dishes on this date</p>
              <div className="flex flex-wrap gap-2">
                {selectedSummary.topDishes.map(d => (
                  <Badge key={d.name} variant="info">{d.name} ({d.quantity})</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Visual breakdown — all computed from this date's billing rows only, zero AI involvement */}
      {selectedSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card title={IconTitle(<Clock size={16} />, 'Hourly Sales')} subtitle="Orders by hour on this date">
            {hasHourlyData ? (
              <BarChart
                data={hourlyData.filter(h => h.orders > 0)}
                bars={[{ key: 'orders', name: 'Orders', color: CHART_COLORS[1] }]}
                xKey="hour"
                height={200}
                xFormatter={v => `${v}:00`}
                tooltipFormatter={(v) => [`${v} orders`, 'Orders']}
              />
            ) : (
              <EmptyState title="No hourly data" description="This date has no time-stamped orders." />
            )}
          </Card>

          <Card title={IconTitle(<Trophy size={16} />, 'Top Dishes')} subtitle="Revenue by dish on this date">
            {dishRevenueData.length > 0 ? (
              <BarChart
                data={dishRevenueData}
                bars={[{ key: 'revenue', name: 'Revenue', color: CHART_COLORS[0] }]}
                xKey="name"
                layout="vertical"
                height={Math.max(160, dishRevenueData.length * 32)}
                xFormatter={v => `₹${(Number(v) / 1000).toFixed(0)}k`}
                tooltipFormatter={(v) => [fmtCurrency(v), 'Revenue']}
              />
            ) : (
              <EmptyState title="No dishes sold" description="No billing rows found for this date." />
            )}
          </Card>

          <Card title={IconTitle(<PieChartIcon size={16} />, 'Meal Period Split')} subtitle="Revenue share on this date">
            {mealPieDataForDate.length > 0 ? (
              <DonutChart data={mealPieDataForDate} height={200} formatter={fmtCurrency} />
            ) : (
              <EmptyState title="No meal period data" description="This date has no meal-period-tagged orders." />
            )}
          </Card>

          <Card
            title={IconTitle(<TrendingUp size={16} />, '7-Day Trend')}
            subtitle="Revenue vs the surrounding week"
            action={
              windowAvg > 0 ? (
                <Badge variant={trendDiffPct >= 0 ? 'success' : 'danger'} dot>
                  {trendDiffPct >= 0 ? '+' : ''}{trendDiffPct.toFixed(1)}% vs 7-day avg
                </Badge>
              ) : undefined
            }
          >
            {trendWindow.length > 1 ? (
              <LineChart
                data={trendWindow}
                lines={[{ key: 'revenue', name: 'Revenue', color: CHART_COLORS[0] }]}
                xKey="date"
                height={200}
                xFormatter={fmtShortDate}
                yFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                tooltipFormatter={(v, name) => [fmtCurrency(v), name]}
              />
            ) : (
              <EmptyState title="Not enough surrounding data" description="Need at least one neighboring day to show a trend." />
            )}
          </Card>
        </div>
      )}

      {/* AI Strategy Note — optional commentary, failures are isolated to this section */}
      <Card
        className="mb-6"
        title={<span className="flex items-center gap-2"><Sparkles size={16} /> AI Strategy Note</span>}
        subtitle="Optional AI commentary grounded in the data report above"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => generateReport('morning')} loading={generating === 'morning'}>
              <Sun size={14} /> Morning Brief
            </Button>
            <Button onClick={() => generateReport('evening')} loading={generating === 'evening'}>
              <Moon size={14} /> Evening Report
            </Button>
          </div>
        }
      >
        {generating && (
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-5 border-2 border-[var(--color-unity)] border-t-transparent rounded-full animate-spin" />
            <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
              Generating {generating === 'morning' ? 'Morning Brief' : 'Evening Report'} for {selectedDate}...
            </p>
          </div>
        )}

        {aiError && !generating && (
          <Alert variant="danger" title="AI note unavailable" onClose={() => setAiError('')}>
            {aiError} — the data report above is unaffected.
          </Alert>
        )}

        {dateReports.length === 0 && !generating && !aiError && (
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
            No AI note generated for this date yet. Use the buttons above to generate one.
          </p>
        )}

        <div className="space-y-4 mt-4">
          {dateReports.map(report => (
            <div key={report.id} className="border border-[var(--color-border-default)] rounded-[var(--radius-md)] p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {report.type === 'morning'
                    ? <Sun size={16} style={{ color: 'var(--color-sunburst)' }} />
                    : <Moon size={16} style={{ color: 'var(--color-unity)' }} />
                  }
                  <span className="font-semibold text-[var(--text-sm)] text-[var(--color-text-primary)]">
                    {report.type === 'morning' ? 'Morning Brief' : 'Evening Report'}
                  </span>
                </div>
                <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                  {new Date(report.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">{report.aiText}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
