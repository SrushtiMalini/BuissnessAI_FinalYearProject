import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Users, Clock } from 'lucide-react';
import { storage } from '../../lib/storage';
import { runWorkforceForecast, buildWorkforceHeatmap, getWeeklyStaffCost } from '../../lib/ml/workforceForecast';
import { Card, Badge, MetricTile, EmptyState, Button, DataTable } from '../../design-system/components';
import { HeatmapChart } from '../../design-system/charts';
import { getSortedDates } from '../../lib/ml/features';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const BIN_COLORS: Record<string, string> = {
  low: 'success',
  medium: 'info',
  high: 'warning',
  peak: 'danger',
};

export default function WorkforcePlanningPage() {
  const billing = storage.getBilling();
  const [viewMode, setViewMode] = useState<'heatmap' | 'table'>('heatmap');

  const recs = useMemo(() => runWorkforceForecast(billing, 7), [billing]);
  const heatmapData = useMemo(() => buildWorkforceHeatmap(recs), [recs]);
  const weeklyStaffCost = useMemo(() => getWeeklyStaffCost(recs), [recs]);

  const sortedDates = getSortedDates(billing);

  if (!billing.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Upload size={40} />}
          title="No data yet"
          description="Upload billing data to generate workforce recommendations."
          action={<Link to="/upload"><Button>Upload Data</Button></Link>}
        />
      </div>
    );
  }

  // Tomorrow's peak hours
  const tomorrow = recs.filter(r => {
    if (!recs.length) return false;
    return r.date === recs[0].date;
  }).sort((a, b) => b.predictedOrders - a.predictedOrders).slice(0, 3);

  const totalStaffNeeded = recs.length > 0
    ? Math.max(...recs.map(r => r.recommendedStaff.kitchen + r.recommendedStaff.service + r.recommendedStaff.cashier))
    : 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text-primary)]">Workforce Planning</h1>
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-1">
            Feature-weighted demand bins · Random Forest analogue · {sortedDates.length} days of training data
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === 'heatmap' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('heatmap')}>Heatmap</Button>
          <Button variant={viewMode === 'table' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('table')}>Schedule</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MetricTile label="Peak Staff Needed" value={String(totalStaffNeeded)} valueFont="mono" subtext="Max staff at any hour" icon={<Users size={18} />} />
        <MetricTile label="Est. Weekly Staff Cost" value={`₹${weeklyStaffCost.toLocaleString('en-IN')}`} valueFont="display" subtext="At ₹600/staff/day" />
        <MetricTile label="Days Forecast" value="7" valueFont="mono" subtext="Next 7 days" />
      </div>

      {/* Tomorrow's peaks */}
      {tomorrow.length > 0 && (
        <Card title="Tomorrow's Peak Hours" subtitle="Highest demand periods" className="mb-6">
          <div className="flex gap-4 flex-wrap">
            {tomorrow.map((rec, i) => (
              <div key={i} className={`flex-1 min-w-32 p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-primary)]`}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-[var(--color-text-muted)]" />
                  <span className="font-mono font-semibold text-[var(--color-text-primary)]">{rec.hour}:00</span>
                </div>
                <Badge variant={BIN_COLORS[rec.demandBin] as any} dot>{rec.demandBin}</Badge>
                <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-2">
                  {rec.recommendedStaff.kitchen}K + {rec.recommendedStaff.service}S + {rec.recommendedStaff.cashier}C staff
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {recs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={36} />}
            title="Generating workforce forecast"
            description="Need more historical data to build reliable demand patterns."
          />
        </Card>
      ) : viewMode === 'heatmap' ? (
        <Card title="Weekly Demand Heatmap" subtitle="Colour intensity = order volume · Numbers = recommended staff">
          {heatmapData.length > 0 ? (
            <HeatmapChart
              data={heatmapData}
              days={DAY_NAMES}
              hours={HOURS}
              cellLabel={(d) => d.label}
            />
          ) : (
            <EmptyState
              title="No hourly time data"
              description="Your billing data doesn't have time information. The heatmap uses estimated patterns instead."
            />
          )}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--color-border-default)]">
            <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">Demand intensity:</span>
            {['low', 'medium', 'high', 'peak'].map(bin => (
              <Badge key={bin} variant={BIN_COLORS[bin] as any} dot>{bin}</Badge>
            ))}
          </div>
        </Card>
      ) : (
        <Card title="Weekly Staffing Schedule">
          <DataTable
            columns={[
              { key: 'date', header: 'Date', render: (row: Record<string, unknown>) => <span className="font-mono text-[var(--text-xs)]">{String(row.date)}</span> },
              { key: 'hour', header: 'Hour', numeric: true, render: (row: Record<string, unknown>) => <span className="font-mono">{String(row.hour)}:00</span> },
              { key: 'shiftLabel', header: 'Shift', render: (row: Record<string, unknown>) => <Badge variant="neutral">{String(row.shiftLabel)}</Badge> },
              {
                key: 'demandBin', header: 'Demand',
                render: (row: Record<string, unknown>) => (
                  <Badge variant={BIN_COLORS[String(row.demandBin)] as any} dot>{String(row.demandBin)}</Badge>
                ),
              },
              {
                key: 'predictedOrders', header: 'Pred. Orders', numeric: true,
                render: (row: Record<string, unknown>) => <span className="font-mono">{String(row.predictedOrders)}</span>,
              },
              {
                key: 'staff', header: 'Staff (K+S+C)', numeric: true,
                render: (row: Record<string, unknown>) => {
                  const s = row.recommendedStaff as { kitchen: number; service: number; cashier: number };
                  return <span className="font-mono">{s.kitchen}+{s.service}+{s.cashier}</span>;
                },
              },
            ]}
            data={recs as Record<string, unknown>[]}
          />
        </Card>
      )}
    </div>
  );
}
