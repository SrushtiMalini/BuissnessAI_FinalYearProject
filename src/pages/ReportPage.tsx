import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Upload, FileText } from 'lucide-react';
import { storage } from '../lib/storage';
import { generateDailyReport } from '../lib/reportGenerator';
import { getDailySummaries } from '../lib/analytics';
import { Button, Card, Badge, EmptyState, PageHeader, MetricTile } from '../design-system/components';
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

  if (!billing.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Upload size={40} />}
          title="No data yet"
          description="Upload billing data to generate AI-powered reports."
          action={<Link to="/upload"><Button>Upload Data</Button></Link>}
        />
      </div>
    );
  }

  const summaries = getDailySummaries(billing, menu);
  const lastSummary = summaries[summaries.length - 1];

  async function generateReport(type: 'morning' | 'evening') {
    setGenerating(type);
    try {
      const name = restaurant?.name ?? 'your restaurant';
      const aiText = await generateDailyReport(billing, menu, name, type);
      const report: Report = {
        id: Date.now().toString(),
        date: lastSummary?.date ?? new Date().toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
        summary: lastSummary ?? { date: '', totalRevenue: 0, totalOrders: 0, topDishes: [], foodCostPct: 0, grossProfit: 0 },
        aiText,
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
        subtitle="AI-generated reports using RAG — grounded in your actual restaurant data"
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
      />

      {lastSummary && (
        <Card className="mb-6">
          <p className="text-[var(--text-xs)] uppercase tracking-wider text-[var(--color-text-muted)] mb-4 font-medium">Latest Day — {lastSummary.date}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">Revenue</p>
              <p className="font-semibold text-[var(--text-xl)] text-[var(--color-text-accent)]">{fmtCurrency(lastSummary.totalRevenue)}</p>
            </div>
            <div>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">Orders</p>
              <p className="font-semibold text-[var(--text-xl)] text-[var(--color-text-primary)]">{lastSummary.totalOrders}</p>
            </div>
            <div>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">Gross Profit</p>
              <p className="font-semibold text-[var(--text-xl)] text-[var(--color-text-primary)]">{fmtCurrency(lastSummary.grossProfit)}</p>
            </div>
            <div>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">Food Cost</p>
              <p className={`font-semibold text-[var(--text-xl)] ${lastSummary.foodCostPct > 35 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}>
                {lastSummary.foodCostPct.toFixed(1)}%
              </p>
            </div>
          </div>
          {lastSummary.topDishes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border-default)]">
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-2">Top dishes</p>
              <div className="flex flex-wrap gap-2">
                {lastSummary.topDishes.map(d => (
                  <Badge key={d.name} variant="info">{d.name} ({d.quantity})</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {generating && (
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[var(--color-unity)] border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="font-medium text-[var(--text-sm)] text-[var(--color-text-primary)]">
                Generating {generating === 'morning' ? 'Morning Brief' : 'Evening Report'}...
              </p>
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">AI is analysing your restaurant data via RAG</p>
            </div>
          </div>
        </Card>
      )}

      {reports.length === 0 && !generating && (
        <Card>
          <EmptyState
            icon={<FileText size={36} />}
            title="No reports yet"
            description="Generate your first morning brief or evening report using the buttons above."
          />
        </Card>
      )}

      <div className="space-y-4">
        {reports.map(report => (
          <Card key={report.id}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {report.type === 'morning'
                  ? <Sun size={16} style={{ color: 'var(--color-sunburst)' }} />
                  : <Moon size={16} style={{ color: 'var(--color-unity)' }} />
                }
                <span className="font-semibold text-[var(--text-sm)] text-[var(--color-text-primary)]">
                  {report.type === 'morning' ? 'Morning Brief' : 'Evening Report'}
                </span>
                <Badge variant={report.type === 'morning' ? 'warning' : 'info'}>{report.date}</Badge>
              </div>
              <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                {new Date(report.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">{report.aiText}</p>
            <div className="flex gap-4 mt-3 pt-3 border-t border-[var(--color-border-default)]">
              <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">Revenue: {fmtCurrency(report.summary.totalRevenue)}</span>
              <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">Orders: {report.summary.totalOrders}</span>
              <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">Food Cost: {report.summary.foodCostPct.toFixed(1)}%</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
