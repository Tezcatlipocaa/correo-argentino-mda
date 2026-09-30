import "dotenv/config";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { kbCategories } from "../src/db/schema";
import { setSessionCookie } from "./helpers/auth";
import { KbTestFixture, uniqueToken, type KbTestMesa } from "./helpers/kb";

const DEFAULT_CATEGORIES = [
  "Accesos",
  "Guías",
  "Preguntas frecuentes",
  "Procedimientos",
  "Soluciones",
];

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

const catalogNames = () =>
  db
    .select({ name: kbCategories.name })
    .from(kbCategories)
    .where(eq(kbCategories.helpdeskId, mesa.invgateId))
    .all()
    .map((row) => row.name)
    .sort();

test("una mesa nueva muestra los 5 defaults en la primera visita", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);

  expect(catalogNames()).toEqual([]);

  await page.goto("/base-conocimiento/categorias");

  for (const label of DEFAULT_CATEGORIES) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  expect(catalogNames()).toEqual([...DEFAULT_CATEGORIES].sort());
});

test("una mesa nunca queda con una sola categoría", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);
  await page.goto("/base-conocimiento/categorias");
  await expect(
    page.getByText("Accesos", { exact: true }).first(),
  ).toBeVisible();

  db.delete(kbCategories)
    .where(eq(kbCategories.helpdeskId, mesa.invgateId))
    .run();
  expect(catalogNames()).toEqual([]);

  const nombre = `Única ${uniqueToken()}`;
  await page.locator("#kb-category-name").fill(nombre);
  await page.getByRole("button", { name: "Agregar categoría" }).click();
  await expect(page.getByText(nombre, { exact: true }).first()).toBeVisible();

  expect(catalogNames()).toEqual([...DEFAULT_CATEGORIES, nombre].sort());
});

test("borrar los 5 defaults los hace reaparecer en la siguiente lectura", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);
  await page.goto("/base-conocimiento/categorias");
  await expect(
    page.getByText("Accesos", { exact: true }).first(),
  ).toBeVisible();

  db.delete(kbCategories)
    .where(eq(kbCategories.helpdeskId, mesa.invgateId))
    .run();
  expect(catalogNames()).toEqual([]);

  await page.reload();

  for (const label of DEFAULT_CATEGORIES) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  expect(catalogNames()).toEqual([...DEFAULT_CATEGORIES].sort());
});
