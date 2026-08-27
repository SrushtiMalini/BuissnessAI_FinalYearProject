import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { storage } from '../lib/storage';
import { computeDishMetrics, classifyMenu } from '../lib/menuEngine';
import { Button, Card, Badge, PageHeader } from '../design-system/components';
import type { MenuItem } from '../types';

function marginPct(item: MenuItem): number {
  return item.sellingPrice > 0 ? ((item.sellingPrice - item.rawMaterialCost) / item.sellingPrice) * 100 : 0;
}

const QUADRANT_CONFIG = {
  star: { label: 'Star', variant: 'warning' as const, desc: 'Protect & promote' },
  hiddenGem: { label: 'Hidden Gem', variant: 'info' as const, desc: 'Push harder' },
  volumeTrap: { label: 'Volume Trap', variant: 'neutral' as const, desc: 'Consider repricing' },
  deadWeight: { label: 'Dead Weight', variant: 'danger' as const, desc: 'Consider removing' },
};

export default function MenuPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [saved, setSaved] = useState(false);
  const [showQuadrants, setShowQuadrants] = useState(true);

  useEffect(() => {
    setItems(storage.getMenu());
  }, []);

  const billing = storage.getBilling();
  const metrics = computeDishMetrics(billing, items);
  const quadrant = classifyMenu(metrics);

  function addRow() {
    setItems(prev => [...prev, { id: Date.now().toString(), name: '', sellingPrice: 0, rawMaterialCost: 0 }]);
  }

  function removeRow(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function update(id: string, field: keyof MenuItem, value: string | number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function save() {
    storage.setMenu(items.filter(i => i.name.trim()));
    setSaved(true);
    setTimeout(() => { setSaved(false); navigate('/dashboard'); }, 1000);
  }

  function getQuadrant(name: string): keyof typeof QUADRANT_CONFIG | '' {
    if (quadrant.star.find(m => m.name === name)) return 'star';
    if (quadrant.hiddenGem.find(m => m.name === name)) return 'hiddenGem';
    if (quadrant.volumeTrap.find(m => m.name === name)) return 'volumeTrap';
    if (quadrant.deadWeight.find(m => m.name === name)) return 'deadWeight';
    return '';
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Menu Setup"
        subtitle="Set dish prices and costs to enable profitability analysis and ML recommendations"
        action={
          <Button onClick={save} loading={saved}>
            <Save size={14} /> {saved ? 'Saved!' : 'Save Menu'}
          </Button>
        }
      />

      {billing.length > 0 && (
        <Card className="mb-6" padding="sm">
          <button
            onClick={() => setShowQuadrants(s => !s)}
            className="w-full flex items-center justify-between p-2 text-[var(--text-sm)] font-medium text-[var(--color-text-primary)] hover:text-[var(--color-unity)] transition-colors"
          >
            <span>Menu Engineering Matrix</span>
            {showQuadrants ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showQuadrants && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-[var(--color-border-default)]">
              {(Object.keys(QUADRANT_CONFIG) as (keyof typeof QUADRANT_CONFIG)[]).map(key => {
                const cfg = QUADRANT_CONFIG[key];
                const count = quadrant[key].length;
                return (
                  <div key={key} className="text-center p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-primary)]">
                    <p className="text-[var(--text-2xl)] font-semibold text-[var(--color-text-primary)]">{count}</p>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-1">{cfg.desc}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[var(--text-sm)]">
            <thead>
              <tr className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border-default)]">
                {['Dish Name', 'Selling Price (₹)', 'Raw Material Cost (₹)', 'Margin', ...(billing.length ? ['Category'] : []), ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[var(--text-xs)] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const pct = marginPct(item);
                const q = getQuadrant(item.name);
                return (
                  <tr key={item.id} className="border-b border-[var(--color-border-default)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors">
                    <td className="px-4 py-2.5">
                      <input
                        value={item.name}
                        onChange={e => update(item.id, 'name', e.target.value)}
                        placeholder="Dish name"
                        className="bg-transparent border border-[var(--color-border-default)] rounded-[var(--radius-sm)] px-2 py-1 text-[var(--color-text-primary)] text-[var(--text-sm)] w-40 focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        value={item.sellingPrice || ''}
                        onChange={e => update(item.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="bg-transparent border border-[var(--color-border-default)] rounded-[var(--radius-sm)] px-2 py-1 text-[var(--color-text-primary)] text-[var(--text-sm)] w-24 focus:outline-none focus:border-[var(--color-border-focus)] font-mono transition-colors"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        value={item.rawMaterialCost || ''}
                        onChange={e => update(item.id, 'rawMaterialCost', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="bg-transparent border border-[var(--color-border-default)] rounded-[var(--radius-sm)] px-2 py-1 text-[var(--color-text-primary)] text-[var(--text-sm)] w-24 focus:outline-none focus:border-[var(--color-border-focus)] font-mono transition-colors"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      {item.sellingPrice > 0 && (
                        <Badge variant={pct >= 50 ? 'success' : pct >= 30 ? 'warning' : 'danger'}>
                          {pct.toFixed(0)}%
                        </Badge>
                      )}
                    </td>
                    {billing.length > 0 && (
                      <td className="px-4 py-2.5">
                        {q && <Badge variant={QUADRANT_CONFIG[q].variant}>{QUADRANT_CONFIG[q].label}</Badge>}
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <button onClick={() => removeRow(item.id)}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button onClick={addRow}
          className="flex items-center gap-2 text-[var(--text-sm)] font-medium mt-4 pt-4 border-t border-[var(--color-border-default)] w-full text-[var(--color-unity)] hover:text-[var(--color-carbon)] transition-colors">
          <Plus size={14} /> Add dish
        </button>
      </Card>
    </div>
  );
}
