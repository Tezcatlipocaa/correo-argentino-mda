import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderMarkdown } from "../../../src/lib/markdown";

describe("KB Markdown Sanitization and Accessibility (#174)", () => {
  it("renderiza checkboxes deshabilitados con aria-hidden y tabindex=-1 para a11y", () => {
    const md = "- [ ] Tarea pendiente\n- [x] Tarea completa";
    const html = renderMarkdown(md);

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('disabled');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('tabindex="-1"');
  });

  it("elimina selectores redundantes .editor-preview-side en estilos de contenido de KbEditor", () => {
    const editorPath = resolve(
      process.cwd(),
      "src/components/base-conocimiento/KbEditor.astro",
    );
    const source = readFileSync(editorPath, "utf-8");

    expect(source).not.toMatch(/\.editor-preview-side\s+h[1-6]/);
    expect(source).not.toMatch(/\.editor-preview-side\s+ul:has/);
    expect(source).not.toMatch(/\.editor-preview-side\s+li\s*>/);
  });
});
