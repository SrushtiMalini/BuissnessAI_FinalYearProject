# BusinessIQ — Complete Technical Reference Manual
## Final Year CSE Project | AI-Powered Restaurant Business Analyst
### Prepared for Viva / Project Evaluation

---

> **How to use this document:** Read it once from top to bottom. Every section explains a real file in the codebase. Wherever you see a file path like `src/lib/analytics.ts`, that exact file exists in the project. Every function name, every algorithm, every formula in this document is from the actual running code.

---

# PART 1: PROJECT OVERVIEW

## 1.1 What is BusinessIQ?

BusinessIQ is a full-stack web application that acts as an AI-powered business analyst for small Indian restaurants. The application accepts raw billing data exported from a POS (Point of Sale) system, processes it using five machine learning algorithms built entirely in TypeScript, and delivers actionable business intelligence — including demand forecasting, food wastage reduction, dynamic menu pricing, workforce scheduling, promotion effectiveness measurement, and an AI chat assistant.

The name "BusinessIQ" reflects the core idea: giving intelligence (IQ) to a business that previously operated only on gut instinct.

## 1.2 The Business Problem

Small restaurant owners in India face four recurring operational problems:

**Problem 1 — Food Wastage**
Restaurants over-prepare food because they cannot predict demand accurately. Unsold food is thrown away, directly destroying raw material cost. A restaurant preparing 20 plates of Paneer Butter Masala when only 12 will sell wastes the raw material cost of 8 plates every day.

**Problem 2 — Wrong Pricing**
Dishes are priced based on competition or intuition, not demand patterns. Some dishes are underpriced (customers would pay more) and some are overpriced (customers avoid them). Without data, owners cannot identify which is which.

**Problem 3 — Staffing Inefficiency**
Staff are scheduled based on habit, not demand patterns. Tuesday lunch may be peak hour but the owner doesn't know it — they schedule the same staff every day, leading to idle workers during slow hours and overwhelmed staff during rush hours.

**Problem 4 — No Business Visibility**
The owner has a stack of billing receipts but no tool that converts them into revenue trends, profit margins, peak hours, top dishes, or week-over-week comparisons. They are flying blind.

BusinessIQ solves all four problems using only the billing CSV data the restaurant already generates.

## 1.3 Target Users

- Small restaurant owners and managers in India
- Monthly revenue range: ₹50,000 to ₹5,00,000
- Establishments: dhabas, mess canteens, tiffin services, small cafes
- Technical profile: no coding knowledge required; basic smartphone literacy sufficient
- The app is in English but uses Indian Rupee (₹) formatting throughout

## 1.4 Critical Architectural Decision: No Backend Database

**The most important design decision in the entire project:** All user data is stored in the browser's `localStorage`. There is no cloud database, no user accounts, no server-side data storage.

Why this was chosen:
- Zero hosting cost — no database server to pay for
- Zero privacy risk — data never leaves the user's device
- Zero setup — no account creation, no login
- Instant deployment — the app works offline after first load

The only external service call is to the NVIDIA AI API for report generation and chat responses.

---

# PART 2: COMPLETE TECHNOLOGY STACK

## 2.1 Frontend Technologies

### React 19.0.1
**What it is:** A JavaScript library for building user interfaces using components.
**Where it is used:** Every page and UI element in the application. The entry point is `src/main.tsx`.
**Why chosen:** React is the industry standard for modern web UIs. Version 19 includes improved concurrent rendering. The project uses functional components with hooks throughout.

### TypeScript 5.8.2
**What it is:** A typed superset of JavaScript that compiles to JavaScript.
**Where it is used:** Every single file in the project — frontend pages, ML algorithms, utility functions, type definitions. File extensions are `.tsx` (TypeScript + JSX) and `.ts` (TypeScript).
**Why chosen:** All five ML algorithms involve complex mathematical computations. TypeScript's type system ensures that a `BillingEntry[]` array cannot accidentally be passed where a `MenuItem[]` is expected, preventing entire categories of runtime bugs. The `src/types/index.ts` file defines all data structures.

### React Router DOM 7.18.0
**What it is:** A routing library that handles navigation between pages in a Single Page Application.
**Where it is used:** `src/App.tsx` — all route definitions are here.
**Why chosen:** Enables navigation (Dashboard → Forecast → Chat) without full page reloads, making the app feel like a native desktop application.

### Recharts 3.8.1
**What it is:** A charting library built on top of D3.js, designed for React.
**Where it is used:** `src/design-system/charts/index.tsx` — BarChart, LineChart, AreaChart, DonutChart are all Recharts wrappers. The HeatmapChart is a custom CSS Grid implementation (not Recharts).
**Why chosen:** Simple API, good TypeScript support, responsive out of the box.

### Tailwind CSS 4.1.14
**What it is:** A utility-first CSS framework where you style elements using class names.
**Where it is used:** Every component file uses Tailwind utility classes for layout, spacing, and responsive design.
**Why chosen:** Rapid development — no need to write separate CSS files for each component.

### Lucide React 0.546.0
**What it is:** An icon library providing clean, consistent SVG icons as React components.
**Where it is used:** Navigation sidebar (AppShell.tsx), page headers, buttons, empty states throughout the app.

### Motion (Framer Motion) 12.23.24
**What it is:** An animation library for React.
**Where it is used:** Page transition `animate-fade-in` in `src/index.css` and `AppShell.tsx`.

## 2.2 Backend Technologies

### Node.js with Express 4.21.2
**What it is:** A minimal web server framework for Node.js.
**Where it is used:** `server.ts` — the entire backend is a single file.
**Why chosen:** Lightweight, fast to write, perfect for a small API with only two endpoints.

### TSX 4.21.0
**What it is:** A tool that runs TypeScript files directly without a separate compilation step.
**Where it is used:** The `npm run dev` command runs `npx tsx server.ts` — this starts the Express server AND the Vite development server together.

### Vite 6.2.3
**What it is:** A modern frontend build tool and development server.
**Where it is used:** `vite.config.ts` configures the build. In development mode, Vite runs as middleware inside the Express server (vite.middlewares).
**Why chosen:** Extremely fast hot module replacement, native ES modules, simple configuration.

### dotenv 17.4.2
**What it is:** Loads environment variables from a `.env.local` file.
**Where it is used:** Top of `server.ts` — loads `NVIDIA_API_KEY` before the server starts.

## 2.3 AI / External API

### NVIDIA NIM API
**Model used:** `minimaxai/minimax-m3`
**Endpoint:** `https://integrate.api.nvidia.com/v1/chat/completions`
**Where it is used:** `server.ts` — the `callNvidia()` function.
**Parameters:** temperature=1.0, top_p=0.95, max_tokens=8192, stream=false
**Why NVIDIA NIM:** Free API key available at build.nvidia.com, supports OpenAI-compatible chat completions format, high token limit (8192) suitable for long restaurant data contexts.

## 2.4 Design System Fonts

- **DM Serif Display** — Used for large KPI numbers (total revenue, etc.) — elegant, readable
- **DM Sans** — Body font, used for all regular text — clean, modern
- **IBM Plex Mono** — Monospace font for numbers, codes, financial figures — ensures digit alignment

All fonts loaded from Google Fonts CDN in `src/design-system/tokens.css`.

## 2.5 Development Tools

| Tool | Purpose |
|---|---|
| TypeScript compiler (tsc) | Type checking via `npm run lint` |
| Vite | Build bundling for production |
| tsx | Direct TypeScript execution in Node |
| autoprefixer | CSS vendor prefix handling |

---

# PART 3: SYSTEM ARCHITECTURE

## 3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              React SPA (Frontend)                │   │
│  │                                                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │   │
│  │  │  Pages   │  │  Design  │  │  ML Modules   │ │   │
│  │  │ (11 pages│  │  System  │  │  (5 algorithms│ │   │
│  │  │ in /pages│  │(/design- │  │  in /lib/ml/) │ │   │
│  │  │ and /ml) │  │ system/) │  │               │ │   │
│  │  └────┬─────┘  └──────────┘  └───────┬───────┘ │   │
│  │       │                               │         │   │
│  │  ┌────▼───────────────────────────────▼──────┐  │   │
│  │  │           Analytics Engine                │  │   │
│  │  │     (src/lib/analytics.ts, forecasting.ts,│  │   │
│  │  │      menuEngine.ts, reportGenerator.ts)   │  │   │
│  │  └────────────────────┬──────────────────────┘  │   │
│  │                       │                          │   │
│  │  ┌────────────────────▼──────────────────────┐  │   │
│  │  │         Storage Layer (localStorage)       │  │   │
│  │  │  (src/lib/storage.ts — 9 storage keys)    │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  └──────────────────────────┬──────────────────────┘   │
│                             │ HTTP fetch                │
└─────────────────────────────┼───────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────┐
│              Express Server (server.ts)                  │
│              Port 3000 — Node.js                         │
│                                                         │
│   POST /api/ai/report ──────┐                           │
│   POST /api/ai/chat   ──────┼──► callNvidia()           │
│                             │                           │
└─────────────────────────────┼───────────────────────────┘
                              │ HTTPS
                              │
┌─────────────────────────────▼───────────────────────────┐
│         NVIDIA NIM API (External)                        │
│         Model: minimaxai/minimax-m3                      │
│         https://integrate.api.nvidia.com                 │
└─────────────────────────────────────────────────────────┘
```

## 3.2 Data Flow

```
CSV File (User's POS Export)
        │
        ▼
src/lib/csvParser.ts (parseCSV)
  - Detect delimiter (, ; | tab)
  - Map column headers
  - Normalize dates
  - Infer meal periods
        │
        ▼
BillingEntry[] array
        │
        ├──► localStorage (biq_billing) via storage.ts
        │
        ├──► analytics.ts ──► Dashboard charts and KPIs
        │
        ├──► forecasting.ts ──► 7-day WMA forecast
        │
        ├──► menuEngine.ts ──► Menu engineering quadrants
        │
        ├──► reportGenerator.ts ──► Context string ──► NVIDIA API ──► Report text
        │
        └──► ML modules:
               wastagePredictor.ts ──► Prep recommendations
               dynamicPricing.ts ──► Price changes
               ingredientForecast.ts ──► Purchase list
               workforceForecast.ts ──► Staffing schedule
               promotionAnalyzer.ts ──► ITS analysis
```

## 3.3 Request-Response Lifecycle for AI Features

```
User clicks "Evening Report" on ReportPage
        │
        ▼
generateDailyReport() in reportGenerator.ts
  buildReportContext() assembles structured text from analytics
  Appends instruction prompt
        │
        ▼
callAI('/api/ai/report', { context }) in aiClient.ts
  POST to http://localhost:3000/api/ai/report
        │
        ▼
server.ts /api/ai/report handler
  Extracts context from request body
  Calls callNvidia([{ role: 'user', content: context }])
        │
        ▼
NVIDIA API (minimaxai/minimax-m3)
  Returns { choices: [{ message: { content: "..." } }] }
        │
        ▼
server.ts sends { text: content } back
        │
        ▼
callAI returns { text: "AI generated report..." }
        │
        ▼
Report object created, saved to localStorage via storage.appendReport()
ReportPage re-renders with new report displayed
```

---

# PART 4: FOLDER STRUCTURE

```
BuisnessAI/                          ← Project root
├── server.ts                        ← Express backend (ONLY backend file)
├── package.json                     ← Dependencies and npm scripts
├── vite.config.ts                   ← Vite build configuration
├── tsconfig.json                    ← TypeScript compiler configuration
├── .env.local                       ← NVIDIA_API_KEY (not committed to git)
├── .env.example                     ← Template showing required env vars
├── index.html                       ← HTML entry point for Vite
├── dist/                            ← Production build output
└── src/
    ├── main.tsx                     ← React application entry point
    ├── App.tsx                      ← Route definitions, navigation guards
    ├── index.css                    ← Global CSS, imports design tokens
    ├── types/
    │   └── index.ts                 ← ALL TypeScript interfaces/types
    ├── lib/
    │   ├── storage.ts               ← localStorage read/write layer
    │   ├── analytics.ts             ← Core analytics functions
    │   ├── forecasting.ts           ← WMA demand forecasting
    │   ├── menuEngine.ts            ← Menu engineering quadrant logic
    │   ├── csvParser.ts             ← CSV file parsing and validation
    │   ├── reportGenerator.ts       ← Report context builder + AI caller
    │   ├── aiClient.ts              ← HTTP client for AI endpoints
    │   └── ml/                      ← Machine Learning modules
    │       ├── features.ts          ← Shared feature engineering utils
    │       ├── wastagePredictor.ts  ← Newsvendor model for food waste
    │       ├── dynamicPricing.ts    ← OLS price elasticity + Lerner rule
    │       ├── ingredientForecast.ts← Gradient-boosted WMA for ingredients
    │       ├── workforceForecast.ts ← Random Forest analogue for staffing
    │       └── promotionAnalyzer.ts ← Interrupted Time Series analysis
    ├── pages/
    │   ├── OnboardingPage.tsx       ← First-time setup form
    │   ├── UploadPage.tsx           ← CSV upload with drag-drop
    │   ├── MenuPage.tsx             ← Menu item editor
    │   ├── DashboardPage.tsx        ← Main analytics dashboard
    │   ├── ForecastPage.tsx         ← 7-day revenue + dish forecast
    │   ├── ReportPage.tsx           ← AI-generated reports
    │   ├── ChatPage.tsx             ← Conversational AI analyst
    │   └── ml/
    │       ├── WastageManagementPage.tsx
    │       ├── DynamicPricingPage.tsx
    │       ├── IngredientForecastPage.tsx
    │       ├── WorkforcePlanningPage.tsx
    │       └── PromotionAnalysisPage.tsx
    ├── layout/
    │   └── AppShell.tsx             ← Sidebar + topbar layout wrapper
    ├── components/
    │   └── ui/
    │       └── index.tsx            ← Legacy UI components (Button, Card)
    └── design-system/
        ├── tokens.css               ← CSS custom properties (colors, fonts)
        ├── components/
        │   └── index.tsx            ← Full design system components
        └── charts/
            └── index.tsx            ← Chart components (Bar/Line/Area/Donut/Heatmap)
```

---

# PART 5: HOW THE APPLICATION STARTS

## 5.1 Development Mode

When you run `npm run dev`, this executes `npx tsx server.ts`.

**Step 1 — Environment loading:**
```typescript
// server.ts lines 1-3
import { config } from "dotenv";
config({ path: ".env.local" });  // loads NVIDIA_API_KEY
config({ path: ".env" });         // fallback
```

**Step 2 — Express app creation:**
```typescript
const app = express();
app.use(express.json({ limit: "2mb" }));  // parse JSON bodies up to 2MB
```

**Step 3 — AI route registration:**
Two routes are registered: `POST /api/ai/report` and `POST /api/ai/chat`.

**Step 4 — Vite dev middleware (development only):**
```typescript
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "spa",
});
app.use(vite.middlewares);
```
This makes Vite serve the React app through the same Express server. Result: one server on port 3000 handles both the API and the frontend.

**Step 5 — Server listen:**
```typescript
app.listen(PORT, "0.0.0.0", () => {
  console.log(`BusinessIQ server running on http://localhost:3000`);
});
```

## 5.2 Production Mode

Running `npm run build` creates the `dist/` folder. In production mode, Express serves the static files:
```typescript
app.use(express.static(distPath));
app.get("*", (_req, response) => {
  response.sendFile(path.join(distPath, "index.html"));
});
```
This means any URL (like `/dashboard`) returns `index.html`, letting React Router handle navigation client-side.

## 5.3 React Application Bootstrap

`index.html` contains `<div id="root"></div>`. Vite injects the compiled JS bundle. Then:

```typescript
// src/main.tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

