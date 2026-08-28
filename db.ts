import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Tests set BIQ_DB_PATH=":memory:" so they never touch the real dev database.
const DB_PATH = process.env.BIQ_DB_PATH ?? (() => {
  const DATA_DIR = path.join(process.cwd(), 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  return path.join(DATA_DIR, 'businessiq.db');
})();

export const db = new Database(DB_PATH);
if (DB_PATH !== ':memory:') db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS billing_entries (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    date TEXT NOT NULL,
    time TEXT,
    dish_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    selling_price REAL NOT NULL,
    meal_period TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_billing_entries_restaurant ON billing_entries(restaurant_id);

  CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    name TEXT NOT NULL,
    selling_price REAL NOT NULL,
    raw_material_cost REAL NOT NULL,
    category TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reports_restaurant ON reports(restaurant_id);

  CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    dish_name TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    recommendation_text TEXT NOT NULL,
    projected_impact REAL NOT NULL,
    confidence TEXT NOT NULL,
    status TEXT NOT NULL,
    created_date TEXT NOT NULL,
    resolved_date TEXT,
    outcome REAL,
    acted_on_date TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_opportunities_restaurant ON opportunities(restaurant_id);
`);

export interface RestaurantRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface BillingEntryRow {
  id: string;
  restaurant_id: string;
  date: string;
  time: string | null;
  dish_name: string;
  quantity: number;
  selling_price: number;
  meal_period: string | null;
}

export interface MenuItemRow {
  id: string;
  restaurant_id: string;
  name: string;
  selling_price: number;
  raw_material_cost: number;
  category: string | null;
}

export interface ReportRow {
  id: string;
  restaurant_id: string;
  date: string;
  type: string;
  content: string;
  created_at: string;
}

export interface OpportunityRow {
  id: string;
  restaurant_id: string;
  dish_name: string;
  signal_type: string;
  recommendation_text: string;
  projected_impact: number;
  confidence: string;
  status: string;
  created_date: string;
  resolved_date: string | null;
  outcome: number | null;
  acted_on_date: string | null;
}
