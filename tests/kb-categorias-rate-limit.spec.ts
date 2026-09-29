import "dotenv/config";
import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { kbCategories } from "../src/db/schema";
import { setSessionCookie } from "./helpers/auth";
import { KbTestFixture, uniqueToken, type KbTestMesa } from "./helpers/kb";

const REDIRECT = 302;
const LIMIT = 20;
const THROTTLED_MESSAGE = "Demasiadas operaciones. Probá en unos minutos.";

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

const postCreate = async (
  context: any,
  name: string,
): Promise<{ status: number; location: URL | null }> => {
  const response = await context.request.post("/base-conocimiento/categorias", {
    form: {
      action: "create",
      name,
      returnTo: "/base-conocimiento/categorias",
    },
    maxRedirects: 0,
  });
  const locationHeader = response.headers().location;
  return {
    status: response.status(),
    location: locationHeader
      ? new URL(locationHeader, "http://localhost:4321")
      : null,
  };
};

test("el ABM corta las escrituras del mismo usuario en la venta de un minuto", async ({
  context,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);

  const nombre = `Rate ${uniqueToken()}`;
  let indiceThrottle = -1;
  let throttleLocation: URL | null = null;

  for (let i = 0; i < LIMIT + 1; i += 1) {
    const result = await postCreate(context, nombre);
    if (result.location?.searchParams.get("toast_msg") === THROTTLED_MESSAGE) {
      indiceThrottle = i;
      throttleLocation = result.location;
      break;
    }
  }

  expect(indiceThrottle).toBe(LIMIT);
  expect(throttleLocation?.searchParams.get("toast_type")).toBe("error");
  expect(throttleLocation?.pathname).toBe("/base-conocimiento/categorias");

  const rows = await db
    .select({ id: kbCategories.id })
    .from(kbCategories)
    .where(
      and(
        eq(kbCategories.helpdeskId, mesa.invgateId),
        eq(kbCategories.name, nombre),
      ),
    );
  expect(rows).toHaveLength(1);
});

test("un segundo usuario no hereda el corte del primero", async ({
  context,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  const otro = await fixture.createUser("team_leader", mesa);
  const nombre = `Rate ${uniqueToken()}`;

  await setSessionCookie(context, leader.signedSessionId);
  for (let i = 0; i < LIMIT + 1; i += 1) {
    await postCreate(context, nombre);
  }
  await setSessionCookie(context, otro.signedSessionId);

  const result = await postCreate(context, nombre);
  expect(result.status).toBe(200);
  expect(result.location).toBeNull();

  const [row] = await db
    .select({ createdByUserId: kbCategories.createdByUserId })
    .from(kbCategories)
    .where(
      and(
        eq(kbCategories.helpdeskId, mesa.invgateId),
        eq(kbCategories.name, nombre),
      ),
    )
    .limit(1);
  expect(row).toBeDefined();
  expect(row?.createdByUserId).toBe(leader.userId);
});

test("un GET al ABM no consume el presupuesto de escritura", async ({
  context,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);

  for (let i = 0; i < LIMIT; i += 1) {
    const response = await context.request.get("/base-conocimiento/categorias");
    expect(response.status()).toBe(200);
  }

  const nombre = `Rate ${uniqueToken()}`;
  const result = await postCreate(context, nombre);
  expect(result.status).toBe(REDIRECT);
  expect(result.location?.searchParams.get("toast_msg")).toBe(
    `Categoría "${nombre}" creada.`,
  );
});
