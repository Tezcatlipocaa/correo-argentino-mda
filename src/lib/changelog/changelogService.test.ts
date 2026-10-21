import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getChangelogEntries,
  getLatestChangelogDate,
  clearChangelogCache,
} from "./changelogService.js";

test("changelogService - aislamiento y parsing con fixtures temporales", async (t) => {
  let tempDir: string;

  t.beforeEach(async () => {
    clearChangelogCache();
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mda-changelog-test-"));
  });

  t.afterEach(async () => {
    clearChangelogCache();
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

  await t.test("parsea, normaliza fechas ISO completas, filtra borradores (draft: true) y ordena cronológicamente de forma descendente", async () => {
    // Fixture 1: Release intermedio (2026-10-10) con fecha ISO compleja
    await fs.promises.writeFile(
      path.join(tempDir, "2026-10-10.md"),
      `---
title: "Actualización de Octubre 1"
date: "2026-10-10T14:30:00Z"
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

    // Verificar normalización de fecha YYYY-MM-DD
    assert.equal(entries[1].date, "2026-10-10");
    assert.equal(entries[2].date, "2026-09-15");

    // Verificar que el contenido HTML haya sido procesado
    assert.match(entries[0].html, /Nuevo visor de novedades/);

    // Verificar latest date normalizado
    const latestDate = await getLatestChangelogDate(tempDir);
    assert.equal(latestDate, "2026-10-20");
  });

  await t.test("deduplicación: preserva el release original anterior y descarta repeticiones en releases nuevos", async () => {
    // Release ORIGINAL anterior (2026-10-21) que publicó originalmente 'aabbccd'
    await fs.promises.writeFile(
      path.join(tempDir, "2026-10-21.md"),
      `---
title: "Release 21 Original"
date: "2026-10-21"
commits:
  - "aabbccd"
  - "8901234"
---
### Funciones
- Feature original [\`aabbccd\`]
- Feature única 21 [\`8901234\`]
`
    );

    // Release NUEVO posterior (2026-10-22) que intenta repetir 'aabbccd' y trae una feature nueva '1234567'
    await fs.promises.writeFile(
      path.join(tempDir, "2026-10-22.md"),
      `---
title: "Release 22 Nuevo"
date: "2026-10-22"
commits:
  - "aabbccd"
  - "1234567"
---
### Funciones
- Feature repetida que debe descartarse [\`aabbccd\`]
- Feature nueva 22 [\`1234567\`]
`
    );

    const entries = await getChangelogEntries(tempDir);
    assert.equal(entries.length, 2);

    // En la salida (orden descendente por fecha):
    // entries[0] es Release 22 (más reciente): debe conservar SOLO el commit nuevo '1234567'
    assert.equal(entries[0].title, "Release 22 Nuevo");
    assert.deepEqual(entries[0].commits, ["1234567"]);
    assert.doesNotMatch(entries[0].html, /Feature repetida/);
    assert.match(entries[0].html, /Feature nueva 22/);

    // entries[1] es Release 21 (original): debe conservar 'aabbccd' y '8901234' intactos
    assert.equal(entries[1].title, "Release 21 Original");
    assert.deepEqual(entries[1].commits, ["aabbccd", "8901234"]);
    assert.match(entries[1].html, /Feature original/);
    assert.match(entries[1].html, /Feature única 21/);
  });

  await t.test("descarta releases que queden vacías tras la deduplicación completa", async () => {
    // Release previo (2026-10-15)
    await fs.promises.writeFile(
      path.join(tempDir, "2026-10-15.md"),
      `---
title: "Release Inicial"
date: "2026-10-15"
commits:
  - "fedcba9"
---
### Funciones
- Feature inicial [\`fedcba9\`]
`
    );

    // Release posterior (2026-10-16) cuyos commits son 100% repetidos del anterior
    await fs.promises.writeFile(
      path.join(tempDir, "2026-10-16.md"),
      `---
title: "Release 100% Repetido"
date: "2026-10-16"
commits:
  - "fedcba9"
---
### Funciones
- Feature idéntica re-subida [\`fedcba9\`]
`
    );

    const entries = await getChangelogEntries(tempDir);
    // Debe descartar Release 100% Repetido y listar solo Release Inicial
    assert.equal(entries.length, 1);
    assert.equal(entries[0].title, "Release Inicial");
  });

  await t.test("deduplica hashes detectados en el contenido aunque no figuren en frontmatter commits:", async () => {
    // Release anterior que solo tiene el hash en las viñetas, sin frontmatter commits:
    await fs.promises.writeFile(
      path.join(tempDir, "2026-10-01.md"),
      `---
title: "Release Sin Frontmatter Commits"
date: "2026-10-01"
---
### Mejoras
- Mejora con hash en viñeta [\`7778889\`]
`
    );

    // Release nuevo que repite ese mismo hash
    await fs.promises.writeFile(
      path.join(tempDir, "2026-10-02.md"),
      `---
title: "Release Repetidor"
date: "2026-10-02"
---
### Mejoras
- Intento de duplicar mejora [\`7778889\`]
- Mejora genuina nueva [\`9990001\`]
`
    );

    const entries = await getChangelogEntries(tempDir);
    assert.equal(entries.length, 2);
    // En el release nuevo (entries[0]), el hash repetido se descartó
    assert.doesNotMatch(entries[0].html, /Intento de duplicar/);
    assert.match(entries[0].html, /Mejora genuina nueva/);
    assert.deepEqual(entries[0].commits, ["9990001"]);
  });
});
