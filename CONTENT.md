# BusinessIQ — Phase 2 Project Review Content

## 1. Abstract

BusinessIQ is a web application that gives small, single-outlet restaurants a self-serve business-intelligence tool without requiring a POS integration, a database, or IT staff. The owner uploads a CSV export of billing/order data, and the app stores it in the browser's `localStorage`. A React 19 + Vite + Tailwind CSS frontend runs all analytics, forecasting, and ML-style computations client-side, directly against that stored data — no backend database exists. A thin Express server (run via `tsx server.ts`) serves the Vite app and exposes two proxy endpoints (`/api/ai/report`, `/api/ai/chat`) that forward prompts to an external LLM (NVIDIA's hosted API, or Groq as a fallback) to generate natural-language reports and answer chat questions grounded in the uploaded data. What is implemented: CSV ingestion, menu profitability classification, demand forecasting, dynamic pricing, wastage prediction, ingredient forecasting, workforce planning, promotion impact analysis, and AI report/chat. Not implemented: authentication, a persistent server-side database, and multi-user/multi-outlet support.

## 2. Introduction

Small, independent restaurants generate transaction data every day (POS exports, billing registers) but almost never analyze it — commercial BI/analytics platforms are priced and built for chains with dedicated staff, not a single-location owner-operator. The result is that decisions on pricing, menu composition, staffing, and purchasing are made on gut feel, and problems like food wastage or underpriced dishes go unnoticed until they show up as thin margins.

BusinessIQ addresses this gap with a zero-infrastructure tool: the owner exports their billing data as a CSV (already a standard POS export format), drops it into the app, and immediately gets a menu-engineering breakdown, a 7-day demand forecast, wastage and pricing recommendations, and an AI-generated plain-language report — all running in the browser, with no signup, server database, or integration work required. The scope is intentionally single-restaurant and single-user, matching the actual persistence model (browser `localStorage`) rather than claiming enterprise-scale capability.

## 3. Problem Statement

- Small restaurants have no visibility into which dishes are actually profitable versus merely popular — `menuEngine.ts` addresses this by classifying every dish into Star / Hidden Gem / Volume Trap / Dead Weight based on sales volume and contribution margin.
- Owners cannot predict next week's demand to plan prep and purchasing — `forecasting.ts` and `ingredientForecast.ts` generate day-by-day revenue, per-dish, and per-ingredient forecasts from historical order patterns.
- Food wastage from over-preparation is rarely quantified — `wastagePredictor.ts` estimates waste in rupees per dish and recommends a reduced prep quantity.
- Menu prices are typically set once and never revisited against actual demand sensitivity — `dynamicPricing.ts` estimates price elasticity per dish and recommends a revenue-optimal price.
- Promotions and discounts are run without measuring whether they actually paid off — `promotionAnalyzer.ts` statistically isolates a promotion's effect on revenue and profitability from the underlying trend.

## 4. Requirements Analysis

### Functional Requirements (by page, from `src/pages`)

| Page | Route | What it does |
|---|---|---|
| OnboardingPage | `/` | Collects and saves restaurant profile (name, etc.) to `storage.setRestaurant` before the app is usable |
| UploadPage | `/upload` | Parses a CSV (or generates sample data), previews parsed rows, and on save fully replaces stored billing data and rebuilds the menu |
| MenuPage | `/menu` | Editable table of dish name/selling price/raw material cost; shows each dish's menu-engineering quadrant once billing data exists |
| DashboardPage | `/dashboard` | Revenue/profit trend (30 days), top dishes by revenue, revenue by meal period, week-over-week comparison, peak-hour order volume |
| ForecastPage | `/forecast` | 7-day total revenue forecast, day-by-day forecast table, and per-dish prep-quantity forecast, using a from-scratch Weighted Moving Average model |
| ReportPage | `/report` | Generates and stores AI morning/evening reports via the backend AI proxy, grounded in the restaurant's actual data |
| ChatPage | `/chat` | Conversational Q&A over the restaurant's own data (RAG-style: injects a data summary into the system prompt) via the backend AI proxy |
| DynamicPricingPage | `/ml/pricing` | Per-dish price elasticity + a recommended optimal price, projected revenue/demand impact, and one-click "apply" to update the menu price |
| WastageManagementPage | `/ml/wastage` | Predicted wastage (qty and ₹) per dish, recommended prep quantity, 30-day waste trend chart, top waste offenders |
| IngredientForecastPage | `/ml/ingredients` | Lets the user map dishes to ingredients/quantities, then forecasts 7-day ingredient purchasing needs with confidence bands |
| WorkforcePlanningPage | `/ml/workforce` | Predicted order volume per hour for the next 7 days, binned into demand levels, converted into a recommended kitchen/service/cashier headcount and a weekly demand heatmap |
| PromotionAnalysisPage | `/ml/promotions` | Lets the user log a promotion period, then statistically measures its effect on revenue, order volume, and profitability |

