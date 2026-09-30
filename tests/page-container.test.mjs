import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const fileUrl = (path) => new URL(path, root);
const read = (path) => readFile(fileUrl(path), "utf8");
const exists = (path) => existsSync(fileUrl(path));

const componentPath = "src/components/ui/PageContainer.astro";

assert.ok(exists(componentPath), "Expected PageContainer.astro to exist");

const pageContainer = await read(componentPath);

assert.match(
  pageContainer,
  /width\?:\s*"default"[\s\S]*?"full"/,
  "PageContainer should expose a width prop with multiple variants",
);
assert.match(
  pageContainer,
  /gap\?:\s*"md"\s*\|\s*"lg"/,
  "PageContainer should expose md and lg gap variants",
);
assert.match(
  pageContainer,
  /as\?:\s*"div"\s*\|\s*"section"/,
  "PageContainer should allow rendering as div or section",
);
assert.match(
  pageContainer,
  /class\?:\s*string/,
  "PageContainer should pass through additional classes",
);
assert.match(pageContainer, /max-w-6xl/);
assert.match(pageContainer, /max-w-7xl/);
assert.match(pageContainer, /mx-auto/);
assert.match(pageContainer, /flex/);
assert.match(pageContainer, /w-full/);
assert.match(pageContainer, /flex-col/);
assert.doesNotMatch(
  pageContainer,
  /(?:^|["'\s])(?:p|px|py)-\d/,
  "PageContainer should not include default padding classes",
);

// Nota: se removió la lista de "rutas migradas" (gap/width por página) porque
// era un change-detector sobre archivos de página que se refactorizan seguido
// y no verifica comportamiento. El contrato del componente (arriba) es lo
// durable.
