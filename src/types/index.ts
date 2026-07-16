export interface Restaurant {
  name: string;
  ownerName: string;
  city: string;
  revenueRange: string;
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
