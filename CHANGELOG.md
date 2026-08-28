# Changelog

All notable changes to this project will be documented in this file.

## 2026-08-28

### Add real restaurant accounts (SQLite + JWT auth) with login/signup pages and per-account data separation
- **package.json**: Added `better-sqlite3`, `bcrypt`, `jsonwebtoken`, `uuid` (runtime) and their `@types/*` (dev) — why: real persistent accounts need a real DB, hashed passwords, and signed session tokens
- **db.ts**: New file — opens/creates `data/businessiq.db` via better-sqlite3, creates `restaurants` table (`id` uuid pk, `name`, `email` unique, `password_hash`, `created_at`) if not exists; exports `db` and `RestaurantRow` type — why: single source of truth for the one new persisted table, kept separate from existing localStorage-based analytics data per task scope
- **.gitignore**: Added `data/` — why: the SQLite file + WAL/SHM siblings are runtime state, not source
- **.env.example**: Added `JWT_SECRET` placeholder — why: document the required env var without committing a real secret
- **.env.local**: New (gitignored) file with a generated `JWT_SECRET` for local dev — why: server needs a secret to sign/verify JWTs
- **server.ts**: Added `POST /api/auth/signup` (validates input, rejects duplicate email with 409, hashes password with bcrypt, inserts restaurant row, returns JWT) and `POST /api/auth/login` (verifies hash, returns JWT); added `requireAuth` Express middleware that reads `Authorization: Bearer <token>`, verifies it with `jsonwebtoken`, and attaches `restaurantId` to the request for future protected routes — why: standard email+password+JWT pattern, no protected business routes exist yet so `requireAuth` is defined but not yet wired to one
- **src/lib/authClient.ts**: New file — thin fetch wrapper for `/api/auth/signup` and `/api/auth/login`, plus `saveSession`/`logout`/`isAuthenticated` helpers around the two fixed localStorage keys `biq_auth_token` and `biq_restaurant_id` — why: single place for the frontend's auth contract
- **src/pages/LoginPage.tsx**, **src/pages/SignupPage.tsx**: New pages — centered card on the app's existing dark sidebar background (`--color-bg-sidebar`) with the app's existing `Button`/token-based input styling (olive `--color-unity` primary button, `--color-sunburst` accent), inline validation errors, link between the two pages; on success call `authClient.saveSession` then navigate into the app — why: professional auth flow using the app's existing design tokens, no new visual style invented
- **src/App.tsx**: Added `/login` and `/signup` public routes; added `RequireAuth` guard (redirects to `/login` when `biq_auth_token` is missing) wrapping both the onboarding route and `AppLayout` (which now nests `RequireAuth > RequireOnboarding > AppShell`) — why: every existing page must require a logged-in account first, onboarding (per-browser restaurant profile) still runs after that
- **src/layout/AppShell.tsx**: Added a Logout button at the bottom of the sidebar (calls `authClient.logout()` then navigates to `/login`) — why: task requires a visible logout action
- **src/lib/storage.ts**: Added `nsKey(base)` which suffixes every localStorage key with the current `biq_restaurant_id` (or `anon` if absent), read fresh from localStorage on every `get`/`set`/`remove` call; added `remove()` helper and switched the three direct `localStorage.removeItem(KEYS.x)` call sites (`clearBilling`, `clearChat`, `clearAll`) to use it — why: cheap per-account scoping of existing client-side billing/menu/forecast data without migrating it into the DB, per task step 4

### Execution flow
- Read server.ts, src/lib/storage.ts, src/App.tsx, src/layout/AppShell.tsx, src/design-system/tokens.css, src/design-system/components/index.tsx, src/pages/OnboardingPage.tsx, src/lib/aiClient.ts, src/types/index.ts, tsconfig.json, package.json, .gitignore, .env.example to learn existing patterns before adding anything
- Created branch `auth-and-db` off `main`
- Installed `better-sqlite3`, `bcrypt`, `jsonwebtoken`, `uuid` + `@types/*`
- Wrote db.ts, updated .gitignore and .env.example, created .env.local with a generated JWT secret
- Edited server.ts: added signup/login routes and `requireAuth` middleware
- Wrote src/lib/authClient.ts, src/pages/LoginPage.tsx, src/pages/SignupPage.tsx
- Edited src/App.tsx (routes + `RequireAuth`), src/layout/AppShell.tsx (logout button), src/lib/storage.ts (namespacing)
- Ran `npx tsc --noEmit` — clean, no errors
- Started the dev server and curl-tested the auth flow directly: signup returned a JWT + restaurantId (200), the same email re-signing up was rejected (409 "already exists"), login with the correct password returned a fresh valid JWT (200), login with a wrong password was rejected (401) — then queried `data/businessiq.db` directly with better-sqlite3 and confirmed the restaurant row was persisted with the correct name/email
- Verified `storage.ts`'s per-account separation by inspection: every `get`/`set`/`remove` now routes through `nsKey()`, which reads `biq_restaurant_id` from localStorage at call time, so two different restaurant IDs produce two disjoint sets of `biq_*_<id>` keys in the same browser — stopped the test server and deleted the test `data/` directory afterward so no test account/DB file was left behind

