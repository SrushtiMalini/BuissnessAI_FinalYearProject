import type { EstablishmentType, MealPeriodOffered, TrackingMethod, BusinessPriority } from '../types';

export const ESTABLISHMENT_TYPES: { value: EstablishmentType; label: string }[] = [
  { value: 'dhaba', label: 'Dhaba' },
  { value: 'qsr', label: 'QSR' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'fine-dine', label: 'Fine Dine' },
  { value: 'cloud-kitchen', label: 'Cloud Kitchen' },
  { value: 'other', label: 'Other' },
];

export const MEAL_PERIODS: { value: MealPeriodOffered; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

export const TRACKING_METHODS: { value: TrackingMethod; label: string; description: string }[] = [
  { value: 'pos', label: 'POS system', description: 'We use a point-of-sale system' },
  { value: 'manual', label: 'Notebook / manual', description: 'We track sales by hand' },
  { value: 'none', label: 'Not tracked yet', description: "We don't track sales currently" },
];

export const PRIORITIES: { value: BusinessPriority; label: string }[] = [
  { value: 'reducing-food-waste', label: 'Reducing food waste' },
  { value: 'pricing-dishes', label: 'Pricing dishes correctly' },
  { value: 'staffing-scheduling', label: 'Staffing / scheduling' },
  { value: 'understanding-sales', label: 'Understanding what sells' },
  { value: 'all', label: 'All of the above' },
];

export const CUISINE_SUGGESTIONS = [
  'North Indian', 'South Indian', 'Chaat', 'Continental', 'Chinese', 'Mughlai', 'Multi-cuisine',
];

export function togglePriority(current: BusinessPriority[], value: BusinessPriority): BusinessPriority[] {
  if (value === 'all') {
    return current.length === 1 && current[0] === 'all' ? [] : ['all'];
  }
  const withoutAll = current.filter(p => p !== 'all');
  return withoutAll.includes(value) ? withoutAll.filter(v => v !== value) : [...withoutAll, value];
}
