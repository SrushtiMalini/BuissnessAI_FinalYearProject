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
import { randomUUID } from "crypto";
import { db } from "./db.ts";
import type { RestaurantRow, BillingEntryRow, MenuItemRow, ReportRow, OpportunityRow } from "./db.ts";
import { runImport, getLastStatus, watchIncoming } from "./importPipeline.ts";
import type {
  BillingEntry, MenuItem, Report, Opportunity, OpportunitySignalType, OpportunityStatus,
} from "./src/types/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = 10;

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

/**
 * Builds the Express app with every route mounted, but does not start listening,
 * spin up the Vite dev middleware, or start the folder-watcher — so it's safe to
 * import from tests (e.g. with supertest) without side effects or an open port.
 */
export function createApp() {
  const app = express();

  app.use(express.json({ limit: "2mb" }));

  function signToken(restaurantId: string): string {
    if (!JWT_SECRET) throw new Error("JWT_SECRET is not configured on the server.");
    return jwt.sign({ restaurantId }, JWT_SECRET, { expiresIn: "30d" });
  }

  // Signup
  app.post("/api/auth/signup", async (req, res) => {
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

      const token = signToken(id);
      res.json({ token, restaurantId: id, name: name.trim(), email: normalizedEmail });
    } catch (err: any) {
      console.error("Signup error:", err.message);
      res.status(500).json({ error: err.message ?? "Signup failed" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
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

      const token = signToken(row.id);
      res.json({ token, restaurantId: row.id, name: row.name, email: row.email });
    } catch (err: any) {
      console.error("Login error:", err.message);
      res.status(500).json({ error: err.message ?? "Login failed" });
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
      const restaurantId = req.restaurantId!;

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