### Harden CSV upload validation UX (per-row error detail, ambiguous-date flagging, Import Issues panel)
- **src/lib/csvParser.ts**: Added `RowIssue` type (`rowNumber`, `rawValues`, `reason`, `type: 'error'|'warning'`); `ParseResult.issues` now holds ALL flagged rows (uncapped) instead of `errors` capping at 20 — why: UI should cap display, not the data
- **src/lib/csvParser.ts**: `normaliseDate` now returns `{ date, ambiguous }` and rejects out-of-range day/month (was previously silently building invalid date strings like "2024-25-13"); when day and month are both ≤12 and differ, the row is flagged as a `warning` with reason `ambiguous date (...), assumed DD/MM` instead of guessing silently — why: task requires visible verification of the DD/MM assumption, not a silent guess
- **src/lib/csvParser.ts**: Removed dead `mdy` regex branch in `normaliseDate` — it was unreachable because the preceding `dmy` regex already matched any `/`-separated numeric date first
- **src/lib/csvParser.ts**: Non-numeric selling price now pushes a `warning` issue (`non-numeric price (...)`) instead of silently defaulting to 0 with no trace; value still defaults to 0 and the row still imports — behavior for valid rows is unchanged
- **src/lib/csvParser.ts**: Invalid date / missing dish name still push `error` issues and still skip the row (same rows are skipped as before — only the reporting changed)
- **src/pages/UploadPage.tsx**: Added collapsible "Import Issues" panel (`issuesOpen` state) below the Preview card, rendered whenever `result.issues.length > 0`, listing every flagged row's row number, raw values, and reason; display capped at `ISSUES_DISPLAY_CAP = 200` rows with a "+N more issues not shown" footer — cap is UI-only, `result.issues` still holds everything
- **src/pages/UploadPage.tsx**: `result` state retyped to `ParseResult` (was an inline duplicate type); "Skipped rows" stat renamed to "Flagged rows" and now reads `result.issues.length`
- **src/pages/UploadPage.tsx**: Top-level fatal-error banner logic changed from `res.errors.length && !res.entries.length` to `!res.entries.length` (falls back to a generic "see Import Issues below" message when there's no fatal file-level error but zero rows parsed) — needed because per-row failures no longer populate `errors`
- **src/pages/UploadPage.tsx**: `saveAndContinue` / `storage.setBilling` / `buildMenuFromBilling` flow untouched — valid-row import behavior is unchanged

### Execution flow
- Read src/lib/csvParser.ts and src/pages/UploadPage.tsx in full
- Grepped src/ for `parseCSV`, `ParseResult`, `.errors`, `generateSampleCSV` — confirmed only UploadPage.tsx consumes `parseCSV`/`ParseResult`, so the interface change was safe to make
- Edited csvParser.ts: added `RowIssue`, reworked `normaliseDate` to return ambiguity + reject invalid month/day, replaced per-row `errors.push` with `issues.push` (error/warning), added non-numeric-price warning, updated both early `resolve()` calls and the final `resolve()` to the new `ParseResult` shape
- Edited UploadPage.tsx: retyped `result` state to `ParseResult`, added `issuesOpen` state + collapsible Import Issues panel with a 200-row display cap, updated the fatal-error condition and the "Flagged rows" stat, removed now-unused `BillingEntry` import
- Ran `npx tsc --noEmit` — clean, no errors
- Verified `saveAndContinue`, `storage.setBilling`, `buildMenuFromBilling` call sites unchanged — valid-row import path not touched

## 2026-08-27

### Docs: Generated Phase-2 project review content (CONTENT.md)
- **CONTENT.md**: New file — abstract, introduction, problem statement, requirements, methodology, implementation, testing, results, conclusion for the Phase-2 review; why: content had to be derived strictly from actual code (not `final_proj_report.docx`, which describes an unimplemented stack) so every claim is traceable to a real file/function

### Execution flow
- Read src/pages/* (UploadPage, MenuPage full; others via targeted grep for route/function/title strings), src/lib/{storage,menuEngine,forecasting,analytics,aiClient,csvParser,reportGenerator}.ts, src/lib/ml/*.ts (dynamicPricing, ingredientForecast, promotionAnalyzer, wastagePredictor, workforceForecast, features), server.ts, package.json, App.tsx routes, existing CHANGELOG.md
- Verified each ML module's actual algorithm from its JSDoc header (WMA, Newsvendor model, log-log elasticity/Lerner rule, OLS ITS regression, feature-weighted voting) and confirmed Prophet/XGBoost/Random Forest are named only as comment-level conceptual analogues, never actually invoked
- Verified tech stack claims against package.json dependencies and server.ts's actual fetch-based NVIDIA/Groq calls (not the unused @google/genai/openai SDK deps)
- Wrote CONTENT.md with one heading per required section, citing concrete files/functions for every claim

### Fix: CSV upload not fully replacing menu/billing data
- **src/lib/storage.ts**: Removed `appendBilling` (merged old+new billing by id, causing old dishes to survive); added `setBilling(entries)` doing a full overwrite of the billing key — why: upload must always replace, never merge
- **src/pages/UploadPage.tsx**: `saveAndContinue` now unconditionally calls `storage.setBilling(result.entries)` then `buildMenuFromBilling(result.entries, [])` (empty existingMenu) then `storage.setMenu(menu)` — why: previously passed full merged billing + old `storage.getMenu()` as existingMenu, which carried forward old dish names into the new menu
- **src/lib/menuEngine.ts**: Verified only — `buildMenuFromBilling` takes no implicit/localStorage state and returns only dishes present in the `entries` arg, reusing existingMenu only for price/cost of matching names; no changes needed since existingMenu is now always `[]`
- **src/pages/MenuPage.tsx**: Verified only — no `SAMPLE_MENU` or hardcoded fallback array present; reads via `storage.getMenu()` which defaults to `[]`
- **src/design-system/components/index.tsx**: Fixed unrelated pre-existing type error — `Table`'s `col.render(row)` call was missing the required `index` arg per its `render?: (row, index) => ReactNode` signature; blocked `tsc --noEmit`

### Execution flow
- Read src/lib/storage.ts, src/pages/UploadPage.tsx, src/lib/menuEngine.ts, src/pages/MenuPage.tsx
- Grepped src/ for `SAMPLE_MENU`, `getMenu()`, `appendBilling` — confirmed no other hardcoded fallback menus exist (all other `getMenu()` call sites are plain reads)
- Edited storage.ts: replaced `appendBilling` with `setBilling`
- Edited UploadPage.tsx: `saveAndContinue` uses `setBilling` + `buildMenuFromBilling(result.entries, [])` unconditionally
- Ran `npx tsc --noEmit` — found unrelated error in design-system/components/index.tsx:222; fixed by passing `i` to `col.render`
- Re-ran `npx tsc --noEmit` — clean, no errors
- Manual trace verify: fresh storage → upload CSV A(X,Y,Z) → setBilling([X,Y,Z]) → buildMenuFromBilling([X,Y,Z], []) → menu = [X,Y,Z] only → upload CSV B(P,Q) → setBilling([P,Q]) overwrites A → buildMenuFromBilling([P,Q], []) → menu = [P,Q] only, zero carryover from A — PASSED

### Groq AI Provider Integration
- **.env.example**: Added `GROQ_API_KEY` placeholder with comment explaining it's fallback when NVIDIA_API_KEY is not set
- **server.ts**: Added `callGroq()` function mirroring `callNvidia()`, pointed to `https://api.groq.com/openai/v1/chat/completions` with `groq/llama-3.1-8b-instant` model; Added `callAI()` wrapper that uses NVIDIA if key exists, otherwise falls back to Groq; Updated `/api/ai/report` and `/api/ai/chat` endpoints to use `callAI()`

### Menu-Billing Sync Refinement
- **src/lib/menuEngine.ts**: Already contains `buildMenuFromBilling()` function that builds menu from billing entries by averaging prices for new dishes and preserving existing menu item data; No changes needed - function already meets spec
- **src/pages/UploadPage.tsx**: Already imports and uses `buildMenuFromBilling`; Already calls `storage.getBilling()` then `buildMenuFromBilling()` then `storage.setMenu()` in `saveAndContinue`; No changes needed
- **src/pages/MenuPage.tsx**: Already uses `storage.getMenu()` directly in useEffect without SAMPLE_MENU fallback; No changes needed

### Documentation
- **CLAUDE.md**: Created with rule to append dated CHANGELOG.md entries after any code change

### Verification
- Ran `tsc --noEmit` - no type errors
- Ran `npm run lint` (`tsc --noEmit`) - no type errors
- Ran `npm run dev` (`npx tsx server.ts`) - FAILED with `EADDRINUSE: address already in use 0.0.0.0:3000` (port 3000 already bound by another process); WebSocket port 24678 also already in use
