import type { ReactNode } from 'react';
import {
  BarChart as RBarChart, Bar, LineChart as RLineChart, Line,
  AreaChart as RAreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';

export const CHART_COLORS = ['#5B6B4A', '#E8A830', '#8B9B7A', '#C0392B', '#2C7A5C', '#D4A017'];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    color: 'var(--color-text-primary)',
    fontSize: '13px',
  },
  labelStyle: { color: 'var(--color-text-secondary)', marginBottom: 4 },
};

const axisStyle = { fill: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'IBM Plex Mono' };
const gridStyle = { stroke: 'var(--color-border-default)', strokeDasharray: '3 3', vertical: false };

interface ChartWrapperProps {
  data: Record<string, unknown>[];
  height?: number;
  children?: ReactNode;
}

// ─── BarChart ────────────────────────────────────────────────────────────────

interface BarChartProps extends ChartWrapperProps {
  bars: { key: string; name?: string; color?: string }[];
  xKey?: string;
  xFormatter?: (v: unknown) => string;
  yFormatter?: (v: number) => string;
  tooltipFormatter?: (v: number, name: string) => [string, string];
  layout?: 'horizontal' | 'vertical';
}

export function BarChart({
  data, bars, xKey = 'date', height = 220, xFormatter, yFormatter,
  tooltipFormatter, layout = 'horizontal',
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart data={data} layout={layout} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid {...gridStyle} />
        <XAxis
          dataKey={layout === 'horizontal' ? xKey : undefined}
          type={layout === 'vertical' ? 'number' : 'category'}
          tick={axisStyle}
          axisLine={{ stroke: 'var(--color-border-default)' }}
          tickLine={false}
          minTickGap={20}
          tickFormatter={xFormatter as ((v: unknown) => string) | undefined}
        />
        <YAxis
          type={layout === 'vertical' ? 'category' : 'number'}
          dataKey={layout === 'vertical' ? xKey : undefined}
          tick={axisStyle}
          axisLine={false}
          tickLine={false}
          tickFormatter={yFormatter ? (v: number) => yFormatter(v) : undefined}
          width={layout === 'vertical' ? 80 : undefined}
        />
        <Tooltip {...tooltipStyle} formatter={tooltipFormatter} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-secondary)' }} />}
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name ?? b.key}
            fill={b.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={layout === 'horizontal' ? [4, 4, 0, 0] : [0, 4, 4, 0]}
            maxBarSize={40}
          />
        ))}
      </RBarChart>
    </ResponsiveContainer>
  );
}

// ─── LineChart ───────────────────────────────────────────────────────────────

interface LineChartProps extends ChartWrapperProps {
  lines: { key: string; name?: string; color?: string; dashed?: boolean }[];
  xKey?: string;
  xFormatter?: (v: unknown) => string;
  yFormatter?: (v: number) => string;
  tooltipFormatter?: (v: number, name: string) => [string, string];
}

export function LineChart({
  data, lines, xKey = 'date', height = 220, xFormatter, yFormatter, tooltipFormatter,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RLineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={{ stroke: 'var(--color-border-default)' }}
          tickLine={false} minTickGap={20} tickFormatter={xFormatter as ((v: unknown) => string) | undefined} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false}
          tickFormatter={yFormatter ? (v: number) => yFormatter(v) : undefined} />
        <Tooltip {...tooltipStyle} formatter={tooltipFormatter} />
        {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-secondary)' }} />}
        {lines.map((l, i) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name ?? l.key}
            stroke={l.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2} dot={false}
            strokeDasharray={l.dashed ? '4 4' : undefined}
            animationDuration={600}
          />
        ))}
      </RLineChart>
    </ResponsiveContainer>
  );
}

// ─── AreaChart ───────────────────────────────────────────────────────────────

interface AreaChartProps extends ChartWrapperProps {
  areas: { key: string; name?: string; color?: string }[];
  xKey?: string;
  xFormatter?: (v: unknown) => string;
  yFormatter?: (v: number) => string;
  tooltipFormatter?: (v: number, name: string) => [string, string];
}