React mounts the `App` component into the `root` div, and the application is live.

---

# PART 6: DATA MODEL (ALL TYPESCRIPT INTERFACES)

All interfaces are defined in `src/types/index.ts`. Every piece of data in the application corresponds to one of these interfaces.

## 6.1 Restaurant
```typescript
interface Restaurant {
  name: string;        // Restaurant name e.g. "Shyam Dhaba"
  ownerName: string;   // Owner's name e.g. "Shashank"
  city: string;        // City e.g. "Bangalore"
  revenueRange: string; // Monthly revenue bucket e.g. "₹50K–₹1L"
}
```
Stored in `localStorage` under key `biq_restaurant`. Set once during onboarding, never deleted.

## 6.2 MenuItem
```typescript
interface MenuItem {
  id: string;            // Unique identifier (timestamp string)
  name: string;          // Dish name e.g. "Paneer Butter Masala"
  sellingPrice: number;  // Price customer pays in ₹ e.g. 160
  rawMaterialCost: number; // Cost of ingredients in ₹ e.g. 72
  category?: string;     // Optional: "main", "bread", "rice"
}
```
Stored under `biq_menu`. The **margin** is calculated as `(sellingPrice - rawMaterialCost) / sellingPrice × 100`.

## 6.3 BillingEntry
```typescript
interface BillingEntry {
  id: string;      // "YYYY-MM-DD-dishName-rowIndex"
  date: string;    // "YYYY-MM-DD" format always
  time?: string;   // "HH:MM" optional — for peak hour analysis
  dishName: string; // Must match MenuItem.name for cost lookup
  quantity: number; // Number of plates/units sold
  sellingPrice: number; // Price at time of sale
  mealPeriod?: 'breakfast' | 'lunch' | 'dinner' | 'other';
}
```
Stored under `biq_billing`. This is the primary data source for ALL analytics. Parsed from CSV upload. The `id` field prevents duplicates when uploading the same file twice.

## 6.4 MenuQuadrant
```typescript
interface MenuQuadrant {
  star: MenuItem[];       // High sales + High margin
  hiddenGem: MenuItem[];  // Low sales + High margin
  volumeTrap: MenuItem[]; // High sales + Low margin
  deadWeight: MenuItem[]; // Low sales + Low margin
}
```

## 6.5 DailySummary
```typescript
interface DailySummary {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  topDishes: { name: string; quantity: number; revenue: number }[];
  foodCostPct: number;   // (rawMaterialCost / totalRevenue) × 100
  grossProfit: number;   // totalRevenue - rawMaterialCost
}
```

## 6.6 ForecastEntry / ForecastResult
```typescript
interface ForecastEntry {
  date: string;
  predicted: number;  // WMA-predicted revenue
  actual?: number;    // Present only in backtesting entries
}

interface ForecastResult {
  totalRevenueForecast: ForecastEntry[]; // 7 future days
  dishForecasts: DishForecast[];         // Per-dish plate forecasts
  mae: number;   // Mean Absolute Error in ₹
  rmse: number;  // Root Mean Square Error in ₹
  generatedAt: string; // ISO timestamp
}
```

## 6.7 Report
```typescript
interface Report {
  id: string;
  date: string;         // The date the report covers
  generatedAt: string;  // When AI generated it
  summary: DailySummary; // Numerical data snapshot
  aiText: string;       // The AI-generated narrative text
  type: 'morning' | 'evening';
}
```
Stored under `biq_reports`. Capped at 30 reports (newest first).

## 6.8 ChatMessage
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
```
Stored under `biq_chat`. Capped at 100 messages (oldest dropped).

## 6.9 ML Types

**IngredientMapping** — Links a dish to its ingredient list with quantity per serving.

**IngredientForecast** — 7-day daily quantity forecast per ingredient with confidence intervals.

**WastagePrediction** — Per-dish: recommended prep qty, usual prep qty, estimated saving, prevention action.

**PricingRecommendation** — Per-dish: current price, recommended price, elasticity, revenue impact projection.

**WorkforceRecommendation** — Per date+hour: predicted orders, demand bin, staff counts (kitchen/service/cashier).

**PromotionRecord** — Promotion metadata + ITS analysis results (revenueImpactPct, pValue, recommendation).

---

# PART 7: STORAGE LAYER (localStorage)

## 7.1 File Location
`src/lib/storage.ts`

## 7.2 Storage Keys
```typescript
const KEYS = {
  restaurant: 'biq_restaurant',
  menu: 'biq_menu',
  billing: 'biq_billing',
  reports: 'biq_reports',
  chat: 'biq_chat',
  ingredientMappings: 'biq_ingredient_mappings',
  wastageLog: 'biq_wastage_log',
  pricingRecs: 'biq_pricing_recs',
  promotions: 'biq_promotions',
}
```

## 7.3 Generic Read/Write Functions
```typescript
function get<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

function set<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}
```
All data is JSON-serialized before storage and JSON-parsed on retrieval. The `try/catch` in `get()` handles corrupted data gracefully.

## 7.4 Key Operations and Their Limits

| Operation | Function | Limit/Behavior |
|---|---|---|
| Add billing | `appendBilling(entries)` | Deduplicates by `id` field — uploading same file twice is safe |
| Add report | `appendReport(report)` | Keeps only newest 30: `.slice(0, 30)` |
| Add chat message | `appendChat(msg)` | Keeps last 100: `.slice(-100)` |
| Add wastage log | `appendWastageLog(entry)` | Keeps last 500: `.slice(-500)` |
| Clear everything | `clearAll()` | Removes all 9 keys from localStorage |

## 7.5 Deduplication Logic
```typescript
appendBilling: (entries: BillingEntry[]) => {
  const existing = get<BillingEntry[]>(KEYS.billing) ?? [];
  const existingIds = new Set(existing.map(e => e.id));
  const newEntries = entries.filter(e => !existingIds.has(e.id));
  set(KEYS.billing, [...existing, ...newEntries]);
  return newEntries.length; // returns count of actually added rows
}
```
The `id` for each `BillingEntry` is `${date}-${dishName}-${rowIndex}`. If you re-upload the same CSV, all IDs match the existing set, and `newEntries` is empty.

---

# PART 8: FRONTEND ROUTING

## 8.1 File Location
`src/App.tsx`

## 8.2 Route Table

| Path | Component | Guard | Description |
|---|---|---|---|
| `/` | OnboardingPage | None | First-time setup |
| `/dashboard` | DashboardPage | RequireOnboarding + AppShell | Main analytics |
| `/upload` | UploadPage | RequireOnboarding + AppShell | CSV upload |
| `/menu` | MenuPage | RequireOnboarding + AppShell | Menu management |
| `/forecast` | ForecastPage | RequireOnboarding + AppShell | WMA forecast |
| `/report` | ReportPage | RequireOnboarding + AppShell | AI reports |
| `/chat` | ChatPage | RequireOnboarding + AppShell | AI chat |
| `/ml/wastage` | WastageManagementPage | RequireOnboarding + AppShell | Newsvendor ML |
| `/ml/ingredients` | IngredientForecastPage | RequireOnboarding + AppShell | Ingredient ML |
| `/ml/workforce` | WorkforcePlanningPage | RequireOnboarding + AppShell | Workforce ML |
| `/ml/pricing` | DynamicPricingPage | RequireOnboarding + AppShell | Pricing ML |
| `/ml/promotions` | PromotionAnalysisPage | RequireOnboarding + AppShell | ITS analysis |
| `*` (catch-all) | Navigate to `/` | None | 404 redirect |

## 8.3 RequireOnboarding Guard

```typescript
function RequireOnboarding({ children }: { children: ReactNode }) {
  const restaurant = storage.getRestaurant();
  if (!restaurant) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```
Before rendering any protected page, this checks if the restaurant object exists in localStorage. If it doesn't (first visit, or cleared data), it redirects to `/` (OnboardingPage). This is the application's only "authentication" mechanism — not a security measure, but a UX flow guard.

## 8.4 AppLayout Wrapper
```typescript
function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireOnboarding>
      <AppShell>{children}</AppShell>
    </RequireOnboarding>
  );
}
```
Every protected route wraps its content in `AppLayout`, which applies both the guard and the sidebar/topbar layout.

---

# PART 9: ONBOARDING FLOW

## 9.1 File Location
`src/pages/OnboardingPage.tsx`

## 9.2 What the User Sees
A centered card on a dark background (`#0D1117`) with:
- BusinessIQ logo (ChefHat icon + title)
- Form: Restaurant Name (required), Owner Name (required), City (optional), Monthly Revenue Range (dropdown)

## 9.3 Form Logic
```typescript
const [form, setForm] = useState({
  name: '',
  ownerName: '',
  city: '',
  revenueRange: 'Under ₹50K',
});

function submit(e: FormEvent) {
  e.preventDefault();
  if (!form.name.trim() || !form.ownerName.trim()) return; // validation
  storage.setRestaurant(form);   // save to localStorage
  navigate('/upload');           // redirect to upload page
}
```

## 9.4 After Onboarding
Once the restaurant is saved, `RequireOnboarding` will always pass (returns children instead of redirect). The user is sent to `/upload` to provide billing data.

---

# PART 10: CSV UPLOAD AND PARSING

## 10.1 File Location
`src/lib/csvParser.ts` — parsing logic
`src/pages/UploadPage.tsx` — upload UI

## 10.2 Upload UI Features (UploadPage.tsx)
- **Drag-and-drop zone:** `onDrop`, `onDragOver`, `onDragLeave` handlers
- **Click-to-upload:** Hidden `<input type="file">` triggered by clicking the drop zone
- **Progress bar:** Real-time `ParseProgress` updates during parsing
- **Preview table:** Shows first 8 rows after parsing
- **Statistics:** Total rows, unique days, unique dishes, skipped rows count
- **Sample data:** "Use Sample Data" button calls `generateSampleCSV()` which creates 30 days of fake data for 7 dishes
- **Download sample:** Creates a Blob URL and triggers browser download
- **Deduplication:** `storage.appendBilling()` silently skips already-imported rows

## 10.3 CSV Parsing Algorithm (csvParser.ts)

### Step 1 — Delimiter Detection
```typescript
function detectDelimiter(sample: string): string {
  const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  for (const ch of sample) {
    if (ch in counts) counts[ch as keyof typeof counts]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
```
Counts occurrences of each possible delimiter in the first line. Most frequent wins. Supports comma, semicolon, tab, and pipe formats.

### Step 2 — Header Mapping with Aliases
```typescript
const aliases: Record<string, string[]> = {
  date: ['date', 'order_date', 'sale_date', 'transaction_date', 'day'],
  dishName: ['dish', 'dish_name', 'item', 'item_name', 'product', 'name', 'menu_item'],
  quantity: ['qty', 'quantity', 'count', 'units', 'sold'],
  sellingPrice: ['price', 'selling_price', 'unit_price', 'rate', 'amount', 'revenue'],
  mealPeriod: ['meal', 'meal_period', 'period', 'shift', 'session'],
};
```
The parser normalizes each header to lowercase with underscores, then checks it against every alias list. This means a CSV from Petpooja POS (which uses "dish_name") and one from a custom Excel (which uses "item") both work without modification.

**Required columns:** `date` and `dishName`. If either is missing, parsing fails with a descriptive error.

