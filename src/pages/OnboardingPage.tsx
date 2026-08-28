import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { storage } from '../lib/storage';
import { Button } from '../components/ui';
import type {
  Restaurant, EstablishmentType, MealPeriodOffered, TrackingMethod, BusinessPriority,
} from '../types';

const STEPS = ['Identity', 'Format', 'Tracking', 'Priorities', 'Review'];

const ESTABLISHMENT_TYPES: { value: EstablishmentType; label: string }[] = [
  { value: 'dhaba', label: 'Dhaba' },
  { value: 'qsr', label: 'QSR' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'fine-dine', label: 'Fine Dine' },
  { value: 'cloud-kitchen', label: 'Cloud Kitchen' },
  { value: 'other', label: 'Other' },
];

const MEAL_PERIODS: { value: MealPeriodOffered; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

const TRACKING_METHODS: { value: TrackingMethod; label: string; description: string }[] = [
  { value: 'pos', label: 'POS system', description: 'We use a point-of-sale system' },
  { value: 'manual', label: 'Notebook / manual', description: 'We track sales by hand' },
  { value: 'none', label: 'Not tracked yet', description: "We don't track sales currently" },
];

const PRIORITIES: { value: BusinessPriority; label: string }[] = [
  { value: 'reducing-food-waste', label: 'Reducing food waste' },
  { value: 'pricing-dishes', label: 'Pricing dishes correctly' },
  { value: 'staffing-scheduling', label: 'Staffing / scheduling' },
  { value: 'understanding-sales', label: 'Understanding what sells' },
  { value: 'all', label: 'All of the above' },
];

const CUISINE_SUGGESTIONS = [
  'North Indian', 'South Indian', 'Chaat', 'Continental', 'Chinese', 'Mughlai', 'Multi-cuisine',
];

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

interface PillProps { selected: boolean; onClick: () => void; children: ReactNode; key?: string; }

function Pill({ selected, onClick, children }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium border transition-colors ${
        selected
          ? 'bg-[var(--color-unity)] border-[var(--color-unity)] text-[var(--color-text-inverse)]'
          : 'border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[var(--color-text-secondary)] text-sm mb-1.5">
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  );
}

const inputClass = 'w-full bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]';

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

  function togglePriority(value: BusinessPriority) {
    setForm(f => {
      if (value === 'all') {
        return { ...f, priorities: f.priorities.length === 1 && f.priorities[0] === 'all' ? [] : ['all'] };
      }
      const withoutAll = f.priorities.filter(p => p !== 'all');
      return {
        ...f,
        priorities: withoutAll.includes(value) ? withoutAll.filter(v => v !== value) : [...withoutAll, value],
      };
    });
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

  function submit() {
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
    storage.setRestaurant(restaurant);
    navigate('/upload');
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
              <Field label="Restaurant Name" required>
                <input className={inputClass} value={form.name} placeholder="e.g. Shyam Dhaba"
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="Owner Name" required>
                <input className={inputClass} value={form.ownerName} placeholder="e.g. Shashank"
                  onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} />
              </Field>
              <Field label="City">
                <input className={inputClass} value={form.city} placeholder="e.g. Bangalore"
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </Field>
              <Field label="Cuisine / Theme">
                <input className={inputClass} value={form.cuisine} placeholder="e.g. North Indian, Chaat, Continental"
                  list="cuisine-suggestions"
                  onChange={e => setForm(f => ({ ...f, cuisine: e.target.value }))} />
                <datalist id="cuisine-suggestions">
                  {CUISINE_SUGGESTIONS.map(c => <option key={c} value={c} />)}
                </datalist>
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-[var(--color-text-primary)] font-semibold text-lg mb-5">Business format</h2>
              <Field label="Establishment type" required>
                <div className="flex flex-wrap gap-2">
                  {ESTABLISHMENT_TYPES.map(t => (
                    <Pill key={t.value} selected={form.establishmentType === t.value}
                      onClick={() => setForm(f => ({ ...f, establishmentType: t.value }))}>
                      {t.label}
                    </Pill>
                  ))}
                </div>
              </Field>
              <Field label="Days open per week" required>
                <select className={inputClass} value={form.daysOpenPerWeek}
                  onChange={e => setForm(f => ({ ...f, daysOpenPerWeek: Number(e.target.value) }))}>
                  {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Meal periods served" required>
                <div className="flex flex-wrap gap-2">
                  {MEAL_PERIODS.map(m => (
                    <Pill key={m.value} selected={form.mealPeriods.includes(m.value)} onClick={() => toggleMealPeriod(m.value)}>
                      {m.label}
                    </Pill>
                  ))}
                </div>
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-[var(--color-text-primary)] font-semibold text-lg mb-5">Current tracking method</h2>
              <Field label="How do you currently track sales?" required>
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
              </Field>
              {form.trackingMethod === 'pos' && (
                <Field label="Which POS system?">
                  <input className={inputClass} value={form.posName} placeholder="e.g. Petpooja, Poster POS"
                    onChange={e => setForm(f => ({ ...f, posName: e.target.value }))} />
                </Field>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-[var(--color-text-primary)] font-semibold text-lg mb-5">Priorities</h2>
              <Field label="What do you most want help with right now?" required>
                <div className="flex flex-wrap gap-2">
                  {PRIORITIES.map(p => (
                    <Pill key={p.value} selected={form.priorities.includes(p.value)} onClick={() => togglePriority(p.value)}>
                      {p.label}
                    </Pill>
                  ))}
                </div>
              </Field>
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
              <Button onClick={submit}>
                Get Started →
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
