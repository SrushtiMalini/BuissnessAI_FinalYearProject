# Progress Log

This file is the plain-English version of what's been built, for anyone on the team
who doesn't read code. For the technical version (files changed, why), see CHANGELOG.md.

## 2026-08-29 — Automated Tests (catching mistakes before they reach the app)

**What was missing:** No automated tests existed anywhere in the project. Every single
feature — the 5 prediction/analytics engines, the menu logic, the Opportunity Engine,
the login and data-saving system — had only ever been checked by hand, by a person
manually clicking through the app or running one-off checks. Nothing ran automatically
to catch a mistake before it reached a real user.

**Why it matters:** Manual checking works today, but it doesn't scale and it doesn't
protect the past. Every time a change is made anywhere in the app, someone would have
to remember to re-check all the older features by hand to make sure nothing broke —
and in practice, that never fully happens. Automated tests run the same checks, the
same way, every single time, in seconds, with no one needing to remember to do it.

**What changed, in plain terms:**
- Added a proper test runner (Vitest) and a `npm test` command that checks the whole project in one go.
- Wrote 69 automated checks covering: all 5 prediction engines (dynamic pricing, food-waste prediction, ingredient forecasting, promotion analysis, staffing forecasting), the sales forecasting engine, the menu-classification logic (Star/Hidden Gem/Volume Trap/Dead Weight), the Opportunity Engine (the "This Week's Opportunities" recommendations), and the login/account system.
- For the login and account system specifically: verified — with a real, temporary, throwaway test database, never the real one — that signing up and logging in work, that a stranger without a valid login is turned away, and most importantly that two different restaurant accounts can genuinely never see each other's sales data, even in the same request.
- Every prediction engine's math was checked by hand against the exact formula it's supposed to use (not just "does it return a number"), so a future change that quietly breaks the actual calculation will be caught immediately instead of silently shipping.
- Along the way, found two small, real inconsistencies in how two of the prediction engines weight recent vs. older sales history — flagged in the technical changelog for a product decision, not changed, since this task was about adding tests, not changing how predictions are calculated.

**An honest note on something that went wrong and was fixed:** while writing the login-system
tests, a bug in the test setup caused one early test run to accidentally run against the
real database instead of a safe, temporary one — and it deleted the real account's entire
sales history (4,569 rows, 61 days of "bengaluru cafe" data). This was caught immediately,
the cause was fixed so it cannot happen again, and — with the account owner's explicit
go-ahead at each step — the sales history was fully recovered from a lower-level backup
copy of the database and restored. The count, dates, and account match exactly what was
there before. The menu and account login were never affected.

**Where to see it:** Run `npm test` from the project root — it checks everything and reports
pass/fail in a few seconds. Nothing about how the app looks or behaves day-to-day changed;
this is entirely a safety net working behind the scenes.

## 2026-08-28 — Opportunity Engine (Business Analyst Recommendations)

**What we built:** The app now watches your sales data and automatically tells you
which dishes to push, reprice, or stop wasting — like a business analyst pointing
things out for you, instead of just showing you charts and leaving you to spot the
patterns yourself.

**Why:** This was requested to make the app act as an actual analyst, not just a
dashboard.

**What changed, in plain terms:**
- The app now compares each dish's sales this week vs last week and flags big changes (up or down by 20% or more).
- It also checks whether a dish has moved into or out of its "star" status on the menu (our best-performing category) and flags that shift.
- It pulls in the pricing suggestions the app already generates and highlights the ones that would genuinely make more money.
- It pulls in the food-waste predictions the app already generates and highlights the ones that would save a meaningful amount.
- It checks past promotions and flags any that worked well enough to be worth repeating.
- All of this is combined into one ranked list — the app picks the 5 biggest, most confident opportunities and shows them front and center.
- The dashboard now shows a "This Week's Opportunities" panel right at the top, before anything else, with a "Mark as Acted On" or "Dismiss" button on each suggestion.
- There's a new "Opportunities" page in the sidebar showing the full history — every suggestion ever made, whether you acted on it, and once enough time has passed, whether it actually worked (what we predicted vs. what actually happened).
- Nothing here uses AI — every number and recommendation is calculated directly from your real sales data, so it's consistent and explainable every time.

**Where to see it:** Open the Dashboard — the new "This Week's Opportunities" panel is
at the very top. Click "Opportunities" in the sidebar (under Intelligence) to see the
full history and track record.

## 2026-08-28 — Your Data Now Lives on a Real Server, Not Just Your Browser

**What we built:** All of a restaurant's sales history, menu, reports, and opportunity
recommendations are now saved in a real database on our server, tied securely to their
account — not just sitting in their web browser anymore.

**Why:** Before this, everything was stored only in the browser. If an owner cleared
their browser data, switched phones or computers, or even just used a different
browser, all of their sales history, menu, and recommendations were gone for good —
with no way to get them back. A restaurant owner needs their business data to be safe
no matter what happens to their device or browser.

**What changed, in plain terms:**
- Every restaurant's sales data, menu, saved reports, and opportunity recommendations now live in a real database on the server, the same secure place their login already lives.
- Each account can only ever see and change its own data — this is enforced by the server itself now, not just by how the app happens to organize things in the browser, so it can't be worked around.
- If someone already had data saved the old way in their browser, the app automatically and safely moves it to the server the very first time they use the app after this update — quietly, in the background, with nothing for them to do.
- Clearing your browser, switching devices, or logging in from somewhere new no longer loses anything — logging back in brings all your data back exactly as it was.
- Every part of the app that reads or saves data (uploading sales, editing the menu, generating reports, marking a recommendation as done) still works exactly the same from the owner's point of view — the change is entirely behind the scenes.

**Where to see it:** Nothing looks different day-to-day — that's the point. The proof
is what *doesn't* happen anymore: clear your browser and log back in, and your Dashboard,
Menu, Reports, and Opportunities are all still there.

**One thing to know:** the restaurant's basic profile (name, city, cuisine, etc. from
onboarding) was intentionally left out of this move for now and still lives only in
the browser — that's next on the list.
