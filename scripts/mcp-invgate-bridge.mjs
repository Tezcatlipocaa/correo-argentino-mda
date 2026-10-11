import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = resolve(ROOT, ".env");
const MCP_URL = "https://qacorreo.sd.cloud.invgate.net/mcp/v1";
const PROTOCOL_VERSION = "2025-06-18";

function readToken() {
  const fromEnv = process.env.INVGATE_MCP_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (!existsSync(ENV_PATH)) throw new Error("INVGATE_MCP_TOKEN not set and no .env at " + ENV_PATH);
  const line = readFileSync(ENV_PATH, "utf8")
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith("INVGATE_MCP_TOKEN="));
  if (!line) throw new Error("INVGATE_MCP_TOKEN missing from .env");
  return line
    .slice(line.indexOf("=") + 1)
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

const TOKEN = readToken();
let sessionId = null;

function write(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function parseSse(text) {
  const out = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("");
    if (data) {
      try {
        out.push(JSON.parse(data));
      } catch {
        /* ignore non-JSON frames */
      }
    }
  }
  return out;
}

async function handle(msg) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${TOKEN}`,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await fetch(MCP_URL, { method: "POST", headers, body: JSON.stringify(msg) });

  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;

  const text = await res.text();
  if (!text) {
    if (res.ok) return [];
    return [{ jsonrpc: "2.0", id: msg.id ?? null, error: { code: res.status, message: `HTTP ${res.status}: ${text.slice(0, 300)}` } }];
  }

  const ct = res.headers.get("content-type") || "";
  const frames = ct.includes("text/event-stream") ? parseSse(text) : safeJson(text);
  const messages = Array.isArray(frames) ? frames : [frames];

  if (!res.ok) {
    return [
      {
        jsonrpc: "2.0",
        id: msg.id ?? null,
        error: { code: res.status, message: `HTTP ${res.status}: ${text.slice(0, 300)}` },
      },
    ];
  }
  return messages;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { jsonrpc: "2.0", id: null, error: { code: -32700, message: text.slice(0, 300) } };
  }
}

let queue = Promise.resolve();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  for (const line of chunk.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      continue;
    }
    queue = queue
      .then(() => handle(msg))
      .then((msgs) => msgs.forEach(write))
      .catch((err) => {
        if (msg.id !== undefined) {
          write({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: String(err?.message || err) } });
        }
      });
  }
});
process.stdin.on("end", () => {
  queue.then(() => process.exit(0));
});
