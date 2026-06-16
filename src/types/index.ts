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
  star: MenuItem[];       // high sales, high margin
  hiddenGem: MenuItem[];  // low sales, high margin
  volumeTrap: MenuItem[]; // high sales, low margin
  deadWeight: MenuItem[]; // low sales, low margin
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
