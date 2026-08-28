import { useState } from 'react';
import {
  Sparkles, TrendingUp, TrendingDown, Layers, DollarSign, Trash2, Megaphone,
  CheckCircle2, XCircle, Clock as ClockIcon,
} from 'lucide-react';
import { storage } from '../lib/storage';
import { PageHeader, Card, Badge, EmptyState } from '../design-system/components';
import type { Opportunity, OpportunityStatus, OpportunitySignalType } from '../types';

function fmtCurrency(n: number): string {
  return `${n < 0 ? '-' : '+'}₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}/week`;
}

const SIGNAL_ICON: Record<OpportunitySignalType, typeof TrendingUp> = {
  trending_up: TrendingUp,
  trending_down: TrendingDown,
  quadrant_shift: Layers,
  pricing: DollarSign,
  wastage: Trash2,
  promotion: Megaphone,
};

const SIGNAL_LABEL: Record<OpportunitySignalType, string> = {
  trending_up: 'Trending Up',
  trending_down: 'Trending Down',
  quadrant_shift: 'Menu Shift',
  pricing: 'Pricing',
  wastage: 'Wastage',
  promotion: 'Promotion',
};

const STATUS_BADGE: Record<OpportunityStatus, { variant: 'info' | 'success' | 'neutral' | 'warning'; label: string }> = {
  new: { variant: 'info', label: 'New' },
  acted_on: { variant: 'success', label: 'Acted On' },
  dismissed: { variant: 'neutral', label: 'Dismissed' },
  expired: { variant: 'warning', label: 'Expired' },
};

export default function OpportunityHistoryPage() {
  const [opportunities] = useState<Opportunity[]>(() =>
    [...storage.getOpportunities()].sort((a, b) => b.createdDate.localeCompare(a.createdDate))
  );

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Opportunities"
        subtitle="Full history of business-analyst recommendations and how they actually played out"
      />

      {opportunities.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Sparkles size={36} />}
            title="No opportunities yet"
            description="Opportunities are generated automatically whenever new billing data is uploaded or imported."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {opportunities.map(o => {
            const Icon = SIGNAL_ICON[o.signalType];
            const status = STATUS_BADGE[o.status];
            const hit = o.outcome !== null && o.outcome >= o.projectedImpact * 0.5;
            return (
              <Card key={o.id} padding="sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-bg-primary)] flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={15} className="text-[var(--color-text-muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <Badge variant="neutral">{SIGNAL_LABEL[o.signalType]}</Badge>
                      <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">{o.createdDate}</span>
                    </div>
                    <p className="text-[var(--text-sm)] text-[var(--color-text-primary)]">{o.recommendationText}</p>
                    <div className="flex items-center gap-4 mt-2 text-[var(--text-xs)] text-[var(--color-text-muted)] flex-wrap">
                      <span>Predicted {fmtCurrency(o.projectedImpact)}</span>
                      {o.outcome !== null ? (
                        <span className="flex items-center gap-1">
                          {hit ? <CheckCircle2 size={13} className="text-[var(--color-success)]" /> : <XCircle size={13} className="text-[var(--color-danger)]" />}
                          Actual: {fmtCurrency(o.outcome)} ({hit ? 'Hit' : 'Miss'})
                        </span>
                      ) : o.status === 'acted_on' ? (
                        <span className="flex items-center gap-1">
                          <ClockIcon size={13} /> Measuring outcome...
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