### Step 3 — Date Normalization
```typescript
function normaliseDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10); // ISO: 2024-01-15
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; // DD/MM/YYYY
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; // MM/DD/YYYY
  return null; // Invalid date → row is skipped with error
}
```
All dates are normalized to `YYYY-MM-DD` regardless of input format. 2-digit years are converted to 4-digit (e.g., `24` → `2024`).

### Step 4 — Meal Period Inference
If no `mealPeriod` column exists but a `time` column does:
```typescript
function inferMealPeriod(time?: string): BillingEntry['mealPeriod'] {
  const [h] = time.split(':').map(Number);
  if (h >= 6 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 16 && h < 23) return 'dinner';
  return 'other';
}
```
Hours 6–10 → breakfast, 11–15 → lunch, 16–22 → dinner, rest → other.

### Step 5 — Batched Processing
```typescript
const BATCH = 500;
function processBatch() {
  const end = Math.min(i + BATCH, total);
  for (; i < end; i++) { /* parse rows */ }
  onProgress?.({ processed: i, total, pct: Math.round((i/total)*100) });
  if (i < total) setTimeout(processBatch, 0); // yield to browser
  else resolve({ entries, errors, totalRows });
}
```
Processing 500 rows at a time with `setTimeout(processBatch, 0)` releases the browser's main thread between batches. This prevents the UI from freezing on large files and allows the progress bar to update.

### Step 6 — Error Handling
- Invalid dates: row skipped, error logged as "Row N: invalid date 'X'"
- Missing dish name: row skipped
- Maximum 20 errors reported (to avoid flooding the UI)
- Price cleanup: `replace(/[₹,\s]/g, '')` removes ₹ symbol and commas from price strings


---

# PART 11: MENU ENGINE

## 11.1 File Location
`src/lib/menuEngine.ts`

## 11.2 Purpose
The menu engine answers the most fundamental question a restaurant owner has: "Which dishes should I keep, promote, reprice, or remove?" It implements the **Menu Engineering Matrix**, a well-established hospitality industry framework developed by Michael Kasavana and Donald Smith.

## 11.3 Step 1 — Computing Dish Metrics

```typescript
export function computeDishMetrics(entries: BillingEntry[], menu: MenuItem[]): DishMetrics[]
```

For every unique dish name found in billing entries:
- `totalQuantity` = sum of all quantities sold across all dates
- `totalRevenue` = sum of `sellingPrice × quantity` across all dates
- `rawMaterialCost` = looks up `MenuItem.rawMaterialCost` from menu, multiplies by total quantity
- `contributionMargin` = `totalRevenue - rawMaterialCost`
- `marginPct` = `(contributionMargin / totalRevenue) × 100`

The function uses a `Map<string, MenuItem>` keyed by lowercase dish name for O(1) lookup. If a dish in billing has no matching menu item, `rawMaterialCost = 0` (cannot calculate margin without cost data).

## 11.4 Step 2 — Menu Quadrant Classification

```typescript
export function classifyMenu(metrics: DishMetrics[]): MenuQuadrant
```

Two thresholds are computed:
- `avgQty` = average total quantity sold across all dishes
- `avgMarginPct` = average margin percentage across all dishes

Each dish is classified by comparing against both averages:

```
                    MARGIN
                Low        High
           ┌──────────┬──────────┐
      High │  Volume  │   Star   │
SALES      │   Trap   │ (⭐ keep) │
           ├──────────┼──────────┤
       Low │   Dead   │  Hidden  │
           │  Weight  │   Gem    │
           └──────────┴──────────┘
```

- **Star** (`highSales && highMargin`): Best performers. High volume AND high margin. Action: protect and feature prominently on the menu.
- **Hidden Gem** (`!highSales && highMargin`): High margin but not enough customers ordering. Action: promote actively, feature in recommendations.
- **Volume Trap** (`highSales && !highMargin`): Customers love it but margins are thin. Action: consider repricing upward.
- **Dead Weight** (`!highSales && !highMargin`): Neither popular nor profitable. Action: consider removing from menu.

## 11.5 Insight Text Generation

```typescript
export function getMenuProfitabilityInsight(quadrant: MenuQuadrant): string
```
Generates a human-readable summary: "3 star dishes (protect these), 1 hidden gem (promote more), 2 volume traps (consider repricing)". Used in AI report context and Dashboard subtitle.

---

# PART 12: ANALYTICS ENGINE

## 12.1 File Location
`src/lib/analytics.ts`

## 12.2 groupByDate

```typescript
export function groupByDate(entries: BillingEntry[]): Record<string, BillingEntry[]>
```
Groups all billing entries by date string. Uses `reduce` to build a dictionary where each key is a `YYYY-MM-DD` date and each value is the array of entries for that day. This is the foundational function used by almost every other analytics function.

## 12.3 getDailySummaries

```typescript
export function getDailySummaries(entries: BillingEntry[], menu: MenuItem[]): DailySummary[]
```
For each date in the billing data:
1. Builds a `dishTotals` Map (dish name → {quantity, revenue})
2. Computes `totalRevenue = sum(sellingPrice × quantity)` for all entries
3. Computes `totalOrders = sum(quantity)` for all entries
4. Looks up each dish in menu to compute `rawMaterialCost`
5. Calculates `foodCostPct = (rawMaterialCost / totalRevenue) × 100`
6. Calculates `grossProfit = totalRevenue - rawMaterialCost`
7. Sorts dishes by quantity to get `topDishes` (top 5)

Returns a sorted array of `DailySummary` objects. **This is the single most important function** — almost every dashboard metric derives from these summaries.

**Food Cost % industry benchmark:** 30%. The dashboard colors food cost % red if >35%, amber if >30%.

## 12.4 getRevenueByDay

```typescript
export function getRevenueByDay(summaries: DailySummary[], days = 30)
```
Returns the last N days of summaries mapped to `{date, revenue, profit}`. Used to power the area chart on the dashboard.

## 12.5 getTopDishes

```typescript
export function getTopDishes(entries: BillingEntry[], topN = 10)
```
Aggregates total quantity and revenue per dish across ALL time, sorts by revenue descending, returns top N. Displayed as the "Top Dishes by Revenue" table on the dashboard.

## 12.6 getPeakHours

```typescript
export function getPeakHours(entries: BillingEntry[])
```
Creates an array of 24 hour slots (0–23). For each entry with a `time` field, parses the hour and adds the quantity to that slot. Returns `[{hour: 0, orders: 0}, {hour: 1, orders: 0}, ..., {hour: 23, orders: 45}]`. If billing data has no `time` column, all values are 0 and the peak hours chart shows an empty state.

## 12.7 getMealPeriodSplit

```typescript
export function getMealPeriodSplit(entries: BillingEntry[])
```
Sums total revenue by meal period: `{breakfast: 0, lunch: 0, dinner: 0, other: 0}`. Powers the donut chart on the dashboard.

## 12.8 getWeeklyComparison

```typescript
export function getWeeklyComparison(summaries: DailySummary[])
```
- `thisWeek` = sum of revenue for last 7 days of summaries
- `lastWeek` = sum of revenue for the 7 days before that
- `pctChange = (thisWeek - lastWeek) / lastWeek × 100`

Displayed as the "This Week vs Last Week" card on the dashboard with a green/red badge.

## 12.9 computeKPIs

```typescript
export function computeKPIs(summaries: DailySummary[])
```
Returns:
- `totalRevenue` = sum of all daily revenues
- `avgDailyRevenue` = totalRevenue / number of days
- `avgFoodCost` = average food cost % across all days
- `bestDay` = the `DailySummary` with the highest single-day revenue

---

# PART 13: DASHBOARD PAGE

## 13.1 File Location
`src/pages/DashboardPage.tsx`

## 13.2 Data Loading
All data comes from localStorage via the `storage` module. No API calls. All computations are wrapped in `useMemo` to avoid recomputing on every render:

```typescript
const summaries = useMemo(() => getDailySummaries(billing, menu), [billing, menu]);
const revenueByDay = useMemo(() => getRevenueByDay(summaries, 30), [summaries]);
const topDishes = useMemo(() => getTopDishes(billing, 8), [billing]);
// etc.
```

## 13.3 Dashboard Components

### KPI Tiles (4 tiles in a grid)
| Tile | Value | Source | Color Logic |
|---|---|---|---|
| Total Revenue | Sum of all revenue | `summaries.reduce(s, d => s + d.totalRevenue, 0)` | None |
| Total Orders | Sum of all orders | `summaries.reduce(s, d => s + d.totalOrders, 0)` | None |
| Avg Daily Revenue | Average per day | `kpis.avgDailyRevenue` | None |
| Avg Food Cost | Average food cost % | `kpis.avgFoodCost` | Green <30%, Amber 30-35%, Red >35% |

### Revenue Area Chart (30 Days)
- Component: `AreaChart` from design system
- Data: `revenueByDay` — array of `{date, revenue, profit}`
- Two areas: Revenue (green) and Gross Profit (amber)
- X-axis: formatted as `DD/MM`
- Y-axis: formatted as `₹Xk`

### Top Dishes Table
- Component: `DataTable` (sortable by orders or revenue)
- Data: `getTopDishes(billing, 8)` — top 8 dishes by revenue
- Columns: Rank, Dish Name, Orders (sortable), Revenue (sortable)

### Meal Period Donut Chart
- Component: `DonutChart`
- Data: `getMealPeriodSplit(billing)` → filtered to non-zero values
- Shows revenue split: Breakfast / Lunch / Dinner / Other

### Weekly Comparison Card
- Shows `thisWeek` and `lastWeek` revenue values
- Change badge: green if `pctChange >= 0`, red if negative

### Peak Hours Bar Chart
- Component: `BarChart`
- Data: `getPeakHours(billing)` filtered to hours with orders, sliced hours 6-22
- Only shows if billing data includes time information

### Empty State
If no billing data exists, the entire dashboard shows an `EmptyState` component with a link to `/upload`.

---

# PART 14: FORECASTING MODULE — WEIGHTED MOVING AVERAGE

## 14.1 File Location
`src/lib/forecasting.ts`

## 14.2 What Is WMA?
Weighted Moving Average (WMA) is a forecasting method that computes a weighted average of past observations, giving more weight to recent data. Unlike Simple Moving Average (SMA), WMA recognizes that last week's performance is more predictive than four weeks ago.

## 14.3 Weights Used
```typescript
const WMA_WEIGHTS = [0.4, 0.3, 0.2, 0.1]; // most recent first
```
- Most recent same-weekday: 40% weight
- 2 weeks ago same-weekday: 30% weight
- 3 weeks ago same-weekday: 20% weight
- 4 weeks ago same-weekday: 10% weight

Total weight = 1.0 (normalized).

## 14.4 Why Day-of-Week Matters
Restaurants have strong weekly seasonality. Sunday lunch is typically different from Tuesday lunch. Simply using the last 4 days would mix weekdays and weekends, producing poor predictions. The algorithm explicitly finds the last 4 occurrences of the **same day of week** as the target date.

```typescript
const sameDowRevenues: number[] = sortedDates
  .filter(date => getDayOfWeek(date) === futureDow)
  .slice(-4)
  .map(date => getDailyRevenue(byDate, date));
const predicted = wma(sameDowRevenues);
```

## 14.5 WMA Computation
```typescript
function wma(values: number[]): number {
  const n = Math.min(values.length, WMA_WEIGHTS.length);
  let sum = 0, weightSum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[values.length - 1 - i] * WMA_WEIGHTS[i];
    weightSum += WMA_WEIGHTS[i];
  }
  return sum / weightSum; // normalized in case fewer than 4 data points
}
```

## 14.6 7-Day Future Forecast

For each of the next 7 days:
1. Compute the future date: `addDays(lastDate, d)` for d = 1 to 7
2. Get day of week for that future date
3. Find last 4 historical dates with the same day of week
4. Apply WMA to get predicted revenue
5. Round to nearest ₹

## 14.7 Backtesting (Accuracy Evaluation)

The model evaluates itself by treating the last 7 days of available data as a test set:
- **Training dates:** All dates except the last 7
- **Test dates:** Last 7 dates
- For each test date, predict using only training data (no data leakage)
- Compare predicted vs actual

```typescript
const evalForecasts: ForecastEntry[] = testDates.map(testDate => {
  const dow = getDayOfWeek(testDate);
  const trainingDow = trainDates.filter(d => getDayOfWeek(d) === dow).slice(-4);
  const predicted = wma(trainingDow.map(d => getDailyRevenue(byDate, d)));
  const actual = getDailyRevenue(byDate, testDate);
  return { date: testDate, predicted: Math.round(predicted), actual };
});
```

## 14.8 Error Metrics

### MAE (Mean Absolute Error)
```
MAE = (1/n) × Σ |predicted_i - actual_i|
```
Interpretation: "On average, the model's prediction is off by ±₹MAE per day."
Example: MAE = ₹450 means predictions are typically within ±₹450.

### RMSE (Root Mean Square Error)
```
RMSE = √( (1/n) × Σ (predicted_i - actual_i)² )
```
RMSE penalizes large errors more heavily than MAE. If RMSE >> MAE, the model has occasional very large errors. Both are displayed on the Forecast page.

## 14.9 Per-Dish Forecast
The same WMA algorithm runs for each unique dish name (up to 15 dishes), forecasting quantities (plates) for the next 7 days. Used in the "Per-Dish Prep Forecast" table on ForecastPage.

