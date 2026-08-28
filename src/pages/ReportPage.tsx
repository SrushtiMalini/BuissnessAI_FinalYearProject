import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Upload, ChevronLeft, ChevronRight, BarChart3, Sparkles } from 'lucide-react';
import { storage } from '../lib/storage';
import { generateDailyReport } from '../lib/reportGenerator';
import { getDailySummaries } from '../lib/analytics';
import { Button, Card, Badge, EmptyState, PageHeader, Alert, formInputClass } from '../design-system/components';
import type { Report } from '../types';

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
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
      storage.appendReport(report);
      setReports(storage.getReports());
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
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
