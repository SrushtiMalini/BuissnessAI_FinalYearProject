import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, BarChart as HBarChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Upload } from 'lucide-react';
import { storage } from '../lib/storage';
import {
  getDailySummaries, getRevenueByDay, getTopDishes,
  getMealPeriodSplit, getWeeklyComparison, computeKPIs, getPeakHours
} from '../lib/analytics';
import { StatCard, Card, PageHeader } from '../components/ui';

const COLORS = ['#4ADE80', '#60A5FA', '#F59E0B', '#F87171', '#A78BFA', '#34D399', '#FB923C'];

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function fmtShortDate(d: string): string {
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
      <div className="max-w-lg mx-auto text-center py-20">
        <Upload size={48} className="text-gray-600 mx-auto mb-4" />
        <h2 className="text-white font-semibold text-xl mb-2">No data yet</h2>
        <p className="text-gray-400 mb-6">Upload your billing data to start seeing insights.</p>
        <Link to="/upload" className="bg-[#4ADE80] text-[#0D1117] px-5 py-2 rounded-lg font-medium text-sm hover:bg-[#22c55e] transition-colors">
          Upload Data
        </Link>
      </div>
    );
  }

  const mealPieData = [
    { name: 'Breakfast', value: mealSplit.breakfast },
    { name: 'Lunch', value: mealSplit.lunch },
    { name: 'Dinner', value: mealSplit.dinner },
    { name: 'Other', value: mealSplit.other },
  ].filter(d => d.value > 0);

  const totalRevenue = summaries.reduce((s, d) => s + d.totalRevenue, 0);
  const totalOrders = summaries.reduce((s, d) => s + d.totalOrders, 0);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title={restaurant?.name ?? 'Dashboard'}
        subtitle={`${summaries.length} days of data · ${billing.length.toLocaleString()} transactions`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Revenue" value={fmtCurrency(totalRevenue)} color="#4ADE80" />
        <StatCard label="Avg Daily Revenue" value={fmtCurrency(kpis.avgDailyRevenue)} sub={kpis.bestDay ? `Best: ${kpis.bestDay.date}` : undefined} />
        <StatCard label="Total Orders" value={totalOrders.toLocaleString()} />
        <StatCard label="Avg Food Cost" value={`${kpis.avgFoodCost.toFixed(1)}%`} sub="Benchmark: 30%" color={kpis.avgFoodCost > 35 ? '#F87171' : kpis.avgFoodCost > 30 ? '#F59E0B' : '#4ADE80'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Revenue — Last 30 Days">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueByDay} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
              <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fill: '#6B7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8 }}
                labelStyle={{ color: '#9CA3AF' }}
                formatter={(v: number) => [fmtCurrency(v), 'Revenue']}
                labelFormatter={fmtShortDate}
              />
              <Line type="monotone" dataKey="revenue" stroke="#4ADE80" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" stroke="#60A5FA" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top Dishes by Revenue">
          <ResponsiveContainer width="100%" height={220}>
            <HBarChart data={topDishes} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
              <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={60} />
              <Tooltip
                contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8 }}
                formatter={(v: number) => [fmtCurrency(v), 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#4ADE80" radius={[0, 4, 4, 0]} />
            </HBarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Revenue by Meal Period">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={mealPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#4B5563' }}>
                {mealPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8 }} formatter={(v: number) => fmtCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {peakHours.length > 0 && (
          <Card title="Peak Hours">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={peakHours} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                <XAxis dataKey="hour" tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={h => `${h}:00`} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8 }}
                  formatter={(v: number) => [v, 'Orders']}
                  labelFormatter={h => `${h}:00`}
                />
                <Bar dataKey="orders" fill="#60A5FA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="This Week vs Last Week" className="md:col-span-1">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">This week</span>
              <span className="text-white font-semibold">{fmtCurrency(weekly.thisWeek)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Last week</span>
              <span className="text-white font-semibold">{fmtCurrency(weekly.lastWeek)}</span>
            </div>
            <div className="pt-2 border-t border-[#30363D] flex justify-between items-center">
              <span className="text-gray-400 text-sm">Change</span>
              <span className={`font-bold ${weekly.pctChange >= 0 ? 'text-[#4ADE80]' : 'text-red-400'}`}>
                {weekly.pctChange >= 0 ? '+' : ''}{weekly.pctChange.toFixed(1)}%
              </span>
            </div>
          </div>
        </Card>

        <Card title="Daily Revenue Breakdown (Last 14 Days)" className="md:col-span-2">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={revenueByDay.slice(-14)} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
              <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fill: '#6B7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8 }} formatter={(v: number) => [fmtCurrency(v), 'Revenue']} labelFormatter={fmtShortDate} />
              <Bar dataKey="revenue" fill="#4ADE80" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" fill="#60A5FA" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
