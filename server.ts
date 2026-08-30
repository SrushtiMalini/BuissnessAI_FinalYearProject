import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" }); // fallback
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { randomUUID, randomBytes, createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "./db.ts";
import type { RestaurantRow, BillingEntryRow, MenuItemRow, ReportRow, OpportunityRow, ForecastAccuracyRow, RefreshTokenRow, RestaurantProfileRow } from "./db.ts";
import { runImport, getLastStatus, watchIncoming } from "./importPipeline.ts";
import { runWMAForecast } from "./src/lib/forecasting.ts";
import { generateNextDayEntries, determineNextDate } from "./src/lib/testDataGenerator.ts";
import type {
  BillingEntry, MenuItem, Report, Opportunity, OpportunitySignalType, OpportunityStatus,
  ForecastAccuracyEntry, ForecastAccuracyPoint,
} from "./src/types/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = 10;

// ─── Auth tokens: short-lived access JWT + long-lived rotating refresh token ─
//
// Access tokens are the same signed JWT as before, just short-lived now (15m
// instead of a flat 30d) — requireAuth is unchanged. Refresh tokens are opaque
// random strings; only their SHA-256 hash is ever stored, so a stolen DB export
// can't be replayed as a live session. Rotation (POST /api/auth/refresh) revokes
// the presented token and issues a new one in the same request — reusing an
// already-rotated refresh token is rejected, which is what makes this rotation
// rather than a second flat long-lived token.

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function signAccessToken(restaurantId: string): string {
  if (!JWT_SECRET) throw new Error("JWT_SECRET is not configured on the server.");
  return jwt.sign({ restaurantId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function issueRefreshToken(restaurantId: string): string {
  const token = randomBytes(48).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
  db.prepare(
    "INSERT INTO refresh_tokens (id, restaurant_id, token_hash, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)"
  ).run(randomUUID(), restaurantId, hashToken(token), now.toISOString(), expiresAt.toISOString());
  return token;
}

// ─── Trained demand model bridge (Node -> Python) ────────────────────────────

const execFileAsync = promisify(execFile);
const PYTHON_BIN = process.env.PYTHON_BIN ?? "python";
const TRAIN_SCRIPT = path.join(__dirname, "server", "ml", "train_demand_model.py");
const PREDICT_SCRIPT = path.join(__dirname, "server", "ml", "predict_demand.py");

interface TrainSummary {
  ok: boolean;
  error?: string;
  rowsUsed?: number;
  daysUsed?: number;
  dishCount?: number;
  trainRows?: number;
  testRows?: number;
  mae?: number;
  trainedAt?: string;
}

async function trainDemandModel(restaurantId: string): Promise<TrainSummary> {
  try {
    const { stdout } = await execFileAsync(PYTHON_BIN, [TRAIN_SCRIPT, restaurantId], { cwd: process.cwd() });
    const resultLine = stdout.split("\n").reverse().find(l => l.startsWith("RESULT_JSON:"));
    if (!resultLine) return { ok: false, error: "Training script produced no result." };
    return JSON.parse(resultLine.slice("RESULT_JSON:".length)) as TrainSummary;
  } catch (err: any) {
    console.error("trainDemandModel error:", err.message);
    return { ok: false, error: err.stderr?.toString().trim() || err.message || "Training failed." };
  }
}

interface PredictResult {
  predicted?: number;
  dish?: string;
  date?: string;
  error?: string;
  message?: string;
}

async function predictDemand(restaurantId: string, date: string, dishName: string): Promise<PredictResult> {
  try {
    const { stdout } = await execFileAsync(PYTHON_BIN, [PREDICT_SCRIPT, restaurantId, date, dishName], { cwd: process.cwd() });
    const lastLine = stdout.trim().split("\n").pop() ?? "{}";
    return JSON.parse(lastLine) as PredictResult;
  } catch (err: any) {
    console.error("predictDemand error:", err.message);
    return { error: "predict_failed", message: err.stderr?.toString().trim() || err.message };
  }
}

interface AuthedRequest extends Request {
  restaurantId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing Authorization header" });
  if (!JWT_SECRET) return res.status(500).json({ error: "JWT_SECRET is not configured on the server." });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { restaurantId: string };
    req.restaurantId = payload.restaurantId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── Row <-> app-type mapping helpers ────────────────────────────────────────

function billingRowKey(date: string, time: string | undefined | null, dishName: string, quantity: number, sellingPrice: number): string {
  return `${date}|${time ?? ""}|${dishName}|${quantity}|${sellingPrice}`;
}

/** Shared by POST /api/billing (real uploads) and POST /api/test-data/confirm-next-day
 *  (the "Generate Next Day" testing tool) — same dedup-by-key insert, same place. */
function insertBillingEntries(restaurantId: string, newEntries: BillingEntry[]): { added: number; total: number } {
  const existingRows = db.prepare(
    "SELECT date, time, dish_name, quantity, selling_price FROM billing_entries WHERE restaurant_id = ?"
  ).all(restaurantId) as Pick<BillingEntryRow, "date" | "time" | "dish_name" | "quantity" | "selling_price">[];
  const seen = new Set(existingRows.map(r => billingRowKey(r.date, r.time, r.dish_name, r.quantity, r.selling_price)));

  const insert = db.prepare(
    "INSERT INTO billing_entries (id, restaurant_id, date, time, dish_name, quantity, selling_price, meal_period) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  let added = 0;
  const insertMany = db.transaction((entries: BillingEntry[]) => {
    for (const e of entries) {
      const key = billingRowKey(e.date, e.time, e.dishName, e.quantity, e.sellingPrice);
      if (seen.has(key)) continue;
      seen.add(key);
      insert.run(randomUUID(), restaurantId, e.date, e.time ?? null, e.dishName, e.quantity, e.sellingPrice, e.mealPeriod ?? null);
      added++;
    }
  });
  insertMany(newEntries);

  const total = (db.prepare("SELECT COUNT(*) as c FROM billing_entries WHERE restaurant_id = ?").get(restaurantId) as { c: number }).c;
  return { added, total };
}

function rowToBillingEntry(row: BillingEntryRow): BillingEntry {
  return {
    id: row.id,
    date: row.date,
    time: row.time ?? undefined,
    dishName: row.dish_name,
    quantity: row.quantity,
    sellingPrice: row.selling_price,
    mealPeriod: (row.meal_period ?? undefined) as BillingEntry["mealPeriod"],
  };
}

function rowToMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    name: row.name,
    sellingPrice: row.selling_price,
    rawMaterialCost: row.raw_material_cost,
    category: row.category ?? undefined,
  };
}

function rowToReport(row: ReportRow): Report {
  const parsed = JSON.parse(row.content) as { generatedAt: string; summary: Report["summary"]; aiText: string };
  return {
    id: row.id,
    date: row.date,
    generatedAt: parsed.generatedAt,
    summary: parsed.summary,
    aiText: parsed.aiText,
    type: row.type as Report["type"],
  };
}

function rowToForecastAccuracy(row: ForecastAccuracyRow): ForecastAccuracyEntry {
  return {
    id: row.id,
    date: row.date,
    dishName: row.dish_name,
    predictedValue: row.predicted_value,
    actualValue: row.actual_value,
    absoluteError: row.absolute_error,
    createdAt: row.created_at,
  };
}

function rowToOpportunity(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    dishName: row.dish_name,
    signalType: row.signal_type as OpportunitySignalType,
    recommendationText: row.recommendation_text,
    projectedImpact: row.projected_impact,
    confidence: row.confidence as Opportunity["confidence"],
    status: row.status as OpportunityStatus,
    createdDate: row.created_date,
    resolvedDate: row.resolved_date,
    outcome: row.outcome,
    actedOnDate: row.acted_on_date,
  };
}

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "minimaxai/minimax-m3";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "groq/llama-3.1-8b-instant";

async function callNvidia(messages: { role: string; content: string }[]): Promise<string> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error("NVIDIA_API_KEY is not configured on the server.");

  const response = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages,
      temperature: 1.0,
      top_p: 0.95,
      max_tokens: 8192,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NVIDIA API error ${response.status}: ${errText}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGroq(messages: { role: string; content: string }[]): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured on the server.");

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 1.0,
      top_p: 0.95,
      max_tokens: 8192,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errText}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAI(messages: { role: string; content: string }[]): Promise<string> {
  if (process.env.NVIDIA_API_KEY) return callNvidia(messages);
  return callGroq(messages);
}

export interface CreateAppOptions {
  /** Master on/off switch for both limiters below. Default true (secure by default) — tests that don't care about rate limiting pass false so their many rapid auth calls against one shared app aren't affected. */
  rateLimit?: boolean;
  /** Auth endpoints (signup+login share one limiter — see authLimiter below): attempts allowed per IP per window. Default 5. */
  authLimiterMax?: number;
  authLimiterWindowMs?: number;
  /** All other /api/* routes: requests allowed per IP per window. Default 100. */
  apiLimiterMax?: number;
  apiLimiterWindowMs?: number;
}

/**
 * Builds the Express app with every route mounted, but does not start listening,
 * spin up the Vite dev middleware, or start the folder-watcher — so it's safe to
 * import from tests (e.g. with supertest) without side effects or an open port.
 */
export function createApp(opts: CreateAppOptions = {}) {
  const {
    rateLimit: rateLimitEnabled = true,
    authLimiterMax = 5,
    authLimiterWindowMs = 15 * 60 * 1000,
    apiLimiterMax = 100,
    apiLimiterWindowMs = 60 * 1000,
  } = opts;

  const app = express();

  app.use(express.json({ limit: "2mb" }));

  // General abuse protection for every /api/* route (auth endpoints below sit
  // behind this AND the stricter authLimiter — layered, not a replacement).
  if (rateLimitEnabled) {
    app.use("/api", rateLimit({
      windowMs: apiLimiterWindowMs,
      max: apiLimiterMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many requests, please slow down and try again shortly" },
    }));
  }

  // Strict, shared budget across BOTH signup and login — an attacker switching
  // endpoints doesn't double their guessing budget.
  const authLimiter = rateLimitEnabled
    ? rateLimit({
        windowMs: authLimiterWindowMs,
        max: authLimiterMax,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: "Too many attempts, please try again in a few minutes" },
      })
    : (_req: Request, _res: Response, next: NextFunction) => next();

  // Signup
  app.post("/api/auth/signup", authLimiter, async (req, res) => {
    try {
      const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
      if (!name?.trim() || !email?.trim() || !password) {
        return res.status(400).json({ error: "name, email and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existing = db.prepare("SELECT id FROM restaurants WHERE email = ?").get(normalizedEmail);
      if (existing) return res.status(409).json({ error: "An account with this email already exists" });

      const id = randomUUID();
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      db.prepare(
        "INSERT INTO restaurants (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(id, name.trim(), normalizedEmail, passwordHash, new Date().toISOString());

      const accessToken = signAccessToken(id);
      const refreshToken = issueRefreshToken(id);
      res.json({ accessToken, refreshToken, restaurantId: id, name: name.trim(), email: normalizedEmail });
    } catch (err: any) {
      console.error("Signup error:", err.message);
      res.status(500).json({ error: err.message ?? "Signup failed" });
    }
  });

  // Login
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email?.trim() || !password) {
        return res.status(400).json({ error: "email and password are required" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const row = db.prepare("SELECT * FROM restaurants WHERE email = ?").get(normalizedEmail) as
        | RestaurantRow
        | undefined;
      if (!row) return res.status(401).json({ error: "Invalid email or password" });

      const valid = await bcrypt.compare(password, row.password_hash);
      if (!valid) return res.status(401).json({ error: "Invalid email or password" });

      const accessToken = signAccessToken(row.id);
      const refreshToken = issueRefreshToken(row.id);
      res.json({ accessToken, refreshToken, restaurantId: row.id, name: row.name, email: row.email });
    } catch (err: any) {
      console.error("Login error:", err.message);
      res.status(500).json({ error: err.message ?? "Login failed" });
    }
  });

  // Refresh — rotation, not reuse: the presented refresh token is revoked and a
  // brand-new one issued in the same request. Replaying an already-used (or
  // expired/revoked) refresh token is rejected.
  app.post("/api/auth/refresh", (req, res) => {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };
      if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });

      const tokenHash = hashToken(refreshToken);
      const row = db.prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?").get(tokenHash) as
        | RefreshTokenRow
        | undefined;
      if (!row) return res.status(401).json({ error: "Invalid refresh token" });
      if (row.revoked_at) return res.status(401).json({ error: "Refresh token has already been used or revoked" });
      if (new Date(row.expires_at).getTime() < Date.now()) return res.status(401).json({ error: "Refresh token has expired" });

      db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);

      const accessToken = signAccessToken(row.restaurant_id);
      const newRefreshToken = issueRefreshToken(row.restaurant_id);
      res.json({ accessToken, refreshToken: newRefreshToken, restaurantId: row.restaurant_id });
    } catch (err: any) {
      console.error("Refresh error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to refresh session" });
    }
  });

  // Logout — revokes the refresh token server-side so it can never be used
  // again, even if it leaks. Not behind requireAuth: the access token may
  // already be expired by the time the user clicks Logout, and revoking a
  // refresh token needs nothing but the token itself.
  app.post("/api/auth/logout", (req, res) => {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };
      if (refreshToken) {
        db.prepare(
          "UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL"
        ).run(new Date().toISOString(), hashToken(refreshToken));
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Logout error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to log out" });
    }
  });

  // ─── Billing (append-only from the client's point of view; restaurantId always from the verified JWT) ───

  app.get("/api/billing", requireAuth, (req: AuthedRequest, res) => {
    const rows = db.prepare("SELECT * FROM billing_entries WHERE restaurant_id = ?").all(req.restaurantId) as BillingEntryRow[];
    res.json(rows.map(rowToBillingEntry));
  });

  app.post("/api/billing", requireAuth, (req: AuthedRequest, res) => {
    try {
      const newEntries = req.body as BillingEntry[];
      if (!Array.isArray(newEntries)) return res.status(400).json({ error: "Expected an array of billing entries" });
      const { added, total } = insertBillingEntries(req.restaurantId!, newEntries);
      res.json({ added, total });
    } catch (err: any) {
      console.error("POST /api/billing error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to save billing data" });
    }
  });

  // Only reachable from Settings' Danger Zone — not used by any upload/import path.
  app.delete("/api/billing", requireAuth, (req: AuthedRequest, res) => {
    db.prepare("DELETE FROM billing_entries WHERE restaurant_id = ?").run(req.restaurantId);
    res.json({ ok: true });
  });

  // ─── Restaurant profile (onboarding identity/format/tracking/priorities) ───
  //
  // Previously localStorage-only, which meant "has this restaurant completed
  // onboarding" was a fact about the BROWSER, not the account — a fresh device,
  // a cleared localStorage, or a different browser would force a completed
  // account back through onboarding even though nothing about the account
  // itself was actually incomplete. Server-backed now, same pattern as menu:
  // one row per restaurant, upserted whole.

  app.get("/api/restaurant-profile", requireAuth, (req: AuthedRequest, res) => {
    const row = db.prepare("SELECT * FROM restaurant_profile WHERE restaurant_id = ?").get(req.restaurantId) as
      | RestaurantProfileRow
      | undefined;
    res.json(row ? JSON.parse(row.content) : null);
  });

  app.put("/api/restaurant-profile", requireAuth, (req: AuthedRequest, res) => {
    try {
      const restaurantId = req.restaurantId!;
      db.prepare(
        `INSERT INTO restaurant_profile (restaurant_id, content, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(restaurant_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`
      ).run(restaurantId, JSON.stringify(req.body ?? {}), new Date().toISOString());
      res.json({ ok: true });
    } catch (err: any) {
      console.error("PUT /api/restaurant-profile error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to save restaurant profile" });
    }
  });

  // ─── Menu (full-replace semantics — matches the existing "edit the whole table, Save" UX) ───

  app.get("/api/menu", requireAuth, (req: AuthedRequest, res) => {
    const rows = db.prepare("SELECT * FROM menu_items WHERE restaurant_id = ?").all(req.restaurantId) as MenuItemRow[];
    res.json(rows.map(rowToMenuItem));
  });

  app.put("/api/menu", requireAuth, (req: AuthedRequest, res) => {
    try {
      const items = req.body as MenuItem[];
      if (!Array.isArray(items)) return res.status(400).json({ error: "Expected an array of menu items" });
      const restaurantId = req.restaurantId!;

      const replace = db.transaction((menuItems: MenuItem[]) => {
        db.prepare("DELETE FROM menu_items WHERE restaurant_id = ?").run(restaurantId);
        const insert = db.prepare(
          "INSERT INTO menu_items (id, restaurant_id, name, selling_price, raw_material_cost, category) VALUES (?, ?, ?, ?, ?, ?)"
        );
        for (const item of menuItems) {
          insert.run(item.id || randomUUID(), restaurantId, item.name, item.sellingPrice, item.rawMaterialCost, item.category ?? null);
        }
      });
      replace(items);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("PUT /api/menu error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to save menu" });
    }
  });

  // ─── Test Data Generator ("Generate Next Day" testing tool — UploadPage's Testing
  // Tools section. Never used by any real import path; generates one plausible day
  // of sales for the restaurant's own locked menu (menu_items), so the team can
  // watch ML forecasts and Opportunity Engine recommendations evolve day by day
  // without waiting for real time to pass. A generated batch is held in-memory
  // until confirmed or discarded, then confirm reuses insertBillingEntries — the
  // exact same dedup/insert path a real CSV upload's rows go through. ───

  const GENERATION_TTL_MS = 30 * 60 * 1000; // 30 minutes — stale previews are swept, not accumulated forever
  const pendingGenerations = new Map<string, { restaurantId: string; entries: BillingEntry[]; createdAt: number }>();

  function sweepExpiredGenerations(): void {
    const now = Date.now();
    for (const [id, gen] of pendingGenerations) {
      if (now - gen.createdAt > GENERATION_TTL_MS) pendingGenerations.delete(id);
    }
  }

  app.post("/api/test-data/generate-next-day", requireAuth, (req: AuthedRequest, res) => {
    try {
      sweepExpiredGenerations();
      const restaurantId = req.restaurantId!;

      const menuRows = db.prepare("SELECT * FROM menu_items WHERE restaurant_id = ?").all(restaurantId) as MenuItemRow[];
      const menu = menuRows.map(rowToMenuItem);
      if (!menu.length) {
        return res.status(400).json({ error: "Set up this restaurant's menu before generating test data — there are no dishes to generate sales for." });
      }

      const billingRows = db.prepare("SELECT * FROM billing_entries WHERE restaurant_id = ?").all(restaurantId) as BillingEntryRow[];
      const billing = billingRows.map(rowToBillingEntry);

      const nextDate = determineNextDate(billing);
      const entries = generateNextDayEntries(menu, billing, nextDate);

      // One pending generation per restaurant at a time — a fresh generate discards any stale one.
      for (const [id, gen] of pendingGenerations) {
        if (gen.restaurantId === restaurantId) pendingGenerations.delete(id);
      }
      const requestId = randomUUID();
      pendingGenerations.set(requestId, { restaurantId, entries, createdAt: Date.now() });

      const totalOrders = entries.reduce((s, e) => s + e.quantity, 0);
      const totalRevenue = Math.round(entries.reduce((s, e) => s + e.quantity * e.sellingPrice, 0));
      res.json({ requestId, date: nextDate, totalOrders, totalRevenue, rowCount: entries.length });
    } catch (err: any) {
      console.error("generate-next-day error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to generate test data" });
    }
  });

  app.post("/api/test-data/confirm-next-day", requireAuth, (req: AuthedRequest, res) => {
    try {
      sweepExpiredGenerations();
      const { requestId } = req.body as { requestId?: string };
      if (!requestId) return res.status(400).json({ error: "requestId is required" });
      const restaurantId = req.restaurantId!;

      const pending = pendingGenerations.get(requestId);
      if (!pending || pending.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "No pending generation found for this request — it may have expired or already been resolved." });
      }
      pendingGenerations.delete(requestId);

      const { added, total } = insertBillingEntries(restaurantId, pending.entries);
      res.json({ added, total, entries: pending.entries });
    } catch (err: any) {
      console.error("confirm-next-day error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to import generated test data" });
    }
  });

  app.post("/api/test-data/discard-next-day", requireAuth, (req: AuthedRequest, res) => {
    const { requestId } = req.body as { requestId?: string };
    const restaurantId = req.restaurantId!;
    if (requestId) {
      const pending = pendingGenerations.get(requestId);
      if (pending && pending.restaurantId === restaurantId) pendingGenerations.delete(requestId);
    }
    res.json({ ok: true });
  });

  // ─── Reports (append-only, capped at 30 most recent per restaurant — matches old slice(0,30)) ───

  app.get("/api/reports", requireAuth, (req: AuthedRequest, res) => {
    const rows = db.prepare("SELECT * FROM reports WHERE restaurant_id = ? ORDER BY created_at DESC").all(req.restaurantId) as ReportRow[];
    res.json(rows.map(rowToReport));
  });

  app.post("/api/reports", requireAuth, (req: AuthedRequest, res) => {
    try {
      const report = req.body as Report;
      const restaurantId = req.restaurantId!;
      const content = JSON.stringify({ generatedAt: report.generatedAt, summary: report.summary, aiText: report.aiText });

      db.prepare(
        "INSERT INTO reports (id, restaurant_id, date, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(report.id || randomUUID(), restaurantId, report.date, report.type, content, report.generatedAt);

      const excess = db.prepare(
        "SELECT id FROM reports WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 30"
      ).all(restaurantId) as { id: string }[];
      if (excess.length) {
        const del = db.prepare("DELETE FROM reports WHERE id = ?");
        for (const row of excess) del.run(row.id);
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error("POST /api/reports error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to save report" });
    }
  });

  // Only reachable from Settings' Danger Zone.
  app.delete("/api/reports", requireAuth, (req: AuthedRequest, res) => {
    db.prepare("DELETE FROM reports WHERE restaurant_id = ?").run(req.restaurantId);
    res.json({ ok: true });
  });

  // ─── Opportunities (POST = full-replace, matching the old storage.setOpportunities(fullList)
  // contract — all scoring/dedup/expiry logic still lives client-side in opportunityEngine.ts;
  // PATCH = single-row status update for the Dashboard's Mark-as-Acted-On/Dismiss buttons) ───

  app.get("/api/opportunities", requireAuth, (req: AuthedRequest, res) => {
    const rows = db.prepare("SELECT * FROM opportunities WHERE restaurant_id = ?").all(req.restaurantId) as OpportunityRow[];
    res.json(rows.map(rowToOpportunity));
  });

  app.post("/api/opportunities", requireAuth, (req: AuthedRequest, res) => {
    try {
      const opportunities = req.body as Opportunity[];
      if (!Array.isArray(opportunities)) return res.status(400).json({ error: "Expected an array of opportunities" });
      const restaurantId = req.restaurantId!;

      const replace = db.transaction((items: Opportunity[]) => {
        db.prepare("DELETE FROM opportunities WHERE restaurant_id = ?").run(restaurantId);
        const insert = db.prepare(
          `INSERT INTO opportunities
            (id, restaurant_id, dish_name, signal_type, recommendation_text, projected_impact, confidence, status, created_date, resolved_date, outcome, acted_on_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const o of items) {
          insert.run(
            o.id || randomUUID(), restaurantId, o.dishName, o.signalType, o.recommendationText,
            o.projectedImpact, o.confidence, o.status, o.createdDate, o.resolvedDate, o.outcome, o.actedOnDate ?? null
          );
        }
      });
      replace(opportunities);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("POST /api/opportunities error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to save opportunities" });
    }
  });

  app.patch("/api/opportunities/:id", requireAuth, (req: AuthedRequest, res) => {
    try {
      const { status } = req.body as { status?: OpportunityStatus };
      if (!status) return res.status(400).json({ error: "status is required" });
      const restaurantId = req.restaurantId!;
      const today = new Date().toISOString().slice(0, 10);

      const result = db.prepare(
        `UPDATE opportunities SET status = ?, acted_on_date = CASE WHEN ? = 'acted_on' THEN ? ELSE acted_on_date END
         WHERE id = ? AND restaurant_id = ?`
      ).run(status, status, today, req.params.id, restaurantId);

      if (result.changes === 0) return res.status(404).json({ error: "Opportunity not found" });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("PATCH /api/opportunities/:id error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to update opportunity" });
    }
  });

  // ─── Forecast Accuracy Tracking (client generates predictions with the existing
  // WMA model and records them here; this endpoint just persists + aggregates) ───

  // Aggregated time series for the "Forecast Accuracy Over Time" chart: one point per
  // date that has at least one resolved (actual_value not null) row, averaged across dishes.
  app.get("/api/forecast-accuracy", requireAuth, (req: AuthedRequest, res) => {
    const rows = db.prepare(
      `SELECT date, AVG(absolute_error) as mae FROM forecast_accuracy
       WHERE restaurant_id = ? AND actual_value IS NOT NULL
       GROUP BY date ORDER BY date ASC`
    ).all(req.restaurantId) as { date: string; mae: number }[];
    const series: ForecastAccuracyPoint[] = rows.map(r => ({ date: r.date, mae: Math.round(r.mae * 100) / 100 }));
    res.json(series);
  });

  // Raw rows (including unresolved ones) — used client-side by forecastAccuracyEngine.ts
  // to find which stored forecasts are now due for backfill and which dates already
  // have a forecast on file (so a repeated run doesn't insert duplicates).
  app.get("/api/forecast-accuracy/raw", requireAuth, (req: AuthedRequest, res) => {
    const rows = db.prepare("SELECT * FROM forecast_accuracy WHERE restaurant_id = ?").all(req.restaurantId) as ForecastAccuracyRow[];
    res.json(rows.map(rowToForecastAccuracy));
  });

  app.post("/api/forecast-accuracy", requireAuth, (req: AuthedRequest, res) => {
    try {
      const { inserts, updates } = req.body as {
        inserts?: { date: string; dishName: string; predictedValue: number }[];
        updates?: { id: string; actualValue: number; absoluteError: number }[];
      };
      const restaurantId = req.restaurantId!;
      const now = new Date().toISOString();

      const run = db.transaction(() => {
        if (inserts?.length) {
          const insert = db.prepare(
            `INSERT INTO forecast_accuracy (id, restaurant_id, date, dish_name, predicted_value, actual_value, absolute_error, created_at)
             VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`
          );
          for (const i of inserts) insert.run(randomUUID(), restaurantId, i.date, i.dishName, i.predictedValue, now);
        }
        if (updates?.length) {
          const update = db.prepare(
            `UPDATE forecast_accuracy SET actual_value = ?, absolute_error = ? WHERE id = ? AND restaurant_id = ?`
          );
          for (const u of updates) update.run(u.actualValue, u.absoluteError, u.id, restaurantId);
        }
      });
      run();
      res.json({ ok: true });
    } catch (err: any) {
      console.error("POST /api/forecast-accuracy error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to sync forecast accuracy" });
    }
  });

  // ─── Trained Demand Model (GradientBoostingRegressor, runs alongside the WMA
  // baseline in forecasting.ts — does not replace it) ───

  // Manual retrain trigger — no scheduler yet.
  app.post("/api/forecast/train", requireAuth, async (req: AuthedRequest, res) => {
    const summary = await trainDemandModel(req.restaurantId!);
    if (!summary.ok) return res.status(422).json(summary);
    res.json(summary);
  });

  app.get("/api/forecast/compare", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const dish = req.query.dish as string | undefined;
      const date = req.query.date as string | undefined;
      if (!dish || !date) return res.status(400).json({ error: "dish and date query params are required" });
      const restaurantId = req.restaurantId!;

      const rows = db.prepare("SELECT * FROM billing_entries WHERE restaurant_id = ?").all(restaurantId) as BillingEntryRow[];
      const entries = rows.map(rowToBillingEntry);
      const wmaResult = runWMAForecast(entries, 7);
      const dishForecast = wmaResult.dishForecasts.find(d => d.dishName === dish);
      const wma = dishForecast?.forecasts.find(f => f.date === date)?.predicted ?? null;

      const predicted = await predictDemand(restaurantId, date, dish);
      const trainedModel = typeof predicted.predicted === "number" ? predicted.predicted : null;

      res.json({ wma, trainedModel, trainedModelStatus: predicted.error ?? null });
    } catch (err: any) {
      console.error("GET /api/forecast/compare error:", err.message);
      res.status(500).json({ error: err.message ?? "Failed to compare forecasts" });
    }
  });

  // Auto-import status (last file-watcher or manual-trigger result)
  app.get("/api/import/status", (_req, res) => {
    res.json(getLastStatus());
  });

  // Manual "Import Today's Sales" trigger — runs the same pipeline the folder watcher uses
  app.post("/api/import/trigger", async (_req, res) => {
    try {
      const status = await runImport();
      if (!status) {
        return res.json({ found: false, message: "No new export found in the watched folder." });
      }
      res.json({ found: true, status });
    } catch (err: any) {
      console.error("Manual import trigger error:", err.message);
      res.status(500).json({ error: err.message ?? "Import failed" });
    }
  });

  // Daily report / morning brief endpoint
  app.post("/api/ai/report", async (req, res) => {
    try {
      const { context } = req.body as { context: string };
      if (!context) return res.status(400).json({ error: "context is required" });

      const text = await callAI([{ role: "user", content: context }]);
      res.json({ text });
    } catch (err: any) {
      console.error("Report AI error:", err.message);
      res.status(500).json({ error: err.message ?? "AI call failed" });
    }
  });

  // Conversational analyst endpoint
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages } = req.body as { messages: { role: string; content: string }[] };
      if (!messages?.length) return res.status(400).json({ error: "messages is required" });

      const text = await callAI(messages);
      res.json({ text });
    } catch (err: any) {
      console.error("Chat AI error:", err.message);
      res.status(500).json({ error: err.message ?? "AI call failed" });
    }
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const PORT = 3000;

  watchIncoming(status => {
    console.log(
      status.success
        ? `Auto-imported ${status.filename}: ${status.rowsImported} rows`
        : `Auto-import failed for ${status.filename}: ${status.message}`
    );
  });

  // Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, response) => {
      response.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BusinessIQ server running on http://localhost:${PORT}`);
  });
}

// Only auto-start when run directly (`npx tsx server.ts`) — importing createApp()/requireAuth
// from tests must not also bind a port, start Vite, or start the folder watcher.
const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isMainModule) startServer();
