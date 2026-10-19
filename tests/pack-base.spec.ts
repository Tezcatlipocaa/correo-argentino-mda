import "dotenv/config";
import { expect, test } from "@playwright/test";
import {
  cleanupTestUser,
  createTestUserAndSession,
  setSessionCookie,
} from "./helpers/auth";

test.describe("Pack base de operatoria automatizado (#313)", () => {
  let user: Awaited<ReturnType<typeof createTestUserAndSession>> | null = null;
  let admin: Awaited<ReturnType<typeof createTestUserAndSession>> | null = null;

  test.afterEach(async () => {
    if (user) {
      await cleanupTestUser(user.userId, user.sessionId);
      user = null;
    }
    if (admin) {
      await cleanupTestUser(admin.userId, admin.sessionId);
      admin = null;
    }
  });

  test("usuario logueado ve el banner del pack base con conteo y botón de descarga", async ({
    context,
    page,
  }) => {
    user = await createTestUserAndSession("agent");
    await setSessionCookie(context, user.signedSessionId);

    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4321";
    await page.goto(`${baseURL}/recursos/aplicativos`);

    // Banner principal
    const banner = page.locator("article", {
      hasText: "Pack base de operatoria (.zip)",
    });
    await expect(banner).toBeVisible();

    // Badge con conteo de aplicativos y tamaño en MB
    await expect(banner.getByText(/aplicativos.*MB/i)).toBeVisible();

    // SearchBar ubicada visualmente antes del banner
    const searchBar = page.locator("#catalog-search");
    await expect(searchBar).toBeVisible();
    const searchBox = await searchBar.boundingBox();
    const bannerBox = await banner.boundingBox();
    expect(searchBox).not.toBeNull();
    expect(bannerBox).not.toBeNull();
    expect(bannerBox!.y).toBeGreaterThan(searchBox!.y);

    // Botón de descarga
    const downloadBtn = banner.getByRole("link", { name: /descargar \.zip/i });
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toHaveAttribute(
      "href",
      new RegExp("/api/aplicativos/pack-base"),
    );
  });

  test("endpoint /api/aplicativos/pack-base entrega el archivo zip válido", async ({
    context,
  }) => {
    user = await createTestUserAndSession("agent");
    await setSessionCookie(context, user.signedSessionId);

    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4321";
    const response = await context.request.get(
      `${baseURL}/api/aplicativos/pack-base`,
    );

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/zip");
    expect(response.headers()["content-disposition"]).toContain(
      'attachment; filename="pack-base-operatoria-mda.zip"',
    );

    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);
    // Verificamos firma de cabecera ZIP: PK (0x50, 0x4B)
    expect(body[0]).toBe(0x50);
    expect(body[1]).toBe(0x4b);
  });

  test("admin ve el badge en el listado y el control en edición de aplicativos", async ({
    context,
    page,
  }) => {
    admin = await createTestUserAndSession("admin");
    await setSessionCookie(context, admin.signedSessionId);

    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4321";

    // Listado de aplicativos
    await page.goto(`${baseURL}/admin/aplicativos`);
    await expect(page.locator("text=Pack base").first()).toBeVisible();

    // Edición de aplicativo local
    await page.goto(`${baseURL}/admin/aplicativos/edit/6`);
    const checkbox = page.locator('input[name="inPackBase"]');
    await expect(checkbox).toBeVisible();
  });

  test("los switches de pestañas de Recursos permanecen anclados arriba a la derecha entre navegación", async ({
    context,
    page,
  }) => {
    user = await createTestUserAndSession("agent");
    await setSessionCookie(context, user.signedSessionId);

    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4321";

    // Navegar a /recursos (Enlaces)
    await page.goto(`${baseURL}/recursos`);
    const tabsLocator1 = page.locator('nav[aria-label="Secciones de Recursos"]');
    await expect(tabsLocator1).toBeVisible();
    const box1 = await tabsLocator1.boundingBox();
    expect(box1).not.toBeNull();

    // Navegar a /recursos/aplicativos
    await page.goto(`${baseURL}/recursos/aplicativos`);
    const tabsLocator2 = page.locator('nav[aria-label="Secciones de Recursos"]');
    await expect(tabsLocator2).toBeVisible();
    const box2 = await tabsLocator2.boundingBox();
    expect(box2).not.toBeNull();

    // Navegar a /recursos/contactos
    await page.goto(`${baseURL}/recursos/contactos`);
    const tabsLocator3 = page.locator('nav[aria-label="Secciones de Recursos"]');
    await expect(tabsLocator3).toBeVisible();
    const box3 = await tabsLocator3.boundingBox();
    expect(box3).not.toBeNull();

    // Comprobamos posición en el extremo derecho consistente (tolerancia <= 5px en X por active tab font-weight, <= 1px en Y)
    expect(Math.abs(box1!.x - box2!.x)).toBeLessThanOrEqual(5);
    expect(Math.abs(box1!.y - box2!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(box1!.x - box3!.x)).toBeLessThanOrEqual(5);
    expect(Math.abs(box1!.y - box3!.y)).toBeLessThanOrEqual(1);
  });

  test("las barras de búsqueda y los empty states con botón Limpiar búsqueda funcionan unificados en Enlaces, Aplicativos y Contactos", async ({
    context,
    page,
  }) => {
    user = await createTestUserAndSession("agent");
    await setSessionCookie(context, user.signedSessionId);

    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4321";

    // 1. Probar en /recursos (Enlaces)
    await page.goto(`${baseURL}/recursos`);
    const linksSearch = page.locator("#important-links-search");
    await expect(linksSearch).toBeVisible();
    await linksSearch.fill("termino_inexistente_xyz_123");
    const linksEmpty = page.locator("#important-links-empty");
    await expect(linksEmpty).toBeVisible();
    await expect(linksEmpty.getByText("Sin resultados")).toBeVisible();
    const linksClearBtn = linksEmpty.getByRole("button", { name: "Limpiar búsqueda" });
    await expect(linksClearBtn).toBeVisible();
    await linksClearBtn.click();
    await expect(linksSearch).toHaveValue("");
    await expect(linksEmpty).toBeHidden();

    // 2. Probar en /recursos/aplicativos (Aplicativos)
    await page.goto(`${baseURL}/recursos/aplicativos`);
    const appsSearch = page.locator("#catalog-search");
    await expect(appsSearch).toBeVisible();
    await appsSearch.fill("termino_inexistente_xyz_123");
    const appsEmpty = page.locator("#catalog-empty-state");
    await expect(appsEmpty).toBeVisible();
    await expect(appsEmpty.getByText("Sin resultados")).toBeVisible();
    const appsClearBtn = appsEmpty.getByRole("button", { name: "Limpiar búsqueda" });
    await expect(appsClearBtn).toBeVisible();
    await appsClearBtn.click();
    await expect(appsSearch).toHaveValue("");
    await expect(appsEmpty).toBeHidden();

    // 3. Probar en /recursos/contactos (Contactos)
    await page.goto(`${baseURL}/recursos/contactos`);
    const contactsSearch = page.locator("#contacts-search");
    await expect(contactsSearch).toBeVisible();
    await contactsSearch.fill("termino_inexistente_xyz_123");
    const contactsEmpty = page.locator("#contacts-empty-state");
    await expect(contactsEmpty).toBeVisible();
    await expect(contactsEmpty.getByText("Sin resultados")).toBeVisible();
    const contactsClearBtn = contactsEmpty.getByRole("button", { name: "Limpiar búsqueda" });
    await expect(contactsClearBtn).toBeVisible();
    await contactsClearBtn.click();
    await expect(contactsSearch).toHaveValue("");
    await expect(contactsEmpty).toBeHidden();
  });
});
