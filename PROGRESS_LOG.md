# Progress Log

This file is the plain-English version of what's been built, for anyone on the team
who doesn't read code. For the technical version (files changed, why), see CHANGELOG.md.

## 2026-08-30 — Fixed: Large File Uploads Failing, and Blank Dish Names in the Preview

**Bug 1 — "Could not reach the server to save your data" on big uploads:** If you tried to
upload a large sales history file (we tested with 90 days / 16,810 rows), saving would
fail with that error. What was actually happening: the server has a safety limit on how
big a single upload request is allowed to be (2MB), and a file that size, once turned
into the format the server expects, came in just over that limit — so the server rejected
it outright before it ever tried to save anything. It wasn't the server being down, wasn't
it being slow, and wasn't your login expiring — we checked all three directly and ruled
them out. **The fix:** large uploads are now automatically split into smaller batches
behind the scenes and sent one after another, so there's no single request big enough to
hit that limit — no matter how many days of history you upload at once.

**Bug 2 — Dish names showing up blank in the upload preview:** After parsing a file, the
preview table's Date, Qty, Price, and Meal columns showed correctly, but the Dish column
looked empty. We checked directly — the dish names were always there in the data, so
nothing was being lost or misread. The actual problem was cosmetic: that one column (and
two of the stat numbers just above it) was styled in pure white text, left over from an
older version of the page's color scheme. The rest of the app has since moved to a
lighter background, so that white text was rendering invisibly — white text on a
near-white background. **The fix:** those spots now use the same text color as the rest
of the app, so they're visible again.

**Verified together:** re-ran the exact same 90-day, 16,810-row file end-to-end through
the real upload screen — the Dish column and stat numbers displayed correctly in the
preview, and clicking Save & Continue completed successfully with no error, landing the
data in billing history as expected.

## 2026-08-30 — New Testing Tool: "Generate Next Day"

**What's new:** A new button on the Upload Data page, in a clearly-marked "Testing Tools"
section, lets the team generate one realistic day of sales at a time for a restaurant —
using only dishes that are actually on that restaurant's menu — so we can watch the ML
forecasts and Opportunity Engine recommendations evolve day by day, without waiting for
real time to pass or having to hand-build test spreadsheets every time we want to see
what happens "the next day."

**How it works:** Click **Generate Next Day**, and it creates one plausible day of sales —
picking up right where the restaurant's existing sales history leaves off (or starting
from today if there's no history yet), varying order volume for weekends and festivals,
and pricing each dish a few percent around its real menu price, the way real-world sales
naturally vary day to day. You get a preview first — "Generated sales for [date] — N
orders, ₹X revenue" — before anything is saved. From there:
- **Yes, Import** runs it through the exact same process as a real sales upload: checked
  against the locked menu, then used to update the sales-forecast-accuracy tracker and
  the Opportunity Engine, exactly like a real day of sales would be.
- **Discard** throws it away — nothing is saved, and the restaurant's history is untouched.

Only one generated day can be pending at a time — you have to import or discard it before
generating the next one, so nobody accidentally builds up a pile of unconfirmed test data.

**Important:** this is clearly labeled as a testing-only tool, separated from the real
upload area with its own bordered section — it's not something a real restaurant owner
would see themselves using; it exists purely to let the team watch the product's
intelligence features develop over simulated time.

**Verified end-to-end** on the running app: seeded a test restaurant with a menu and a
week of history, clicked Generate Next Day, confirmed the preview only ever used real
menu dishes and picked up the very next calendar day, discarded once (confirmed nothing
was saved), then generated and imported for real — confirmed the new day landed in
billing history correctly, and that both the forecast-accuracy tracker and the
Opportunity Engine picked up the new data, exactly as they would for a real upload.

## 2026-08-30 — Your Menu Is Now Locked and Owner-Controlled

**What's new:** Up until today, uploading your sales data could silently change your menu
behind your back — any dish name that showed up in a POS export got auto-added, with a
guessed price and cost, no questions asked. That's gone. Your menu is now a locked list
that only changes when you say so — never as a side effect of uploading data.

**What changed for you, day to day:**
- **Setup order changed.** After you finish the initial restaurant profile questions,
  you're now taken straight to Menu Setup — add your dishes (name, price, cost) first,
  either by typing them in or by uploading a CSV (dish, price, cost) if you'd rather bulk
  import. Only after you have at least one dish saved does Upload Data become available.
- **Uploads now flag anything they don't recognize.** Every time you upload sales data —
  whether you drop a file in yourself or use "Import Today's Sales" — every dish name in
  it is checked against your menu. Dishes already on your menu import normally. Anything
  that ISN'T on your menu gets held back, and you're shown exactly what: "We found N
  dishes in this file that aren't in your menu," with each one listed and two clear
  choices — **Add to my menu** (you set the price and cost right there) or **Not from
  this restaurant** (those rows are left out, and the import summary tells you exactly
  what was excluded and why). Nothing gets imported or added silently — every one of those
  dishes needs your explicit yes/no before the import finishes. This applies to background
  auto-imports too, not just files you upload by hand — if an automatic import contains an
  unrecognized dish, it now waits for your decision instead of guessing.
