import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Plus, Trash2, Package, Info } from 'lucide-react';
import { storage } from '../../lib/storage';
import { runIngredientForecast, computeIngredientForecastMetrics } from '../../lib/ml/ingredientForecast';
import { Card, Badge, MetricTile, EmptyState, Button, Modal, DataTable } from '../../design-system/components';
import { LineChart } from '../../design-system/charts';
import { CHART_COLORS } from '../../design-system/charts';
import type { IngredientMapping } from '../../types';

const DEFAULT_MAPPINGS: IngredientMapping[] = [
  { dishId: '', dishName: 'Dal Fry', ingredients: [{ name: 'Dal', quantityPerServing: 0.08, unit: 'kg' }, { name: 'Ghee', quantityPerServing: 0.015, unit: 'kg' }, { name: 'Onion', quantityPerServing: 0.05, unit: 'kg' }] },
  { dishId: '', dishName: 'Paneer Butter Masala', ingredients: [{ name: 'Paneer', quantityPerServing: 0.1, unit: 'kg' }, { name: 'Butter', quantityPerServing: 0.02, unit: 'kg' }, { name: 'Tomato', quantityPerServing: 0.08, unit: 'kg' }] },
  { dishId: '', dishName: 'Veg Biryani', ingredients: [{ name: 'Rice', quantityPerServing: 0.15, unit: 'kg' }, { name: 'Mixed Veg', quantityPerServing: 0.12, unit: 'kg' }] },
  { dishId: '', dishName: 'Chapati', ingredients: [{ name: 'Flour', quantityPerServing: 0.05, unit: 'kg' }, { name: 'Ghee', quantityPerServing: 0.005, unit: 'kg' }] },
];

function fmtQty(n: number, unit: string): string {
  if (n >= 1) return `${n.toFixed(1)} ${unit}`;
  return `${(n * 1000).toFixed(0)}g`;
}