### Non-Functional Requirements (derived from the actual code)

- **Client-side only**: all analytics/ML functions (`src/lib/*.ts`, `src/lib/ml/*.ts`) run synchronously in the browser against in-memory arrays — no server-side computation.
- **No backend database**: `src/lib/storage.ts` persists everything to browser `localStorage` under fixed keys (`biq_restaurant`, `biq_menu`, `biq_billing`, etc.); data is per-browser and is lost if storage is cleared.
- **No authentication**: there is no login, session, or user model anywhere in the codebase — the app assumes a single operator per browser.
- **Storage-capacity bound**: `storage.ts`'s `set()` wraps `localStorage.setItem` in a try/catch and returns `false` on failure (e.g. quota exceeded); `UploadPage.tsx` surfaces this as "Browser storage limit was exceeded."
- **AI features require server-side API keys**: `/api/ai/report` and `/api/ai/chat` throw if neither `NVIDIA_API_KEY` nor `GROQ_API_KEY` is set in the server environment — AI report/chat features are unavailable without one.
- **Single restaurant/tenant per browser profile**: `storage.ts` has no restaurant/tenant ID — all data keys are global to the browser.

## 5. Methodology / System Design

**Architecture**: React (Vite dev server, Tailwind CSS v4) frontend ⇄ Express server (`server.ts`, run through `tsx`) ⇄ external LLM API (NVIDIA `minimaxai/minimax-m3` primary, Groq `llama-3.1-8b-instant` fallback — chosen in `callAI()` purely by whether `NVIDIA_API_KEY` is set). The Express server's only jobs are: (1) serve the Vite app (dev middleware in development, static `dist/` in production) and (2) proxy two POST endpoints so the LLM API key stays server-side rather than in browser code. All business analytics, forecasting, and the five "ML" modules run entirely client-side in the browser, reading and writing `localStorage` via `src/lib/storage.ts` — there is no database and no server-side persistence.

**Algorithms actually implemented** (per the JSDoc header of each file in `src/lib/ml/`):

- **Ingredient Forecast** (`ingredientForecast.ts`): a hand-written **feature-weighted Weighted Moving Average (WMA)** — day-of-week weighting `[0.4, 0.3, 0.2, 0.1]` over the last 4 same-weekday values, adjusted by festival-proximity, weekend, month-end, and a 7-day-vs-30-day rolling-trend multiplier.
- **Demand Forecast** (`forecasting.ts`): the same day-of-week **WMA** approach, applied to total revenue and per-dish quantity, with MAE/RMSE computed via backtesting on the last 7 actual days.
- **Wastage Prediction** (`wastagePredictor.ts`): the **Newsvendor model** from operations research — critical ratio `CR = (price − cost) / price`, optimal prep quantity `Q* = μ + z(CR)·σ` using a normal-inverse-CDF approximation (Beasley–Springer–Moro), fed by the same WMA-style demand forecast.
- **Dynamic Pricing** (`dynamicPricing.ts`): **log-log OLS price-elasticity estimation** (`ln(qty) ~ α + ε·ln(price)`) across dishes, with the **Lerner markup rule** `P* = C·|ε| / (|ε| − 1)` used to compute the profit-maximizing price when demand is elastic.
- **Promotion Analysis** (`promotionAnalyzer.ts`): **Interrupted Time Series (ITS) analysis via OLS regression** (`Y_t = β0 + β1·T + β2·D_t + β3·T_after`), solved with a hand-written normal-equations matrix inverter, plus a t-statistic/p-value approximation for significance.
- **Workforce Planning** (`workforceForecast.ts`): a **feature-weighted voting ensemble** over day-of-week × hour history, festival/weekend adjustments, and a trend component, binning predicted demand into percentile-based low/medium/high/peak levels mapped to fixed staffing counts.

