import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" }); // fallback
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { db } from "./db.ts";
import type { RestaurantRow } from "./db.ts";
import { runImport, getLastStatus, watchIncoming } from "./importPipeline.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = 10;

interface AuthedRequest extends Request {
  restaurantId?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
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

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  watchIncoming(status => {
    console.log(
      status.success
        ? `Auto-imported ${status.filename}: ${status.rowsImported} rows`
        : `Auto-import failed for ${status.filename}: ${status.message}`
    );
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

startServer();
