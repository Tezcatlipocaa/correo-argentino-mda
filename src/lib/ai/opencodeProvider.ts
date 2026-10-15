import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AiProvider } from "./types.js";

const env = (k: string) =>
  process.env[k] ?? (import.meta.env as Record<string, string | undefined> | undefined)?.[k];

function killProcessTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === "win32") {
    try {
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      // Ignorar fallo al forzar cierre
    }
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {}
    }
  }
}

export function extractModelText(stdout: string): string {
  let text = "";
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("{")) continue;
    try {
      const ev = JSON.parse(line);
      if (ev?.type === "text") {
        if (typeof ev.part?.text === "string") {
          text += ev.part.text;
        } else if (typeof ev.part === "string") {
          text += ev.part;
        }
      }
    } catch {
      // Línea no parseable como evento
    }
  }
  return text;
}

export class OpenCodeProvider implements AiProvider {
  name: string;
  private model: string;
  private timeoutMs: number;

  constructor(model?: string, timeoutMs?: number) {
    this.model = model || env("OPENCODE_MODEL") || "opencode/nemotron-3.5-lightning-free";
    this.name = `opencode:${this.model}`;
    this.timeoutMs = timeoutMs || Number(env("OPENCODE_TIMEOUT_MS")) || 120_000;
  }

  async evaluate(prompt: string): Promise<string> {
    const bin = env("OPENCODE_BIN") || "opencode";
    const dir = path.join(tmpdir(), "mda-ai");
    const file = path.join(dir, `${randomUUID()}.txt`);
    const message = "Segui las instrucciones del archivo adjunto y responde solo con el JSON pedido.";

    await mkdir(dir, { recursive: true });
    await writeFile(file, prompt, "utf8");

    try {
      const isWin = process.platform === "win32";
      // En Windows spawn directo con shell o cmd.exe
      const args = ["run", "--standalone", "--model", this.model, "--format", "json", "--file", file, message];

      const child = spawn(bin, args, {
        cwd: dir,
        shell: isWin,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      return await new Promise<string>((resolve, reject) => {
        let out = "";
        let err = "";
        const timer = setTimeout(() => {
          killProcessTree(child.pid);
          reject(new Error(`OpenCode no respondió en ${Math.round(this.timeoutMs / 1000)}s`));
        }, this.timeoutMs);

        child.stdout?.on("data", (d) => (out += d));
        child.stderr?.on("data", (d) => (err += d));
        child.on("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (code !== 0) {
            return reject(new Error(`OpenCode finalizó con código ${code}: ${err.slice(0, 300)}`));
          }
          const modelText = extractModelText(out);
          if (!modelText.trim()) {
            return reject(new Error("OpenCode no devolvió texto de respuesta."));
          }
          resolve(modelText);
        });
      });
    } finally {
      unlink(file).catch(() => {});
    }
  }
}