export default function IngredientForecastPage() {
  const billing = storage.getBilling();
  const menu = storage.getMenu();
  const [mappings, setMappings] = useState<IngredientMapping[]>(() => {
    const stored = storage.getIngredientMappings();
    if (stored.length) return stored;
    // Pre-fill dishes that match the menu
    const menuNames = new Set(menu.map(m => m.name.toLowerCase()));
    return DEFAULT_MAPPINGS.map(m => ({
      ...m,
      dishId: menu.find(mi => mi.name.toLowerCase() === m.dishName.toLowerCase())?.id ?? '',
    })).filter(m => menuNames.has(m.dishName.toLowerCase()) || true);
  });
  const [showMapping, setShowMapping] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);

  const forecasts = useMemo(() => runIngredientForecast(billing, mappings, 7), [billing, mappings]);
  const metrics = useMemo(() => computeIngredientForecastMetrics(billing, mappings), [billing, mappings]);

  function saveMappings() {
    storage.setIngredientMappings(mappings);
    setShowMapping(false);
  }

  if (!billing.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Upload size={40} />}
          title="No data yet"
          description="Upload billing data to generate ingredient forecasts."
          action={<Link to="/upload"><Button>Upload Data</Button></Link>}
        />
      </div>
    );
  }

  const selectedForecast = forecasts.find(f => f.ingredientName === selectedIngredient);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text-primary)]">Ingredient Forecast</h1>
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-1">
            Feature-weighted WMA · {metrics.trainingDays} days of training data
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShowMapping(true)}>
          <Plus size={14} /> Manage Ingredient Mappings
        </Button>
      </div>

      {forecasts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={36} />}
            title="Add dish-ingredient mappings to activate forecasting"
            description="Map each dish to its ingredients and quantities per serving."
            action={<Button onClick={() => setShowMapping(true)}>Configure Mappings</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricTile label="Ingredients to Purchase" value={String(forecasts.length)} valueFont="mono" subtext="Next 7 days" />
            <MetricTile label="Forecast MAE" value={`${metrics.mae} units`} valueFont="mono" subtext="Mean Absolute Error" />
            <MetricTile label="Training Data" value={`${metrics.trainingDays}d`} valueFont="mono" subtext="Days of history" />
            <MetricTile
              label="Forecast Accuracy"
              value={`${Math.max(0, 100 - metrics.mape)}%`}
              valueFont="mono"
              accent={metrics.mape < 20 ? 'var(--color-success)' : 'var(--color-warning)'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main table */}
            <div className="lg:col-span-2">
              <Card title="Purchasing Recommendations" subtitle="Next 7 days · includes 20% safety buffer">
                <DataTable
                  columns={[
                    { key: 'ingredientName', header: 'Ingredient', sortable: true },
                    {
                      key: 'totalNeeded', header: 'Total Needed', numeric: true, sortable: true,
                      render: (row: Record<string, unknown>) => (
                        <span className="font-mono font-semibold text-[var(--color-unity)]">
                          {fmtQty(Number(row.totalNeeded), String(row.unit))}
                        </span>
                      ),
                    },
                    { key: 'unit', header: 'Unit' },
                    {
                      key: 'confidence', header: 'Confidence',
                      render: (row: Record<string, unknown>) => (
                        <Badge variant={row.confidence === 'high' ? 'success' : row.confidence === 'medium' ? 'warning' : 'neutral'} dot>
                          {String(row.confidence)}
                        </Badge>
                      ),
                    },
                  ]}
                  data={forecasts as Record<string, unknown>[]}
                  keyField="ingredientName"
                  onRowClick={(row) => setSelectedIngredient(String(row.ingredientName))}
                />
              </Card>
            </div>

            {/* 7-day chart */}
            <div>
              {selectedForecast ? (
                <Card title={selectedForecast.ingredientName}
                  subtitle="7-day demand forecast"
                  action={
                    <button onClick={() => setSelectedIngredient(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xl">×</button>
                  }
                >
                  <LineChart
                    data={selectedForecast.dailyForecasts}
                    lines={[
                      { key: 'predicted', name: 'Predicted', color: CHART_COLORS[0] },
                      { key: 'upper', name: 'Upper bound', color: CHART_COLORS[2], dashed: true },
                    ]}
                    xKey="date"
                    height={200}
                    xFormatter={(d) => {
                      const dt = new Date(String(d));
                      return `${dt.getDate()}/${dt.getMonth() + 1}`;
                    }}
                    yFormatter={v => fmtQty(v, selectedForecast.unit)}
                  />
                </Card>
              ) : (
                <Card>
                  <EmptyState
                    icon={<Info size={28} />}
                    title="Click a row"
                    description="Select an ingredient to see its 7-day demand forecast chart."
                  />
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {/* Ingredient mapping modal */}
      <Modal open={showMapping} onClose={() => setShowMapping(false)} title="Dish-Ingredient Mappings" width="max-w-2xl">
        <div className="space-y-4">
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
            Define how much of each ingredient each dish uses per serving.
          </p>
          {mappings.map((mapping, mi) => (
            <div key={mi} className="border border-[var(--color-border-default)] rounded-[var(--radius-md)] p-4">
              <div className="flex items-center justify-between mb-3">
                <input
                  value={mapping.dishName}
                  onChange={e => setMappings(prev => prev.map((m, i) => i === mi ? { ...m, dishName: e.target.value } : m))}
                  placeholder="Dish name"
                  className="font-medium text-[var(--text-sm)] bg-transparent border-b border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] pb-0.5"
                />
                <button onClick={() => setMappings(prev => prev.filter((_, i) => i !== mi))}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="space-y-2">
                {mapping.ingredients.map((ing, ii) => (
                  <div key={ii} className="flex gap-2 items-center">
                    <input value={ing.name}
                      onChange={e => setMappings(prev => prev.map((m, i) => i === mi ? { ...m, ingredients: m.ingredients.map((ing2, j) => j === ii ? { ...ing2, name: e.target.value } : ing2) } : m))}
                      placeholder="Ingredient" className="flex-1 text-[var(--text-sm)] bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-sm)] px-2 py-1 focus:outline-none focus:border-[var(--color-border-focus)]" />
                    <input type="number" value={ing.quantityPerServing}
                      onChange={e => setMappings(prev => prev.map((m, i) => i === mi ? { ...m, ingredients: m.ingredients.map((ing2, j) => j === ii ? { ...ing2, quantityPerServing: parseFloat(e.target.value) || 0 } : ing2) } : m))}
                      className="w-20 text-[var(--text-sm)] font-mono bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-sm)] px-2 py-1 focus:outline-none focus:border-[var(--color-border-focus)]" />
                    <select value={ing.unit}
                      onChange={e => setMappings(prev => prev.map((m, i) => i === mi ? { ...m, ingredients: m.ingredients.map((ing2, j) => j === ii ? { ...ing2, unit: e.target.value } : ing2) } : m))}
                      className="text-[var(--text-sm)] bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-sm)] px-2 py-1 focus:outline-none">
                      {['kg', 'litres', 'pieces', 'dozen', 'grams'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <button onClick={() => setMappings(prev => prev.map((m, i) => i === mi ? { ...m, ingredients: m.ingredients.filter((_, j) => j !== ii) } : m))}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                      ×
                    </button>
                  </div>
                ))}
                <button onClick={() => setMappings(prev => prev.map((m, i) => i === mi ? { ...m, ingredients: [...m.ingredients, { name: '', quantityPerServing: 0.1, unit: 'kg' }] } : m))}
                  className="text-[var(--text-xs)] text-[var(--color-unity)] hover:text-[var(--color-carbon)] flex items-center gap-1">
                  <Plus size={12} /> Add ingredient
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => setMappings(prev => [...prev, { dishId: '', dishName: '', ingredients: [{ name: '', quantityPerServing: 0.1, unit: 'kg' }] }])}
            className="flex items-center gap-2 text-[var(--text-sm)] text-[var(--color-unity)] font-medium">
            <Plus size={14} /> Add dish mapping
          </button>
          <div className="flex gap-2 pt-2 border-t border-[var(--color-border-default)]">
            <Button onClick={saveMappings}>Save Mappings</Button>
            <Button variant="ghost" onClick={() => setShowMapping(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
