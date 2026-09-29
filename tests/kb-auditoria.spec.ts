import "dotenv/config";
import { expect, test } from "@playwright/test";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../src/db/index";
import { auditLogs, kbCategories } from "../src/db/schema";
import { setSessionCookie } from "./helpers/auth";
import {
  KbTestFixture,
  setEasyMdeContent,
  uniqueToken,
  type KbTestMesa,
} from "./helpers/kb";

let fixture: KbTestFixture;
let mesa: KbTestMesa;

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  mesa = await fixture.createMesa();
});

test.afterEach(async () => {
  db.delete(kbCategories)
    .where(eq(kbCategories.helpdeskId, mesa.invgateId))
    .run();
  await fixture.cleanup();
});

const readAuditRows = (username: string, watermark: number) =>
  db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      beforeState: auditLogs.beforeState,
      afterState: auditLogs.afterState,
    })
    .from(auditLogs)
    .where(and(gt(auditLogs.id, watermark), eq(auditLogs.username, username)))
    .all();

const currentAuditWatermark = (): number => {
  const [row] = db
    .select({ maxId: sql<number | null>`MAX(${auditLogs.id})` })
    .from(auditLogs)
    .all();
  return Number(row?.maxId ?? 0);
};

test("el alta de artículo y su publicación dejan registros estructurados", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);
  const watermark = fixture.auditLogWatermark;

  const title = `Auditoría ${uniqueToken()}`;
  await page.goto("/base-conocimiento/create");
  await page.locator("#kb-title").fill(title);
  await page.locator("#kb-category").selectOption("Accesos");
  await setEasyMdeContent(page, `Contenido ${uniqueToken()}`);
  await page.getByRole("button", { name: "Crear artículo" }).click();
  await expect(page.locator("#global-toast-container")).toContainText(
    "Artículo creado con éxito.",
  );

  const [created] = readAuditRows(leader.username, watermark);
  expect(created).toBeDefined();
  expect(created?.entityType).toBe("kb_article");
  expect(created?.beforeState).toBeNull();
  expect(created?.afterState).toMatchObject({
    title,
    helpdeskId: mesa.invgateId,
    category: "Accesos",
    status: "draft",
  });
  if (created?.entityId) fixture.trackArticle(created.entityId);

  const watermarkAfterCreate = currentAuditWatermark();
  await page.goto(`/base-conocimiento/edit/${created!.entityId!}`);
  await page.locator("#kb-status").selectOption("published");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator("#global-toast-container")).toContainText(
    "Artículo publicado con éxito.",
  );

  const rows = readAuditRows(leader.username, watermarkAfterCreate);
  const update = rows.find((row) =>
    row.action.includes("Actualizó el artículo"),
  );
  const publication = rows.find((row) =>
    row.action.includes("Publicó el artículo"),
  );
  expect(update).toBeDefined();
  expect(publication).toBeDefined();
  expect(rows).toHaveLength(2);
  expect(update?.entityType).toBe("kb_article");
  expect(update?.beforeState).toMatchObject({ status: "draft" });
  expect(update?.afterState).toMatchObject({ status: "published" });
  expect(publication?.entityType).toBe("kb_article");
  expect(publication?.entityId).toBe(created?.entityId);
  expect(publication?.beforeState).toMatchObject({ status: "draft" });
  expect(publication?.afterState).toMatchObject({ status: "published" });
});

test("el renombrado de categoría registra el nombre anterior y la cascada", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);
  const watermark = fixture.auditLogWatermark;

  const nombre = `Cascada audit ${uniqueToken()}`;
  await page.goto("/base-conocimiento/categorias");
  await page.locator("#kb-category-name").fill(nombre);
  await page.getByRole("button", { name: "Agregar categoría" }).click();
  await expect(page.getByText(nombre, { exact: true }).first()).toBeVisible();

  await fixture.createArticle({
    mesa,
    authorUserId: leader.userId,
    title: `Artículo cascada ${uniqueToken()}`,
    category: nombre,
    status: "draft",
  });

  const renombrada = `${nombre} v2`;
  const row = page.locator("li").filter({ hasText: nombre });
  await row.locator('input[name="name"]').fill(renombrada);
  await row.locator('input[name="name"]').press("Enter");
  await expect(
    page.getByText(renombrada, { exact: true }).first(),
  ).toBeVisible();

  const rows = readAuditRows(leader.username, watermark);
  const rename = rows.find((row) =>
    row.action.includes("Actualizó la categoría"),
  );
  expect(rename).toBeDefined();
  expect(rename?.entityType).toBe("kb_category");
  expect(rename?.beforeState).toMatchObject({ name: nombre });
  expect(rename?.afterState).toMatchObject({
    name: renombrada,
    articlesUpdated: 1,
  });
});

test("la baja bloqueada de una categoría registra el conteo de artículos en uso", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);
  const watermark = fixture.auditLogWatermark;

  const nombre = `En uso audit ${uniqueToken()}`;
  await page.goto("/base-conocimiento/categorias");
  await page.locator("#kb-category-name").fill(nombre);
  await page.getByRole("button", { name: "Agregar categoría" }).click();
  await expect(page.getByText(nombre, { exact: true }).first()).toBeVisible();

  await fixture.createArticle({
    mesa,
    authorUserId: leader.userId,
    title: `Artículo en uso ${uniqueToken()}`,
    category: nombre,
    status: "draft",
  });

  const row = page.locator("li").filter({ hasText: nombre });
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: `Eliminar ${nombre}` }).click();
  await expect(
    page.getByText(
      "La categoría está en uso en artículos y no se puede eliminar.",
    ),
  ).toBeVisible();

  const rows = readAuditRows(leader.username, watermark);
  const refused = rows.find((row) =>
    row.action.includes("No eliminó la categoría"),
  );
  expect(refused).toBeDefined();
  expect(refused?.entityType).toBe("kb_category");
  expect(refused?.afterState).toBeNull();
  expect(refused?.beforeState).toMatchObject({
    name: nombre,
    articlesInUse: 1,
  });
});
