import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const fileUrl = (path) => new URL(path, root);
const read = (path) => readFile(fileUrl(path), "utf8");
const exists = (path) => existsSync(fileUrl(path));

const componentPath = "src/components/ui/forms/FormLegend.astro";

assert.ok(exists(componentPath), "Expected FormLegend.astro to exist");

const component = await read(componentPath);

assert.match(
  component,
  /fieldset-legend/,
  "FormLegend should use DaisyUI's fieldset-legend class",
);
assert.match(component, /uppercase/, "FormLegend should be uppercase");
assert.match(component, /tracking-wide/, "FormLegend should use tracking-wide");
assert.doesNotMatch(
  component,
  /[a-z]-\[[a-z0-9]/i,
  "FormLegend should not use arbitrary Tailwind values with []",
);
assert.match(
  component,
  /class\?:\s*string/,
  "FormLegend should accept a class prop",
);
assert.match(
  component,
  /<slot\s*\/>/,
  "FormLegend should have a slot for content",
);

// Nota: se removió la lista `migratedFiles` (conteo exacto de <FormLegend> por
// archivo) porque era un change-detector sobre 14 archivos que se refactorizan
// seguido y no verifica comportamiento. El contrato del componente (arriba) es
// lo durable.
