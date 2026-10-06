import type { APIRoute } from "astro";
import { eq, inArray } from "drizzle-orm";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { can } from "@lib/roleConfig";
import { jsonResponse, jsonError, sanitizeError } from "@lib/apiResponse";
import { db } from "@db/index";
import { offices } from "@db/schema";
import { logAdminFromAstro } from "@lib/auditLogger";
import { normalizeSearchValue } from "@lib/clientSearch";
import { z } from "zod";

const payloadSchema = z.object({
  groups: z
    .array(
      z.object({
        key: z.string().min(1),
        canonical: z.string().trim().min(3).max(255),
      }),
    )
    .min(1)
    .max(100),
});

/**
 * Backup WAL-safe del archivo SQLite antes de una escritura masiva.
 * Reutiliza el mismo destino que scripts/backup-db.bat (database/backups/).
 */
async function backupDatabase(): Promise<string> {
  const dbPath = path.resolve(process.cwd(), "database", "mda.db");
  const backupDir = path.resolve(process.cwd(), "database", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(backupDir, `mda-reconcile-${stamp}.db`);

  // Handle propio y efimero: `db` (drizzle) no expone el handle crudo de
  // better-sqlite3. `backup()` usa la API de backup de SQLite, que incluye el
  // contenido pendiente en `-wal` (a diferencia de copiar el archivo).
  const handle = new Database(dbPath);
  try {
    await handle.backup(dest);
  } finally {
    handle.close();
  }

  return dest;
}

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user || locals.user.id === 0) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }
  if (!can(locals.user.role, "admin")) {
    return jsonResponse({ error: "Prohibido" }, 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("Payload inválido", 400);
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  try {
    const backupPath = await backupDatabase();

    const targetRows = await db
      .select({
        id: offices.id,
        code: offices.code,
        name: offices.name,
        address: offices.address,
      })
      .from(offices)
      .where(
        inArray(
          offices.address,
          parsed.data.groups.flatMap((g) => g.canonical),
        ),
      );

    let updated = 0;
    for (const group of parsed.data.groups) {
      const canonical = group.canonical.toUpperCase();
      const members = targetRows.filter(
        (r) => (r.address ?? "").trim().toUpperCase() === canonical,
      );

      for (const member of members) {
        const searchableText = normalizeSearchValue(
          [member.code, member.name, canonical].filter(Boolean).join(" "),
        );
        await db
          .update(offices)
          .set({ address: canonical, searchableText })
          .where(eq(offices.id, member.id));
        updated++;
      }

      await logAdminFromAstro(
        locals,
        `Unificó ${members.length} oficinas bajo el edificio "${canonical}" (${members
          .map((m) => m.code)
          .join(", ")})`,
      );
    }

    return jsonResponse({
      success: true,
      updated,
      groups: parsed.data.groups.length,
      backup: path.basename(backupPath),
      requested: parsed.data.groups.length,
    });
  } catch (error) {
    return jsonError(sanitizeError(error), 500);
  }
};
