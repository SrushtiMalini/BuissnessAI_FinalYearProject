# Changelog

All notable changes to this project will be documented in this file.

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
