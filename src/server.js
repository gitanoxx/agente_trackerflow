import "./load-env.js";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ConversationStore } from "./store.js";
import { GeminiAgent } from "./gemini.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(root, "public");
const store = new ConversationStore(join(root, "data", "conversations.json"));
await store.init();

const agent = new GeminiAgent({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || "gemini-3.8-flash"
});

const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20_000) throw new Error("Solicitud demasiado grande");
  }
  return raw ? JSON.parse(raw) : {};
}

async function api(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true, geminiConfigured: agent.configured, model: agent.model });
  }
  if (req.method === "GET" && url.pathname === "/api/conversations") return json(res, 200, store.list());
  if (req.method === "POST" && url.pathname === "/api/conversations") return json(res, 201, await store.create());

  const match = url.pathname.match(/^\/api\/conversations\/([a-f0-9-]+)(?:\/(messages|summary))?$/);
  if (!match) return json(res, 404, { error: "Ruta no encontrada" });
  const conversation = store.get(match[1]);
  if (!conversation) return json(res, 404, { error: "Conversación no encontrada" });

  if (req.method === "GET" && !match[2]) return json(res, 200, conversation);

  if (req.method === "POST" && match[2] === "messages") {
    const input = await body(req);
    const message = typeof input.message === "string" ? input.message.trim() : "";
    if (!message) return json(res, 400, { error: "El mensaje es obligatorio" });
    if (message.length > 4000) return json(res, 400, { error: "El mensaje supera los 4000 caracteres" });
    await store.addMessage(conversation.id, "user", message);
    const reply = await agent.reply(conversation.messages);
    await store.addMessage(conversation.id, "assistant", reply);
    return json(res, 200, { reply, conversation });
  }

  if (req.method === "POST" && match[2] === "summary") {
    if (!conversation.messages.length) return json(res, 400, { error: "La conversación está vacía" });
    const summary = await agent.summarize(conversation.messages);
    await store.setSummary(conversation.id, summary);
    return json(res, 200, { summary });
  }

  return json(res, 405, { error: "Método no permitido" });
}

async function whatsappWebhook(req, res, url) {
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = process.env.META_VERIFY_TOKEN;
    if (mode === "subscribe" && expected && token === expected) {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      return res.end(challenge || "");
    }
    return json(res, 403, { error: "Verificación de Meta rechazada" });
  }

  if (req.method === "POST") {
    const payload = await body(req);
    // En la siguiente etapa validaremos la firma y procesaremos los mensajes.
    console.log("Evento de WhatsApp recibido", JSON.stringify(payload));
    return json(res, 200, { received: true });
  }

  return json(res, 405, { error: "Método no permitido" });
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/webhooks/whatsapp") return await whatsappWebhook(req, res, url);
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (relative.includes("..")) return json(res, 400, { error: "Ruta inválida" });
    const file = await readFile(join(publicDir, relative));
    res.writeHead(200, { "content-type": mime[extname(relative)] || "application/octet-stream" });
    res.end(file);
  } catch (error) {
    const status = error.code === "ENOENT" ? 404 : error.message.includes("GEMINI_API_KEY") ? 503 : 500;
    json(res, status, { error: status === 500 ? "No fue posible procesar la solicitud" : error.message });
    if (status === 500) console.error(error);
  }
}

const port = Number(process.env.PORT || 3100);
createServer(handler).listen(port, "127.0.0.1", () => {
  console.log(`Trackerflow Agent disponible en http://127.0.0.1:${port}`);
  if (!agent.configured) console.log("Modo sin IA: configura GEMINI_API_KEY en .env");
});
