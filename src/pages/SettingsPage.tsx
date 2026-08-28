import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, AlertTriangle, CheckCircle } from 'lucide-react';
import { storage } from '../lib/storage';
import { Button, Card, PageHeader, Pill, FormField, formInputClass, Modal } from '../components/ui';
import {
  ESTABLISHMENT_TYPES, MEAL_PERIODS, TRACKING_METHODS, PRIORITIES, CUISINE_SUGGESTIONS, togglePriority,
} from '../lib/restaurantOptions';
import type {
  Restaurant, EstablishmentType, MealPeriodOffered, TrackingMethod, BusinessPriority,
} from '../types';

interface FormState {
  name: string;
  ownerName: string;
  city: string;
  cuisine: string;
  establishmentType: EstablishmentType | '';
  daysOpenPerWeek: number;
  mealPeriods: MealPeriodOffered[];
  trackingMethod: TrackingMethod | '';
  posName: string;
  priorities: BusinessPriority[];
}

function toFormState(r: Restaurant): FormState {
  return {
    name: r.name,
    ownerName: r.ownerName,
    city: r.city,
    cuisine: r.cuisine,
    establishmentType: r.establishmentType,
    daysOpenPerWeek: r.daysOpenPerWeek,
    mealPeriods: r.mealPeriods,
    trackingMethod: r.trackingMethod,
    posName: r.posName ?? '',
    priorities: r.priorities,
  };
}

const FALLBACK_FORM: FormState = {
  name: '', ownerName: '', city: '', cuisine: '',
  establishmentType: '', daysOpenPerWeek: 7, mealPeriods: [],
  trackingMethod: '', posName: '', priorities: [],
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(() => {
    const existing = storage.getRestaurant();
    return existing ? toFormState(existing) : FALLBACK_FORM;
  });
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function toggleMealPeriod(value: MealPeriodOffered) {
    setForm(f => ({
      ...f,
      mealPeriods: f.mealPeriods.includes(value)
        ? f.mealPeriods.filter(v => v !== value)
        : [...f.mealPeriods, value],
    }));
  }

  function handleTogglePriority(value: BusinessPriority) {
    setForm(f => ({ ...f, priorities: togglePriority(f.priorities, value) }));
  }

  function save() {
    const restaurant: Restaurant = {
      name: form.name.trim(),
      ownerName: form.ownerName.trim(),
      city: form.city.trim(),
      cuisine: form.cuisine.trim(),
      establishmentType: (form.establishmentType || 'other') as EstablishmentType,
      daysOpenPerWeek: form.daysOpenPerWeek,
      mealPeriods: form.mealPeriods,
      trackingMethod: (form.trackingMethod || 'none') as TrackingMethod,
      posName: form.trackingMethod === 'pos' ? form.posName.trim() : undefined,
      priorities: form.priorities,
    };
    storage.setRestaurant(restaurant);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function clearAllData() {
    await storage.clearAll();
    navigate('/');
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Manage your restaurant profile"
        action={
          <Button onClick={save}>
            {saved ? <><CheckCircle size={14} /> Saved!</> : <><Save size={14} /> Save Changes</>}
          </Button>
        }
      />

      <Card title="Restaurant Identity" className="mb-6">
        <FormField label="Restaurant Name" required>
          <input className={formInputClass} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Owner Name" required>
          <input className={formInputClass} value={form.ownerName}
            onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} />
        </FormField>
        <FormField label="City">
          <input className={formInputClass} value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
        </FormField>
        <FormField label="Cuisine / Theme">
          <input className={formInputClass} value={form.cuisine} list="cuisine-suggestions"
            onChange={e => setForm(f => ({ ...f, cuisine: e.target.value }))} />
          <datalist id="cuisine-suggestions">
            {CUISINE_SUGGESTIONS.map(c => <option key={c} value={c} />)}
          </datalist>
        </FormField>
      </Card>

      <Card title="Business Format" className="mb-6">
        <FormField label="Establishment type" required>
          <div className="flex flex-wrap gap-2">
            {ESTABLISHMENT_TYPES.map(t => (
              <Pill key={t.value} selected={form.establishmentType === t.value}
                onClick={() => setForm(f => ({ ...f, establishmentType: t.value }))}>
                {t.label}
              </Pill>
            ))}
          </div>
        </FormField>
        <FormField label="Days open per week" required>
          <select className={formInputClass} value={form.daysOpenPerWeek}
            onChange={e => setForm(f => ({ ...f, daysOpenPerWeek: Number(e.target.value) }))}>
            {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </FormField>
        <FormField label="Meal periods served" required>
          <div className="flex flex-wrap gap-2">
            {MEAL_PERIODS.map(m => (
              <Pill key={m.value} selected={form.mealPeriods.includes(m.value)} onClick={() => toggleMealPeriod(m.value)}>
                {m.label}
              </Pill>
            ))}
          </div>
        </FormField>
      </Card>

      <Card title="Current Tracking Method" className="mb-6">
        <FormField label="How do you currently track sales?" required>
          <div className="flex flex-col gap-2">
            {TRACKING_METHODS.map(t => (
              <button key={t.value} type="button"
                onClick={() => setForm(f => ({ ...f, trackingMethod: t.value }))}
                className={`text-left px-4 py-3 rounded-[var(--radius-md)] border transition-colors ${
                  form.trackingMethod === t.value
                    ? 'border-[var(--color-unity)] bg-[var(--color-unity)]/8'
                    : 'border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]'
                }`}>
                <p className="text-[var(--color-text-primary)] font-medium text-sm">{t.label}</p>
                <p className="text-[var(--color-text-muted)] text-xs mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
        </FormField>
        {form.trackingMethod === 'pos' && (
          <FormField label="Which POS system?">
            <input className={formInputClass} value={form.posName} placeholder="e.g. Petpooja, Poster POS"
              onChange={e => setForm(f => ({ ...f, posName: e.target.value }))} />
          </FormField>
        )}
      </Card>

      <Card title="Priorities" className="mb-6">
        <FormField label="What do you most want help with right now?" required>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map(p => (
              <Pill key={p.value} selected={form.priorities.includes(p.value)} onClick={() => handleTogglePriority(p.value)}>
                {p.label}
              </Pill>
            ))}
          </div>
        </FormField>
      </Card>

      <Card className="border-[var(--color-danger)]/30">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-[var(--color-danger)] font-semibold text-base flex items-center gap-2">
              <AlertTriangle size={16} /> Danger Zone
            </h3>
            <p className="text-[var(--color-text-muted)] text-sm mt-1 max-w-md">
              Permanently clear all billing, menu, and report data for this account and return to onboarding. This cannot be undone.
            </p>
          </div>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>Clear All Data</Button>
        </div>
      </Card>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Clear all restaurant data?">
        <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mb-6">
          This will permanently delete all billing records, menu items, and reports for{' '}
          <strong>{form.name || 'this restaurant'}</strong>, and take you back to onboarding. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={clearAllData}>Yes, clear everything</Button>
        </div>
      </Modal>
    </div>
  );
}