## 14.10 Minimum Data Requirement
The function returns empty results if fewer than 7 days of data are available. Need at least 4 occurrences of the same weekday for reliable WMA.

---

# PART 15: ML MODULE 1 — WASTAGE PREDICTOR (NEWSVENDOR MODEL)

## 15.1 File Location
`src/lib/ml/wastagePredictor.ts`

## 15.2 The Business Problem
A restaurant prepares food in the morning without knowing exactly how many customers will come. If they prepare too much → food is wasted (overage cost). If they prepare too little → customers are disappointed and contribution margin is lost (underage cost).

## 15.3 The Newsvendor Model (Operations Research)
The Newsvendor Problem is a classic OR model for single-period inventory decisions under uncertain demand. It is the same model used by McDonald's, Domino's, and every major QSR chain.

**Costs:**
- `Co` (overage cost) = raw material cost per unit wasted
- `Cu` (underage cost) = contribution margin per unit of lost sale = selling price - raw material cost

**Critical Ratio:**
```
CR = Cu / (Cu + Co) = (P - C) / P
```
Where P = selling price, C = raw material cost.

**Optimal Preparation Quantity:**
```
Q* = F⁻¹(CR) = μ + z(CR) × σ
```
Where:
- `μ` = mean demand (WMA forecast for target date)
- `σ` = standard deviation of historical demand
- `z(CR)` = the z-score at the critical ratio probability (from Normal inverse CDF)
- `F⁻¹` = inverse of Normal CDF

## 15.4 Normal Inverse CDF Implementation

Since there is no math library, the code implements the **Beasley-Springer-Moro algorithm** — a rational polynomial approximation of the Normal inverse CDF, accurate to 7 significant figures:

```typescript
function normalInverseCDF(p: number): number {
  // Uses polynomial coefficients a[], b[], c[], d[]
  // Different rational approximations for lower tail, central, upper tail
  // pLow = 0.02425, pHigh = 0.97575
}
```
This is a well-known numerical methods algorithm published in ACM Transactions on Mathematical Software. It replaces what would otherwise require a statistics library.

## 15.5 Newsvendor Implementation

```typescript
function newsvendorOptimalQty(meanDemand, stdDemand, unitCost, unitRevenue): number {
  const criticalRatio = (unitRevenue - unitCost) / unitRevenue;
  const z = normalInverseCDF(Math.max(0.01, Math.min(0.99, criticalRatio)));
  const q = meanDemand + z * Math.max(stdDemand, meanDemand * 0.15);
  return Math.max(0, Math.round(q));
}
```

The `Math.max(stdDemand, meanDemand * 0.15)` ensures minimum 15% standard deviation even if historical data is very consistent — accounts for real-world variability.

## 15.6 Demand Forecast for Target Date

```typescript
function forecastDishDemand(stats: DishStats, targetDate: string): number {
  const dow = new Date(targetDate).getDay();
  const sameDow = stats.sortedDates
    .filter(d => new Date(d).getDay() === dow).slice(-4);
  // WMA with weights [0.4, 0.3, 0.2, 0.1]
  let base = wma(sameDow.map(d => stats.byDate.get(d) ?? 0));

  // Adjustments from features.ts
  if (isFestival(targetDate)) base *= 1.18;      // +18% on festivals
  else if (festivalProximity(targetDate) <= 2) base *= 1.12; // +12% near festival
  if (isWeekend(targetDate)) base *= 1.10;        // +10% on weekends
  if (isMonthEnd(targetDate)) base *= 1.06;       // +6% at month end
  return Math.max(0, Math.round(base));
}
```

## 15.7 Usual Prep Quantity
```typescript
const usualPrep = Math.round(stats.avgQty * 1.15);
```
The model assumes current practice is to prepare 15% above average demand — a common restaurant buffer.

## 15.8 Savings Calculation
```typescript
const waste = Math.max(0, usualPrep - forecastedDemand);
const estimatedSaving = Math.round(waste * rawCost);
```
If the forecast demand is lower than usual prep, the difference × raw material cost = money saved by not over-preparing.

## 15.9 Prevention Actions
The model generates specific advice based on waste patterns:
- If `wasteRatio > 0.3`: "Significantly reduce prep quantity. Consider batch cooking in smaller lots."
- If `stdQty/avgQty > 0.4` (high volatility): "Demand is volatile — cook in two batches: morning and post-lunch."
- Otherwise: "Reduce preparation batch size."

## 15.10 Confidence Levels
- `high`: ≥60 days of data (very reliable)
- `medium`: 30–59 days
- `low`: <30 days (use with caution)

## 15.11 Wastage Analysis (analyzeWastage)
Separate from predictions, the analysis function computes:
- **Trend per dish**: Compares `rMean` (last 14 days avg) vs `pMean` (previous 14 days avg). If `rMean > pMean × 1.05` → improving (demand rising, less waste). If `rMean < pMean × 0.95` → worsening.
- **Daily waste 30d**: Estimates daily waste ₹ for the last 30 days for the bar chart
- **Waste as % of revenue**: For the financial impact tab

---

# PART 16: ML MODULE 2 — DYNAMIC PRICING (PRICE ELASTICITY)

## 16.1 File Location
`src/lib/ml/dynamicPricing.ts`

## 16.2 The Economic Concept: Price Elasticity of Demand
Price elasticity measures how sensitive demand is to price changes:
```
ε = (% change in quantity demanded) / (% change in price)
```
- `|ε| > 1`: Elastic demand — customers are price-sensitive. Raising price loses volume significantly.
- `|ε| < 1`: Inelastic demand — customers aren't price-sensitive. Raising price barely reduces volume.

For food: staple items (Roti, Rice) tend to be inelastic. Premium items (Paneer Butter Masala) tend to be elastic.

## 16.3 Log-Log OLS Regression
The elasticity is estimated using the **log-log regression model**:
```
ln(quantity) = α + ε × ln(price) + ε_residual
```
Taking logs linearizes the multiplicative demand function. The slope of this regression IS the price elasticity.

**Implementation — Cross-Sectional OLS:**
Since individual dish prices rarely change over time in a small restaurant, the model uses cross-sectional variation — comparing elasticity across dishes at different price points.

```typescript
const xs = [...dishStats.values()].map(d => d.lnPrice);
const ys = [...dishStats.values()].map(d => d.lnQty);
const n = xs.length;
const xMean = xs.reduce((s, v) => s + v, 0) / n;
const yMean = ys.reduce((s, v) => s + v, 0) / n;
const slope = xs.reduce((s, x, i) => s + (x-xMean)*(ys[i]-yMean), 0)
              / xs.reduce((s, x) => s + (x-xMean)**2, 0 + 1e-9);
```
This is the standard OLS formula: `β = Σ(xᵢ-x̄)(yᵢ-ȳ) / Σ(xᵢ-x̄)²`

## 16.4 Elasticity Bounds
```typescript
const globalElasticity = Math.max(-3.5, Math.min(-0.2, slope));
```
Food elasticity is bounded to [-3.5, -0.2]. Values outside this range indicate data issues.

## 16.5 Fallback for Insufficient Data
If fewer than 3 dishes have enough data for OLS, assumed elasticities are used:
- Price > ₹150: ε = -1.8 (expensive dishes are more elastic)
- Price ₹80–₹150: ε = -1.3
- Price < ₹80: ε = -0.9 (cheap staples are more inelastic)

## 16.6 Lerner Markup Rule (Optimal Price)
The Lerner condition for profit-maximizing price:
```
P* = C × |ε| / (|ε| - 1)   [when |ε| > 1, elastic demand]
P* = P × 1.15               [when |ε| < 1, inelastic — just raise price 15%]
```
This is the standard microeconomics formula for monopoly pricing from Wooldridge's Econometrics textbook.

## 16.7 Price Constraints
```typescript
const minPrice = C / (1 - 0.35); // minimum 35% margin always maintained
const maxPrice = P * 1.3;        // maximum 30% above current price
optimalPrice = Math.max(minPrice, Math.min(maxPrice, optimalPrice));
optimalPrice = Math.round(optimalPrice / 5) * 5; // round to nearest ₹5
```
Practical constraints prevent unrealistic recommendations.

## 16.8 Filtering
Recommendations are only generated if `|priceDiffPct| >= 5%` (changes less than 5% are not worth the friction of repricing).

## 16.9 Revenue Impact Calculation
```typescript
const demandChangePct = elasticity * priceDiffPct;
const newRevenue = optimalPrice * (1 + demandChangePct / 100);
const revenueChangePct = ((newRevenue - currentRevenue) / currentRevenue) * 100;
```

## 16.10 Applying a Recommendation
When the user clicks "Apply Price Change" on DynamicPricingPage:
```typescript
function applyRecommendation(rec: PricingRecommendation) {
  const currentMenu = storage.getMenu();
  const updated = currentMenu.map(m =>
    m.id === rec.dishId ? { ...m, sellingPrice: rec.recommendedPrice } : m
  );
  storage.setMenu(updated);
}
```
The menu in localStorage is updated immediately. All subsequent analytics, wastage predictions, and ingredient forecasts will use the new price.

---

# PART 17: ML MODULE 3 — INGREDIENT FORECAST

## 17.1 File Location
`src/lib/ml/ingredientForecast.ts`

## 17.2 Purpose
Answers the question: "How much of each raw ingredient do I need to buy for the next 7 days?" This directly enables the owner to make accurate purchase orders, reducing both over-buying and stockouts.

## 17.3 Prerequisite: Ingredient Mappings
The owner must first define which ingredients each dish uses and in what quantity per serving. This is done via the "Manage Ingredient Mappings" modal on the IngredientForecastPage.

Example: Dal Fry uses 80g dal + 15g ghee + 50g onion per serving.

Stored in localStorage under `biq_ingredient_mappings`.

## 17.4 The Algorithm: Feature-Weighted WMA with Gradient-Boosted Features

The base forecast uses the same day-of-week WMA as the revenue forecasting:
```typescript
const weights = [0.4, 0.3, 0.2, 0.1];
let base = wma(sameDow.map(d => demand.byDate.get(d) ?? 0));
```

Then feature adjustments are layered on top (this is the "gradient boosting" analogue):

```typescript
// Rolling trend adjustment: if demand is rising, increase forecast
const trend = mean7 / mean30;
base *= Math.max(0.7, Math.min(1.5, trend)); // bounded to [0.7x, 1.5x]

// Festival proximity boost
if (isFestival(targetDate)) base *= 1.20;
else if (prox <= 2) base *= 1.15;
else if (prox <= 7) base *= 1.08;

// Weekend uplift
if (isWeekend(targetDate)) base *= 1.12;

// Month-end uplift (salary received, higher spending)
if (isMonthEnd(targetDate)) base *= 1.07;
```

## 17.5 Dish → Ingredient Aggregation
For each future day, for each dish mapping:
1. Predict dish demand for that day
2. Multiply by `ingredient.quantityPerServing` for each ingredient
3. Sum across all dishes that use the same ingredient

This gives total raw ingredient quantity needed per day.

## 17.6 Safety Buffer
```typescript
const qty = Math.ceil(entry.qty * 1.2); // 20% safety buffer
```
All ingredient quantities are increased by 20% before presenting as the purchase recommendation. This accounts for recipe inconsistency, spoilage during storage, and forecast error.

## 17.7 Confidence Intervals
```typescript
dailyForecasts.push({
  predicted: qty,
  lower: Math.max(0, Math.round(qty - std * 1.2)),
  upper: Math.round(qty + std * 1.2),
});
```
The `std` propagates through: first estimated from same-weekday historical data for each dish, then multiplied by `quantityPerServing` and summed across dishes. The `±1.2σ` bounds form the confidence interval band shown on the ingredient detail chart.

## 17.8 Model Metrics (computeIngredientForecastMetrics)
Computes MAE (Mean Absolute Error in units) and MAPE (Mean Absolute Percentage Error) by:
1. Holding out last 7 days of billing data
2. Re-running forecast on training data for validation dates
3. Comparing predicted dish demand vs actual sold quantities

---

# PART 18: ML MODULE 4 — WORKFORCE PLANNING (RANDOM FOREST ANALOGUE)

## 18.1 File Location
`src/lib/ml/workforceForecast.ts`

## 18.2 Why "Random Forest Analogue"?
A true Random Forest would require training hundreds of decision trees in-browser, which is computationally prohibitive for a TypeScript web app. Instead, the code implements the **same feature set** that Random Forest models use for workforce demand prediction:
- Day of week
- Hour of day
- Historical same-period observations
- Festival and weather-like adjustments
- Rolling trend

The predictions are aggregated using weighted averaging across the last 4 weeks — equivalent to a shallow ensemble of time-series models.

## 18.3 Hourly Order Map

```typescript
function buildHourlyMap(entries: BillingEntry[]): Map<string, number> {
  for (const e of entries) {
    const hour = parseInt(e.time.split(':')[0], 10);
    const key = `${e.date}|${hour}`;
    map.set(key, (map.get(key) ?? 0) + e.quantity);
  }
}
```
Creates a map of `"YYYY-MM-DD|H" → order count`. If no time data exists, daily orders are distributed using typical meal period weight patterns (7% at 7am, 14% at noon, etc.).

## 18.4 Percentile Thresholds for Demand Bins

```typescript
const p25 = percentile(allHourlyValues, 25);
const p60 = percentile(allHourlyValues, 60);
const p85 = percentile(allHourlyValues, 85);
```

Every hour's predicted orders is classified against these thresholds:
- `≤ p25` → **low**
- `p25 < x ≤ p60` → **medium**
- `p60 < x ≤ p85` → **high**
- `> p85` → **peak**