The code's own comments explicitly frame WMA, the Newsvendor model, log-log elasticity/the Lerner rule, and OLS ITS regression as the actual techniques used, while describing them as being conceptually "equivalent to" or an "analogue of" XGBoost/gradient boosting and Random Forest for viva-defense purposes. **Prophet, XGBoost, and Random Forest are not actually implemented or run anywhere in this codebase** — those names appear only as comment-level conceptual comparisons in `ingredientForecast.ts` and `workforceForecast.ts`.

## 6. Implementation

**Tech stack (from `package.json`)**: React 19, React Router 7, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), Recharts 3 (charts), Lucide React (icons), Motion (animation), Express 4, dotenv, TypeScript 5.8, run via `tsx`. (`@google/genai`, `@google/generative-ai`, and `openai` are present as dependencies but the actual AI calls in `server.ts` use plain `fetch` against NVIDIA's and Groq's OpenAI-compatible REST endpoints, not these SDKs.)

**Key technical features actually coded**:
- Flexible CSV parser (`csvParser.ts`) with delimiter auto-detection, header-alias matching (e.g. `qty`/`quantity`/`count`), multiple date-format normalization, batched async parsing with progress callback, and a sample-CSV generator.
- Full-replace upload flow (`UploadPage.tsx` + `storage.setBilling`) — each upload overwrites prior billing data and rebuilds the menu from scratch, avoiding stale/merged dish lists.
- Menu engineering classification (`menuEngine.ts`: `buildMenuFromBilling`, `computeDishMetrics`, `classifyMenu`) into Star/Hidden Gem/Volume Trap/Dead Weight quadrants using average sales volume and margin-percentage thresholds.
- Analytics aggregation layer (`analytics.ts`): daily summaries, top dishes, peak-hour histogram, meal-period revenue split, week-over-week comparison, KPI rollups.
- Five independent ML modules under `src/lib/ml/` (dynamic pricing, wastage, ingredient forecast, workforce forecast, promotion analysis), each with its own shared feature-engineering helpers (`features.ts`: Indian festival calendar 2024–2026, weekend/month-end detection, rolling mean/std).
- AI proxy server (`server.ts`) with automatic NVIDIA→Groq fallback (`callAI`), and a typed frontend client (`aiClient.ts`) that posts to `/api/ai/report` or `/api/ai/chat`.
- RAG-style context injection: `reportGenerator.ts`'s `buildReportContext()` serializes real KPIs, top dishes, and menu-quadrant results into a text block that is injected into every AI report and chat prompt, so LLM responses are grounded in the user's actual uploaded data rather than the model's general knowledge.
- `localStorage`-backed persistence layer (`storage.ts`) with typed getters/setters per data domain (restaurant, menu, billing, reports, chat, ingredient mappings, wastage log, pricing recs, promotions) and a `clearAll()` reset.

## 7. Testing

Testing to date has been manual, code-verification-driven, and logged per change in `CHANGELOG.md` rather than via an automated test suite (none exists in the repo). Categories covered:

- **Type safety**: `tsc --noEmit` run after every change (`npm run lint` is an alias for this) to catch signature/type mismatches before runtime.
- **Data-integrity regression testing**: traced a full CSV-upload lifecycle (upload A → verify menu shows only A's dishes → upload B → verify menu shows only B's dishes, zero carryover) to catch and fix a bug where `appendBilling` merged old and new billing data and `buildMenuFromBilling` was passed the stale menu as `existingMenu`, causing old and new dishes to appear together in Menu Setup after a fresh upload.
- **Storage-quota handling**: verified `storage.ts`'s `set()` catches `localStorage.setItem` quota errors and returns `false`, and that `UploadPage.tsx` surfaces this to the user as "Browser storage limit was exceeded" instead of failing silently.
- **Menu/billing auto-sync verification**: confirmed `buildMenuFromBilling` reads no implicit/global state (no `localStorage` access inside `menuEngine.ts`) and derives dishes purely from its `entries` argument, so menu contents are a deterministic function of the currently-stored billing data.
- **Fallback-data audit**: grepped the full `src/` tree for hardcoded/sample menu arrays (e.g. a `SAMPLE_MENU` constant) that could silently override real uploaded data — none found; all pages read live data via `storage.getMenu()` / `storage.getBilling()`, which default to empty arrays.
- **AI provider fallback**: verified `callAI()` in `server.ts` selects NVIDIA when `NVIDIA_API_KEY` is set and falls back to Groq otherwise, and that both endpoints return a clear error message (not a crash) when neither key is configured.

