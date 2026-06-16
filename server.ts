import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" }); // fallback
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "minimaxai/minimax-m3";

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "2mb" }));

  // Daily report / morning brief endpoint
  app.post("/api/ai/report", async (req, res) => {
    try {
      const { context } = req.body as { context: string };
      if (!context) return res.status(400).json({ error: "context is required" });

      const text = await callNvidia([{ role: "user", content: context }]);
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

      const text = await callNvidia(messages);
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
