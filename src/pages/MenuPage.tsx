import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save } from 'lucide-react';
import { storage } from '../lib/storage';
import { computeDishMetrics, classifyMenu } from '../lib/menuEngine';
import { Button, Card, Badge, PageHeader } from '../components/ui';
import type { MenuItem } from '../types';

const SAMPLE_MENU: MenuItem[] = [
  { id: '1', name: 'Dal Fry', sellingPrice: 80, rawMaterialCost: 28 },
  { id: '2', name: 'Paneer Butter Masala', sellingPrice: 160, rawMaterialCost: 72 },
  { id: '3', name: 'Veg Thali', sellingPrice: 120, rawMaterialCost: 38 },
  { id: '4', name: 'Rajma Chawal', sellingPrice: 90, rawMaterialCost: 31 },
  { id: '5', name: 'Egg Curry', sellingPrice: 100, rawMaterialCost: 29 },
  { id: '6', name: 'Roti', sellingPrice: 15, rawMaterialCost: 5 },
  { id: '7', name: 'Jeera Rice', sellingPrice: 60, rawMaterialCost: 18 },
];

function marginPct(item: MenuItem): number {
  return item.sellingPrice > 0
    ? ((item.sellingPrice - item.rawMaterialCost) / item.sellingPrice) * 100
    : 0;
}

function marginBadge(pct: number) {
  if (pct >= 50) return <Badge variant="green">{pct.toFixed(0)}% margin</Badge>;
  if (pct >= 30) return <Badge variant="amber">{pct.toFixed(0)}% margin</Badge>;
  return <Badge variant="red">{pct.toFixed(0)}% margin</Badge>;
}

export default function MenuPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = storage.getMenu();
    setItems(stored.length ? stored : SAMPLE_MENU);
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

  const quadrantColors: Record<string, string> = {
    star: 'text-yellow-400',
    hiddenGem: 'text-blue-400',
    volumeTrap: 'text-amber-400',
    deadWeight: 'text-red-400',
  };

  function getQuadrant(name: string): string {
    if (quadrant.star.find(m => m.name === name)) return 'star';
    if (quadrant.hiddenGem.find(m => m.name === name)) return 'hiddenGem';
    if (quadrant.volumeTrap.find(m => m.name === name)) return 'volumeTrap';
    if (quadrant.deadWeight.find(m => m.name === name)) return 'deadWeight';
    return '';
  }

  const quadrantLabel: Record<string, string> = {
    star: '⭐ Star',
    hiddenGem: '💎 Hidden Gem',
    volumeTrap: '⚠️ Volume Trap',
    deadWeight: '💀 Dead Weight',
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Menu Setup" subtitle="Add dish selling prices and raw material costs to enable profitability analysis" />
        <Button onClick={save} loading={saved}>
          <Save size={15} /> {saved ? 'Saved!' : 'Save Menu'}
        </Button>
      </div>

      {billing.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: '⭐ Stars', items: quadrant.star, color: 'text-yellow-400', desc: 'Protect these' },
            { label: '💎 Hidden Gems', items: quadrant.hiddenGem, color: 'text-blue-400', desc: 'Promote more' },
            { label: '⚠️ Volume Traps', items: quadrant.volumeTrap, color: 'text-amber-400', desc: 'Consider repricing' },
            { label: '💀 Dead Weight', items: quadrant.deadWeight, color: 'text-red-400', desc: 'Consider removing' },
          ].map(({ label, items: qItems, color, desc }) => (
            <Card key={label} className="text-center">
              <p className={`font-bold text-lg ${color}`}>{qItems.length}</p>
              <p className="text-white text-sm font-medium">{label}</p>
              <p className="text-gray-500 text-xs">{desc}</p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363D]">
                <th className="text-left text-gray-400 font-medium pb-3 pr-3">Dish Name</th>
                <th className="text-left text-gray-400 font-medium pb-3 pr-3">Selling Price (₹)</th>
                <th className="text-left text-gray-400 font-medium pb-3 pr-3">Raw Material Cost (₹)</th>
                <th className="text-left text-gray-400 font-medium pb-3 pr-3">Margin</th>
                {billing.length > 0 && <th className="text-left text-gray-400 font-medium pb-3 pr-3">Category</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const pct = marginPct(item);
                const q = getQuadrant(item.name);
                return (
                  <tr key={item.id} className="border-b border-[#30363D]/50">
                    <td className="py-2 pr-3">
                      <input
                        value={item.name}
                        onChange={e => update(item.id, 'name', e.target.value)}
                        placeholder="Dish name"
                        className="bg-transparent border border-[#30363D] rounded px-2 py-1 text-white text-sm w-40 focus:outline-none focus:border-[#4ADE80]"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        value={item.sellingPrice || ''}
                        onChange={e => update(item.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="bg-transparent border border-[#30363D] rounded px-2 py-1 text-white text-sm w-24 focus:outline-none focus:border-[#4ADE80]"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        value={item.rawMaterialCost || ''}
                        onChange={e => update(item.id, 'rawMaterialCost', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="bg-transparent border border-[#30363D] rounded px-2 py-1 text-white text-sm w-24 focus:outline-none focus:border-[#4ADE80]"
                      />
                    </td>
                    <td className="py-2 pr-3">{item.sellingPrice > 0 && marginBadge(pct)}</td>
                    {billing.length > 0 && (
                      <td className="py-2 pr-3">
                        {q && <span className={`text-xs font-medium ${quadrantColors[q]}`}>{quadrantLabel[q]}</span>}
                      </td>
                    )}
                    <td className="py-2">
                      <button onClick={() => removeRow(item.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button onClick={addRow} className="flex items-center gap-2 text-[#4ADE80] text-sm mt-4 hover:text-white transition-colors">
          <Plus size={14} /> Add dish
        </button>
      </Card>
    </div>
  );
}
