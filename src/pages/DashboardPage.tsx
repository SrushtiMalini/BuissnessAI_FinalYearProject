import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Upload, TrendingUp, ShoppingBag, Percent, Activity } from 'lucide-react';
import { storage } from '../lib/storage';
import {
  getDailySummaries, getRevenueByDay, getTopDishes,
  getMealPeriodSplit, getWeeklyComparison, computeKPIs, getPeakHours,
} from '../lib/analytics';
import { MetricTile, Card, Badge, EmptyState, Button, DataTable } from '../design-system/components';
import { AreaChart, BarChart, DonutChart } from '../design-system/charts';
import { CHART_COLORS } from '../design-system/charts';

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function fmtShortDate(d: unknown): string {
  if (typeof d !== 'string') return '';
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

export default function DashboardPage() {
  const billing = storage.getBilling();
  const menu = storage.getMenu();
  const restaurant = storage.getRestaurant();

  const summaries = useMemo(() => getDailySummaries(billing, menu), [billing, menu]);
  const revenueByDay = useMemo(() => getRevenueByDay(summaries, 30), [summaries]);
  const topDishes = useMemo(() => getTopDishes(billing, 8), [billing]);
  const mealSplit = useMemo(() => getMealPeriodSplit(billing), [billing]);
  const weekly = useMemo(() => getWeeklyComparison(summaries), [summaries]);
  const kpis = useMemo(() => computeKPIs(summaries), [summaries]);
  const peakHours = useMemo(() => getPeakHours(billing).filter(h => h.orders > 0), [billing]);

  if (!billing.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Upload size={40} />}
          title="No data yet"
          description="Upload your billing CSV to start seeing insights and AI recommendations."
          action={<Link to="/upload"><Button>Upload Data</Button></Link>}
        />
      </div>
    );
  }

  const totalRevenue = summaries.reduce((s, d) => s + d.totalRevenue, 0);
  const totalOrders = summaries.reduce((s, d) => s + d.totalOrders, 0);

  const mealPieData = [
    { name: 'Breakfast', value: mealSplit.breakfast },
    { name: 'Lunch', value: mealSplit.lunch },
    { name: 'Dinner', value: mealSplit.dinner },
    { name: 'Other', value: mealSplit.other },
  ].filter(d => d.value > 0);

  const topDishColumns = [
    {
      key: 'rank', header: '#', width: '40px',
      render: (_: unknown, i: number) => (
        <span className="text-[var(--color-text-muted)] font-mono text-xs">{i + 1}</span>
      ),
    },
    { key: 'name', header: 'Dish' },
    {
      key: 'quantity', header: 'Orders', numeric: true, sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="font-mono">{Number(row.quantity).toLocaleString('en-IN')}</span>
      ),
    },
    {
      key: 'revenue', header: 'Revenue', numeric: true, sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="font-mono text-[var(--color-text-accent)]">{fmtCurrency(Number(row.revenue))}</span>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          label="Total Revenue"
          value={fmtCurrency(totalRevenue)}
          valueFont="display"
          change={weekly.pctChange}
          changeLabel="vs last week"
          icon={<TrendingUp size={18} />}
        />
        <MetricTile
          label="Total Orders"
          value={totalOrders.toLocaleString('en-IN')}
          valueFont="mono"
          subtext={`${summaries.length} days of data`}
          icon={<ShoppingBag size={18} />}
        />
        <MetricTile
          label="Avg Daily Revenue"
          value={fmtCurrency(kpis.avgDailyRevenue)}
          valueFont="display"
          subtext={kpis.bestDay ? `Best: ${kpis.bestDay.date}` : undefined}
          icon={<Activity size={18} />}
        />
        <MetricTile
          label="Avg Food Cost"
          value={`${kpis.avgFoodCost.toFixed(1)}%`}
          valueFont="mono"
          subtext="Benchmark: 30%"
          accent={kpis.avgFoodCost > 35 ? 'var(--color-danger)' : kpis.avgFoodCost > 30 ? 'var(--color-warning)' : 'var(--color-success)'}
          icon={<Percent size={18} />}
        />
      </div>

      {/* Revenue trend */}
      <Card title="Revenue — Last 30 Days" subtitle="Revenue and gross profit trend">
        <AreaChart
          data={revenueByDay}
          areas={[
            { key: 'revenue', name: 'Revenue', color: CHART_COLORS[0] },
            { key: 'profit', name: 'Gross Profit', color: CHART_COLORS[1] },
          ]}
          xKey="date"
          height={240}
          xFormatter={fmtShortDate}
          yFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
          tooltipFormatter={(v, name) => [fmtCurrency(v), name]}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top dishes table */}
        <Card title="Top Dishes by Revenue" subtitle="All-time performance">
          <DataTable
            columns={topDishColumns as any}
            data={topDishes.map((d, i) => ({ ...d, rank: i + 1 })) as any}
            keyField="name"
          />
        </Card>

        {/* Meal period split */}
        <Card title="Revenue by Meal Period">
          {mealPieData.length > 0 ? (
            <DonutChart
              data={mealPieData}
              height={220}
              formatter={fmtCurrency}
            />
          ) : (
            <EmptyState
              title="No meal period data"
              description="Upload data with time information to see meal split."
            />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly comparison */}
        <Card title="This Week vs Last Week">
          <div className="space-y-3 pt-2">
            {[
              { label: 'This week', value: fmtCurrency(weekly.thisWeek), highlight: true },
              { label: 'Last week', value: fmtCurrency(weekly.lastWeek), highlight: false },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center">
                <span className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">{row.label}</span>
                <span className={`font-semibold ${row.highlight ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                  {row.value}
                </span>
              </div>
            ))}
            <div className="pt-2 border-t border-[var(--color-border-default)] flex justify-between items-center">
              <span className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">Change</span>
              <Badge variant={weekly.pctChange >= 0 ? 'success' : 'danger'} dot>
                {weekly.pctChange >= 0 ? '+' : ''}{weekly.pctChange.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </Card>

        {/* Peak hours */}
        {peakHours.length > 0 ? (
          <Card title="Peak Hours" subtitle="Order volume by hour" className="lg:col-span-2">
            <BarChart
              data={peakHours.filter(h => h.orders > 0).slice(6, 23)}
              bars={[{ key: 'orders', name: 'Orders', color: CHART_COLORS[1] }]}
              xKey="hour"
              height={180}
              xFormatter={v => `${v}:00`}
              tooltipFormatter={(v, _) => [`${v} orders`, 'Orders']}
            />
          </Card>
        ) : (
          <Card title="Peak Hours" className="lg:col-span-2">
            <EmptyState
              title="No time data"
              description="Upload data with time column to see peak hour analysis."
            />
          </Card>
        )}
      </div>
    </div>
  );
}
