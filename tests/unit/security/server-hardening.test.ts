import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { RATE_LIMITS } from "../../../src/lib/rateLimit";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const PORT = 4451;
let server: ChildProcess | null = null;

async function waitReady(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/login`);
      if (res.status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("server.mjs no levantó");
}

const loginOnce = async (ip: string) => {
  const res = await fetch(`http://127.0.0.1:${PORT}/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": ip,
    },
    body: "username=x&password=x",
  });
  const location = res.headers.get("location") ?? "";
  return { status: res.status, location };
};

beforeAll(async () => {
  if (!existsSync(path.join(ROOT, "dist", "server", "entry.mjs"))) {
    throw new Error("Falta dist/: correr `npm run build` antes de este test");
  }
  server = spawn(process.execPath, ["server.mjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1" },
    stdio: "ignore",
  });
  await waitReady();
}, 60000);

afterAll(() => {
  server?.kill();
});

describe("hardening de server.mjs (#235)", () => {
  it("no expone X-Powered-By", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/login`);
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("el rate limit de login usa la IP real de X-Forwarded-For", async () => {
    const limit = RATE_LIMITS.login.limit;
    let throttledAt = -1;
    for (let i = 0; i < limit + 1; i++) {
      const { location } = await loginOnce("203.0.113.9");
      if (location.includes("Demasiados")) throttledAt = i;
    }
    expect(throttledAt).toBe(limit);

    // Otra IP no hereda el corte.
    const other = await loginOnce("203.0.113.10");
    expect(other.location).not.toContain("Demasiados");
  }, 90000);
});
