import { describe, it } from "vitest";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { processAppFileUpload } from "../../src/lib/appFileUpload";

function makeFile(name: string, content: string, type: string) {
  return new File([Buffer.from(content)], name, { type });
}

describe("processAppFileUpload", () => {
  it("valida extensión, MIME, tamaño y limpieza del archivo anterior", async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "mda-test-upload-"));
    process.env.EXTERNAL_STORAGE_DIR = TMP;

    const exists = (name: string) =>
      fs.existsSync(path.join(TMP, "apps", name));
    const filesIn = (): string[] => {
      try {
        return fs.readdirSync(path.join(TMP, "apps"));
      } catch {
        return [];
      }
    };

    try {
      assert.equal(
        await processAppFileUpload(null, null),
        null,
        "null file → null",
      );

      assert.equal(
        await processAppFileUpload(
          makeFile("test.zip", "", "application/zip"),
          null,
        ),
        null,
        "empty file → null",
      );

      const r1 = await processAppFileUpload(
        makeFile("app.zip", "zipdata", "application/zip"),
        null,
      );
      assert.ok(r1?.endsWith(".zip"), ".zip aceptado");
      assert.ok(exists(r1), ".zip escrito a disco");

      const r2 = await processAppFileUpload(
        makeFile("installer.exe", "exedata", "application/octet-stream"),
        null,
      );
      assert.ok(r2?.endsWith(".exe"), ".exe con octet-stream aceptado");

      const r3 = await processAppFileUpload(
        makeFile("setup.msi", "msidata", "application/x-msi"),
        null,
      );
      assert.ok(r3?.endsWith(".msi"), ".msi aceptado");

      const r4 = await processAppFileUpload(
        makeFile("archive.rar", "rardata", "application/vnd.rar"),
        null,
      );
      assert.ok(r4?.endsWith(".rar"), ".rar aceptado");

      try {
        await processAppFileUpload(
          makeFile("readme.txt", "text", "text/plain"),
          null,
        );
        assert.fail(".txt debe rechazarse");
      } catch (e) {
        assert.ok(
          e instanceof Error && e.message.includes("extensión"),
          ".txt → error de extensión",
        );
      }

      try {
        await processAppFileUpload(
          makeFile("app.exe", "data", "text/html"),
          null,
        );
        assert.fail("MIME text/html debe rechazarse");
      } catch (e) {
        assert.ok(
          e instanceof Error && e.message.includes("tipo de archivo"),
          "MIME inválido → error de tipo",
        );
      }

      try {
        const big = new File(
          [Buffer.alloc(101 * 1024 * 1024 + 1)],
          "big.zip",
          { type: "application/zip" },
        );
        await processAppFileUpload(big, null);
        assert.fail("Archivo >100MB debe rechazarse");
      } catch (e) {
        assert.ok(
          e instanceof Error && e.message.includes("100 MB"),
          ">100MB → error de tamaño",
        );
      }

      filesIn().forEach((f) => fs.unlinkSync(path.join(TMP, "apps", f)));
      const r5 = await processAppFileUpload(
        makeFile("v1.zip", "version1", "application/zip"),
        null,
      );
      const r6 = await processAppFileUpload(
        makeFile("v2.zip", "version2", "application/zip"),
        r5,
      );
      assert.ok(r5 !== r6, "nuevo upload genera distinto filename");
      assert.ok(exists(r6), "nuevo archivo existe");
      assert.ok(!exists(r5), "archivo anterior eliminado");

      const r7 = await processAppFileUpload(
        makeFile("ext.zip", "external", "application/zip"),
        "https://cdn.example.com/app.zip",
      );
      assert.ok(r7, "currentFilePath URL no rompe upload");
    } finally {
      fs.rmSync(TMP, { recursive: true, force: true });
      delete process.env.EXTERNAL_STORAGE_DIR;
    }
  });
});
