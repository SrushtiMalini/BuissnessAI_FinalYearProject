import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { storage } from '../../lib/storage';
import { runDynamicPricing, estimateMonthlySavings } from '../../lib/ml/dynamicPricing';
import { Card, Badge, MetricTile, EmptyState, Button, Alert, DataTable, Modal } from '../../design-system/components';
import type { PricingRecommendation } from '../../types';

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export default function DynamicPricingPage() {
  const billing = storage.getBilling();
  const menu = storage.getMenu();
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [selectedRec, setSelectedRec] = useState<PricingRecommendation | null>(null);

  const recs = useMemo(() => runDynamicPricing(billing, menu), [billing, menu]);
  const monthlySavings = useMemo(() => estimateMonthlySavings(recs, billing), [recs, billing]);

  if (!billing.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Upload size={40} />}
          title="No data yet"
          description="Upload billing data to generate pricing recommendations."
          action={<Link to="/upload"><Button>Upload Data</Button></Link>}
        />
      </div>
    );
  }

  if (!menu.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<DollarSign size={40} />}
          title="No menu configured"
          description="Add dishes and prices in Menu Setup to enable pricing analysis."
          action={<Link to="/menu"><Button>Configure Menu</Button></Link>}
        />
      </div>
    );
  }

  function applyRecommendation(rec: PricingRecommendation) {
    const currentMenu = storage.getMenu();
    const updated = currentMenu.map(m => m.id === rec.dishId ? { ...m, sellingPrice: rec.recommendedPrice } : m);
    storage.setMenu(updated);
    setAppliedIds(prev => new Set([...prev, rec.dishId]));
    setSelectedRec(null);
  }

  const upRecs = recs.filter(r => r.recommendedPrice > r.currentPrice);
  const downRecs = recs.filter(r => r.recommendedPrice < r.currentPrice);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text-primary)]">Dynamic Pricing</h1>
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-1">
            Log-log OLS price elasticity · Lerner markup rule · {recs.length} recommendations
          </p>
        </div>
      </div>

      {monthlySavings > 0 && (
        <div className="mb-6">
          <Alert variant="success">
            <strong>{recs.length} dishes have pricing opportunities.</strong> Adjusting them could add <strong>{fmtCurrency(monthlySavings)}/month</strong> in revenue.
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricTile label="Underpriced Dishes" value={String(upRecs.length)} valueFont="mono" subtext="Price increase recommended" icon={<TrendingUp size={18} />} />
        <MetricTile label="Overpriced Dishes" value={String(downRecs.length)} valueFont="mono" subtext="Price decrease recommended" />
        <MetricTile label="Monthly Revenue Gain" value={fmtCurrency(Math.max(0, monthlySavings))} valueFont="display" accent="var(--color-success)" />
        <MetricTile label="Total Dishes Analyzed" value={String(menu.length)} valueFont="mono" subtext="From menu" />
      </div>

      {recs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<AlertCircle size={36} />}
            title="No significant pricing opportunities found"
            description="Your current prices appear well-calibrated relative to demand patterns. Add more dishes with cost data for deeper analysis."
          />
        </Card>
      ) : (
        <Card title="Pricing Recommendations"
          subtitle="Based on price elasticity estimation from demand patterns"
          action={<Badge variant="info">Click row for details</Badge>}
        >
          <DataTable
            columns={[
              { key: 'dishName', header: 'Dish', sortable: true },
              {
                key: 'currentPrice', header: 'Current Price', numeric: true,
                render: (row: Record<string, unknown>) => <span className="font-mono">{fmtCurrency(Number(row.currentPrice))}</span>,
              },
              {
                key: 'recommendedPrice', header: 'Recommended', numeric: true, sortable: true,
                render: (row: Record<string, unknown>) => (
                  <span className={`font-mono font-semibold ${Number(row.recommendedPrice) > Number(row.currentPrice) ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
                    {fmtCurrency(Number(row.recommendedPrice))}
                  </span>
                ),
              },
              {
                key: 'elasticity', header: 'Elasticity', numeric: true,
                render: (row: Record<string, unknown>) => (
                  <span className="font-mono text-[var(--text-xs)]">{Number(row.elasticity).toFixed(2)}</span>
                ),
              },
              {
                key: 'projectedRevenueChangePct', header: 'Rev Impact', numeric: true, sortable: true,
                render: (row: Record<string, unknown>) => {
                  const v = Number(row.projectedRevenueChangePct);
                  return <span className={`font-mono font-medium ${v >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>{v >= 0 ? '+' : ''}{v.toFixed(1)}%</span>;
                },
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
                key: 'apply', header: '',
                render: (row: Record<string, unknown>) => {
                  const isApplied = appliedIds.has(String(row.dishId));
                  return (
                    <Button size="sm" variant={isApplied ? 'ghost' : 'secondary'} disabled={isApplied}
                      onClick={(e) => { e.stopPropagation(); setSelectedRec(row as unknown as PricingRecommendation); }}>
                      {isApplied ? 'Applied' : 'Review'}
                    </Button>
                  );
                },
              },
            ]}
            data={recs as unknown as Record<string, unknown>[]}
            keyField="dishId"
            onRowClick={(row) => setSelectedRec(row as unknown as PricingRecommendation)}
          />
        </Card>
      )}

      {/* Detail modal */}
      <Modal open={!!selectedRec} onClose={() => setSelectedRec(null)} title={selectedRec?.dishName ?? ''}>
        {selectedRec && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[var(--color-bg-primary)] rounded-[var(--radius-md)]">
                <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">Current Price</p>
                <p className="font-semibold text-[var(--text-xl)] font-mono">{fmtCurrency(selectedRec.currentPrice)}</p>
              </div>
              <div className="p-3 bg-[var(--color-success-light)] rounded-[var(--radius-md)]">
                <p className="text-[var(--text-xs)] text-[var(--color-success)] mb-1">Recommended Price</p>
                <p className="font-semibold text-[var(--text-xl)] font-mono text-[var(--color-success)]">{fmtCurrency(selectedRec.recommendedPrice)}</p>
              </div>
            </div>
            <div className="p-4 bg-[var(--color-bg-primary)] rounded-[var(--radius-md)]">
              <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] leading-relaxed">{selectedRec.reasoning}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">Price Change</p>
                <p className="font-mono font-medium">{selectedRec.recommendedPrice > selectedRec.currentPrice ? '+' : ''}{(((selectedRec.recommendedPrice - selectedRec.currentPrice) / selectedRec.currentPrice) * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">Demand Impact</p>
                <p className={`font-mono font-medium ${selectedRec.projectedDemandChangePct >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                  {selectedRec.projectedDemandChangePct >= 0 ? '+' : ''}{selectedRec.projectedDemandChangePct.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">Revenue Impact</p>
                <p className={`font-mono font-medium ${selectedRec.projectedRevenueChangePct >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                  {selectedRec.projectedRevenueChangePct >= 0 ? '+' : ''}{selectedRec.projectedRevenueChangePct.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => applyRecommendation(selectedRec)}>Apply Price Change</Button>
              <Button variant="ghost" onClick={() => setSelectedRec(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
