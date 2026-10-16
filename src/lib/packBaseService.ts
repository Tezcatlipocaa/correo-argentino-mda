import fs from "node:fs";
import path from "node:path";
import { ZipArchive } from "archiver";
import { db } from "@db/index";
import { applications } from "@db/schema";
import { eq, asc } from "drizzle-orm";
import { getAppsDir, ensureDir } from "@lib/storage";

export const PACK_BASE_ZIP_FILENAME = "pack-base-operatoria-mda.zip";

export interface PackBaseFileItem {
  id: number;
  title: string;
  diskPath: string;
  entryName: string;
  size: number;
  mtimeMs: number;
}

export interface PackBaseAppsInfo {
  items: PackBaseFileItem[];
  count: number;
  totalSizeBytes: number;
  maxMtimeMs: number;
}

export interface PackBaseResult {
  available: boolean;
  count: number;
  totalSize: number;
  zipPath: string | null;
}

let activeBuildPromise: Promise<PackBaseResult> | null = null;

export function cleanArchiveEntryName(rawName: string): string {
  const base = path.basename(rawName).trim();
  const withoutTimestamp = base.replace(/^\d+[-_]/, "");
  return withoutTimestamp || base;
}

export function isEligiblePackBaseApp(filePath: string | null | undefined): boolean {
  if (!filePath || typeof filePath !== "string") return false;
  const trimmed = filePath.trim().toLowerCase();
  if (trimmed === "") return false;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return false;
  return true;
}

export function resolveAppDiskPath(filePath: string, appsDir: string): string {
  const fileName = path.basename(filePath);
  return path.join(appsDir, fileName);
}

export function shouldRegenerateZip(zipPath: string, maxSourceMtimeMs: number): boolean {
  try {
    if (!fs.existsSync(zipPath)) return true;
    const stat = fs.statSync(zipPath);
    if (stat.size === 0) return true;
    return stat.mtimeMs < maxSourceMtimeMs;
  } catch {
    return true;
  }
}

const inFlightZipBuilds = new Map<string, Promise<{ success: boolean; size: number }>>();

export async function buildPackBaseZip(
  items: PackBaseFileItem[],
  targetZipPath: string,
): Promise<{ success: boolean; size: number }> {
  const existing = inFlightZipBuilds.get(targetZipPath);
  if (existing) {
    return existing;
  }

  const buildPromise = (async () => {
    const targetDir = path.dirname(targetZipPath);
    ensureDir(targetDir);

    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const tmpPath = `${targetZipPath}.tmp-${Date.now()}-${randomSuffix}`;

    return new Promise<{ success: boolean; size: number }>((resolve, reject) => {
      const output = fs.createWriteStream(tmpPath);
      const archive = new ZipArchive({
        zlib: { level: 6 },
      });

      output.on("close", () => {
        try {
          if (fs.existsSync(targetZipPath)) {
            fs.unlinkSync(targetZipPath);
          }
          fs.renameSync(tmpPath, targetZipPath);
          const finalStat = fs.statSync(targetZipPath);
          resolve({ success: true, size: finalStat.size });
        } catch (err) {
          reject(err);
        }
      });

      archive.on("error", (err: any) => {
        try {
          if (fs.existsSync(tmpPath)) {
            fs.unlinkSync(tmpPath);
          }
        } catch {
          // Ignorar limpieza de tmp
        }
        reject(err);
      });

      archive.pipe(output);

      for (const item of items) {
        archive.file(item.diskPath, { name: item.entryName });
      }

      archive.finalize();
    });
  })();

  inFlightZipBuilds.set(targetZipPath, buildPromise);
  try {
    return await buildPromise;
  } finally {
    inFlightZipBuilds.delete(targetZipPath);
  }
}

export async function getPackBaseApps(): Promise<PackBaseAppsInfo> {
  const appsDir = getAppsDir();
  const rows = await db
    .select({
      id: applications.id,
      title: applications.title,
      filePath: applications.filePath,
      inPackBase: applications.inPackBase,
    })
    .from(applications)
    .where(eq(applications.inPackBase, true))
    .orderBy(asc(applications.sortOrder), asc(applications.title));

  const items: PackBaseFileItem[] = [];
  let totalSizeBytes = 0;
  let maxMtimeMs = 0;

  for (const row of rows) {
    if (!isEligiblePackBaseApp(row.filePath)) continue;
    const diskPath = resolveAppDiskPath(row.filePath!, appsDir);
    if (!fs.existsSync(diskPath)) continue;

    try {
      const stat = fs.statSync(diskPath);
      if (stat.isFile() && stat.size > 0) {
        const entryName = cleanArchiveEntryName(row.filePath!);
        items.push({
          id: row.id,
          title: row.title,
          diskPath,
          entryName,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
        totalSizeBytes += stat.size;
        if (stat.mtimeMs > maxMtimeMs) {
          maxMtimeMs = stat.mtimeMs;
        }
      }
    } catch {
      // Ignorar archivos ilegibles
    }
  }

  return {
    items,
    count: items.length,
    totalSizeBytes,
    maxMtimeMs,
  };
}

export async function getPackBaseStatus(): Promise<{
  available: boolean;
  count: number;
  totalSizeBytes: number;
}> {
  try {
    const appsInfo = await getPackBaseApps();
    if (appsInfo.count === 0) {
      return { available: false, count: 0, totalSizeBytes: 0 };
    }
    const appsDir = getAppsDir();
    const zipPath = path.join(appsDir, PACK_BASE_ZIP_FILENAME);
    let size = appsInfo.totalSizeBytes;
    if (fs.existsSync(zipPath)) {
      try {
        const stat = fs.statSync(zipPath);
        if (stat.size > 0 && !shouldRegenerateZip(zipPath, appsInfo.maxMtimeMs)) {
          size = stat.size;
        }
      } catch {
        // Ignorar error al leer stat del zip
      }
    }
    return {
      available: true,
      count: appsInfo.count,
      totalSizeBytes: size,
    };
  } catch {
    return {
      available: false,
      count: 0,
      totalSizeBytes: 0,
    };
  }
}

export async function ensurePackBaseZip(): Promise<PackBaseResult> {
  if (activeBuildPromise) {
    return activeBuildPromise;
  }

  activeBuildPromise = (async () => {
    try {
      const appsInfo = await getPackBaseApps();
      if (appsInfo.count === 0) {
        return {
          available: false,
          count: 0,
          totalSize: 0,
          zipPath: null,
        };
      }

      const appsDir = getAppsDir();
      const zipPath = path.join(appsDir, PACK_BASE_ZIP_FILENAME);

      if (!shouldRegenerateZip(zipPath, appsInfo.maxMtimeMs)) {
        const stat = fs.statSync(zipPath);
        return {
          available: true,
          count: appsInfo.count,
          totalSize: stat.size,
          zipPath,
        };
      }

      const buildResult = await buildPackBaseZip(appsInfo.items, zipPath);
      return {
        available: true,
        count: appsInfo.count,
        totalSize: buildResult.size,
        zipPath,
      };
    } finally {
      activeBuildPromise = null;
    }
  })();

  return activeBuildPromise;
}
