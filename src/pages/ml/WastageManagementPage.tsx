import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, AlertTriangle, TrendingDown, Leaf, BarChart3, Download } from 'lucide-react';
import { storage } from '../../lib/storage';
import { runWastagePredictions, analyzeWastage } from '../../lib/ml/wastagePredictor';
import { Card, Badge, MetricTile, EmptyState, Button, DataTable } from '../../design-system/components';
import { BarChart, HeatmapChart } from '../../design-system/charts';
import { addDays, getSortedDates } from '../../lib/ml/features';

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

const TABS = ['Today\'s Prep Plan', 'Wastage Analysis', 'Financial Impact', 'Weekly Report'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

export default function WastageManagementPage() {
  const [tab, setTab] = useState(0);
  const billing = storage.getBilling();
  const menu = storage.getMenu();

  const predictions = useMemo(() => runWastagePredictions(billing, menu), [billing, menu]);
  const analysis = useMemo(() => analyzeWastage(billing, menu), [billing, menu]);

  if (!billing.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Upload size={40} />}
          title="No data yet"
          description="Upload at least 14 days of billing data to activate wastage predictions."
          action={<Link to="/upload"><Button>Upload Data</Button></Link>}
        />
      </div>
    );
  }

  const sortedDates = getSortedDates(billing);
  if (sortedDates.length < 14) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<AlertTriangle size={40} />}
          title="More data needed"
          description={`${sortedDates.length} days uploaded. Need at least 14 days for wastage predictions.`}
        />
      </div>
    );
  }

  const totalSavingsToday = predictions.reduce((s, p) => s + p.estimatedSaving, 0);
  const tomorrow = addDays(sortedDates[sortedDates.length - 1], 1);

  // Heatmap: dish × day-of-week wastage
  const heatmapData = analysis.topWasteDishes.flatMap(d =>
    DAYS.map((day, dow) => {
      const wastage = billing
        .filter(e => e.dishName === d.dishName && new Date(e.date).getDay() === dow)
        .reduce((s, e) => {
          const menuItem = menu.find(m => m.name.toLowerCase() === e.dishName.toLowerCase());
          return s + e.quantity * (menuItem?.rawMaterialCost ?? 0) * 0.15; // 15% assumed wastage
        }, 0);
      return { day, hour: dow, value: Math.round(wastage), label: fmtCurrency(Math.round(wastage)) };
    })
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text-primary)]">Wastage Management</h1>
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-1">
            Newsvendor Model · Gradient-boosted demand forecasting · {tomorrow}
          </p>
        </div>
        {predictions.length > 0 && (
          <div className="bg-[var(--color-success-light)] border border-[var(--color-success)]/20 rounded-[var(--radius-lg)] px-4 py-3 text-right">
            <p className="text-[var(--text-xs)] text-[var(--color-success)] uppercase tracking-wider font-medium">Est. savings if followed</p>
            <p className="text-[var(--text-2xl)] font-semibold text-[var(--color-success)]">{fmtCurrency(totalSavingsToday)}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border-default)]">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-[var(--text-sm)] font-medium transition-colors relative ${
              tab === i
                ? 'text-[var(--color-unity)] border-b-2 border-[var(--color-unity)] -mb-px'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab 1: Today's Prep Plan */}
      {tab === 0 && (
        <div className="space-y-6">
          {predictions.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Leaf size={36} />}
                title="No prep adjustments needed"
                description="Your current prep quantities look well-calibrated for tomorrow."
              />
            </Card>
          ) : (
            <Card title="Prep Recommendations" subtitle={`For ${tomorrow}`}
              action={
                <Button variant="secondary" size="sm">
                  <Download size={14} /> Export Prep List
                </Button>
              }
            >
              <DataTable
                columns={[
                  { key: 'dishName', header: 'Dish', sortable: true },
                  {
                    key: 'recommendedPrepQty', header: 'Recommended', numeric: true, sortable: true,
                    render: (row: Record<string, unknown>) => (
                      <span className="font-mono font-semibold text-[var(--color-unity)]">{String(row.recommendedPrepQty)}</span>
                    ),
                  },
                  {
                    key: 'usualPrepQty', header: 'Usual Prep', numeric: true,
                    render: (row: Record<string, unknown>) => (
                      <span className="font-mono text-[var(--color-text-muted)]">{String(row.usualPrepQty)}</span>
                    ),
                  },
                  {
                    key: 'estimatedSaving', header: 'Saving', numeric: true, sortable: true,
                    render: (row: Record<string, unknown>) => (
                      <span className="font-mono text-[var(--color-success)] font-medium">{fmtCurrency(Number(row.estimatedSaving))}</span>
                    ),
                  },
                  {
                    key: 'confidence', header: 'Confidence',
                    render: (row: Record<string, unknown>) => (
                      <Badge variant={row.confidence === 'high' ? 'success' : row.confidence === 'medium' ? 'warning' : 'neutral'} dot>
                        {String(row.confidence)}
                      </Badge>
                    ),
                  },
                  {
                    key: 'preventionAction', header: 'Action',
                    render: (row: Record<string, unknown>) => (
                      <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)] max-w-xs">{String(row.preventionAction)}</span>
                    ),
                  },
                ]}
                data={predictions as Record<string, unknown>[]}
                keyField="dishName"
              />
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Wastage Analysis */}
      {tab === 1 && (
        <div className="space-y-6">
          <Card title="Daily Wastage — Last 30 Days" subtitle="Estimated waste cost per day">
            <BarChart
              data={analysis.dailyWaste30d}
              bars={[{ key: 'wasteRupees', name: 'Waste ₹', color: '#C0392B' }]}
              xKey="date"
              height={220}
              xFormatter={(d) => {
                const dt = new Date(String(d));
                return `${dt.getDate()}/${dt.getMonth() + 1}`;
              }}
              yFormatter={v => `₹${(v / 1000).toFixed(1)}k`}
              tooltipFormatter={(v, _) => [fmtCurrency(v), 'Wastage']}
            />
          </Card>

          <Card title="Top Wastage Offenders" subtitle="Dishes contributing most to weekly waste">
            <DataTable
              columns={[
                { key: 'dishName', header: 'Dish', sortable: true },
                {
                  key: 'weeklyWaste', header: 'Weekly Waste', numeric: true, sortable: true,
                  render: (row: Record<string, unknown>) => (
                    <span className="font-mono text-[var(--color-danger)] font-semibold">{fmtCurrency(Number(row.weeklyWaste))}</span>
                  ),
                },
                {
                  key: 'trend', header: 'Trend',
                  render: (row: Record<string, unknown>) => {
                    const t = String(row.trend);
                    return (
                      <Badge variant={t === 'improving' ? 'success' : t === 'worsening' ? 'danger' : 'neutral'} dot>
                        {t}
                      </Badge>
                    );
                  },
                },
              ]}
              data={analysis.topWasteDishes as Record<string, unknown>[]}
              keyField="dishName"
            />
          </Card>
        </div>
      )}

      {/* Tab 3: Financial Impact */}
      {tab === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricTile
              label="Weekly Waste (est.)"
              value={fmtCurrency(analysis.totalWeeklyWasteRupees)}
              valueFont="display"
              accent="var(--color-danger)"
              icon={<TrendingDown size={18} />}
            />
            <MetricTile
              label="Monthly Waste (est.)"
              value={fmtCurrency(analysis.totalMonthlyWasteRupees)}
              valueFont="display"
              accent="var(--color-danger)"
            />
            <MetricTile
              label="Waste as % of Revenue"
              value={`${analysis.wasteAsPctRevenue.toFixed(1)}%`}
              valueFont="mono"
              subtext="Industry benchmark: 8-10%"
              accent={analysis.wasteAsPctRevenue > 10 ? 'var(--color-danger)' : 'var(--color-success)'}
            />
          </div>

          <Card title="What's Driving Wastage">
            {analysis.topWasteDishes.length > 0 ? (
              <div className="space-y-3">
                {analysis.topWasteDishes.map((d, i) => (
                  <div key={d.dishName} className="flex items-center gap-4 p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-primary)]">
                    <span className="text-[var(--text-xl)] font-semibold text-[var(--color-text-muted)] font-mono w-6">{i + 1}</span>
                    <div className="flex-1">
                      <p className="font-medium text-[var(--text-sm)] text-[var(--color-text-primary)]">{d.dishName}</p>
                      <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">₹{d.weeklyWaste}/week estimated waste</p>
                    </div>
                    <Badge variant={d.trend === 'improving' ? 'success' : d.trend === 'worsening' ? 'danger' : 'neutral'} dot>
                      {d.trend}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No wastage data" description="Need more billing history to compute wastage patterns." />
            )}
          </Card>
        </div>
      )}

      {/* Tab 4: Weekly Report */}
      {tab === 3 && (
        <Card title="Weekly Wastage Report" subtitle="Auto-generated analysis">
          <EmptyState
            icon={<BarChart3 size={36} />}
            title="Report generation"
            description={
              analysis.totalWeeklyWasteRupees > 0
                ? `This week's estimated waste is ${fmtCurrency(analysis.totalWeeklyWasteRupees)}. Top offenders: ${analysis.topWasteDishes.slice(0, 3).map(d => d.dishName).join(', ')}.`
                : "Upload more billing data to generate a comprehensive wastage report."
            }
          />
          {analysis.totalWeeklyWasteRupees > 0 && (
            <div className="mt-4 p-4 bg-[var(--color-bg-primary)] rounded-[var(--radius-md)] text-[var(--text-sm)] text-[var(--color-text-secondary)] leading-relaxed">
              <p className="font-medium text-[var(--color-text-primary)] mb-2">Summary</p>
              <p>Estimated weekly waste: <strong>{fmtCurrency(analysis.totalWeeklyWasteRupees)}</strong> ({analysis.wasteAsPctRevenue.toFixed(1)}% of revenue).</p>
              <p className="mt-2">Top wastage offenders this week: {analysis.topWasteDishes.slice(0, 3).map(d => `${d.dishName} (${fmtCurrency(d.weeklyWaste)})`).join(', ')}.</p>
              <p className="mt-2">Follow tomorrow's prep plan to save up to <strong>{fmtCurrency(totalSavingsToday)}</strong> in raw material costs.</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
