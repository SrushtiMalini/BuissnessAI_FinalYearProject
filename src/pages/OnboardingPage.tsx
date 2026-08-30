import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { storage } from '../lib/storage';
import { Button, Pill, FormField, formInputClass } from '../components/ui';
import {
  ESTABLISHMENT_TYPES, MEAL_PERIODS, TRACKING_METHODS, PRIORITIES, CUISINE_SUGGESTIONS, togglePriority,
} from '../lib/restaurantOptions';
import type {
  Restaurant, EstablishmentType, MealPeriodOffered, TrackingMethod, BusinessPriority,
} from '../types';

const STEPS = ['Identity', 'Format', 'Tracking', 'Priorities', 'Review'];

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

const INITIAL_FORM: FormState = {
  name: '',
  ownerName: '',
  city: '',
  cuisine: '',
  establishmentType: '',
  daysOpenPerWeek: 7,
  mealPeriods: [],
  trackingMethod: '',
  posName: '',
  priorities: [],
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

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

  const canProceed = [
    form.name.trim() && form.ownerName.trim(),
    !!form.establishmentType && form.mealPeriods.length > 0,
    !!form.trackingMethod,
    form.priorities.length > 0,
    true,
  ][step];

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }
  function back() {
    if (step > 0) setStep(s => s - 1);
  }

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function submit() {
    const restaurant: Restaurant = {
      name: form.name.trim(),
      ownerName: form.ownerName.trim(),
      city: form.city.trim(),
      cuisine: form.cuisine.trim(),
      establishmentType: form.establishmentType as EstablishmentType,
      daysOpenPerWeek: form.daysOpenPerWeek,
      mealPeriods: form.mealPeriods,
      trackingMethod: form.trackingMethod as TrackingMethod,
      posName: form.trackingMethod === 'pos' ? form.posName.trim() : undefined,
      priorities: form.priorities,
    };
    setSaving(true);
    setSaveError('');
    const ok = await storage.setRestaurant(restaurant);
    setSaving(false);
    if (!ok) {
      setSaveError('Could not save your restaurant profile. Please try again.');
      return;
    }
    // Menu setup is the next mandatory step — Upload Data stays blocked until at
    // least one menu item exists (see RequireMenu in App.tsx).
    navigate('/menu');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: 'var(--color-bg-sidebar)' }}>
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-[var(--color-unity)]/20">
            <ChefHat size={32} style={{ color: 'var(--color-sunburst)' }} />
          </div>
          <h1 className="text-[var(--color-text-inverse)] text-3xl font-semibold">BusinessIQ</h1>
          <p className="text-white/50 mt-2">Let's set up your restaurant profile</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-6 px-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-initial">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{
                    backgroundColor: i <= step ? 'var(--color-unity)' : 'transparent',
                    border: i <= step ? 'none' : '1px solid rgba(255,255,255,0.25)',
                    color: i <= step ? 'var(--color-text-inverse)' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span className="text-[10px] text-white/40 uppercase tracking-wide hidden sm:block">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-2" style={{ backgroundColor: i < step ? 'var(--color-unity)' : 'rgba(255,255,255,0.15)' }} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] p-6">
          {step === 0 && (
            <>
              <h2 className="text-[var(--color-text-primary)] font-semibold text-lg mb-5">Restaurant identity</h2>
              <FormField label="Restaurant Name" required>
                <input className={formInputClass} value={form.name} placeholder="e.g. Shyam Dhaba"
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </FormField>
              <FormField label="Owner Name" required>
                <input className={formInputClass} value={form.ownerName} placeholder="e.g. Shashank"
                  onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} />
              </FormField>
              <FormField label="City">
                <input className={formInputClass} value={form.city} placeholder="e.g. Bangalore"
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </FormField>
              <FormField label="Cuisine / Theme">
                <input className={formInputClass} value={form.cuisine} placeholder="e.g. North Indian, Chaat, Continental"
                  list="cuisine-suggestions"
                  onChange={e => setForm(f => ({ ...f, cuisine: e.target.value }))} />
                <datalist id="cuisine-suggestions">
                  {CUISINE_SUGGESTIONS.map(c => <option key={c} value={c} />)}
                </datalist>
              </FormField>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-[var(--color-text-primary)] font-semibold text-lg mb-5">Business format</h2>
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
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-[var(--color-text-primary)] font-semibold text-lg mb-5">Current tracking method</h2>
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
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-[var(--color-text-primary)] font-semibold text-lg mb-5">Priorities</h2>
              <FormField label="What do you most want help with right now?" required>
                <div className="flex flex-wrap gap-2">
                  {PRIORITIES.map(p => (
                    <Pill key={p.value} selected={form.priorities.includes(p.value)} onClick={() => handleTogglePriority(p.value)}>
                      {p.label}
                    </Pill>
                  ))}
                </div>
              </FormField>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-[var(--color-text-primary)] font-semibold text-lg mb-5">Review & confirm</h2>
              <div className="space-y-3 text-sm">
                <ReviewRow label="Restaurant" value={form.name} />
                <ReviewRow label="Owner" value={form.ownerName} />
                <ReviewRow label="City" value={form.city || '—'} />
                <ReviewRow label="Cuisine" value={form.cuisine || '—'} />
                <ReviewRow label="Establishment type" value={ESTABLISHMENT_TYPES.find(t => t.value === form.establishmentType)?.label ?? '—'} />
                <ReviewRow label="Days open / week" value={String(form.daysOpenPerWeek)} />
                <ReviewRow label="Meal periods" value={form.mealPeriods.map(v => MEAL_PERIODS.find(m => m.value === v)?.label).join(', ') || '—'} />
                <ReviewRow label="Tracking method" value={
                  `${TRACKING_METHODS.find(t => t.value === form.trackingMethod)?.label ?? '—'}${form.trackingMethod === 'pos' && form.posName ? ` (${form.posName})` : ''}`
                } />
                <ReviewRow label="Priorities" value={form.priorities.map(v => PRIORITIES.find(p => p.value === v)?.label).join(', ') || '—'} />
              </div>
              {saveError && <p className="text-[var(--color-danger)] text-sm mt-3">{saveError}</p>}
            </>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border-default)]">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <ChevronLeft size={16} /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={!canProceed}>
                Next <ChevronRight size={16} />
              </Button>
            ) : (
              <Button onClick={submit} loading={saving} disabled={saving}>
                {saving ? 'Saving…' : 'Get Started →'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-2">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="text-[var(--color-text-primary)] font-medium text-right">{value}</span>
    </div>
  );
}
