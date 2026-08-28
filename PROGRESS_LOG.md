# Progress Log

This file is the plain-English version of what's been built, for anyone on the team
who doesn't read code. For the technical version (files changed, why), see CHANGELOG.md.

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