export function AreaChart({
  data, areas, xKey = 'date', height = 220, xFormatter, yFormatter, tooltipFormatter,
}: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RAreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <defs>
          {areas.map((a, i) => (
            <linearGradient key={a.key} id={`grad-${a.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={a.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.15} />
              <stop offset="100%" stopColor={a.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.01} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={{ stroke: 'var(--color-border-default)' }}
          tickLine={false} minTickGap={20} tickFormatter={xFormatter as ((v: unknown) => string) | undefined} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false}
          tickFormatter={yFormatter ? (v: number) => yFormatter(v) : undefined} />
        <Tooltip {...tooltipStyle} formatter={tooltipFormatter} />
        {areas.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-secondary)' }} />}
        {areas.map((a, i) => (
          <Area key={a.key} type="monotone" dataKey={a.key} name={a.name ?? a.key}
            stroke={a.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            fill={`url(#grad-${a.key})`}
            strokeWidth={2} dot={false} animationDuration={600}
          />
        ))}
      </RAreaChart>
    </ResponsiveContainer>
  );
}

// ─── DonutChart ──────────────────────────────────────────────────────────────

interface DonutChartProps {
  data: { name: string; value: number }[];
  height?: number;
  colors?: string[];
  formatter?: (v: number) => string;
}

export function DonutChart({ data, height = 200, colors = CHART_COLORS, formatter }: DonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
          innerRadius="55%" outerRadius="80%" strokeWidth={2} stroke="var(--color-bg-card)">
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={formatter ? (v: number) => [formatter(v), ''] : undefined} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-secondary)' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── HeatmapChart ────────────────────────────────────────────────────────────
// Implemented using a CSS grid — Recharts ScatterChart isn't suited for heatmaps

interface HeatmapData {
  day: string;
  hour: number;
  value: number;
  label?: string;
}

interface HeatmapChartProps {
  data: HeatmapData[];
  days: string[];
  hours: number[];
  maxValue?: number;
  cellLabel?: (d: HeatmapData) => string;
}

function heatmapColor(intensity: number): string {
  // 0 = light green, 0.5 = amber, 1 = red
  if (intensity < 0.25) return `hsl(140,40%,${90 - intensity * 80}%)`;
  if (intensity < 0.6) return `hsl(${40 - intensity * 30},85%,${70 - intensity * 20}%)`;
  return `hsl(${10 - intensity * 5},75%,${55 - intensity * 15}%)`;
}

export function HeatmapChart({ data, days, hours, maxValue, cellLabel }: HeatmapChartProps) {
  const max = maxValue ?? Math.max(...data.map(d => d.value), 1);
  const map = new Map(data.map(d => [`${d.day}|${d.hour}`, d]));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* Hour header */}
        <div className="flex mb-1 ml-16">
          {hours.map(h => (
            <div key={h} className="w-9 text-center text-[10px] text-[var(--color-text-muted)] font-mono shrink-0">
              {h}
            </div>
          ))}
        </div>
        {days.map(day => (
          <div key={day} className="flex items-center mb-1">
            <div className="w-16 text-[var(--text-xs)] text-[var(--color-text-muted)] pr-2 text-right font-medium shrink-0">
              {day}
            </div>
            {hours.map(h => {
              const d = map.get(`${day}|${h}`);
              const intensity = d ? d.value / max : 0;
              return (
                <div key={h} title={d ? `${day} ${h}:00 — ${d.label ?? d.value}` : undefined}
                  className="w-9 h-7 rounded-[var(--radius-sm)] mr-0.5 flex items-center justify-center shrink-0 transition-transform hover:scale-105 cursor-default"
                  style={{ backgroundColor: intensity > 0 ? heatmapColor(intensity) : 'var(--color-bg-secondary)' }}>
                  {d && intensity > 0.3 && (
                    <span className="text-[9px] font-mono text-white/80">{cellLabel ? cellLabel(d) : ''}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
