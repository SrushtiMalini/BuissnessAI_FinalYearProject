import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, RefreshCw, Sun, Moon, Upload } from 'lucide-react';
import { storage } from '../lib/storage';
import { generateDailyReport } from '../lib/reportGenerator';
import { getDailySummaries } from '../lib/analytics';
import { Button, Card, Badge, PageHeader } from '../components/ui';
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
      <div className="max-w-lg mx-auto text-center py-20">
        <Upload size={48} className="text-gray-600 mx-auto mb-4" />
        <h2 className="text-white font-semibold text-xl mb-2">No data yet</h2>
        <p className="text-gray-400 mb-6">Upload billing data to generate reports.</p>
        <Link to="/upload" className="bg-[#4ADE80] text-[#0D1117] px-5 py-2 rounded-lg font-medium text-sm">Upload Data</Link>
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
      />

      <div className="flex gap-3 mb-6">
        <Button onClick={() => generateReport('morning')} loading={generating === 'morning'} variant="secondary">
          <Sun size={15} /> Morning Brief
        </Button>
        <Button onClick={() => generateReport('evening')} loading={generating === 'evening'}>
          <Moon size={15} /> Generate Evening Report
        </Button>
      </div>

      {lastSummary && (
        <Card title="Latest Day Summary" className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-400 text-xs">Revenue</p>
              <p className="text-[#4ADE80] font-bold text-lg">{fmtCurrency(lastSummary.totalRevenue)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Orders</p>
              <p className="text-white font-bold text-lg">{lastSummary.totalOrders}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Gross Profit</p>
              <p className="text-white font-bold text-lg">{fmtCurrency(lastSummary.grossProfit)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Food Cost</p>
              <p className={`font-bold text-lg ${lastSummary.foodCostPct > 35 ? 'text-red-400' : 'text-white'}`}>
                {lastSummary.foodCostPct.toFixed(1)}%
              </p>
            </div>
          </div>
          {lastSummary.topDishes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#30363D]">
              <p className="text-gray-400 text-xs mb-2">Top dishes</p>
              <div className="flex flex-wrap gap-2">
                {lastSummary.topDishes.map(d => (
                  <Badge key={d.name} variant="green">{d.name} ({d.quantity})</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {generating && (
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <RefreshCw size={16} className="text-[#4ADE80] animate-spin" />
            <div>
              <p className="text-white text-sm font-medium">Generating {generating === 'morning' ? 'Morning Brief' : 'Evening Report'}...</p>
              <p className="text-gray-500 text-xs">AI is analysing your restaurant data via RAG</p>
            </div>
          </div>
        </Card>
      )}

      {reports.length === 0 && !generating && (
        <Card>
          <div className="text-center py-8">
            <FileText size={40} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No reports generated yet. Click a button above to generate your first report.</p>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {reports.map(report => (
          <Card key={report.id}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {report.type === 'morning' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-blue-400" />}
                <span className="text-white font-semibold text-sm">
                  {report.type === 'morning' ? 'Morning Brief' : 'Evening Report'}
                </span>
                <Badge variant={report.type === 'morning' ? 'amber' : 'blue'}>{report.date}</Badge>
              </div>
              <span className="text-gray-500 text-xs">{new Date(report.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{report.aiText}</p>
            <div className="flex gap-4 mt-3 pt-3 border-t border-[#30363D]">
              <span className="text-gray-500 text-xs">Revenue: {fmtCurrency(report.summary.totalRevenue)}</span>
              <span className="text-gray-500 text-xs">Orders: {report.summary.totalOrders}</span>
              <span className="text-gray-500 text-xs">Food Cost: {report.summary.foodCostPct.toFixed(1)}%</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
