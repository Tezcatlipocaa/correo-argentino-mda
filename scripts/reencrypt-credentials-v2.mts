#!/usr/bin/env tsx
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Cargar .env manualmente si existe y no están pobladas las variables
const envPath = path.resolve(".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const { encryptData, decryptData } = await import("../src/lib/encryption.js");

/**
 * Script de migración idempotente: re-encripta credenciales a formato v2 (HKDF-SHA256).
 * Uso:
 *   npx tsx scripts/reencrypt-credentials-v2.mts         (dry-run por defecto)
 *   npx tsx scripts/reencrypt-credentials-v2.mts --apply (aplica cambios con backup WAL-safe)
 */
const DB_PATH = process.env.DATABASE_PATH || path.resolve("database/mda.db");
const isApply = process.argv.includes("--apply");

if (!fs.existsSync(DB_PATH)) {
  console.error(`[reencrypt] Base de datos no encontrada en ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);

console.log(`[reencrypt] Iniciando escaneo en ${DB_PATH} (Modo: ${isApply ? "APPLY" : "DRY-RUN"})`);

// 1. Escanear resource_links
const links = db
  .prepare("SELECT id, title, credential_password FROM resource_links WHERE credential_password IS NOT NULL AND credential_password != ''")
  .all() as Array<{ id: number; title: string; credential_password: string }>;

let linksToMigrate = 0;
const linkUpdates: Array<{ id: number; title: string; newEncrypted: string }> = [];

for (const link of links) {
  if (link.credential_password.startsWith("v2:")) {
    continue; // ya está en v2
  }
  try {
    const plain = decryptData(link.credential_password);
    const newEncrypted = encryptData(plain);
    linkUpdates.push({ id: link.id, title: link.title, newEncrypted });
    linksToMigrate++;
  } catch (err: any) {
    console.error(`[reencrypt] Error al procesar resource_link ${link.id} ("${link.title}"):`, err.message);
  }
}

// 2. Escanear applications.metadata
const apps = db
  .prepare("SELECT id, title, metadata FROM applications WHERE metadata IS NOT NULL AND metadata != ''")
  .all() as Array<{ id: number; title: string; metadata: string }>;

let appsToMigrate = 0;
const appUpdates: Array<{ id: number; title: string; newMetadataEncrypted: string }> = [];

for (const app of apps) {
  if (app.metadata.startsWith("v2:")) {
    continue; // ya está en v2
  }
  try {
    const plainJson = decryptData(app.metadata);
    // Verificar que sea JSON válido
    JSON.parse(plainJson);
    const newMetadataEncrypted = encryptData(plainJson);
    appUpdates.push({ id: app.id, title: app.title, newMetadataEncrypted });
    appsToMigrate++;
  } catch (err: any) {
    console.error(`[reencrypt] Error al procesar application ${app.id} ("${app.title}"):`, err.message);
  }
}

console.log(`[reencrypt] Encontrados para migrar a v2:`);
console.log(`  - resource_links: ${linksToMigrate} de ${links.length}`);
console.log(`  - applications:   ${appsToMigrate} de ${apps.length}`);

if (linksToMigrate === 0 && appsToMigrate === 0) {
  console.log("[reencrypt] Todas las credenciales ya se encuentran cifradas con v2. Nada que hacer.");
  process.exit(0);
}

if (!isApply) {
  console.log("\n[reencrypt] Dry-run finalizado. Para aplicar los cambios ejecutá:");
  console.log("  npx tsx scripts/reencrypt-credentials-v2.mts --apply\n");
  process.exit(0);
}

// Modo APPLY: Backup WAL-safe y transacción
const backupPath = path.resolve(`database/mda.db.backup-v2-${Date.now()}`);
console.log(`[reencrypt] Creando backup WAL-safe en ${backupPath}...`);
db.backup(backupPath)
  .then(() => {
    console.log("[reencrypt] Backup completado exitosamente. Aplicando migración en transacción síncrona...");
    const updateLinkStmt = db.prepare("UPDATE resource_links SET credential_password = ? WHERE id = ?");
    const updateAppStmt = db.prepare("UPDATE applications SET metadata = ? WHERE id = ?");

    const migrateTx = db.transaction(() => {
      for (const item of linkUpdates) {
        updateLinkStmt.run(item.newEncrypted, item.id);
      }
      for (const item of appUpdates) {
        updateAppStmt.run(item.newMetadataEncrypted, item.id);
      }
    });

    migrateTx();
    console.log(`[reencrypt] Éxito: ${linkUpdates.length} enlaces y ${appUpdates.length} aplicativos migrados a v2.`);
  })
  .catch((err) => {
    console.error("[reencrypt] Error al crear backup o ejecutar migración:", err);
    process.exit(1);
  });
