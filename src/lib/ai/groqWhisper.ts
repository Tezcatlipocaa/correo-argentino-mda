import fs from "node:fs";
import path from "node:path";

export const MAX_GROQ_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB
const GROQ_TRANSCRIPTION_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";

/**
 * Resuelve la clave de API de Groq desde process.env, import.meta.env o leyendo .env de disco.
 */
export function getGroqApiKey(): string {
  const envKey = (import.meta.env?.GROQ_API_KEY || process.env.GROQ_API_KEY)?.trim();
  if (envKey) return envKey;
  try {
    const envFile = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, "utf-8");
      const match = content.match(/^GROQ_API_KEY=["']?([^"'\r\n]+)["']?/m);
      if (match?.[1]) {
        process.env.GROQ_API_KEY = match[1].trim();
        return match[1].trim();
      }
    }
  } catch {
    // Continuar sin fallback
  }
  return "";
}

/**
 * Valida que la URL de audio provenga exclusivamente de S3 o de Wise CX (evita SSRF).
 */
export function isAllowedAudioHost(audioUrl: string): boolean {
  if (!audioUrl || typeof audioUrl !== "string") return false;
  try {
    const parsed = new URL(audioUrl);
    if (parsed.protocol !== "https:") return false;
    return (
      parsed.hostname.endsWith(".amazonaws.com") ||
      parsed.hostname.endsWith(".wisecx.com") ||
      parsed.hostname.includes("s3")
    );
  } catch {
    return false;
  }
}

/**
 * Valida tamaño e integridad mínima del buffer de audio.
 */
export function validateAudioBuffer(buffer: Buffer | Uint8Array): void {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error("Buffer de audio vacío o inválido.");
  }
  if (buffer.byteLength > MAX_GROQ_AUDIO_BYTES) {
    throw new Error(
      `El archivo de audio (${(buffer.byteLength / (1024 * 1024)).toFixed(1)}MB) excede el límite de 25MB de Groq.`,
    );
  }
}

/**
 * Descarga el audio desde la URL de Wise CX / S3 con validaciones de seguridad.
 */
export async function fetchAudioBuffer(audioUrl: string): Promise<Buffer> {
  if (!isAllowedAudioHost(audioUrl)) {
    throw new Error(`Host de audio no permitido o inseguro: ${audioUrl}`);
  }

  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Error al descargar grabación de audio: HTTP ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  validateAudioBuffer(buffer);
  return buffer;
}

export interface GroqTranscriptionOptions {
  filename?: string;
  mimeType?: string;
  prompt?: string;
  apiKey?: string;
}

/**
 * Transcribe un archivo de audio utilizando la API Whisper de Groq (whisper-large-v3).
 */
export async function transcribeAudioWithGroq(
  audioBuffer: Buffer | Uint8Array,
  options?: GroqTranscriptionOptions,
): Promise<{ text: string }> {
  const apiKey = (options?.apiKey !== undefined ? options.apiKey : getGroqApiKey())?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY no está configurada en las variables de entorno.");
  }

  validateAudioBuffer(audioBuffer);

  const filename = options?.filename || "audio.mp3";
  const mimeType = options?.mimeType || "audio/mpeg";

  // Crear FormData estándar para multipart/form-data
  const formData = new FormData();
  const fileBlob = new Blob([audioBuffer], { type: mimeType });
  formData.append("file", fileBlob, filename);
  formData.append("model", "whisper-large-v3");
  formData.append("language", "es");
  formData.append("response_format", "json");

  if (options?.prompt?.trim()) {
    formData.append("prompt", options.prompt.trim());
  }

  const response = await fetch(GROQ_TRANSCRIPTION_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let errorMsg = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed?.error?.message) {
        errorMsg = parsed.error.message;
      }
    } catch {
      // Usar texto crudo
    }
    throw new Error(`Error en API de Groq (${response.status}): ${errorMsg}`);
  }

  const result = (await response.json()) as { text?: string };
  return {
    text: (result.text || "").trim(),
  };
}
