import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, TrendingUp, ShoppingBag, Percent, Activity, Lightbulb,
  Trophy, PieChart as PieChartIcon, CalendarDays, Clock, Layers,
} from 'lucide-react';
import { storage } from '../lib/storage';
import {
  getDailySummaries, getRevenueByDay, getTopDishes,
  getMealPeriodSplit, getWeeklyComparison, computeKPIs, getPeakHours,
} from '../lib/analytics';
import { computeDishMetrics, classifyMenu } from '../lib/menuEngine';
import { MetricTile, Card, Badge, EmptyState, Button, DataTable, IconTitle } from '../design-system/components';
import { AreaChart, BarChart, DonutChart } from '../design-system/charts';
import { CHART_COLORS } from '../design-system/charts';

const FOOD_COST_BENCHMARK = 30;

const MENU_HEALTH_CONFIG = {
  star: { label: 'Star', variant: 'warning' as const },
  hiddenGem: { label: 'Hidden Gem', variant: 'info' as const },
  volumeTrap: { label: 'Volume Trap', variant: 'neutral' as const },
  deadWeight: { label: 'Dead Weight', variant: 'danger' as const },
};

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function fmtShortDate(d: unknown): string {
  if (typeof d !== 'string') return '';
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

// Plain computed callouts — no AI involved, just thresholds/derivations over the same data the KPI tiles use.
function computeInsights(
  kpis: ReturnType<typeof computeKPIs>,
  weekly: ReturnType<typeof getWeeklyComparison>,
  topDishes: { name: string; quantity: number; revenue: number }[],
  quadrant: ReturnType<typeof classifyMenu>,
): string[] {
  const insights: string[] = [];

  const foodCostDiff = kpis.avgFoodCost - FOOD_COST_BENCHMARK;
  if (Math.abs(foodCostDiff) >= 1) {
    insights.push(
      `Food cost is ${Math.abs(foodCostDiff).toFixed(0)}pt${Math.abs(foodCostDiff) >= 1.5 ? 's' : ''} ${foodCostDiff > 0 ? 'above' : 'below'} the ${FOOD_COST_BENCHMARK}% benchmark`
    );
  }

  if (weekly.lastWeek > 0) {
    const dir = weekly.pctChange >= 0 ? 'up' : 'down';
    insights.push(`Revenue is ${dir} ${Math.abs(weekly.pctChange).toFixed(1)}% vs last week`);
  }

  if (topDishes[0]) {
    insights.push(`${topDishes[0].name} is your top earner (${fmtCurrency(topDishes[0].revenue)})`);
  }

  if (quadrant.deadWeight.length > 0) {
    insights.push(`${quadrant.deadWeight.length} dish${quadrant.deadWeight.length > 1 ? 'es are' : ' is'} Dead Weight — consider trimming the menu`);
  } else if (quadrant.hiddenGem.length > 0) {
    insights.push(`${quadrant.hiddenGem.length} Hidden Gem dish${quadrant.hiddenGem.length > 1 ? 'es' : ''} — promote ${quadrant.hiddenGem.length > 1 ? 'them' : 'it'} more`);
  }

  return insights.slice(0, 4);
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
  const dishMetrics = useMemo(() => computeDishMetrics(billing, menu), [billing, menu]);
  const quadrant = useMemo(() => classifyMenu(dishMetrics), [dishMetrics]);
  const insights = useMemo(() => computeInsights(kpis, weekly, topDishes, quadrant), [kpis, weekly, topDishes, quadrant]);

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
          status={weekly.lastWeek > 0 ? (weekly.pctChange >= 0 ? 'good' : weekly.pctChange <= -10 ? 'danger' : 'warning') : undefined}
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
          subtext={`Benchmark: ${FOOD_COST_BENCHMARK}%`}
          accent={kpis.avgFoodCost > 35 ? 'var(--color-danger)' : kpis.avgFoodCost > 30 ? 'var(--color-warning)' : 'var(--color-success)'}
          status={kpis.avgFoodCost > 35 ? 'danger' : kpis.avgFoodCost > 30 ? 'warning' : 'good'}
          icon={<Percent size={18} />}
        />
      </div>

      {/* Insights strip — plain computed callouts, no AI */}
      {insights.length > 0 && (
        <Card padding="sm">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {insights.map((text, i) => (
              <div key={i} className="flex items-center gap-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                <Lightbulb size={14} style={{ color: 'var(--color-sunburst)' }} className="shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Menu Health */}
      <Card
        title={IconTitle(<Layers size={16} />, 'Menu Health')}
        subtitle="Profitability classification across your menu"
        action={<Link to="/menu" className="text-[var(--text-xs)] font-medium text-[var(--color-unity)] hover:underline">View Menu →</Link>}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(MENU_HEALTH_CONFIG) as (keyof typeof MENU_HEALTH_CONFIG)[]).map(key => {
            const cfg = MENU_HEALTH_CONFIG[key];
            return (
              <div key={key} className="text-center p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-primary)]">
                <p className="text-[var(--text-2xl)] font-semibold text-[var(--color-text-primary)]">{quadrant[key].length}</p>
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Revenue trend */}
      <Card title={IconTitle(<TrendingUp size={16} />, 'Revenue — Last 30 Days')} subtitle="Revenue and gross profit trend">
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
        <Card title={IconTitle(<Trophy size={16} />, 'Top Dishes by Revenue')} subtitle="All-time performance">
          <DataTable
            columns={topDishColumns as any}
            data={topDishes.map((d, i) => ({ ...d, rank: i + 1 })) as any}
            keyField="name"
          />
        </Card>

        {/* Meal period split */}
        <Card title={IconTitle(<PieChartIcon size={16} />, 'Revenue by Meal Period')}>
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
        <Card title={IconTitle(<CalendarDays size={16} />, 'This Week vs Last Week')}>
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
          <Card title={IconTitle(<Clock size={16} />, 'Peak Hours')} subtitle="Order volume by hour" className="lg:col-span-2">
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
          <Card title={IconTitle(<Clock size={16} />, 'Peak Hours')} className="lg:col-span-2">
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
