import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getChangelogEntries, getLatestChangelogDate } from "./changelogService.js";

test("changelogService - aislamiento y parsing con fixtures temporales", async (t) => {
  let tempDir: string;

  t.beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mda-changelog-test-"));
  });

  t.afterEach(async () => {
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test("devuelve lista vacía si el directorio no existe", async () => {
    const nonExistentDir = path.join(tempDir, "sub-no-existe");
    const entries = await getChangelogEntries(nonExistentDir);
    assert.deepEqual(entries, []);
    const latestDate = await getLatestChangelogDate(nonExistentDir);
    assert.equal(latestDate, null);
  });

  await t.test("parsea, filtra borradores (draft: true) y ordena cronológicamente de forma descendente", async () => {
    // Fixture 1: Release intermedio (2026-10-10)
    await fs.promises.writeFile(
      path.join(tempDir, "2026-10-10.md"),
      `---
title: "Actualización de Octubre 1"
date: "2026-10-10"
version: "v1.2.0"
---
### Mejoras
- Optimización de carga en dashboard
`
    );

    // Fixture 2: Release más reciente (2026-10-20)
    await fs.promises.writeFile(
      path.join(tempDir, "2026-10-20.md"),
      `---
title: "Actualización de Octubre 2"
date: "2026-10-20"
version: "v1.3.0"
---
### Nuevas Funciones
- Nuevo visor de novedades
`
    );

    // Fixture 3: Release antiguo (2026-09-15)
    await fs.promises.writeFile(
      path.join(tempDir, "2026-09-15.md"),
      `---
title: "Actualización de Septiembre"
date: "2026-09-15"
version: "v1.1.0"
---
### Correcciones
- Corrección de tipificación
`
    );

    // Fixture 4: Borrador con fecha futura que debe ser ignorado (draft: true)
    await fs.promises.writeFile(
      path.join(tempDir, "example.md"),
      `---
title: "Plantilla Borrador"
date: "2026-11-01"
draft: true
---
### En desarrollo
- Contenido en borrador
`
    );

    const entries = await getChangelogEntries(tempDir);
    assert.equal(entries.length, 3, "Debe cargar únicamente las 3 entradas que no son draft");

    // Verificar orden descendente: 2026-10-20 -> 2026-10-10 -> 2026-09-15
    assert.equal(entries[0].date, "2026-10-20");
    assert.equal(entries[0].title, "Actualización de Octubre 2");
    assert.equal(entries[1].date, "2026-10-10");
    assert.equal(entries[2].date, "2026-09-15");

    // Verificar que el contenido HTML haya sido procesado
    assert.match(entries[0].html, /Nuevo visor de novedades/);

    // Verificar latest date
    const latestDate = await getLatestChangelogDate(tempDir);
    assert.equal(latestDate, "2026-10-20");
  });
});
