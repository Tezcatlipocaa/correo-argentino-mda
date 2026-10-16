import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("AdminChatbotWidget Contract", () => {
  const widgetPath = resolve(
    process.cwd(),
    "src/components/admin/ai/AdminChatbotWidget.tsx",
  );
  const layoutPath = resolve(
    process.cwd(),
    "src/layouts/BaseLayout.astro",
  );

  it("el archivo del componente existe", () => {
    expect(existsSync(widgetPath)).toBe(true);
  });

  it("implementa el FAB con clases de DaisyUI, color secondary y roles accesibles", () => {
    const source = readFileSync(widgetPath, "utf-8");
    expect(source).toMatch(/class(?:Name)?="[^"]*fab/);
    expect(source).toMatch(/btn-circle/);
    expect(source).toMatch(/btn-secondary/);
  });

  it("identifica al bot con el nombre Referente", () => {
    const source = readFileSync(widgetPath, "utf-8");
    expect(source).toMatch(/Referente/);
  });

  it("soporta cierre con tecla Escape", () => {
    const source = readFileSync(widgetPath, "utf-8");
    expect(source).toMatch(/key === ["']Escape["']/);
  });

  it("está integrado en BaseLayout condicionado a rol admin y oculto en móviles", () => {
    const layoutSource = readFileSync(layoutPath, "utf-8");
    expect(layoutSource).toMatch(/normalizedUserRole === ["']admin["']/);
    expect(layoutSource).toMatch(/AdminChatbotWidget/);
    expect(layoutSource).toMatch(/client:idle/);
    expect(layoutSource).toMatch(/hidden md:block/);
  });

  it("incluye botón de reinicio y botón de detener generación", () => {
    const source = readFileSync(widgetPath, "utf-8");
    expect(source).toMatch(/handleReset/);
    expect(source).toMatch(/handleStop/);
    expect(source).toMatch(/aria-label=["']Reiniciar conversación["']/);
    expect(source).toMatch(/aria-label=["']Detener respuesta["']/);
  });

  it("soporta metadatos DaisyUI chat-header y chat-footer", () => {
    const source = readFileSync(widgetPath, "utf-8");
    expect(source).toMatch(/chat-header/);
    expect(source).toMatch(/chat-footer/);
  });

  it("utiliza textarea autoajustable con Enter para enviar y scrollbar-hide", () => {
    const source = readFileSync(widgetPath, "utf-8");
    expect(source).toMatch(/<textarea/);
    expect(source).toMatch(/handleKeyDown/);
    expect(source).toMatch(/key === ["']Enter["'] && !e\.shiftKey/);
    expect(source).toMatch(/scrollbar-hide/);
  });

  it("incorpora animación con transform y origen en esquina inferior derecha", () => {
    const source = readFileSync(widgetPath, "utf-8");
    expect(source).toMatch(/origin-bottom-right/);
    expect(source).toMatch(/scale-100 opacity-100/);
    expect(source).toMatch(/scale-95 opacity-0/);
  });

  it("persiste mensajes y estado de apertura en sessionStorage con fallback seguro", () => {
    const source = readFileSync(widgetPath, "utf-8");
    expect(source).toMatch(/mda_admin_chatbot_messages/);
    expect(source).toMatch(/mda_admin_chatbot_open/);
    expect(source).toMatch(/sessionStorage\.getItem/);
    expect(source).toMatch(/sessionStorage\.setItem/);
  });
});
