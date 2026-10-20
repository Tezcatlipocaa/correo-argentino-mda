import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
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

export function extractModelError(stdout: string, stderr: string): string {
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("{")) continue;
    try {
      const ev = JSON.parse(line);
      if (ev?.type === "error") {
        const msg = ev.error?.message || ev.message;
        if (typeof msg === "string" && msg.trim()) {
          return msg.trim();
        }
      }
    } catch {
      // Línea no parseable como evento
    }
  }
  const fallback = (stderr || stdout).trim();
  return fallback ? fallback.slice(0, 300) : "Error desconocido de OpenCode";
}

export function resolveOpenCodeBin(): { command: string; argsPrefix: string[]; shell: boolean } {
  const custom = env("OPENCODE_BIN");
  if (custom) return { command: custom, argsPrefix: [], shell: false };
  if (process.platform === "win32") {
    const npmExe = path.join(process.env.APPDATA || "", "npm", "node_modules", "@opencode", "cli", "bin", "opencode.exe");
    if (existsSync(npmExe)) {
      return { command: npmExe, argsPrefix: [], shell: false };
    }
    return { command: "cmd.exe", argsPrefix: ["/d", "/s", "/c", "opencode.cmd"], shell: false };
  }
  return { command: "opencode", argsPrefix: [], shell: false };
}

export const FALLBACK_MODELS = [
  "opencode/deepseek-v4.1-flash-free",
  "opencode/mimo-v2.6-flash-free",
  "opencode/glm-5.3-flash-free",
] as const;

export function getFallbackModels(currentModel: string): string[] {
  return FALLBACK_MODELS.filter((m) => m !== currentModel);
}

export class OpenCodeProvider implements AiProvider {
  name: string;
  private model: string;
  private timeoutMs: number;

  constructor(model?: string, timeoutMs?: number) {
    this.model = model || env("OPENCODE_MODEL") || "opencode/nemotron-3.5-lightning-free";
    this.name = `opencode:${this.model}`;
    this.timeoutMs = timeoutMs || Number(env("OPENCODE_TIMEOUT_MS")) || 180_000;
  }

  private async runWithModel(modelToUse: string, prompt: string): Promise<string> {
    const binInfo = resolveOpenCodeBin();
    const runId = randomUUID();
    const dir = path.join(tmpdir(), "mda-ai", runId);
    const isolatedDataDir = path.join(dir, "data");
    const file = path.join(dir, "prompt.txt");
    const message = "Segui las instrucciones del archivo adjunto y responde solo con el JSON pedido.";

    await mkdir(dir, { recursive: true });
    await mkdir(isolatedDataDir, { recursive: true });
    await writeFile(file, prompt, "utf8");

    const customApiKey = env("OPENCODE_API_KEY");
    if (customApiKey) {
      const opencodeDataDir = path.join(isolatedDataDir, "opencode");
      await mkdir(opencodeDataDir, { recursive: true });
      await writeFile(
        path.join(opencodeDataDir, "auth.json"),
        JSON.stringify({ opencode: { type: "api", key: customApiKey } }),
        "utf8",
      );
    }

    try {
      const cfgPath = path.join(dir, "opencode.json");
      await writeFile(
        cfgPath,
        JSON.stringify({
          $schema: "https://opencode.ai/config.json",
          plugin: [],
          plugins: [],
          mcp: {},
          lsp: false,
        }),
        "utf8",
      );

      const args = [
        ...binInfo.argsPrefix,
        "run",
        "--standalone",
        "--model",
        modelToUse,
        "--format",
        "json",
        "--file",
        file,
        message,
      ];

      const child = spawn(binInfo.command, args, {
        cwd: dir,
        shell: binInfo.shell,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: {
          ...process.env,
          OPENCODE_CONFIG: cfgPath,
          OPENCODE_CONFIG_DIR: dir,
          XDG_DATA_HOME: isolatedDataDir,
          OPENCODE_DISABLE_PROJECT_CONFIG: "true",
          OPENCODE_DISABLE_CLAUDE_CODE: "true",
          OPENCODE_DISABLE_CLAUDE_CODE_SKILLS: "true",
        },
      });

      return await new Promise<string>((resolve, reject) => {
        let out = "";
        let err = "";
        const timer = setTimeout(() => {
          killProcessTree(child.pid);
          reject(new Error(`OpenCode demoró más de ${Math.round(this.timeoutMs / 1000)}s en responder.`));
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
            const errDetail = extractModelError(out, err);
            return reject(new Error(`OpenCode finalizó con código ${code}: ${errDetail}`));
          }
          const modelText = extractModelText(out);
          if (!modelText.trim()) {
            return reject(new Error("OpenCode no devolvió texto de respuesta."));
          }
          resolve(modelText);
        });
      });
    } finally {
      rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }


  async evaluate(prompt: string): Promise<string> {
    const candidates = [this.model, ...getFallbackModels(this.model)];
    let lastError: unknown = null;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      try {
        const res = await this.runWithModel(candidate, prompt);
        this.name = `opencode:${candidate}`;
        return res;
      } catch (err) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[OpenCodeProvider] Falló modelo '${candidate}' (${errMsg}). ${i < candidates.length - 1 ? "Reintentando con fallback..." : "No quedan fallbacks."}`);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`OpenCode falló tras reintentar con los modelos disponibles: ${String(lastError)}`);
  }
}