Using data-driven percentiles (rather than fixed numbers) means the thresholds adapt to each restaurant's scale. A restaurant doing 5 orders/hour peak vs one doing 50 orders/hour peak will both get meaningful bins.

## 18.5 Staffing Rules

```typescript
const STAFFING: Record<DemandBin, {kitchen: number; service: number; cashier: number}> = {
  low:    { kitchen: 1, service: 1, cashier: 1 },
  medium: { kitchen: 2, service: 2, cashier: 1 },
  high:   { kitchen: 3, service: 3, cashier: 1 },
  peak:   { kitchen: 4, service: 4, cashier: 2 },
};
```
K = Kitchen staff, S = Service/waiter staff, C = Cashier. Designed for a typical small Indian restaurant with counter service.

## 18.6 Prediction Loop

For each day (next 7 days) and each hour (7am–10pm):
1. Find the same day-of-week in last 4 weeks
2. Average the hourly order counts for that specific hour
3. Apply festival (+20%) and weekend (+10%) boosts
4. Classify into demand bin
5. Map to staffing recommendation

## 18.7 Shift Labels
```typescript
function shiftLabel(hour: number): string {
  if (hour >= 6 && hour <= 10) return 'morning';
  if (hour >= 11 && hour <= 14) return 'lunch';
  if (hour >= 15 && hour <= 17) return 'afternoon';
  if (hour >= 18 && hour <= 22) return 'evening';
  return 'off-peak';
}
```

## 18.8 Heatmap Construction (buildWorkforceHeatmap)
Converts the array of `WorkforceRecommendation` objects into a 2D grid:
- Rows: days of the week (Sun–Sat)
- Columns: hours (7–22)
- Cell value: predicted order count
- Cell label: total staff count
Rendered using the custom `HeatmapChart` component (CSS Grid, not Recharts).

## 18.9 Weekly Staff Cost Estimate (getWeeklyStaffCost)
Groups recommendations by shift label per day, takes max staff count per shift (to avoid double-counting), and multiplies by `₹600/staff/day ÷ 4 shifts`. Default daily cost per staff is ₹600.

---

# PART 19: ML MODULE 5 — PROMOTION ANALYSIS (INTERRUPTED TIME SERIES)

## 19.1 File Location
`src/lib/ml/promotionAnalyzer.ts`

## 19.2 The Business Problem
Restaurant owners run promotions (Diwali discount, Happy Hour, combo deals) but don't know if they actually help. A naive before/after comparison is misleading because revenue naturally varies. Interrupted Time Series (ITS) controls for the pre-existing trend.

## 19.3 ITS Design Matrix

The regression model is:
```
Y_t = β0 + β1×T + β2×D_t + β3×T_after_t + ε
```

Where:
- `Y_t` = revenue (or orders) on day t
- `T` = time index (days since analysis start) — controls for linear trend
- `D_t` = 1 if date is during promotion period, 0 otherwise — the **level change**
- `T_after_t` = time elapsed since promotion ended — the **slope change / recovery**
- `β2` = the causal estimate of promotion's immediate effect (what we want)

## 19.4 Full OLS Implementation (No External Library)

The code implements OLS from scratch using matrix algebra:
```
β = (X'X)⁻¹ X'Y
```

**Matrix multiplication (X'X and X'Y):**
```typescript
for (let i = 0; i < k; i++)
  for (let j = 0; j < k; j++)
    for (let t = 0; t < n; t++) XtX[i][j] += X[t][i] * X[t][j];
```

**Matrix inversion (Gaussian elimination):**
```typescript
function invertMatrix(M: number[][]): number[][] | null {
  // Augments M with identity matrix [M|I]
  // Applies Gauss-Jordan elimination
  // Returns the right half [I|M⁻¹]
}
```
If the matrix is singular (perfectly collinear data), `invertMatrix` returns `null` and the analysis gracefully fails.

## 19.5 Standard Errors and p-value

```typescript
const sse = resid.reduce((s, r) => s + r**2, 0);
const sigma2 = sse / (n - k); // MSE
const se = inv.map((row, i) => Math.sqrt(Math.max(0, sigma2 * row[i]))); // SE from diagonal of σ²(X'X)⁻¹
```

T-statistic for promotion coefficient:
```typescript
const tStat = revResult.se[2] > 0 ? revEffect / revResult.se[2] : 0;
```

P-value approximation using Beta function:
```typescript
function tPValue(tStat: number, df: number): number {
  const x = df / (df + tStat**2);
  // Regularized incomplete Beta function approximation
}
```
`p < 0.10` is used as the significance threshold (10% level, standard for small samples).

## 19.6 Impact Calculations

```typescript
const baselineRevMean = datesBefore.map(d => revenueMap.get(d) ?? 0)
                                   .reduce((s, v) => s + v, 0) / datesBefore.length;
const revenueImpactPct = (revEffect / baselineRevMean) * 100;
const profitabilityImpactPct = revenueImpactPct - promotion.discountValue;
```

Profitability impact deducts the discount cost: a promotion that raised revenue 10% but gave a 15% discount actually reduced profitability by 5%.

## 19.7 Recommendation Logic
```typescript
const recommendation =
  profitabilityImpactPct > 5 ? 'repeat' :
  profitabilityImpactPct > -5 ? 'modify' :
  'discontinue';
```

## 19.8 Natural Language Finding
The model auto-generates an English sentence:
> "This promotion increased profitability by 8.3%. Revenue changed by +12.1% and order volume by +15.4%. Statistical confidence: high (p < 0.10). Consider repeating during high-traffic periods."

---

# PART 20: FEATURE ENGINEERING LIBRARY

## 20.1 File Location
`src/lib/ml/features.ts`

## 20.2 Purpose
This file is shared by all 5 ML modules. It provides the common feature transformations needed by all time-series models. Centralizing these prevents code duplication and ensures all modules use identical feature definitions.

## 20.3 Indian Festival Calendar

```typescript
const INDIAN_FESTIVALS_2024_2025_2026: Record<string, string> = {
  '2024-01-15': 'Makar Sankranti',
  '2024-03-25': 'Holi',
  '2024-08-15': 'Independence Day',
  '2024-11-01': 'Diwali',
  '2025-03-14': 'Holi',
  '2025-11-01': 'Diwali',
  // ... 30+ Indian festivals hardcoded
}
```
Covers 2024–2026. Restaurant demand typically spikes on festivals — this feature captures that pattern. Festivals covered include: Makar Sankranti, Holi, Ram Navami, Baisakhi, Independence Day, Janmashtami, Ganesh Chaturthi, Dussehra, Diwali, Guru Nanak Jayanti, Christmas, New Year.

## 20.4 Festival Functions

```typescript
isFestival(dateStr): boolean
// Returns true if date is exactly on a festival
// e.g. isFestival('2024-11-01') === true (Diwali)

festivalProximity(dateStr): number
// Returns days to nearest festival (0–7, or 7 if >7 days away)
// e.g. festivalProximity('2024-10-30') === 2 (2 days before Diwali)
```

## 20.5 Other Feature Functions

```typescript
isWeekend(dateStr): boolean
// Returns true for Saturday (6) and Sunday (0)

isMonthEnd(dateStr): boolean
// True if within last 3 days of the month
// Rationale: many salaried workers get paid at month end → higher spending

addDays(dateStr, n): string
// Date arithmetic — add n days to a date string

rollingMean(dateMap, dateStr, windowDays): number
// Average of last N days ending at dateStr
// Used for trend detection in ingredientForecast

rollingStd(dateMap, dateStr, windowDays): number
// Standard deviation of last N days
// Used for confidence intervals

buildDailyRevenue(entries): Map<string, number>
buildDailyOrders(entries): Map<string, number>
// Build date → value maps used by promotionAnalyzer

getSortedDates(entries): string[]
// Returns sorted unique date strings from billing entries
```


---

# PART 21: AI / LLM INTEGRATION

## 21.1 Backend: server.ts

The entire backend is one file: `server.ts` in the project root.

### callNvidia() function
```typescript
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "minimaxai/minimax-m3";

async function callNvidia(messages: {role: string; content: string}[]): Promise<string> {
  const key = process.env.NVIDIA_API_KEY;
  const response = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages,
      temperature: 1.0,
      top_p: 0.95,
      max_tokens: 8192,
      stream: false,
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}
```

### Two API Routes

**POST /api/ai/report**
- Input: `{ context: string }` — a single large string containing the instruction + all restaurant data
- Calls: `callNvidia([{ role: "user", content: context }])`
- Output: `{ text: string }` — the AI-generated report narrative
- Used by: ReportPage.tsx (morning brief + evening report)

**POST /api/ai/chat**
- Input: `{ messages: {role, content}[] }` — full conversation history
- Calls: `callNvidia(messages)`
- Output: `{ text: string }` — the AI's reply
- Used by: ChatPage.tsx (conversational analyst)

## 21.2 Frontend AI Client: aiClient.ts

```typescript
export async function callAI(
  endpoint: '/api/ai/report' | '/api/ai/chat',
  payload: { context: string; messages?: AIMessage[] }
): Promise<AIResponse> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { text: data.text ?? '' };
}
```
This is a thin HTTP wrapper. It calls the Express server (same origin, port 3000), not the NVIDIA API directly. The API key never reaches the browser.

---

# PART 22: REPORT GENERATION (RAG PATTERN)

## 22.1 File Location
`src/lib/reportGenerator.ts`

## 22.2 What is RAG?
RAG = Retrieval-Augmented Generation. Instead of asking the AI a generic question, you first retrieve relevant data, attach it to the prompt as context, and then ask the AI to reason over that data. This grounds the AI response in real facts rather than hallucinated ones.

In BusinessIQ:
- **Retrieval** = `buildReportContext()` assembles all analytics into a structured text string
- **Augmented** = that context string is prepended to the instruction prompt
- **Generation** = NVIDIA model generates a report grounded in the actual data

## 22.3 buildReportContext()

This function assembles a structured plain-text document from all analytics:

```
RESTAURANT BUSINESS DATA (as of 2024-11-15)

=== TODAY'S PERFORMANCE ===
Revenue: ₹8,450
Orders: 67
Gross Profit: ₹5,200
Food Cost %: 38.5% (industry benchmark: 30%)
Top dishes today: Paneer Butter Masala (12 plates), Dal Fry (18 plates)...

=== WEEKLY OVERVIEW ===
This week revenue: ₹52,300
Last week revenue: ₹48,100
Change: +8.7%

=== TOP DISHES (all time) ===
1. Dal Fry: 420 plates, ₹33,600
2. Paneer Butter Masala: 280 plates, ₹44,800
...

=== MENU PROFITABILITY ===
2 star dishes (protect these), 1 hidden gem (promote more)...

=== OVERALL KPIs ===
Total revenue (all time): ₹3,24,000
Average daily revenue: ₹10,800
```

## 22.4 Prompt Templates

**Evening Report prompt:**
> "You are a friendly AI business analyst for [restaurant name]. Based on the data below, generate an end-of-day business report. Include: overall performance verdict (strong/decent/weak day), key wins, one or two specific things that need attention, and a short actionable suggestion for tomorrow. Write in plain, warm, human language. Do not use bullet points. Keep it under 200 words. End by asking how the day felt from the owner's perspective."

**Morning Brief prompt:**
> "You are a friendly AI business analyst for [restaurant name]. Based on the data below, generate a morning brief. Include: yesterday's performance summary, what to expect today based on patterns, and one specific preparation tip for today. Write in plain, warm language. Under 150 words."

The instruction + context string is sent as a single `user` message to the NVIDIA API.

## 22.5 Report Storage
Reports are stored in localStorage under `biq_reports`, capped at 30 (newest first). Each report stores:
- The AI text narrative
- The `DailySummary` snapshot at time of generation
- Type (morning/evening), date, generatedAt timestamp

---

# PART 23: AI CHAT SYSTEM

## 23.1 File Location
`src/pages/ChatPage.tsx`

## 23.2 System Prompt Construction
Every chat request sends the full restaurant context as a system message:

```typescript
const context = buildReportContext(billing, menu);
const systemPrompt = `You are a smart, friendly AI business analyst for "${restaurant.name}".
You have access to the restaurant's actual business data below.
Answer questions specifically using that data — give concrete numbers, specific dish names,
and actionable advice. Keep answers concise (3-5 sentences max).
Be warm but direct, like a trusted advisor.

DATA:
${context}`;
```

## 23.3 Conversation History Management
Only the last 10 messages are sent to the API (to stay within token limits):
```typescript
const aiMessages = [
  { role: 'system', content: systemPrompt },
  ...updated.slice(-10).map(m => ({ role: m.role, content: m.content })),
];
```

## 23.4 Message Persistence
Every user and assistant message is immediately saved to localStorage:
```typescript
storage.appendChat(userMsg);   // saved before API call
storage.appendChat(assistantMsg); // saved after API response
```
Chat history survives page refresh. Capped at 100 messages.

## 23.5 Suggested Questions
6 pre-built questions shown on empty chat state:
- "Which is my most profitable dish?"
- "What was my best day this week?"
- "Which dishes should I remove from the menu?"
- "How can I reduce food wastage?"
- "What is my average food cost percentage?"
- "Which meal period brings the most revenue?"

Clicking any of them calls `sendMessage(question)` directly.

## 23.6 Loading State (Typing Indicator)
Three bouncing dots shown while waiting for API response:
```typescript
{[0,1,2].map(i => (
  <div className="w-2 h-2 rounded-full animate-bounce"
    style={{ animationDelay: `${i * 0.15}s` }} />
))}
```