- **Menu Setup also got a CSV upload option** for anyone who'd rather bulk-import their
  starting menu from a spreadsheet than type each dish by hand — it still lands in the
  same editable table and still needs you to click Save Menu, same as typing dishes in
  manually.

**Why this matters:** Before, a typo in a POS export, a seasonal special, or genuinely
unrelated data (say, a different outlet's export dropped in the wrong folder) could
quietly pollute your menu with junk entries and made-up prices — and you'd only notice
later, if at all, when profitability numbers looked wrong. Now your menu is exactly what
you decided it is, always, and the only way it changes is if you tell it to.

**Verified end-to-end** on the running app with a fresh test account: signed up, completed
onboarding, landed on Menu Setup (not Upload) as required, added a dish, saved, landed on
Upload Data as required, then uploaded a file with one recognized and one unrecognized
dish — the "unrecognized dishes" review screen appeared exactly as designed, listing the
one new dish with both decision buttons and correctly refusing to let the import finish
until it was resolved.

## 2026-08-30 — Fixed: the app kept forgetting you'd already signed up

**What was reported:** after creating an account and finishing the setup wizard once, the
app would keep bouncing back to the login screen or the "let's set up your restaurant"
wizard, instead of just remembering you and taking you to your dashboard.

**What it actually was (checked, not guessed):** a recent change moved the restaurant
setup wizard's "are they done onboarding?" answer from the browser onto the server (a
good change on its own — it means switching devices doesn't make you redo setup). But
the server that was actually running hadn't been restarted since that change went in, so
it didn't yet have the new database table or the new endpoint the app needed to save and
check that answer. Every attempt to save "onboarding complete" silently failed, and every
page load's "let me check if you're logged in and set up" request failed right along with
it — which is what looked like the app forgetting the session.

We confirmed this by testing it directly: with the old, un-restarted server, saving the
setup wizard's answer genuinely failed every time; after restarting the server, the exact
same save worked, and reloading the page correctly remembered it. We also separately and
directly tested the part suspected to be the real culprit — the automatic "your login
expired, quietly get a fresh one" mechanism — and confirmed it already worked correctly;
it was never the problem.

**What we fixed, so this can't quietly happen again:**
- Restarted the server so it's running the current code.
- The page-load check that verifies "logged in + set up" was written so that if even
  *one* small piece of it failed (like in this exact incident), the whole check gave up
  and threw away everything it already knew — sales data, menu, all of it — not just the
  one broken piece. Fixed so each piece is checked independently: a hiccup in one no
  longer wipes out everything else.
- Separately noticed that opening a brand-new browser tab and landing on the site's home
  page always showed the setup wizard from scratch, even for an account that had already
  finished it, because nothing checked first. Fixed — it now sends an already-set-up
  account straight to the dashboard.

**Verified for real:** signed up a fresh account, finished the full 5-step setup wizard
through the actual app, reloaded the page twice, and closed and reopened the tab — every
time, it correctly remembered the account and skipped straight past login/setup.

**Nothing about token expiry was extended or loosened** — the actual broken pieces were
fixed directly, not papered over.

## 2026-08-30 — Locking the Front Door: Login Protection, Safer Sessions, and Automatic Checks

**What's new:** Three defensive upgrades to the login/account system, none of which change
anything you can see or do day-to-day — this is entirely about protecting what's already
there.

**1. Login is now protected against repeated password-guessing.** Before today, nothing
stopped someone (or a script) from trying thousands of password guesses against an account
in a row. Now, after 5 failed login or signup attempts from the same source within 15
minutes, further attempts are blocked with a clear message ("Too many attempts, please try
again in a few minutes") until the window passes. A real person logging in once, even if
they fumble their password once or twice, is never affected — this only kicks in for rapid,
repeated attempts, the pattern a password-guessing attack actually looks like. The same kind
of protection (a gentler version) now also covers the rest of the app's API against a flood
of automated requests generally.

**2. Login sessions now renew themselves safely in the background, and logging out actually
ends the session on the server.** Previously, logging in issued one login "pass" that stayed
valid for 30 days straight — if that pass ever leaked, it worked for a full month with no way
to shut it off remotely. Now, logging in issues a short-lived pass (15 minutes) plus a
longer-lived renewal ticket. The app renews the short pass automatically and invisibly in the
background every time it's about to expire — you'll never notice, never get logged out
mid-session. Each time it renews, the old renewal ticket is retired and a fresh one issued,
so an old, leaked ticket stops working the moment a real renewal happens. And now, clicking
Logout actually tells the server to invalidate your renewal ticket for good — before, Logout
only cleared things on your own browser, so a copied token could technically still work
elsewhere; now it can't.

**3. Every future code change is now automatically checked before it can be merged.** A new
automated pipeline (GitHub Actions) runs on every single push and every pull request: it
checks the code for type errors and runs the full automated test suite (85 checks, up from
73 — 12 new ones added today specifically for the new login-protection and session-renewal
behavior). If either check fails, the pipeline is marked failed and clearly flags it — this
is meant to catch a mistake before it reaches the real app, not just report on it afterward.

**Nothing about how the app works day-to-day has changed** — every existing feature, button,
and page behaves exactly as before. This is purely about making the account system harder to
abuse and about catching regressions automatically going forward.

## 2026-08-30 — The First Real Trained AI Model for Demand Forecasting

**What's new:** Up until now, every "prediction" in BusinessIQ — demand forecasting,
wastage, workforce, pricing — has come from a hand-written formula: a weighted average
of recent sales, a rule about weekends and festivals, that kind of thing. Those formulas
are useful, and they still run exactly as before. But today the app got its **first
real trained machine learning model**: one that looks at a restaurant's own sales
history and learns its own patterns, rather than following a fixed rule everyone shares.

**How it works, in plain terms:** On the Forecast page there's now a "Train Model"
button. Click it, and the system looks at every dish sold on every day in your billing
history, and teaches a model (a "Gradient Boosting" model — a well-established,
industry-standard technique) to predict how much of each dish will sell tomorrow, based
on the day of the week, whether it's a festival, and how that dish has been selling
over the past one and two weeks. It needs at least two weeks of billing history to do
this meaningfully. Training takes a few seconds and it tells you how it did — for
example "trained on 90 days of data, MAE 3.18 units," meaning its typical guess is off
by about 3 plates either way.

**What you'll actually see:** A new "Trained Model (Beta)" section on the Forecast page.
Before training, it just tells you to train first — no blank or broken tables. After
training, it shows a table for your top dishes over the next 7 days with two columns
side by side: "Baseline (WMA)" (the original formula-based forecast, unchanged) and
"Trained Model (Beta)" (the new learned one). You can look at both and judge for
yourself which one seems closer to what actually happens.

**Why this matters:** This is the first concrete step toward what the original project
vision called the model "learning the business" — instead of a fixed formula the same
for every restaurant, the trained model adapts to this specific restaurant's own dishes,
seasonality, and customer patterns. It runs quietly alongside the existing formula,
not in place of it, so nothing that already worked changes — this is purely additive,
and safe to try. Over time, as more restaurants use it and the comparison table builds
up a track record, this is the foundation a fully AI-driven forecast could be built on.

**One new setup step for developers:** this feature needed Python (specifically,
scikit-learn, the standard Python ML toolkit) for the first time — everything else in
BusinessIQ still runs on the existing Node.js stack. It's an optional, one-time
`pip install` step; the rest of the app works fine without it, only "Train Model" needs
it.

## 2026-08-30 — Forecast Accuracy Tracking (and a documentation correction)

**Part 1 — documentation now matches reality:** A few older project documents (the
README and the technical Q&A doc) still described the database as PostgreSQL and
hinted the forecasting model might be something like "Prophet." Neither has ever been
true here — the app uses SQLite (a real file on this server, `data/businessiq.db`) and
a custom-built forecasting method called Weighted Moving Average. Both documents have
been corrected to say so plainly. SQLite is not a placeholder or a shortcut — it's a
deliberate, appropriate choice for a single restaurant's scale; if this ever grows to
many restaurants writing at once, migrating to PostgreSQL is a well-understood, scoped
next step, not a rewrite. No application behavior changed — wording only.

**Part 2 — the app now grades its own forecasts:** Until today, the 7-day sales
forecast was generated and shown, but nobody — not the app, not us — was keeping score
of whether it was actually right. Starting today, every forecast the app makes for
every dish is saved, and the moment real sales data for that day arrives, the app
automatically checks its own prediction against what actually happened and records how
far off it was.

**Why this matters:** This is the first day of a running, honest track record. It answers
the question "is this thing actually any good at predicting demand?" with real numbers
instead of a one-time impression, and it accumulates for as long as the app runs. It's
also the yardstick the separately-planned trained machine-learning model will be measured
against — without this, there'd be no fair baseline to compare a fancier model to.

**What changed, in plain terms:**
- Every time new billing data is uploaded or auto-imported, two things now happen automatically: (1) any forecast made earlier for a date that has just become "today's real numbers" gets checked and scored, and (2) a fresh 7-day forecast is generated and saved for later checking.
- A new chart on the Forecast page, "Forecast Accuracy Over Time," shows this score (how far off the model was, on average, per day) as a line over time. Since today is day one, it currently shows a "still collecting data" message instead of an empty or broken chart — the score will appear as soon as a forecasted day's real sales land, typically the very next day.
- Nothing about the forecast numbers shown elsewhere on the page changed — this only adds a scorekeeping layer behind the scenes.

**Where to see it:** Forecast page → scroll to the bottom → "Forecast Accuracy Over Time."

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
