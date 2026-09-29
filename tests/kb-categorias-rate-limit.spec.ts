import "dotenv/config";
import { expect, test, type BrowserContext } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { kbCategories } from "../src/db/schema";
import { setSessionCookie } from "./helpers/auth";
import { KbTestFixture, uniqueToken, type KbTestMesa } from "./helpers/kb";

const REDIRECT = 302;
const LIMIT = 20;
const CATEGORIAS_PATH = "/base-conocimiento/categorias";
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
  context: BrowserContext,
  name: string,
  options: { path?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; location: URL | null }> => {
  const response = await context.request.post(options.path ?? CATEGORIAS_PATH, {
    form: {
      action: "create",
      name,
      returnTo: CATEGORIAS_PATH,
    },
    headers: options.headers,
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

const isThrottled = (result: { location: URL | null }) =>
  result.location?.searchParams.get("toast_msg") === THROTTLED_MESSAGE;

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
    if (isThrottled(result)) {
      indiceThrottle = i;
      throttleLocation = result.location;
      break;
    }
  }

  expect(indiceThrottle).toBe(LIMIT);
  expect(throttleLocation?.searchParams.get("toast_type")).toBe("error");
  expect(throttleLocation?.pathname).toBe(CATEGORIAS_PATH);

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
  const nombreLeader = `Rate ${uniqueToken()}`;

  await setSessionCookie(context, leader.signedSessionId);
  for (let i = 0; i < LIMIT + 1; i += 1) {
    await postCreate(context, nombreLeader);
  }
  await setSessionCookie(context, otro.signedSessionId);

  // Nombre distinto: con el mismo nombre el handler tomaba el camino del
  // duplicado (200 sin Location) y el test pasaba por la razon equivocada.
  const nombreOtro = `Rate ${uniqueToken()}`;
  const result = await postCreate(context, nombreOtro);
  expect(result.status).toBe(REDIRECT);
  expect(result.location?.pathname).toBe(CATEGORIAS_PATH);
  expect(result.location?.searchParams.get("toast_type")).toBe("success");
  expect(result.location?.searchParams.get("toast_msg")).toBe(
    `Categoría "${nombreOtro}" creada.`,
  );

  const rows = await db
    .select({ createdByUserId: kbCategories.createdByUserId })
    .from(kbCategories)
    .where(
      and(
        eq(kbCategories.helpdeskId, mesa.invgateId),
        eq(kbCategories.name, nombreOtro),
      ),
    );
  expect(rows).toHaveLength(1);
  expect(rows[0].createdByUserId).toBe(otro.userId);
});

test("el alias con slash final comparte la venta con la ruta canónica", async ({
  context,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);

  const nombre = `Rate ${uniqueToken()}`;
  // La venta se llena entera por el alias con slash final...
  for (let i = 0; i < LIMIT; i += 1) {
    const result = await postCreate(context, nombre, {
      path: `${CATEGORIAS_PATH}/`,
    });
    expect(isThrottled(result)).toBe(false);
  }
  // ...y la ruta canonica es la que corta en la request siguiente.
  const canonical = await postCreate(context, nombre);
  expect(isThrottled(canonical)).toBe(true);
  expect(canonical.status).toBe(REDIRECT);
  expect(canonical.location?.pathname).toBe(CATEGORIAS_PATH);

  // El alias tampoco abre una segunda venta.
  const alias = await postCreate(context, nombre, {
    path: `${CATEGORIAS_PATH}/`,
  });
  expect(isThrottled(alias)).toBe(true);

  // Solo se creando una categoria: las 20 escrituras pasaron.
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

test("un POST anónimo se corta por IP y aterriza en /login", async ({
  context,
}) => {
  // El bucket `ip:` vive en el proceso del server: cualquier POST anonimo a
  // esta ruta dentro de la ventana de 60s (una corrida anterior incluida) lo
  // deja quemado. Por eso el test no fija el indice exacto del corte -- eso
  // lo prueba el unit de checkRateLimit con el perfil kbCategoryWrite -- y
  // exige el contrato: tras 21 peticiones, la ultima esta cortada.
  for (let i = 0; i < LIMIT + 1; i += 1) {
    const result = await postCreate(context, `Rate ${uniqueToken()}`);
    expect(result.status).toBe(REDIRECT);
    if (i < LIMIT) continue;

    expect(isThrottled(result)).toBe(true);
    // El corte no manda a una pagina que el anonimo no puede ver.
    expect(result.location?.pathname).toBe("/login");
    expect(result.location?.searchParams.get("toast_type")).toBe("error");
  }

  // Una sola asercion sobre rotar X-Forwarded-For: documenta el runtime de
  // test (el dev server de Astro resuelve clientAddress del socket, no del
  // header). Detras de un proxy que inyecte el header, la key `ip:` si
  // seguiria al header y esto dejaria de ser cierto.
  const rotado = await postCreate(context, `Rate ${uniqueToken()}`, {
    headers: { "X-Forwarded-For": "203.0.113.77" },
  });
  expect(isThrottled(rotado)).toBe(true);
});

test("un GET al ABM no consume el presupuesto de escritura", async ({
  context,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);

  for (let i = 0; i < LIMIT; i += 1) {
    const response = await context.request.get(CATEGORIAS_PATH);
    expect(response.status()).toBe(200);
  }

  const nombre = `Rate ${uniqueToken()}`;
  const result = await postCreate(context, nombre);
  expect(result.status).toBe(REDIRECT);
  expect(result.location?.searchParams.get("toast_msg")).toBe(
    `Categoría "${nombre}" creada.`,
  );
});
