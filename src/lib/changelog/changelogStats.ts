import { execFileSync } from "node:child_process";

export interface ChangelogStats {
  additions: number;
  deletions: number;
  estimatedHours: number;
  formattedHours: string;
}

/**
 * Parsea la salida de `git show --numstat` sumando adiciones y eliminaciones.
 * Ignora líneas de archivos binarios ("- - path") y líneas vacías.
 */
export function parseNumstatOutput(output: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  const lines = output.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const addedStr = parts[0];
      const deletedStr = parts[1];

      // Los archivos binarios muestran '-' en vez de un número
      if (addedStr !== "-" && deletedStr !== "-") {
        const a = parseInt(addedStr, 10);
        const d = parseInt(deletedStr, 10);
        if (!Number.isNaN(a)) additions += a;
        if (!Number.isNaN(d)) deletions += d;
      }
    }
  }

  return { additions, deletions };
}

/**
 * Algoritmo de clustering de sesiones de trabajo sobre timestamps de commits (en segundos unix):
 * - Base por sesión iniciada o commit aislado: 30 minutos (1800 s).
 * - Commits con diferencia <= 2 horas (7200 s) se suman a la sesión actual como tiempo real.
 * - Commits con diferencia > 2 horas cierran la sesión y abren una nueva con 30 minutos base.
 */
export function estimateWorkHoursFromTimestamps(timestamps: number[]): {
  estimatedHours: number;
  formattedHours: string;
} {
  if (!timestamps || timestamps.length === 0) {
    return { estimatedHours: 0, formattedHours: "0.0 h" };
  }

  const sorted = [...timestamps].sort((a, b) => a - b);
  const SESSION_THRESHOLD_SEC = 2 * 60 * 60; // 2 horas
  const BASE_SESSION_SEC = 30 * 60; // 30 minutos

  let totalSeconds = BASE_SESSION_SEC;

  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i] - sorted[i - 1];
    if (delta <= 0) {
      continue;
    }

    if (delta <= SESSION_THRESHOLD_SEC) {
      totalSeconds += delta;
    } else {
      totalSeconds += BASE_SESSION_SEC;
    }
  }

  const hours = totalSeconds / 3600;
  const rounded = Math.round(hours * 10) / 10;
  const formattedHours = `${rounded.toFixed(1)} h`;

  return {
    estimatedHours: rounded,
    formattedHours,
  };
}

/**
 * Calcula las estadísticas de numstat y clustering de horas para un conjunto de hashes de commit.
 * Maneja excepciones de forma fail-safe devolviendo estadísticas en cero si git no está disponible.
 */
export function calculateCommitsStats(commits: string[]): ChangelogStats {
  const fallback: ChangelogStats = {
    additions: 0,
    deletions: 0,
    estimatedHours: 0,
    formattedHours: "0.0 h",
  };

  if (!commits || commits.length === 0) {
    return fallback;
  }

  const validCommits = commits.map((c) => c.trim()).filter((c) => c.length >= 7);
  if (validCommits.length === 0) {
    return fallback;
  }

  let totalAdditions = 0;
  let totalDeletions = 0;
  const timestamps: number[] = [];

  for (const hash of validCommits) {
    try {
      // 1. Obtener timestamp del commit (%ct = committer timestamp unix)
      const timeOut = execFileSync("git", ["log", "-1", "--format=%ct", hash], {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf-8",
      }).trim();

      const ct = parseInt(timeOut, 10);
      if (!Number.isNaN(ct)) {
        timestamps.push(ct);
      }

      // 2. Obtener numstat de adiciones y eliminaciones
      const statOut = execFileSync("git", ["show", "--numstat", "--format=", hash], {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf-8",
      });

      const { additions, deletions } = parseNumstatOutput(statOut);
      totalAdditions += additions;
      totalDeletions += deletions;
    } catch {
      // Si el commit no existe en el clon local o git falla, se omite silenciosamente
      continue;
    }
  }

  const { estimatedHours, formattedHours } = estimateWorkHoursFromTimestamps(timestamps);

  return {
    additions: totalAdditions,
    deletions: totalDeletions,
    estimatedHours,
    formattedHours,
  };
}
