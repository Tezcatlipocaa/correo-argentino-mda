import "dotenv/config";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { setSessionCookie, type TestUser } from "./helpers/auth";
import {
  KbTestFixture,
  setEasyMdeContent,
  type KbTestMesa,
} from "./helpers/kb";

test.use({ viewport: { width: 1920, height: 1080 } });

let fixture: KbTestFixture;
let mesa: KbTestMesa;
let admin: TestUser;

const WIDE_MARKDOWN = [
  "# Encabezado del artículo",
  "",
  "Párrafo introductorio con un enlace muy largo que no debe romper el ancho:",
  "https://ejemplo.local/catalogo/documentacion/articulos/base-de-conocimiento/2026/09",
  "",
  "| Columna uno | Columna dos | Columna tres | Columna cuatro |",
  "| --- | --- | --- | --- |",
  "| valor a | valor b | valor c | valor d |",
  "",
  "```ts",
  "const configuracion = { ancho: 100, alto: 200, etiqueta: 'contenido' };",
  "```",
  "",
  "> Cita de ejemplo para medir el ancho del panel.",
].join("\n");

const TYPO_MARKDOWN = [
  "* asdas",
  "* dasdas",
  "* adsda",
  "* ads",
  "",
  "> dasdas",
  "",
  "1. dasdas",
  "2. dasdas",
  "3. dasda",
  "4. asda",
  "",
  "[dasdasda](https://ejemplo.local/x)",
].join("\n");

type Box = { left: number; right: number; width: number };

const form = (page: Page) => page.locator("#kb-article-form");
const editor = (page: Page) => page.locator(".EasyMDEContainer .CodeMirror");
const sidePreview = (page: Page) =>
  page.locator(".EasyMDEContainer .editor-preview-side");
const fullPreview = (page: Page) =>
  page.locator(".EasyMDEContainer .editor-preview-full");
const sideBySideButton = (page: Page) =>
  page.locator(".EasyMDEContainer .editor-toolbar button.side-by-side");
const fullscreenButton = (page: Page) =>
  page.locator(".EasyMDEContainer .editor-toolbar button.fullscreen");
const previewButton = (page: Page) =>
  page.locator(".EasyMDEContainer .editor-toolbar button.preview");

const viewportWidth = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.clientWidth);

const boxOf = async (locator: Locator, label: string): Promise<Box> => {
  await expect(locator, `${label} no está visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} no tiene boundingBox`).not.toBeNull();
  return { left: box!.x, right: box!.x + box!.width, width: box!.width };
};

const expectNoHorizontalPageScroll = async (
  page: Page,
  mode: string,
): Promise<void> => {
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scroll.scrollWidth,
    `desborde horizontal de la pagina en modo ${mode}: scrollWidth ${scroll.scrollWidth} > clientWidth ${scroll.clientWidth}`,
  ).toBeLessThanOrEqual(scroll.clientWidth + 1);
};

const expectInsideWidth = (
  inner: Box,
  outer: Box,
  label: string,
  mode: string,
): void => {
  expect(
    inner.left,
    `${label} se sale por la izquierda en ${mode}: left ${inner.left} < ${outer.left}`,
  ).toBeGreaterThanOrEqual(outer.left - 2);
  expect(
    inner.right,
    `${label} se sale por la derecha en ${mode}: right ${inner.right} > ${outer.right}`,
  ).toBeLessThanOrEqual(outer.right + 2);
};

