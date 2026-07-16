import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Plus, Megaphone, TrendingUp, TrendingDown } from 'lucide-react';
import { storage } from '../../lib/storage';
import { analyzePromotion } from '../../lib/ml/promotionAnalyzer';
import { Card, Badge, MetricTile, EmptyState, Button, Modal, Alert, DataTable } from '../../design-system/components';
import { AreaChart } from '../../design-system/charts';
import type { PromotionRecord } from '../../types';

const PROMO_TYPES = ['discount', 'combo', 'festival', 'flat'] as const;

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PromotionAnalysisPage() {
  const billing = storage.getBilling();
  const promotions = storage.getPromotions();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newPromo, setNewPromo] = useState<Partial<PromotionRecord>>({
    type: 'discount', discountValue: 10,
  });

  const selectedPromo = promotions.find(p => p.id === selectedId);
  const selectedAnalysis = useMemo(() => {
    if (!selectedPromo || !billing.length) return null;
    return analyzePromotion(billing, selectedPromo);
  }, [selectedPromo, billing]);

  if (!billing.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Upload size={40} />}
          title="No data yet"
          description="Upload billing data to analyze promotion effectiveness."
          action={<Link to="/upload"><Button>Upload Data</Button></Link>}
        />
      </div>
    );
  }

  function addPromotion() {
    if (!newPromo.name || !newPromo.startDate || !newPromo.endDate) return;
    const promo: PromotionRecord = {
      id: Date.now().toString(),
      name: newPromo.name!,
      startDate: newPromo.startDate!,
      endDate: newPromo.endDate!,
      type: newPromo.type ?? 'discount',
      discountValue: newPromo.discountValue ?? 0,
      affectedDishes: [],
    };
    storage.addPromotion(promo);
    setShowAdd(false);
    setNewPromo({ type: 'discount', discountValue: 10 });
    setSelectedId(promo.id);
  }

  const profitableCount = promotions.filter(p => (p.profitabilityImpactPct ?? 0) > 0).length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text-primary)]">Promotion Analysis</h1>
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-1">
            Interrupted Time Series · OLS regression · Causal impact estimation
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Log Promotion
        </Button>
      </div>

      {promotions.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <MetricTile label="Total Promotions" value={String(promotions.length)} valueFont="mono" />
          <MetricTile label="Profitable Promotions" value={String(profitableCount)} valueFont="mono" accent="var(--color-success)" />
          <MetricTile label="Avg Revenue Impact" value={`${(promotions.reduce((s, p) => s + (p.revenueImpactPct ?? 0), 0) / promotions.length).toFixed(1)}%`} valueFont="mono" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Promotions list */}
        <Card title="Promotion History"
          action={<Badge variant="info">{promotions.length} logged</Badge>}
        >
          {promotions.length === 0 ? (
            <EmptyState
              icon={<Megaphone size={36} />}
              title="No promotions logged yet"
              description="Log your promotion periods to measure their true financial impact."
              action={<Button size="sm" onClick={() => setShowAdd(true)}>Log First Promotion</Button>}
            />
          ) : (
            <div className="space-y-2">
              {promotions.map(promo => {
                const impact = promo.profitabilityImpactPct;
                return (
                  <button key={promo.id} onClick={() => setSelectedId(promo.id)}
                    className={`w-full text-left p-3 rounded-[var(--radius-md)] border transition-colors ${
                      selectedId === promo.id
                        ? 'border-[var(--color-unity)] bg-[var(--color-info-light)]'
                        : 'border-[var(--color-border-default)] hover:bg-[var(--color-bg-secondary)]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-[var(--text-sm)] text-[var(--color-text-primary)]">{promo.name}</p>
                        <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-0.5">
                          {fmtDate(promo.startDate)} → {fmtDate(promo.endDate)} · {promo.discountValue}% {promo.type}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {impact !== undefined ? (
                          <Badge variant={impact > 0 ? 'success' : 'danger'}>
                            {impact >= 0 ? '+' : ''}{impact.toFixed(1)}% profit
                          </Badge>
                        ) : (
                          <Badge variant="neutral">Not analyzed</Badge>
                        )}
                        {promo.recommendation && (
                          <Badge variant={promo.recommendation === 'repeat' ? 'success' : promo.recommendation === 'modify' ? 'warning' : 'danger'} dot>
                            {promo.recommendation}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Analysis detail */}
        <Card title={selectedPromo ? `Analysis: ${selectedPromo.name}` : 'Promotion Analysis'}
          subtitle={selectedAnalysis ? `ITS regression · R² = ${selectedAnalysis.rSquared}` : 'Select a promotion to see analysis'}
        >
          {!selectedPromo ? (
            <EmptyState
              icon={<TrendingUp size={36} />}
              title="Select a promotion"
              description="Click a promotion from the list to see its full ITS analysis."
            />
          ) : !selectedAnalysis ? (
            <EmptyState
              title="Insufficient data"
              description="Need at least 14 days before the promotion and 3 days of promotion period for ITS analysis."
            />
          ) : (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Revenue Impact', value: selectedAnalysis.revenueImpactPct, suffix: '%' },
                  { label: 'Order Volume', value: selectedAnalysis.orderVolumeImpactPct, suffix: '%' },
                  { label: 'Profitability', value: selectedAnalysis.profitabilityImpactPct, suffix: '%' },
                ].map(kpi => (
                  <div key={kpi.label} className="text-center p-3 bg-[var(--color-bg-primary)] rounded-[var(--radius-md)]">
                    <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">{kpi.label}</p>
                    <p className={`font-mono font-semibold text-[var(--text-lg)] ${kpi.value >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                      {kpi.value >= 0 ? '+' : ''}{kpi.value.toFixed(1)}{kpi.suffix}
                    </p>
                  </div>
                ))}
              </div>

              {/* Statistical significance */}
              <Alert variant={selectedAnalysis.isSignificant ? 'success' : 'warning'}>
                {selectedAnalysis.isSignificant
                  ? `Statistically significant (p = ${selectedAnalysis.pValue}). High confidence in this result.`
                  : `Low statistical significance (p = ${selectedAnalysis.pValue}). Results may reflect natural variation.`
                }
              </Alert>

              {/* Revenue chart */}
              {selectedAnalysis.analysisData.length > 0 && (
                <AreaChart
                  data={selectedAnalysis.analysisData.map(d => ({
                    date: d.date,
                    revenue: d.revenue,
                    promotion: d.isPromotion ? d.revenue : undefined,
                  }))}
                  areas={[{ key: 'revenue', name: 'Revenue', color: '#5B6B4A' }]}
                  xKey="date"
                  height={160}
                  xFormatter={(d) => {
                    const dt = new Date(String(d));
                    return `${dt.getDate()}/${dt.getMonth() + 1}`;
                  }}
                  yFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                />
              )}

              {/* Finding */}
              <div className="p-4 bg-[var(--color-bg-primary)] rounded-[var(--radius-md)]">
                <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                  {selectedAnalysis.naturalLanguageFinding}
                </p>
              </div>

              <Badge variant={
                selectedAnalysis.recommendation === 'repeat' ? 'success' :
                selectedAnalysis.recommendation === 'modify' ? 'warning' : 'danger'
              } dot>
                Recommendation: {selectedAnalysis.recommendation}
              </Badge>
            </div>
          )}
        </Card>
      </div>

      {/* Add promotion modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Log Promotion Period">
        <div className="space-y-4">
          <div>
            <label className="block text-[var(--text-sm)] font-medium text-[var(--color-text-primary)] mb-1">Promotion Name</label>
            <input value={newPromo.name ?? ''}
              onChange={e => setNewPromo(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Diwali Special, Happy Hour"
              className="w-full border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] focus:outline-none focus:border-[var(--color-border-focus)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--text-sm)] font-medium text-[var(--color-text-primary)] mb-1">Start Date</label>
              <input type="date" value={newPromo.startDate ?? ''}
                onChange={e => setNewPromo(p => ({ ...p, startDate: e.target.value }))}
                className="w-full border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] focus:outline-none focus:border-[var(--color-border-focus)]"
              />
            </div>
            <div>
              <label className="block text-[var(--text-sm)] font-medium text-[var(--color-text-primary)] mb-1">End Date</label>
              <input type="date" value={newPromo.endDate ?? ''}
                onChange={e => setNewPromo(p => ({ ...p, endDate: e.target.value }))}
                className="w-full border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] focus:outline-none focus:border-[var(--color-border-focus)]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--text-sm)] font-medium text-[var(--color-text-primary)] mb-1">Type</label>
              <select value={newPromo.type}
                onChange={e => setNewPromo(p => ({ ...p, type: e.target.value as typeof PROMO_TYPES[number] }))}
                className="w-full border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] focus:outline-none focus:border-[var(--color-border-focus)]"
              >
                {PROMO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[var(--text-sm)] font-medium text-[var(--color-text-primary)] mb-1">Discount %</label>
              <input type="number" value={newPromo.discountValue ?? 0}
                onChange={e => setNewPromo(p => ({ ...p, discountValue: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-sm)] font-mono focus:outline-none focus:border-[var(--color-border-focus)]"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={addPromotion} disabled={!newPromo.name || !newPromo.startDate || !newPromo.endDate}>
              Log Promotion
            </Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