---

# PART 24: DESIGN SYSTEM

## 24.1 Design Tokens (tokens.css)
File: `src/design-system/tokens.css`

All visual constants are defined as CSS custom properties:

**Brand Colors:**
- `--color-unity: #5B6B4A` — Olive green, the primary brand color (buttons, links, active states)
- `--color-sunburst: #E8A830` — Amber/gold, used for icons and warnings
- `--color-carbon: #2C2C2C` — Near-black, used for dark backgrounds

**Semantic Colors:**
- `--color-success: #4A7C59` — Green for positive metrics
- `--color-danger: #C0392B` — Red for negative metrics / warnings
- `--color-warning: #E8A830` — Amber for caution states

**Typography:**
- `--font-display: 'DM Serif Display'` — For large KPI values
- `--font-body: 'DM Sans'` — For all body text
- `--font-mono: 'IBM Plex Mono'` — For numbers, financial figures

**Spacing scale:** --space-1 (4px) through --space-16 (64px)
**Border radius:** --radius-sm (4px) through --radius-full (9999px)
**Shadows:** --shadow-sm, --shadow-md, --shadow-lg

## 24.2 Component Library (design-system/components/index.tsx)

### Button
4 variants: `primary` (green filled), `secondary` (green outlined), `ghost` (transparent), `danger` (red filled)
3 sizes: `sm`, `md`, `lg`
Props: `loading` (shows spinner), `disabled`, `onClick`, `type`

### Card
Container with optional `title`, `subtitle`, `action` slot.
4 padding sizes: none/sm/md/lg.
Always uses `--color-bg-card` background with border and shadow.

### Badge
Inline label with 5 color variants: `success`, `warning`, `danger`, `neutral`, `info`
Optional `dot` prop adds a colored circle before the text.
Used everywhere for status indicators (confidence levels, trends, recommendations).

### MetricTile
The KPI card component. Props:
- `label` — small uppercase label
- `value` — large display number
- `valueFont` — `display` (serif), `mono` (monospace), or `body`
- `change` — shows ↑/↓ percentage change in green/red
- `subtext` — small secondary text below value
- `accent` — override value color (e.g., red for bad food cost %)
- `icon` — icon in top-right corner

### DataTable
Sortable table component. Props:
- `columns` — array of column definitions with optional `render`, `sortable`, `numeric`
- `data` — array of row objects
- `keyField` — unique identifier field
- `onRowClick` — optional row click handler
Client-side sorting: clicking a sortable column header toggles asc/desc.

### EmptyState
Centered placeholder shown when no data exists.
Props: `icon`, `title`, `description`, `action` (a button/link)

### Modal
Full-screen overlay with centered card.
Closes on backdrop click or × button.
`width` prop controls max-width.

### Tooltip
CSS-only hover tooltip using `group-hover:opacity-100`.
Shows content above the wrapped element on hover.

### Alert
Colored information banner. 4 variants: success/warning/danger/info.
Optional `onClose` button.

## 24.3 Chart Library (design-system/charts/index.tsx)

All charts use `ResponsiveContainer` from Recharts — automatically fills their parent width.

### BarChart
Supports horizontal and vertical layouts.
Multiple bars per data point (grouped).
Rounded corners on bars.

### LineChart
Smooth monotone curves.
Multiple lines with optional dashed style.
No dots on data points (clean look).

### AreaChart
Gradient fill (15% opacity at top → 1% at bottom).
Smooth monotone curves with stroke.
Multiple overlapping areas.

### DonutChart
PieChart with `innerRadius="55%"` creating the donut hole.
Legend below.
Custom tooltip formatter.

### HeatmapChart (Custom — NOT Recharts)
Built using CSS Grid, not SVG.
Rows = days, Columns = hours.
Cell color computed by `heatmapColor(intensity)` function:
- Low intensity → light green
- Medium → amber
- High → red
Hover scale animation on each cell.
Used for Workforce Planning heatmap.

### Chart Color Palette
```typescript
export const CHART_COLORS = ['#5B6B4A', '#E8A830', '#8B9B7A', '#C0392B', '#2C7A5C', '#D4A017'];
```
Olive green, amber, sage, red, teal, gold — matches brand tokens.

---

# PART 25: NAVIGATION AND LAYOUT

## 25.1 File Location
`src/layout/AppShell.tsx`

## 25.2 Structure
```
┌─────────────────────────────────────────────────┐
│  TOPBAR (fixed, height 56px)                    │
│  [☰] Restaurant Name          [🔔] [Upload]     │
├──────────┬──────────────────────────────────────┤
│ SIDEBAR  │  PAGE CONTENT                        │
│ (fixed)  │  (scrollable)                        │
│ 240px    │  pt-14 (topbar offset)               │
│ or 56px  │                                      │
│ collapsed│                                      │
└──────────┴──────────────────────────────────────┘
```

## 25.3 Sidebar Navigation Groups

**Overview section:**
- Dashboard (`/dashboard`) — LayoutDashboard icon
- Reports (`/report`) — FileText icon
- AI Analyst (`/chat`) — MessageSquare icon

**Intelligence section (ML pages):**
- Ingredient Forecast (`/ml/ingredients`) — Package icon
- Wastage Management (`/ml/wastage`) — Trash2 icon
- Dynamic Pricing (`/ml/pricing`) — DollarSign icon
- Promotion Analysis (`/ml/promotions`) — Megaphone icon
- Workforce Planning (`/ml/workforce`) — Users icon

**Settings section:**
- Menu Setup (`/menu`) — UtensilsCrossed icon
- Forecasting (`/forecast`) — TrendingUp icon
- Upload Data (`/upload`) — Upload icon

## 25.4 Active State Detection
```typescript
const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to));
```
Active link gets: green left border (`border-l-[3px] border-[--color-sunburst]`), green background tint.

## 25.5 Collapsible Sidebar
- Expanded: 240px wide, shows icons + labels
- Collapsed: 56px wide, shows icons only (labels hidden)
- Toggle button in sidebar header
- Mobile: sidebar hidden off-screen, overlay appears when open
- Page content `marginLeft` transitions smoothly: `style={{ marginLeft: sidebarW, transition: 'margin-left 0.2s' }}`

## 25.6 Topbar
Fixed at top. Shows:
- Hamburger menu button (mobile only)
- Restaurant name from localStorage
- Bell icon (notification placeholder)
- Upload button (shortcut to /upload)

---

# PART 26: ALL PAGES — COMPLETE WALKTHROUGH

