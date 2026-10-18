import test from "node:test";
import assert from "node:assert/strict";
import {
  transcribeAudioWithGroq,
  isAllowedAudioHost,
  validateAudioBuffer,
  MAX_GROQ_AUDIO_BYTES,
} from "./groqWhisper.js";

test("isAllowedAudioHost: valida dominios permitidos de Wise CX y S3", () => {
  assert.equal(isAllowedAudioHost("https://my-bucket.s3.amazonaws.com/call-123.mp3"), true);
  assert.equal(isAllowedAudioHost("https://recordings.wisecx.com/audio/call-456.mp3"), true);
  assert.equal(isAllowedAudioHost("https://s3-sa-east-1.amazonaws.com/wisecx/audio.mp3"), true);

  // Dominios maliciosos o no autorizados
  assert.equal(isAllowedAudioHost("https://evil.com/audio.mp3"), false);
  assert.equal(isAllowedAudioHost("https://wisecx.com.attacker.com/audio.mp3"), false);
  assert.equal(isAllowedAudioHost("http://localhost:8080/audio.mp3"), false);
  assert.equal(isAllowedAudioHost("not-a-url"), false);
});

test("validateAudioBuffer: rechaza buffers vacíos o superiores a 25MB", () => {
  assert.throws(
    () => validateAudioBuffer(Buffer.alloc(0)),
    /Buffer de audio vacío/i,
  );

  const oversized = Buffer.alloc(MAX_GROQ_AUDIO_BYTES + 10);
  assert.throws(
    () => validateAudioBuffer(oversized),
    /excede el límite de 25MB/i,
  );

  assert.doesNotThrow(() => validateAudioBuffer(Buffer.from("dummy-audio-bytes")));
});

test("transcribeAudioWithGroq: lanza error si GROQ_API_KEY no está configurada", async () => {
  await assert.rejects(
    async () => transcribeAudioWithGroq(Buffer.from("audio-bytes"), { apiKey: "" }),
    /GROQ_API_KEY no está configurada/i,
  );
});

test("transcribeAudioWithGroq: envía multipart form-data a Groq y procesa respuesta exitosa", async () => {
  process.env.GROQ_API_KEY = "gsk_test_key_12345";
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(url.toString(), "https://api.groq.com/openai/v1/audio/transcriptions");
      assert.equal(init?.method, "POST");
      const authHeader = (init?.headers as Record<string, string>)?.["Authorization"];
      assert.equal(authHeader, "Bearer gsk_test_key_12345");

      return new Response(JSON.stringify({ text: "Operador: Buenas tardes Correo Argentino." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any;

    const result = await transcribeAudioWithGroq(Buffer.from("valid-mp3-audio"));
    assert.equal(result.text, "Operador: Buenas tardes Correo Argentino.");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GROQ_API_KEY;
  }
});

test("transcribeAudioWithGroq: maneja error de cuota o rate limit de Groq (429)", async () => {
  process.env.GROQ_API_KEY = "gsk_test_key_12345";
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: { message: "Rate limit exceeded" } }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }) as any;

    await assert.rejects(
      async () => transcribeAudioWithGroq(Buffer.from("valid-mp3-audio")),
      /Error en API de Groq \(429\): Rate limit exceeded/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GROQ_API_KEY;
  }
});
