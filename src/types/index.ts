export type EstablishmentType = 'dhaba' | 'qsr' | 'cafe' | 'fine-dine' | 'cloud-kitchen' | 'other';
export type MealPeriodOffered = 'breakfast' | 'lunch' | 'dinner';
export type TrackingMethod = 'pos' | 'manual' | 'none';
export type BusinessPriority =
  | 'reducing-food-waste'
  | 'pricing-dishes'
  | 'staffing-scheduling'
  | 'understanding-sales'
  | 'all';

export interface Restaurant {
  name: string;
  ownerName: string;
  city: string;
  cuisine: string;
  establishmentType: EstablishmentType;
  daysOpenPerWeek: number;
  mealPeriods: MealPeriodOffered[];
  trackingMethod: TrackingMethod;
  posName?: string;
  priorities: BusinessPriority[];
}

export interface MenuItem {
  id: string;
  name: string;
  sellingPrice: number;
  rawMaterialCost: number;
  category?: string;
}

export interface BillingEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  dishName: string;
  quantity: number;
  sellingPrice: number;
  mealPeriod?: 'breakfast' | 'lunch' | 'dinner' | 'other';
}

export interface MenuQuadrant {
  star: MenuItem[];
  hiddenGem: MenuItem[];
  volumeTrap: MenuItem[];
  deadWeight: MenuItem[];
}

export interface DailySummary {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  topDishes: { name: string; quantity: number; revenue: number }[];
  foodCostPct: number;
  grossProfit: number;
}

export interface ForecastEntry {
  date: string;
  predicted: number;
  actual?: number;
}

export interface DishForecast {
  dishName: string;
  forecasts: ForecastEntry[];
}

export interface ForecastResult {
  totalRevenueForecast: ForecastEntry[];
  dishForecasts: DishForecast[];
  mae: number;
  rmse: number;
  generatedAt: string;
}

export interface Report {
  id: string;
  date: string;
  generatedAt: string;
  summary: DailySummary;
  aiText: string;
  type: 'morning' | 'evening';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ─── ML Types ───────────────────────────────────────────────────────────────

export interface IngredientMapping {
  dishId: string;
  dishName: string;
  ingredients: { name: string; quantityPerServing: number; unit: string }[];
}

export interface IngredientForecast {
  ingredientName: string;
  unit: string;
  dailyForecasts: { date: string; predicted: number; lower: number; upper: number }[];
  totalNeeded: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface WastagePrediction {
  dishName: string;
  date: string;
  predictedWasteQty: number;
  predictedWasteRupees: number;
  recommendedPrepQty: number;
  usualPrepQty: number;
  estimatedSaving: number;
  confidence: 'high' | 'medium' | 'low';
  preventionAction: string;
}

export interface PricingRecommendation {
  dishId: string;
  dishName: string;
  currentPrice: number;
  recommendedPrice: number;
  elasticity: number;
  projectedRevenueChangePct: number;
  projectedDemandChangePct: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  isApplied: boolean;
}

export interface WorkforceRecommendation {
  date: string;
  hour: number;
  predictedOrders: number;
  demandBin: 'low' | 'medium' | 'high' | 'peak';
  recommendedStaff: { kitchen: number; service: number; cashier: number };
  shiftLabel: string;
}

// ─── Opportunity Engine ─────────────────────────────────────────────────────

export type OpportunitySignalType =
  | 'trending_up' | 'trending_down' | 'quadrant_shift' | 'pricing' | 'wastage' | 'promotion';

export type OpportunityStatus = 'new' | 'acted_on' | 'dismissed' | 'expired';

export interface Opportunity {
  id: string;
  dishName: string;
  signalType: OpportunitySignalType;
  recommendationText: string;
  projectedImpact: number; // estimated ₹/week
  confidence: 'low' | 'medium' | 'high';
  status: OpportunityStatus;
  createdDate: string; // YYYY-MM-DD
  /** Set when a marked-"acted_on" opportunity's actual outcome is later computed. */
  resolvedDate: string | null;
  /** Actual measured ₹/week impact once resolved; null until then. */
  outcome: number | null;
  /**
   * When the owner marked this "acted_on" — not in the original spec's field list,
   * but required to know when the 7-day outcome-check window starts; createdDate
   * (when the signal was first detected) is a different moment and would make the
   * outcome check fire too early/late if reused for this.
   */
  actedOnDate?: string | null;
}

export interface PromotionRecord {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: 'discount' | 'combo' | 'festival' | 'flat';
  discountValue: number;
  affectedDishes: string[];
  revenueImpactPct?: number;
  orderVolumeImpactPct?: number;
  profitabilityImpactPct?: number;
  pValue?: number;
  recommendation?: string;
  naturalLanguageFinding?: string;
  analyzedAt?: string;
}