## 8. Results

Walking through what each module demonstrably produces, given uploaded billing data and a configured menu:

- **Menu Setup** (`MenuPage`): every dish present in the uploaded CSV appears with an auto-computed average selling price and an estimated raw material cost (35% of price by default), each tagged with its menu-engineering quadrant (Star / Hidden Gem / Volume Trap / Dead Weight) once ≥1 quadrant threshold is met.
- **Dashboard**: a 30-day revenue-and-profit line chart, a ranked top-10 dish list by revenue, a meal-period revenue breakdown (breakfast/lunch/dinner/other), a this-week-vs-last-week percentage change, and an hour-of-day order-volume histogram (when time data is present in the CSV).
- **Demand Forecast**: a 7-day total revenue forecast (numeric ₹ per day), a day-by-day table, per-dish plate-count prep forecasts for up to 15 dishes, and backtested MAE/RMSE accuracy figures computed against the last 7 actual days of data.
- **Dynamic Pricing**: for each priced menu item with ≥7 days of history, an estimated price elasticity (ε), a recommended new price rounded to the nearest ₹5, a projected revenue-change % and demand-change %, a confidence level (low/medium/high based on days of data), and a plain-language reasoning string — recommendations under a 5% price-change threshold are suppressed.
- **Wastage Management**: for dishes where the Newsvendor-optimal prep quantity is meaningfully below the usual (average+15%) prep quantity, a predicted waste quantity and ₹ cost, a recommended reduced prep quantity, a specific prevention action (e.g. "cook in two batches"), plus a 30-day daily waste-cost chart and a top-5 waste-offender ranking with improving/worsening/stable trend.
- **Ingredient Forecasting**: once dish→ingredient mappings are entered, a 7-day purchasing quantity per ingredient (with a 20% safety buffer) and a lower/upper confidence band, ranked by total quantity needed.
- **Workforce Planning**: for each of the next 7 days × 16 operating hours, a predicted order count, a demand bin (low/medium/high/peak), and a recommended kitchen/service/cashier headcount, visualized as a day×hour heatmap and an estimated weekly staffing cost.
- **Promotion Analysis**: for a logged promotion with ≥7 pre-promotion days and ≥2 promotion days of data, a revenue-impact %, order-volume-impact %, profitability-impact % (net of the discount given), a p-value/significance flag, an R², a natural-language finding, and a repeat/modify/discontinue recommendation.
- **AI Reports & Chat**: a morning or evening narrative report and free-form Q&A, both generated by an external LLM call whose prompt is grounded in the real computed KPIs/top dishes/menu quadrants from the current data — contingent on a valid `NVIDIA_API_KEY` or `GROQ_API_KEY` being set on the server.

## 9. Conclusion

**Impact:**
- Gives an owner-operator restaurant a working menu-profitability, forecasting, pricing, wastage, and staffing toolkit from a single CSV upload, with zero setup cost or backend infrastructure to run or pay for.
- Every recommendation (pricing, wastage, staffing) is generated by an explainable, textbook-referenced formula (Lerner rule, Newsvendor model, OLS regression) rather than an opaque model, so the numbers can be justified line-by-line.
- The AI report/chat layer is grounded in the restaurant's own computed data (RAG-style context injection) rather than generic LLM output, keeping answers specific and checkable against the underlying numbers.

**Limitations:**
- There is no backend database — all data lives in one browser's `localStorage`, so it does not sync across devices, survive a cleared browser, or scale past what `localStorage` can hold.
- There is no authentication or multi-user model — the app has no concept of restaurant accounts, so it is currently usable by exactly one operator per browser profile, with no access control.
