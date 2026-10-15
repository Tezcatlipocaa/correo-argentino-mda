import type { AiProvider } from "./types.js";

const env = (k: string) =>
  process.env[k] ?? (import.meta.env as Record<string, string | undefined> | undefined)?.[k];

export class GeminiProvider implements AiProvider {
  name: string;
  private apiKey: string;
  private model: string;
  endpointUrl: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? env("GEMINI_API_KEY") ?? "";
    this.model = model ?? env("GEMINI_MODEL") ?? "gemini-2.5-flash-lite";
    this.name = `gemini:${this.model}`;
    this.endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
  }

  async evaluate(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY no configurada. Agregala a .env para utilizar el proveedor de Gemini.");
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    };

    const res = await fetch(this.endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
      throw new Error("Google Gemini API no devolvió contenido de texto.");
    }

    return candidate;
  }
}