const openCreate = async (page: Page): Promise<void> => {
  await setSessionCookie(page.context(), admin.signedSessionId);
  await page.goto("/base-conocimiento/create");
  await expect(form(page)).toBeVisible();
  await setEasyMdeContent(page, WIDE_MARKDOWN);
};

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  mesa = await fixture.createMesa();
  admin = await fixture.createUser("admin", mesa);
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test.describe("Base de conocimiento - layout del editor", () => {
  test("modo normal: sin desborde y con el editor dentro del ancho util", async ({
    page,
  }) => {
    await openCreate(page);

    const editorBox = await boxOf(editor(page), "el CodeMirror");
    const formBox = await boxOf(form(page), "el formulario");
    const width = await viewportWidth(page);
    const viewportBox: Box = { left: 0, right: width, width };

    expect(
      editorBox.width,
      `el editor mide ${editorBox.width}px y deberia ocupar el ancho del contenedor`,
    ).toBeGreaterThan(formBox.width * 0.8);
    expectInsideWidth(editorBox, viewportBox, "el editor", "normal");
    await expectNoHorizontalPageScroll(page, "normal");
  });

  test("side-by-side: ambos panes quedan dentro del contenedor, sin solaparse", async ({
    page,
  }) => {
    await openCreate(page);

    await sideBySideButton(page).click();
    await expect(
      sidePreview(page),
      "el panel de vista previa lateral no aparece en side-by-side",
    ).toBeVisible();

    const editorBox = await boxOf(editor(page), "el CodeMirror");
    const previewBox = await boxOf(
      sidePreview(page),
      "la vista previa lateral",
    );
    const formBox = await boxOf(form(page), "el formulario");
    const width = await viewportWidth(page);
    const viewportBox: Box = { left: 0, right: width, width };

    expectInsideWidth(editorBox, formBox, "el editor", "side-by-side");
    expectInsideWidth(previewBox, formBox, "la vista previa", "side-by-side");
    expect(
      previewBox.left,
      `la vista previa se superpone al editor en side-by-side: preview.left ${previewBox.left} < editor.right ${editorBox.right}`,
    ).toBeGreaterThanOrEqual(editorBox.right - 2);
    expect(
      editorBox.width,
      `el editor queda Sin ancho util en side-by-side: ${editorBox.width}px`,
    ).toBeGreaterThan(200);
    expect(
      previewBox.width,
      `la vista previa queda sin ancho util en side-by-side: ${previewBox.width}px`,
    ).toBeGreaterThan(200);
    expectInsideWidth(editorBox, viewportBox, "el editor", "side-by-side");
    await expectNoHorizontalPageScroll(page, "side-by-side");
  });

  test("fullscreen: el editor queda dentro del viewport sin desborde", async ({
    page,
  }) => {
    await openCreate(page);

    await fullscreenButton(page).click();
    await expect(editor(page), "el editor no entra en fullscreen").toHaveClass(
      /CodeMirror-fullscreen/,
    );

    const editorBox = await boxOf(editor(page), "el CodeMirror fullscreen");
    const toolbarBox = await boxOf(
      page.locator(".EasyMDEContainer .editor-toolbar.fullscreen"),
      "la toolbar en fullscreen",
    );
    const width = await viewportWidth(page);
    const viewportBox: Box = { left: 0, right: width, width };

    expectInsideWidth(editorBox, viewportBox, "el editor", "fullscreen");
    expectInsideWidth(toolbarBox, viewportBox, "la toolbar", "fullscreen");
    await expectNoHorizontalPageScroll(page, "fullscreen");

    const reachable = await page.evaluate(() => {
      const selectors = [
        ".EasyMDEContainer .editor-toolbar.fullscreen",
        ".EasyMDEContainer .CodeMirror-fullscreen",
      ];
      return selectors.map((selector) => {
        const node = document.querySelector(selector);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        const probe = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return probe instanceof Node && node.contains(probe);
      });
    });
    expect(
      reachable[0],
      "la toolbar en fullscreen queda tapada por el header de la app",
    ).toBe(true);
    expect(
      reachable[1],
      "el editor en fullscreen queda tapado por el header de la app",
    ).toBe(true);

    const edgesReachable = await page.evaluate(() => {
      const node = document.querySelector(
        ".EasyMDEContainer .CodeMirror-fullscreen",
      );
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const probe = document.elementFromPoint(rect.left + 4, rect.top + 4);
      return probe instanceof Node && node.contains(probe);
    });
    expect(
      edgesReachable,
      "el borde izquierdo del editor en fullscreen queda tapado por la barra lateral",
    ).toBe(true);

    const firstButton = page.locator(
      ".EasyMDEContainer .editor-toolbar button.bold",
    );
    await expect(firstButton).toBeVisible();
    const buttonClickable = await firstButton.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const probe = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return probe instanceof Node && node.contains(probe);
    });
    expect(
      buttonClickable,
      "el primer boton de la toolbar no se puede clickear en fullscreen",
    ).toBe(true);

    await fullscreenButton(page).click();
    await expect(editor(page)).not.toHaveClass(/CodeMirror-fullscreen/);
  });

  test("split + fullscreen: los dos paneles reparten el viewport sin taparse", async ({
    page,
  }) => {
    await openCreate(page);

    await sideBySideButton(page).click();
    await expect(sidePreview(page)).toBeVisible();
    await fullscreenButton(page).click();
    await expect(editor(page)).toHaveClass(/CodeMirror-fullscreen/);

    const editorBox = await boxOf(editor(page), "el CodeMirror fullscreen");
    const previewBox = await boxOf(
      sidePreview(page),
      "la vista previa lateral",
    );
    const width = await viewportWidth(page);
    const viewportBox: Box = { left: 0, right: width, width };

    expectInsideWidth(editorBox, viewportBox, "el editor", "split+fullscreen");
    expectInsideWidth(
      previewBox,
      viewportBox,
      "la vista previa",
      "split+fullscreen",
    );
    expect(
      previewBox.left,
      `la vista previa tapa al editor en split+fullscreen: preview.left ${previewBox.left} < editor.right ${editorBox.right}`,
    ).toBeGreaterThanOrEqual(editorBox.right - 2);
    expect(
      editorBox.width,
      `el editor no conserva la mitad del viewport en split+fullscreen: ${editorBox.width}px de ${width}px`,
    ).toBeGreaterThan(width * 0.35);
    await expectNoHorizontalPageScroll(page, "split+fullscreen");

    const previewReachable = await page.evaluate(() => {
      const node = document.querySelector(
        ".EasyMDEContainer .editor-preview-side",
      );
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const probe = document.elementFromPoint(rect.left + 4, rect.top + 4);
      return probe instanceof Node && node.contains(probe);
    });
    expect(
      previewReachable,
      "la vista previa en split+fullscreen queda tapada por el header de la app",
    ).toBe(true);
  });

  test("preview simple: la vista previa completa no desborda ni tapa el editor", async ({
    page,
  }) => {
    await openCreate(page);

    await previewButton(page).click();
    await expect(
      fullPreview(page),
      "la vista previa completa no aparece",
    ).toBeVisible();

    const previewBox = await boxOf(
      fullPreview(page),
      "la vista previa completa",
    );
    const width = await viewportWidth(page);
    const viewportBox: Box = { left: 0, right: width, width };

    expectInsideWidth(previewBox, viewportBox, "la vista previa", "preview");
    await expectNoHorizontalPageScroll(page, "preview");
  });

  test("al volver del split/fullscreen al modo normal el markdown sigue intacto", async ({
    page,
  }) => {
    await openCreate(page);

    await sideBySideButton(page).click();
    await expect(sidePreview(page)).toBeVisible();
    await fullscreenButton(page).click();
    await expect(editor(page)).toHaveClass(/CodeMirror-fullscreen/);
    await fullscreenButton(page).click();
    await expect(editor(page)).not.toHaveClass(/CodeMirror-fullscreen/);
    await sideBySideButton(page).click();
    await expect(sidePreview(page)).toBeHidden();

    const editorBox = await boxOf(editor(page), "el CodeMirror");
    const formBox = await boxOf(form(page), "el formulario");
    expect(
      editorBox.width,
      `el editor no recupera el ancho del contenedor al volver al modo normal: ${editorBox.width}px vs ${formBox.width}px`,
    ).toBeGreaterThan(formBox.width * 0.8);
    expect(await page.locator('textarea[name="content"]').inputValue()).toBe(
      WIDE_MARKDOWN,
    );
    await expectNoHorizontalPageScroll(page, "normal tras volver");
  });

  test("preview: refleja la tipografía del markdown (listas, cita, link, espaciado)", async ({
    page,
  }) => {
    await setSessionCookie(page.context(), admin.signedSessionId);
    await page.goto("/base-conocimiento/create");
    await expect(form(page)).toBeVisible();
    await setEasyMdeContent(page, TYPO_MARKDOWN);

    await previewButton(page).click();
    const preview = fullPreview(page);
    await expect(preview).toBeVisible();
    await expect(preview.locator("ul")).toBeVisible();
    await expect(preview.locator("blockquote")).toBeVisible();

    const styles = await preview.evaluate((root) => {
      const read = (selector: string) => {
        const el = root.querySelector(selector);
        if (!el) return null;
        const s = getComputedStyle(el);
        return {
          listStyleType: s.listStyleType,
          paddingLeft: parseFloat(s.paddingLeft),
          marginTop: parseFloat(s.marginTop),
          marginBottom: parseFloat(s.marginBottom),
          textDecorationLine: s.textDecorationLine,
          color: s.color,
        };
      };
      return {
        ul: read("ul"),
        ol: read("ol"),
        quote: read("blockquote"),
        paragraph: read("p"),
        link: read("a"),
        bodyColor: getComputedStyle(root).color,
      };
    });

    expect(styles.ul?.listStyleType, "la lista no muestra viñetas").toBe(
      "disc",
    );
    expect(
      styles.ul?.paddingLeft ?? 0,
      "la lista no tiene sangría",
    ).toBeGreaterThan(0);
    expect(
      styles.ul?.marginBottom ?? 0,
      "la lista no tiene margen vertical",
    ).toBeGreaterThan(0);
    expect(styles.ol?.listStyleType, "la lista no muestra numeración").toBe(
      "decimal",
    );
    expect(
      styles.ol?.marginTop ?? 0,
      "la lista numerada no tiene margen vertical",
    ).toBeGreaterThan(0);
    expect(
      styles.quote?.marginTop ?? 0,
      "la cita no tiene margen vertical",
    ).toBeGreaterThan(0);
    expect(
      styles.paragraph?.marginBottom ?? 0,
      "los párrafos no se separan",
    ).toBeGreaterThan(0);
    expect(
      styles.link?.textDecorationLine ?? "",
      "el link no se subraya",
    ).toContain("underline");
    expect(
      styles.link?.color,
      "el link no se distingue del texto",
    ).not.toBe(styles.bodyColor);
  });
});