## 26.1 OnboardingPage (`/`)
**File:** `src/pages/OnboardingPage.tsx`
- Shows on first visit or when localStorage has no restaurant data
- Dark background (#0D1117), centered card
- Form: Restaurant Name (required), Owner Name (required), City, Revenue Range (dropdown)
- On submit: saves to `biq_restaurant`, navigates to `/upload`
- No back navigation — once submitted, RequireOnboarding passes

## 26.2 UploadPage (`/upload`)
**File:** `src/pages/UploadPage.tsx`
- Drag-and-drop zone + click-to-browse
- Accepts .csv and .txt files
- "Use Sample Data" generates 30 days of fake data for 7 Indian dishes
- "Download Sample CSV" creates a template for the user to fill
- Progress bar during parsing (batched 500 rows at a time)
- Preview: shows row count, day count, dish count, first 8 rows
- "Save & Continue" deduplicates and appends to localStorage, navigates to `/menu`

## 26.3 MenuPage (`/menu`)
**File:** `src/pages/MenuPage.tsx`
- Editable table: each row = one dish with Name, Selling Price, Raw Material Cost inputs
- Margin % auto-calculated and shown as Badge (green ≥50%, amber ≥30%, red <30%)
- Pre-loaded with 7 sample dishes if menu is empty
- Menu Engineering Matrix shown at top (collapsible) when billing data exists
- "Add dish" adds empty row; Trash icon removes a row
- "Save Menu" filters empty names, saves to localStorage, navigates to `/dashboard`
- When billing exists, each dish row shows its quadrant badge (Star/Hidden Gem/Volume Trap/Dead Weight)

## 26.4 DashboardPage (`/dashboard`)
**File:** `src/pages/DashboardPage.tsx`
- All data from localStorage, all computed with useMemo
- 4 KPI MetricTiles, Revenue AreaChart, Top Dishes DataTable, Meal Period DonutChart, Weekly Comparison Card, Peak Hours BarChart
- Empty state with link to /upload if no billing data

## 26.5 ForecastPage (`/forecast`)
**File:** `src/pages/ForecastPage.tsx`
- Runs `runWMAForecast(billing, 7)` on mount
- Shows: 7-day revenue forecast LineChart, day-by-day table with confidence badges, per-dish prep quantity matrix (rows=dishes, columns=next 7 days)
- MAE and RMSE displayed as MetricTiles
- Minimum 7 days data required

## 26.6 ReportPage (`/report`)
**File:** `src/pages/ReportPage.tsx`
- Shows latest day KPIs and top dishes
- "Morning Brief" and "Evening Report" buttons trigger AI generation
- Loading spinner while AI generates
- Reports displayed as cards (newest first), max 30 stored
- Each card shows: icon (sun/moon), date, AI text, revenue/orders/food cost footer

## 26.7 ChatPage (`/chat`)
**File:** `src/pages/ChatPage.tsx`
- Full-height chat interface
- Empty state shows suggested questions
- User messages: right-aligned, green background
- AI messages: left-aligned, card background
- Typing indicator (3 bouncing dots) while loading
- Enter key sends message; Shift+Enter for new line
- "Clear" button deletes all chat history

## 26.8 WastageManagementPage (`/ml/wastage`)
**File:** `src/pages/ml/WastageManagementPage.tsx`
- 4 tabs:
  1. **Today's Prep Plan** — DataTable of newsvendor predictions: dish, recommended qty, usual qty, saving, confidence, action
  2. **Wastage Analysis** — Daily waste bar chart (30 days) + top offenders table with trend badges
  3. **Financial Impact** — MetricTiles: weekly waste ₹, monthly waste ₹, waste as % of revenue
  4. **Weekly Report** — Text summary of wastage situation
- Green savings banner at top showing total ₹ saved if plan followed
- Minimum 14 days data required

## 26.9 DynamicPricingPage (`/ml/pricing`)
**File:** `src/pages/ml/DynamicPricingPage.tsx`
- Alert banner: "X dishes have pricing opportunities, adjust for ₹Y/month"
- 4 MetricTiles: underpriced dishes, overpriced dishes, monthly revenue gain, total dishes analyzed
- DataTable with elasticity, current price, recommended price, revenue impact %, confidence, Review button
- Clicking a row or Review opens a Modal with:
  - Current vs recommended price comparison
  - Explanation text (reasoning from the algorithm)
  - Price change %, demand impact %, revenue impact %
  - "Apply Price Change" button — directly updates menu in localStorage

## 26.10 IngredientForecastPage (`/ml/ingredients`)
**File:** `src/pages/ml/IngredientForecastPage.tsx`
- "Manage Ingredient Mappings" modal — define dish→ingredient relationships
- Default mappings for Dal Fry, Paneer Butter Masala, Veg Biryani, Chapati
- Summary MetricTiles: ingredients count, MAE, training days, accuracy %
- DataTable: ingredient name, total needed (7 days), unit, confidence
- Clicking a row shows 7-day LineChart for that ingredient (predicted + upper bound)

## 26.11 WorkforcePlanningPage (`/ml/workforce`)
**File:** `src/pages/ml/WorkforcePlanningPage.tsx`
- Toggle: Heatmap view vs Schedule table view
- Heatmap: day × hour grid, color = demand intensity, cell label = staff count
- Schedule table: date, hour, shift, demand bin, predicted orders, K+S+C staff
- "Tomorrow's Peak Hours" — top 3 busiest hours with demand bin and staffing breakdown
- MetricTiles: peak staff needed, estimated weekly staff cost (at ₹600/staff/day)

## 26.12 PromotionAnalysisPage (`/ml/promotions`)
**File:** `src/pages/ml/PromotionAnalysisPage.tsx`
- "Log Promotion" button opens modal: name, start date, end date, type (discount/combo/festival/flat), discount %
- Promotion list on left: each card shows profitability impact badge and recommendation badge
- Selecting a promotion shows ITS analysis on right:
  - 3 KPIs: revenue impact %, order volume impact %, profitability impact %
  - Statistical significance Alert (p-value)
  - Revenue over time AreaChart (promotion period highlighted)
  - Natural language finding
  - Repeat/Modify/Discontinue badge

---

# PART 27: END-TO-END USER JOURNEY

## Complete flow from first visit to full usage:

```
1. User opens http://localhost:3000
   → RequireOnboarding: no restaurant in localStorage
   → Redirected to OnboardingPage (/)

2. User fills form: "Shyam Dhaba", "Shashank", "Bangalore", "₹50K–₹1L"
   → storage.setRestaurant(form) saves to biq_restaurant
   → navigate('/upload')

3. User uploads billing CSV from Petpooja POS
   → csvParser.ts detects delimiter, maps headers, normalizes dates
   → BillingEntry[] created and previewed
   → storage.appendBilling(entries) saves to biq_billing (deduplicated)
   → navigate('/menu')

4. User sets dish costs on MenuPage
   → storage.setMenu(items) saves to biq_menu
   → navigate('/dashboard')

5. Dashboard loads
   → getDailySummaries(billing, menu) computes all daily KPIs
   → Charts render: revenue trend, top dishes, meal split, peak hours

6. User visits /forecast
   → runWMAForecast(billing, 7) computes day-of-week WMA predictions
   → 7-day forecast + per-dish prep quantities displayed

7. User visits /ml/wastage
   → runWastagePredictions(billing, menu) runs Newsvendor model
   → Prep plan shown with recommended vs usual quantities

8. User visits /ml/pricing
   → runDynamicPricing(billing, menu) runs OLS elasticity
   → Price recommendations shown; user clicks Apply
   → storage.setMenu(updatedMenu) with new prices

9. User visits /report
   → Clicks "Evening Report"
   → buildReportContext() assembles all analytics into text
   → callAI('/api/ai/report', {context}) POSTs to Express server
   → server.ts calls callNvidia() with NVIDIA API key
   → AI narrative returned, stored in biq_reports, displayed

10. User visits /chat
    → Types "Which dish should I promote tomorrow?"
    → System prompt built with full restaurant context
    → Last 10 messages + system prompt sent to /api/ai/chat
    → AI responds with specific, data-grounded answer
    → Conversation persisted to biq_chat
```

---

# PART 28: POA / AUTOMATION SYSTEM

## 28.1 What is Automated in BusinessIQ?

BusinessIQ does not have a traditional scheduler or cron job system. Instead, "automation" happens through:

**1. Automatic computation on data load**
Every ML module runs automatically when the page loads using `useMemo`. There is no "Run Analysis" button — the moment you navigate to `/ml/wastage`, the Newsvendor model runs on your billing data and results appear.

**2. Automatic prep plan generation**
The `runWastagePredictions()` function always targets `tomorrow` (one day after the last billing date). Every morning, if the owner uploads yesterday's billing data, the prep plan automatically updates for today.

**3. Automatic pricing application**
When the user clicks "Apply Price Change" on the Dynamic Pricing page, the menu in localStorage is updated immediately. All subsequent analytics, wastage calculations, and ingredient forecasts automatically use the new price — no manual refresh needed.

**4. Automatic report archiving**
Reports are automatically capped at 30 and stored newest-first. Old reports are automatically dropped without user intervention.

**5. Automatic feature engineering**
Every time an ML module runs, `features.ts` automatically detects whether tomorrow is a festival, a weekend, or a month-end, and adjusts predictions accordingly — no manual input required from the owner.

**6. Ingredient purchase list as automation output**
The `runIngredientForecast()` output is a ready-to-use purchase list for the next 7 days. The owner can screenshot or copy this list directly to share with their supplier — automating the purchase planning workflow.

## 28.2 The Daily Workflow (Ideal Usage)

```
Morning:
  1. Upload yesterday's billing CSV → data updated automatically
  2. Open Wastage Management → today's prep plan auto-generated
  3. Open Workforce Planning → today's staffing schedule auto-generated
  4. Click "Morning Brief" on Reports → AI summarizes yesterday + today's outlook

Evening:
  5. Click "Evening Report" → AI generates end-of-day analysis
  6. Open Dynamic Pricing → check if any pricing opportunities emerged

Weekly:
  7. Open Ingredient Forecast → download 7-day purchase list
  8. Open Promotion Analysis → analyze last week's promotion (if any)
  9. Open Dashboard → review weekly comparison, top dishes, trends
```

---

# PART 29: POTENTIAL WEAKNESSES (FOR VIVA)

## 29.1 Technical Limitations

**localStorage size limit (~5MB)**
All data is stored in localStorage which is capped at ~5MB per origin. A restaurant with 2+ years of detailed billing data (tens of thousands of rows) could hit this limit. The application has no warning or compression for this.

**No real-time data**
Data only updates when the owner manually uploads a new CSV. There is no live POS integration — requires manual export and re-upload every day.

**No multi-device sync**
Data stored in one browser's localStorage is not accessible from another device. If the owner switches from laptop to tablet, they lose all their data.

**No authentication**
Anyone with access to the device and browser can see all business data. There is no password protection.

**Festival calendar is hardcoded for 2024-2026**
`features.ts` contains dates only up to January 2026. The model will miss festival effects after this period.

**OLS elasticity uses cross-sectional variation**
Since prices rarely change in small restaurants, the OLS elasticity is estimated across dishes (not across time periods). This is a proxy, not a true elasticity estimate. Dishes at different price points might differ in quality, portion size, or popularity for reasons unrelated to price.

**WMA assumes stationarity**
The Weighted Moving Average assumes that the past pattern repeats. It cannot handle sudden disruptions (new competitor opens, road construction reduces footfall, pandemic). The forecast will lag reality during structural breaks.

## 29.2 Scalability Limitations

- The app is designed for a single restaurant. Multi-branch support would require a backend database and authentication.
- All ML computations run in the browser's main thread. For very large datasets (50,000+ billing rows), the UI could become sluggish.
- No cloud backup means data loss if the browser cache is cleared.

## 29.3 How to Respond to Evaluator Criticism

**"Why not use Python for ML?"**
> "Python would require a backend server, database, and deployment infrastructure. Our design decision was to keep all computation client-side to eliminate infrastructure costs and data privacy risks. TypeScript ML implementations are fully equivalent for the scale of data we handle — we implemented the same mathematical algorithms (Newsvendor, OLS, ITS) that Python libraries use, just in TypeScript."

**"Why localStorage instead of a database?"**
> "For our target user — a small restaurant owner with no IT support — setting up a cloud database and user accounts is a barrier to adoption. localStorage gives us zero-cost, zero-setup, instant deployment. The tradeoff is 5MB limit and no multi-device sync, which we accept for this MVP."

**"Is your ML accurate enough?"**
> "The WMA model shows its accuracy (MAE and RMSE) directly on the Forecast page — users can judge reliability themselves. The Newsvendor model is the same algorithm used by McDonald's and Domino's. The OLS elasticity is standard Wooldridge econometrics. The ITS analysis is used in Cochrane health reviews. All algorithms are theoretically grounded, not ad-hoc."

---

# PART 30: VIVA QUESTIONS AND ANSWERS

## Basic Project Questions

**Q1: What is BusinessIQ?**
A: BusinessIQ is a full-stack web application that acts as an AI-powered business analyst for small Indian restaurants. It takes billing CSV data, runs 5 ML algorithms entirely in the browser, and provides demand forecasting, wastage reduction, dynamic pricing, workforce planning, and promotion analysis. It also has an AI chat assistant powered by the NVIDIA API.

**Q2: What programming languages did you use?**
A: TypeScript is the primary language for everything — frontend React components, all 5 ML algorithms, utility functions, and type definitions. The backend server (Express.js) is also TypeScript, run via Node.js. CSS (with Tailwind) handles styling. There is no Python in the project.

**Q3: Why TypeScript instead of Python for ML?**
A: Python would require a backend server that stays running, a database for storage, and deployment infrastructure. By implementing ML algorithms in TypeScript, everything runs in the user's browser — no server cost, no data leaves the device, and the app works even offline. The mathematical algorithms are identical to their Python equivalents.

**Q4: What is the architecture of the application?**
A: Single Page Application frontend (React + TypeScript) communicating with a minimal Express.js backend (server.ts). The backend has only two endpoints — both proxy requests to the NVIDIA AI API. All business data is stored in the browser's localStorage. ML algorithms run client-side.

**Q5: How does the application start?**
A: `npm run dev` runs `npx tsx server.ts`. This starts the Express server on port 3000 and also creates a Vite dev server running as middleware. Both the API endpoints and the React frontend are served from the same port 3000.

**Q6: What is localStorage and why did you use it?**
A: localStorage is a browser API that stores key-value pairs as strings, persisted across browser sessions, with ~5MB limit. We used it to eliminate the need for a cloud database — data stays on the user's device, there are no hosting costs, and no user account is required. All data is JSON-serialized before storage.

**Q7: How is data structured?**
A: All data structures are TypeScript interfaces defined in `src/types/index.ts`. The primary data type is `BillingEntry` (one row per dish sale). All analytics derive from arrays of BillingEntry. Menu, restaurant profile, reports, chat messages, and ML results are stored separately under different localStorage keys.

**Q8: How does the routing work?**
A: React Router DOM v7 handles all routing client-side. Routes are defined in `src/App.tsx`. A `RequireOnboarding` guard redirects to `/` if no restaurant exists in localStorage. All protected routes are wrapped in `AppLayout` which provides the sidebar and topbar.

**Q9: What happens when a user uploads a CSV?**
A: The file is read using FileReader API, passed to `parseCSV()` in `csvParser.ts`. The parser detects the delimiter, maps column headers using an alias dictionary, normalizes date formats, infers meal periods from time, and processes rows in batches of 500. Results are previewed, then saved to localStorage via `storage.appendBilling()` which deduplicates by row ID.

**Q10: What is the menu engineering matrix?**
A: A framework from hospitality management (Kasavana & Smith) that classifies dishes into 4 quadrants based on sales volume and profit margin. Stars (high sales + high margin) should be protected. Hidden Gems (low sales + high margin) should be promoted. Volume Traps (high sales + low margin) should be repriced. Dead Weight (low sales + low margin) should be removed.

## Analytics Questions

**Q11: How is food cost percentage calculated?**
A: `foodCostPct = (rawMaterialCost / totalRevenue) × 100`. Raw material cost is computed by looking up each dish's cost from the menu and multiplying by quantity sold. Industry benchmark is 30% — the dashboard shows it in red if above 35%.

**Q12: How is gross profit calculated?**
A: `grossProfit = totalRevenue - rawMaterialCost`. This is the contribution before overhead costs (rent, salaries, utilities).

**Q13: How does the weekly comparison work?**
A: `thisWeek = sum of revenue for last 7 days of DailySummaries`. `lastWeek = sum for the 7 days before that`. `pctChange = (thisWeek - lastWeek) / lastWeek × 100`. Displayed as a green ↑ or red ↓ badge.

**Q14: How are peak hours detected?**
A: `getPeakHours()` creates a 24-slot array. For each BillingEntry with a `time` field, it parses the hour (e.g., "13:30" → 13) and adds the quantity to that slot. The result is an array of `{hour, orders}` rendered as a bar chart. Only works if the uploaded CSV has a time column.

**Q15: How is meal period inferred without a meal_period column?**
A: From the time column: 6–10 → breakfast, 11–15 → lunch, 16–22 → dinner, else → other. If there's no time column either, all entries default to "other".

## Forecasting Questions

**Q16: What algorithm is used for forecasting?**
A: Weighted Moving Average (WMA) with weights [0.4, 0.3, 0.2, 0.1] — most recent first. The key innovation is day-of-week awareness: for predicting next Monday's revenue, we use the last 4 Mondays (not the last 4 days), because restaurants have strong weekly seasonality.

**Q17: What do MAE and RMSE mean?**
A: MAE (Mean Absolute Error) = average |predicted - actual|. In rupees, it means "on average the model is off by ±₹MAE per day." RMSE (Root Mean Square Error) = √(average of squared errors). RMSE penalizes large errors more. If RMSE >> MAE, occasional very bad predictions exist. Both are computed by backtesting on the last 7 days of known data.

**Q18: How is backtesting done?**
A: The last 7 days of billing data are held out as a test set. For each test day, predictions are made using only data before that day (no data leakage). Predicted vs actual revenue is compared to compute MAE and RMSE. This simulates how the model would perform in real usage.

**Q19: Why 4 weeks of history for WMA?**
A: Four weeks provides enough same-weekday data points to compute a weighted average (4 data points with weights 0.4/0.3/0.2/0.1). Using more would reduce the recency effect; using fewer would be insufficiently stable.

## ML Module Questions

**Q20: What is the Newsvendor Model?**
A: A classic Operations Research model for single-period inventory decisions under uncertain demand. It finds the optimal preparation quantity that balances the cost of over-preparing (food waste) against the cost of under-preparing (lost sales). Used by McDonald's, Domino's, and every major QSR chain.

**Q21: What is the Critical Ratio?**
A: `CR = Cu / (Cu + Co)` where Cu = underage cost (lost contribution margin) and Co = overage cost (raw material wasted). For a ₹160 Paneer Butter Masala with ₹72 cost: Cu = 160-72=88, Co=72, CR = 88/160 = 0.55. This means prepare enough to satisfy demand with 55% probability.

**Q22: What is the optimal prep quantity formula?**
A: `Q* = μ + z(CR) × σ` where μ = mean demand forecast, σ = standard deviation of demand, z(CR) = z-score at the critical ratio probability from the normal distribution. This is the textbook Newsvendor formula.

**Q23: How did you implement the Normal inverse CDF without a library?**
A: Using the Beasley-Springer-Moro algorithm — a rational polynomial approximation accurate to 7 significant figures. The coefficients are hardcoded arrays. It uses different polynomial formulas for the lower tail, central region, and upper tail of the distribution.

**Q24: What is price elasticity of demand?**
A: `ε = (% change in quantity) / (% change in price)`. If ε = -1.5, a 10% price increase causes a 15% demand decrease. |ε| > 1 means elastic (price-sensitive customers). |ε| < 1 means inelastic (customers buy regardless of price).

**Q25: How is price elasticity estimated?**
A: Using log-log OLS regression: `ln(quantity) = α + ε × ln(price)`. The slope of this regression equals the elasticity. Since prices rarely change over time in small restaurants, we use cross-sectional variation — comparing average log-quantity vs log-price across all dishes.

**Q26: What is the Lerner markup rule?**
A: The microeconomics formula for profit-maximizing price: `P* = C × |ε| / (|ε| - 1)` for elastic demand. Derived by setting the derivative of profit with respect to price equal to zero. This is the standard monopoly pricing formula from Wooldridge's Econometrics.

**Q27: What constraints are applied to pricing recommendations?**
A: Minimum price = `C / (1 - 0.35)` (maintains at least 35% margin). Maximum price = current price × 1.3 (no more than 30% increase). Price rounded to nearest ₹5. Only recommendations with >5% price change are shown.

**Q28: What is Interrupted Time Series analysis?**
A: An econometric method to measure the causal effect of a policy change (like a promotion) on a time series (like daily revenue). It controls for pre-existing trends by fitting a regression with a trend variable, a level-change variable (D_t = 1 during promotion), and a slope-change variable (time after promotion). The coefficient on D_t is the causal estimate of the promotion effect.

**Q29: Why is ITS better than simple before/after comparison?**
A: Simple before/after confounds the promotion effect with natural trends. If revenue was already growing 5% per week before the promotion, a simple comparison would incorrectly attribute that growth to the promotion. ITS removes the pre-existing trend (β1×T term) before estimating the promotion effect.

**Q30: How is OLS implemented in promotionAnalyzer.ts?**
A: From scratch using the normal equations: `β = (X'X)⁻¹ X'Y`. X'X (k×k) and X'Y (k×1) are computed by explicit matrix multiplication. (X'X)⁻¹ is computed using Gauss-Jordan elimination (augmented matrix method). Standard errors come from the diagonal of `σ² × (X'X)⁻¹`.

**Q31: How is the p-value computed?**
A: A t-statistic is computed: `t = β2 / SE(β2)`. The p-value approximation uses the regularized incomplete Beta function. Significance threshold is p < 0.10 (10% level, appropriate for small sample sizes in restaurant data).

**Q32: What does the Workforce Planning algorithm do?**
A: For each day-hour combination in the next 7 days, it averages order counts from the same day-of-week and same hour over the last 4 weeks. Festival and weekend boosts are applied. The predicted count is classified into low/medium/high/peak demand bins using data-driven percentile thresholds (P25, P60, P85). Each bin maps to a staffing rule (kitchen + service + cashier counts).

**Q33: What does the Ingredient Forecast do?**
A: Predicts dish demand for the next 7 days using feature-weighted WMA (with festival, weekend, month-end, and rolling trend adjustments). Multiplies predicted dish quantities by ingredient amounts per serving. Sums across all dishes using each ingredient. Adds 20% safety buffer. Output is a ready-to-use purchase list.

**Q34: What are the feature adjustments in Ingredient Forecast?**
A: Festival day: +20%, within 2 days of festival: +15%, within 7 days: +8%, weekend: +12%, month-end: +7%. Rolling trend: if 7-day mean > 30-day mean, demand is rising — scale base up proportionally (bounded to 0.7x–1.5x).

**Q35: How are confidence levels determined?**
A: Based on days of training data: high = ≥60 days, medium = 30–59 days, low = <30 days. More data = more reliable same-weekday WMA averages.

## Design and Architecture Questions

**Q36: What is the design system?**
A: A centralized set of reusable UI components and CSS variables. `tokens.css` defines all colors, fonts, spacing, and radii as CSS custom properties. `design-system/components/index.tsx` contains Button, Card, Badge, MetricTile, DataTable, EmptyState, Modal, Tooltip, Alert, PageHeader. `design-system/charts/index.tsx` has all chart components.

**Q37: Why CSS custom properties instead of hardcoded colors?**
A: CSS custom properties (variables) allow the entire visual theme to change by modifying one file. They also enable runtime theming (dark mode could be added by redefining the variables in a `.dark` class). Using `var(--color-unity)` everywhere means changing the brand color requires changing one line.

**Q38: How does the HeatmapChart work?**
A: It's a custom CSS Grid layout, not a Recharts component. Days form rows, hours form columns. Each cell's background color is computed by `heatmapColor(intensity)` which interpolates between green (low), amber (medium), and red (high) based on `value / maxValue`. Recharts ScatterChart was evaluated but CSS Grid gives better control over cell sizing and color.

**Q39: What is the RAG pattern?**
A: Retrieval-Augmented Generation. Instead of sending a vague question to the AI, you first retrieve relevant data (the restaurant's actual analytics), attach it to the prompt as context, then ask the AI to reason over it. This prevents hallucination — the AI cannot make up numbers because the real numbers are provided.

**Q40: How does the chat maintain conversation context?**
A: The last 10 messages are included in every API call as a messages array: `[{role:'system', content: systemPrompt}, ...last10messages]`. This gives the AI memory of recent exchanges. Older messages are dropped to stay within the 8192 token limit.

**Q41: Why is the NVIDIA API called server-side, not client-side?**
A: The NVIDIA API key must never be exposed in browser JavaScript — it would be visible in DevTools and could be stolen. The Express server holds the key in an environment variable, making the API call server-side, and the browser never sees the key.

**Q42: What is the AppShell component?**
A: The layout wrapper used by all protected pages. It renders the collapsible sidebar and fixed topbar, then wraps children in a `<main>` with appropriate padding and margin to account for the sidebar width. The sidebar width transition (`0.2s`) is applied to `marginLeft` on the content area.

**Q43: What hooks does the application use?**
A: `useState` for local component state, `useMemo` for expensive computations (all ML module results), `useEffect` for side effects (loading initial menu data, auto-scrolling chat), `useRef` for DOM references (file input, chat scroll), `useNavigate` for programmatic navigation, `useLocation` for active route detection.

**Q44: Why useMemo for ML computations?**
A: ML algorithms (especially Newsvendor and OLS) involve significant computation. `useMemo` caches the result and only recomputes when the dependency (billing, menu) changes. Without it, the algorithm would re-run on every render — potentially causing noticeable lag on large datasets.

## Practical Implementation Questions

**Q45: How does drag-and-drop file upload work?**
A: Three event handlers on the drop zone div: `onDragOver` (prevents default browser behavior, sets `dragging` state), `onDragLeave` (resets state), `onDrop` (reads `e.dataTransfer.files[0]`). The file is read as text using `FileReader.readAsText()`, then passed to `parseCSV()`.

**Q46: How does the sample data work?**
A: `generateSampleCSV()` in `csvParser.ts` creates 30 days of synthetic billing data for 7 predefined Indian dishes (Dal Fry, Paneer Butter Masala, Veg Thali, etc.) with realistic prices. It generates 3 meal periods per day with random dish selection and quantities. The output is a CSV string that the upload page processes identically to a real upload.

**Q47: How is currency formatted throughout the app?**
A: Using `Intl.NumberFormat` via `toLocaleString('en-IN')`: `₹${Math.round(n).toLocaleString('en-IN')}`. This formats 324000 as ₹3,24,000 (Indian numbering system with lakh separators).

**Q48: How does the promotion log → analysis flow work?**
A: User enters promotion details (name, dates, type, discount %) in a modal. It's saved to `biq_promotions` via `storage.addPromotion()`. Selecting a promotion in the list triggers `analyzePromotion(billing, selectedPromo)` via `useMemo`. The ITS regression runs on billing data for dates around the promotion period.

**Q49: What happens if the NVIDIA API is down?**
A: `callAI()` in `aiClient.ts` catches errors and returns `{ text: '', error: errorMessage }`. In ReportPage, the report text becomes "Could not generate AI report: [error]". In ChatPage, the assistant message says "Sorry, I couldn't connect to the AI: [error]". The rest of the app (all ML modules, analytics) continues working normally.

**Q50: How is the sidebar active state determined?**
A: `const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to))`. The special case for `/dashboard` prevents it from matching `/dashboard/something` but the `/ml` prefix correctly highlights any `/ml/*` page.

**Q51: How does applying a pricing recommendation work?**
A: `applyRecommendation(rec)` reads the current menu from localStorage, maps over it to find the matching dish by `dishId`, updates `sellingPrice` to `recommendedPrice`, and saves back. The `appliedIds` state Set tracks which dishes have been applied in the current session to show "Applied" instead of "Review".

**Q52: What is the deduplication logic for billing uploads?**
A: Each `BillingEntry` gets an ID of `${date}-${dishName}-${rowIndex}`. When `appendBilling()` is called, it builds a `Set` of existing IDs. New entries with IDs already in the set are filtered out. This means re-uploading the same CSV file is completely safe.

**Q53: How are the OLS matrix operations verified to be correct?**
A: The Gaussian elimination `invertMatrix()` function returns `null` if the matrix is singular (determinant near zero), which safely aborts the analysis. The `rSquared` value returned by `ols()` serves as a quality check — the promotion analysis displays `R² = X` in the subtitle so the user can judge model fit.

**Q54: What is the minimum data requirement for each ML module?**
A: Forecasting: 7 days minimum. Wastage Predictor: 14 days minimum, 7 per dish. Dynamic Pricing: 7 days per dish for OLS (falls back to assumed elasticity otherwise). Ingredient Forecast: no minimum but more data = higher confidence. Workforce Planning: no minimum (uses fallback daily distribution if no time data). Promotion Analysis: 14 days before + 2 days of promotion.

**Q55: How does the ingredient forecast handle dishes with no sales history?**
A: `predictDishDemand()` returns `{ predicted: 0, std: 0 }` if there are no same-weekday historical values. Such dishes contribute 0 to the ingredient totals. The forecast only includes ingredients from dishes with actual sales data.

**Q56: What are the 9 localStorage keys and what do they store?**
A: `biq_restaurant` (Restaurant object), `biq_menu` (MenuItem[]), `biq_billing` (BillingEntry[]), `biq_reports` (Report[], max 30), `biq_chat` (ChatMessage[], max 100), `biq_ingredient_mappings` (IngredientMapping[]), `biq_wastage_log` (WastagePrediction[], max 500), `biq_pricing_recs` (PricingRecommendation[]), `biq_promotions` (PromotionRecord[]).

**Q57: How does the trend calculation in wastage analysis work?**
A: For each dish, compare `rMean` (average daily quantity in last 14 days) vs `pMean` (average in previous 14 days). If `rMean > pMean × 1.05` → trend is "improving" (demand rising means less relative waste). If `rMean < pMean × 0.95` → "worsening". Otherwise → "stable".

**Q58: What is the Vite build configuration?**
A: `vite.config.ts` uses two plugins: `@vitejs/plugin-react` (JSX transform) and `@tailwindcss/vite` (Tailwind CSS processing). Path alias `@` maps to the project root. HMR (Hot Module Replacement) can be disabled via `DISABLE_HMR=true` environment variable.

**Q59: How would you scale this application?**
A: Replace localStorage with a PostgreSQL database (using Prisma ORM). Add user authentication (JWT or session-based). Move ML computations to a Python backend (FastAPI) for better performance on large datasets. Add multi-restaurant support with organization accounts. Deploy on AWS/GCP with a managed database.

**Q60: What security improvements would you make?**
A: Add HTTPS enforcement, rate limiting on AI endpoints (express-rate-limit), input sanitization for CSV uploads (already done via type coercion), Content Security Policy headers, and if adding user accounts: bcrypt password hashing, JWT with short expiry, and HTTPS-only cookies.

---

# PART 31: PROJECT DEFENSE GUIDE

## 31.1 Two-Minute Explanation
"BusinessIQ is a web application that acts as an AI business analyst for small Indian restaurants. The owner uploads their billing CSV, and the app immediately gives them a full analytics dashboard — revenue trends, top dishes, food cost percentage. Then five machine learning algorithms run automatically: the Newsvendor model predicts how much food to prepare to minimize waste, OLS regression estimates price elasticity and recommends optimal prices, feature-weighted forecasting predicts ingredient purchase quantities, a workforce planning algorithm recommends staffing levels for each hour, and Interrupted Time Series analysis measures whether promotions are actually profitable. There's also an AI chat assistant powered by NVIDIA's LLM that can answer any natural language question about the restaurant's data. All of this runs in the browser — no cloud database, no server-side storage, zero infrastructure cost."

## 31.2 Five-Minute Explanation
Add to the above:
"The entire ML stack is implemented in TypeScript, running client-side in the browser. We made this decision specifically to eliminate infrastructure costs and data privacy concerns — the restaurant's sensitive revenue data never leaves their device. The only external API call is to NVIDIA's NIM service for the AI reports and chat.

The technical stack is React 19 with TypeScript for the frontend, Express.js as a minimal backend server with two AI endpoints, and localStorage as the persistence layer. The design system uses CSS custom properties for theming, Recharts for charts, and a custom CSS Grid heatmap for the workforce planning visualization.

For the ML implementations: the Newsvendor model uses the Beasley-Springer-Moro normal inverse CDF approximation since there's no math library available in-browser. The price elasticity model implements OLS regression from scratch including matrix inversion via Gaussian elimination. The promotion analysis implements the full Interrupted Time Series regression with t-statistics and p-values. These are all theoretically grounded — Newsvendor is standard OR textbook material, OLS elasticity is from Wooldridge's Econometrics, and ITS is used in Cochrane systematic reviews."

## 31.3 Ten-Minute Explanation
Add detailed walkthroughs of each ML algorithm, the data flow from CSV upload to dashboard, the RAG pattern for AI reports, the design system architecture, and the limitations/future work outlined in Part 29.

---

*End of BusinessIQ Technical Reference Manual*
*Document covers: 2 phases of development, 27 source files, 5 ML algorithms, 11 pages, 1 backend server, 1 AI integration*
*Total lines of production code: ~5,300*

