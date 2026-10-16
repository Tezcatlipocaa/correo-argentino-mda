import { describe, it, beforeEach, afterEach } from "vitest";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  cleanArchiveEntryName,
  isEligiblePackBaseApp,
  resolveAppDiskPath,
  buildPackBaseZip,
  shouldRegenerateZip,
} from "../../src/lib/packBaseService";

describe("packBaseService - aislamiento y utilidades", () => {
  let tmpDir: string;
  let appsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mda-test-pack-"));
    appsDir = path.join(tmpDir, "apps");
    fs.mkdirSync(appsDir, { recursive: true });
    process.env.EXTERNAL_STORAGE_DIR = tmpDir;
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignorar limpieza de temporales
    }
  });

  it("cleanArchiveEntryName limpia prefijos de timestamp y caracteres raros", () => {
    assert.equal(
      cleanArchiveEntryName("1783294359606_KiTTY_Rv5F.zip"),
      "KiTTY_Rv5F.zip",
    );
    assert.equal(
      cleanArchiveEntryName("1783294368342_PuTTY.zip"),
      "PuTTY.zip",
    );
    assert.equal(
      cleanArchiveEntryName("simple_app.exe"),
      "simple_app.exe",
    );
  });

  it("isEligiblePackBaseApp descarta URLs externas o archivos ausentes", () => {
    assert.equal(isEligiblePackBaseApp(null), false);
    assert.equal(isEligiblePackBaseApp(""), false);
    assert.equal(isEligiblePackBaseApp("https://getsharex.com/"), false);
    assert.equal(isEligiblePackBaseApp("http://example.com/app.exe"), false);
    assert.equal(
      isEligiblePackBaseApp("/api/download/123_app.zip"),
      true,
    );
    assert.equal(
      isEligiblePackBaseApp("123_app.exe"),
      true,
    );
  });

  it("resolveAppDiskPath obtiene la ruta absoluta en la carpeta apps", () => {
    const diskPath = resolveAppDiskPath("/api/download/1783294359606_KiTTY.zip", appsDir);
    assert.equal(diskPath, path.join(appsDir, "1783294359606_KiTTY.zip"));
  });

  it("shouldRegenerateZip detecta archivos inexistentes o desactualizados", () => {
    const zipPath = path.join(appsDir, "pack-base-operatoria-mda.zip");
    
    // Zip no existe
    assert.equal(shouldRegenerateZip(zipPath, Date.now()), true);

    // Zip creado hace 10 segundos
    fs.writeFileSync(zipPath, "dummy-zip-content");
    const zipStat = fs.statSync(zipPath);

    // Archivo fuente más viejo que el zip -> no regenerar
    assert.equal(shouldRegenerateZip(zipPath, zipStat.mtimeMs - 1000), false);

    // Archivo fuente más nuevo que el zip -> regenerar
    assert.equal(shouldRegenerateZip(zipPath, zipStat.mtimeMs + 2000), true);
  });

  it("buildPackBaseZip genera un ZIP válido con los archivos provistos", async () => {
    const file1 = path.join(appsDir, "100_AppUno.exe");
    const file2 = path.join(appsDir, "200_AppDos.zip");
    fs.writeFileSync(file1, "contenido de app uno");
    fs.writeFileSync(file2, "contenido de app dos");

    const zipPath = path.join(appsDir, "pack-base-operatoria-mda.zip");

    const items = [
      {
        id: 1,
        title: "App Uno",
        diskPath: file1,
        entryName: "AppUno.exe",
        size: fs.statSync(file1).size,
        mtimeMs: fs.statSync(file1).mtimeMs,
      },
      {
        id: 2,
        title: "App Dos",
        diskPath: file2,
        entryName: "AppDos.zip",
        size: fs.statSync(file2).size,
        mtimeMs: fs.statSync(file2).mtimeMs,
      },
    ];

    const result = await buildPackBaseZip(items, zipPath);
    assert.equal(result.success, true);
    assert.ok(fs.existsSync(zipPath));
    const stat = fs.statSync(zipPath);
    assert.ok(stat.size > 0, "El zip generado tiene tamaño > 0");

    // Con el zip recién generado, shouldRegenerateZip debe ser false
    const maxSourceMtime = Math.max(...items.map((i) => i.mtimeMs));
    assert.equal(shouldRegenerateZip(zipPath, maxSourceMtime), false);
  });

  it("buildPackBaseZip maneja llamadas concurrentes hacia el mismo archivo de salida", async () => {
    const file1 = path.join(appsDir, "100_AppTres.exe");
    fs.writeFileSync(file1, "contenido app tres");
    const zipPath = path.join(appsDir, "pack-base-concurrente.zip");

    const items = [
      {
        id: 3,
        title: "App Tres",
        diskPath: file1,
        entryName: "AppTres.exe",
        size: fs.statSync(file1).size,
        mtimeMs: fs.statSync(file1).mtimeMs,
      },
    ];

    const [r1, r2] = await Promise.all([
      buildPackBaseZip(items, zipPath),
      buildPackBaseZip(items, zipPath),
    ]);

    assert.equal(r1.success, true);
    assert.equal(r2.success, true);
    assert.ok(fs.existsSync(zipPath));
  });
});

