import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Upload } from 'lucide-react';
import { storage } from '../lib/storage';
import { runWMAForecast } from '../lib/forecasting';
import { Card, Badge, PageHeader, StatCard } from '../components/ui';

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ForecastPage() {
  const billing = storage.getBilling();
  const forecast = useMemo(() => runWMAForecast(billing, 7), [billing]);

  if (!billing.length) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <Upload size={48} className="text-gray-600 mx-auto mb-4" />
        <h2 className="text-white font-semibold text-xl mb-2">No data to forecast</h2>
        <p className="text-gray-400 mb-6">Upload at least 7 days of billing data to enable forecasting.</p>
        <Link to="/upload" className="bg-[#4ADE80] text-[#0D1117] px-5 py-2 rounded-lg font-medium text-sm">Upload Data</Link>
      </div>
    );
  }

  if (!forecast.totalRevenueForecast.length) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-gray-400">Need at least 7 days of data to generate a forecast. Upload more data.</p>
      </div>
    );
  }

  const totalForecast7d = forecast.totalRevenueForecast.reduce((s, f) => s + f.predicted, 0);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Demand Forecast"
        subtitle="WMA model — Weighted Moving Average built from scratch (no external ML library)"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="7-Day Forecast" value={fmtCurrency(totalForecast7d)} sub="Next 7 days" color="#4ADE80" />
        <StatCard label="Model MAE" value={`₹${forecast.mae}`} sub="Mean Absolute Error" />
        <StatCard label="Model RMSE" value={`₹${forecast.rmse}`} sub="Root Mean Square Error" />
        <StatCard label="Dishes Tracked" value={forecast.dishForecasts.length.toString()} sub="Individual forecasts" />
      </div>

      <Card title="7-Day Revenue Forecast" className="mb-4">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={forecast.totalRevenueForecast} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
            <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { weekday: 'short' })} tick={{ fill: '#6B7280', fontSize: 12 }} />
            <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8 }}
              formatter={(v: number) => [fmtCurrency(v), 'Predicted Revenue']}
              labelFormatter={fmtDate}
            />
            <Line type="monotone" dataKey="predicted" stroke="#4ADE80" strokeWidth={2.5} dot={{ fill: '#4ADE80', r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Day-by-Day Forecast" className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363D]">
                {['Date', 'Day', 'Predicted Revenue', 'Confidence'].map(h => (
                  <th key={h} className="text-left text-gray-400 font-medium pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.totalRevenueForecast.map((f, i) => {
                const day = new Date(f.date).toLocaleDateString('en-IN', { weekday: 'long' });
                const isWeekend = [0, 6].includes(new Date(f.date).getDay());
                return (
                  <tr key={i} className="border-b border-[#30363D]/50">
                    <td className="py-2.5 pr-4 text-gray-300">{f.date}</td>
                    <td className="py-2.5 pr-4 text-white font-medium">{day}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-[#4ADE80] font-semibold">{fmtCurrency(f.predicted)}</span>
                    </td>
                    <td className="py-2.5">
                      {isWeekend ? <Badge variant="green">High (weekend)</Badge> : <Badge variant="blue">Normal</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Per-Dish Prep Forecast (plates to prepare)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363D]">
                <th className="text-left text-gray-400 font-medium pb-2 pr-4">Dish</th>
                {forecast.totalRevenueForecast.map(f => (
                  <th key={f.date} className="text-left text-gray-400 font-medium pb-2 pr-4 whitespace-nowrap">
                    {new Date(f.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.dishForecasts.slice(0, 10).map(df => (
                <tr key={df.dishName} className="border-b border-[#30363D]/50">
                  <td className="py-2 pr-4 text-white font-medium">{df.dishName}</td>
                  {df.forecasts.map((f, i) => (
                    <td key={i} className="py-2 pr-4 text-gray-300">
                      {f.predicted > 0 ? `${f.predicted} plates` : <span className="text-gray-600">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-gray-500 text-xs mt-3">
          * Forecast uses Weighted Moving Average: 40% last week + 30% 2 weeks ago + 20% 3 weeks ago + 10% 4 weeks ago, per day-of-week.
          MAE ₹{forecast.mae} means the model is off by ±₹{forecast.mae} per day on average.
        </p>
      </Card>
    </div>
  );
}
