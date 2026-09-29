import "dotenv/config";
import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { kbCategories } from "../src/db/schema";
import { cleanupTestUser, setSessionCookie } from "./helpers/auth";
import { KbTestFixture, uniqueToken, type KbTestMesa } from "./helpers/kb";

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

test("borrar el usuario que creó una categoría no falla y deja la categoría sin autor", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);

  const nombre = `FK ${uniqueToken()}`;
  await page.goto("/base-conocimiento/categorias");
  await page.locator("#kb-category-name").fill(nombre);
  await page.getByRole("button", { name: "Agregar categoría" }).click();
  await expect(page.getByText(nombre, { exact: true }).first()).toBeVisible();

  const [creada] = await db
    .select({
      id: kbCategories.id,
      createdByUserId: kbCategories.createdByUserId,
    })
    .from(kbCategories)
    .where(
      and(
        eq(kbCategories.helpdeskId, mesa.invgateId),
        eq(kbCategories.name, nombre),
      ),
    )
    .limit(1);
  expect(creada).toBeDefined();
  expect(creada?.createdByUserId).toBe(leader.userId);

  await cleanupTestUser(leader.userId, leader.sessionId);

  const [row] = await db
    .select({
      name: kbCategories.name,
      createdByUserId: kbCategories.createdByUserId,
    })
    .from(kbCategories)
    .where(eq(kbCategories.id, creada!.id));
  expect(row).toBeDefined();
  expect(row?.name).toBe(nombre);
  expect(row?.createdByUserId).toBeNull();
});
