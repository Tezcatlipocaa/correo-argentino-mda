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
commits:
  - "1111aaa"
---
### Mejoras
- Optimización de carga en dashboard [\`1111aaa\`]
`
    );

    // Fixture 2: Release más reciente (2026-10-20)
    await fs.promises.writeFile(
      path.join(tempDir, "2026-10-20.md"),
      `---
title: "Actualización de Octubre 2"
date: "2026-10-20"
version: "v1.3.0"
commits:
  - "2222bbb"
---
### Nuevas Funciones
- Nuevo visor de novedades [\`2222bbb\`]
`
    );

    // Fixture 3: Release antiguo (2026-09-15)
    await fs.promises.writeFile(
      path.join(tempDir, "2026-09-15.md"),
      `---
title: "Actualización de Septiembre"
date: "2026-09-15"
version: "v1.1.0"
commits:
  - "3333ccc"
---
### Correcciones
- Corrección de tipificación [\`3333ccc\`]
`
    );

    // Fixture 4: Borrador con fecha futura que debe ser ignorado (draft: true)
    await fs.promises.writeFile(
      path.join(tempDir, "example.md"),
      `---
title: "Plantilla Borrador"
date: "2026-11-01"
draft: true
commits:
  - "4444ddd"
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
    assert.deepEqual(entries[0].commits, ["2222bbb"]);
    assert.equal(entries[1].date, "2026-10-10");
    assert.equal(entries[2].date, "2026-09-15");

    // Verificar que el contenido HTML haya sido procesado
    assert.match(entries[0].html, /Nuevo visor de novedades/);

    // Verificar latest date
    const latestDate = await getLatestChangelogDate(tempDir);
    assert.equal(latestDate, "2026-10-20");
  });

  await t.test("descarta commits repetidos entre releases", async () => {
    // Release más reciente (2026-10-22) incluye commit repetido 'aabbccd'
    await fs.promises.writeFile(
      path.join(tempDir, "2026-10-22.md"),
      `---
title: "Release 22"
date: "2026-10-22"
commits:
  - "aabbccd"
  - "1234567"
---
### Funciones
- Feature reciente [\`1234567\`]
- Feature compartida previa [\`aabbccd\`]
`
    );

    // Release anterior (2026-10-21) que ya tenía el commit 'aabbccd'
    await fs.promises.writeFile(
      path.join(tempDir, "2026-10-21.md"),
      `---
title: "Release 21"
date: "2026-10-21"
commits:
  - "aabbccd"
  - "8901234"
---
### Funciones
- Feature original [\`aabbccd\`]
- Feature única [\`8901234\`]
`
    );

    const entries = await getChangelogEntries(tempDir);
    assert.equal(entries.length, 2);

    // En el release 22 (más reciente), 'aabbccd' fue consumido primero
    assert.deepEqual(entries[0].commits, ["aabbccd", "1234567"]);

    // En el release 21 (anterior), 'aabbccd' es descartado por duplicación y sólo queda '8901234'
    assert.deepEqual(entries[1].commits, ["8901234"]);
  });
});
