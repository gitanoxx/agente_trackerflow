import { GoogleGenAI } from "@google/genai";
import { SUMMARY_PROMPT, TRACKERFLOW_PROMPT } from "./prompt.js";

function toGeminiHistory(messages) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.text }]
  }));
}

export class GeminiAgent {
  constructor({ apiKey, model }) {
    this.model = model;
    this.fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.6-flash";
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  get configured() {
    return Boolean(this.client);
  }

  async generate(request) {
    const models = [...new Set([this.model, this.fallbackModel])];
    let lastError;
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          return await this.client.models.generateContent({ ...request, model });
        } catch (error) {
          lastError = error;
          if (error.status !== 503) throw error;
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }
    }
    throw lastError;
  }

  async reply(messages) {
    if (!this.client) throw new Error("GEMINI_API_KEY no está configurada");
    const response = await this.generate({
      contents: toGeminiHistory(messages),
      config: {
        systemInstruction: TRACKERFLOW_PROMPT,
        temperature: 0.25,
        maxOutputTokens: 500
      }
    });
    const text = response.text?.trim();
    if (!text) throw new Error("Gemini no devolvió una respuesta de texto");
    return text;
  }

  async summarize(messages) {
    if (!this.client) throw new Error("GEMINI_API_KEY no está configurada");
    const transcript = messages.map((m) => `${m.role === "assistant" ? "TRACKERFLOW" : "CLIENTE"}: ${m.text}`).join("\n");
    const response = await this.generate({
      contents: `${SUMMARY_PROMPT}\n\nCONVERSACIÓN:\n${transcript}`,
      config: { temperature: 0.1, maxOutputTokens: 600 }
    });
    const text = response.text?.trim();
    if (!text) throw new Error("Gemini no devolvió un resumen");
    return text;
  }
}
