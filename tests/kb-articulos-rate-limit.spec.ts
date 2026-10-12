import "dotenv/config";
import { expect, test, type BrowserContext } from "@playwright/test";
import { setSessionCookie } from "./helpers/auth";
import {
  KbTestFixture,
  readCsrfToken,
  uniqueToken,
  type KbTestMesa,
} from "./helpers/kb";

const REDIRECT = 302;
const LIMIT = 20;
const CREATE_PATH = "/base-conocimiento/create";
const THROTTLED_MESSAGE = "Demasiadas operaciones. Probá en unos minutos.";

let fixture: KbTestFixture;
let mesa: KbTestMesa;

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  mesa = await fixture.createMesa();
});

test.afterEach(async () => {
  await fixture.cleanup();
});

const postCreate = async (
  context: BrowserContext,
  csrfToken: string,
  helpdeskId: number,
) => {
  const response = await context.request.post(CREATE_PATH, {
    form: {
      title: `Rate ${uniqueToken()}`,
      category: "",
      content: `Contenido ${uniqueToken()}`,
      status: "draft",
      helpdeskId: String(helpdeskId),
      csrf_token: csrfToken,
    },
    maxRedirects: 0,
  });
  const locationHeader = response.headers().location;
  return {
    status: response.status(),
    location: locationHeader
      ? new URL(
          locationHeader,
          test.info().project.use.baseURL ?? "http://localhost:4321",
        )
      : null,
  };
};

const isThrottled = (result: { location: URL | null }) =>
  result.location?.searchParams.get("toast_msg") === THROTTLED_MESSAGE;

test("el alta de artículos corta al usuario en el límite", async ({
  context,
  page,
}) => {
  const admin = await fixture.createUser("admin", mesa);
  await setSessionCookie(context, admin.signedSessionId);
  const csrfToken = await readCsrfToken(page, CREATE_PATH);

  let indiceThrottle = -1;
  for (let i = 0; i < LIMIT + 1; i += 1) {
    const result = await postCreate(context, csrfToken, mesa.invgateId);
    if (isThrottled(result)) {
      indiceThrottle = i;
      break;
    }
    expect(result.status).toBe(REDIRECT);
  }

  expect(indiceThrottle).toBe(LIMIT);
});

test("un segundo usuario no hereda el corte del primero", async ({
  context,
  page,
}) => {
  const primero = await fixture.createUser("admin", mesa);
  const segundo = await fixture.createUser("admin", mesa);

  await setSessionCookie(context, primero.signedSessionId);
  const csrfPrimero = await readCsrfToken(page, CREATE_PATH);
  for (let i = 0; i < LIMIT + 1; i += 1) {
    await postCreate(context, csrfPrimero, mesa.invgateId);
  }

  await setSessionCookie(context, segundo.signedSessionId);
  const csrfSegundo = await readCsrfToken(page, CREATE_PATH);
  const resultado = await postCreate(context, csrfSegundo, mesa.invgateId);
  expect(resultado.status).toBe(REDIRECT);
  expect(isThrottled(resultado)).toBe(false);
});

test("los GET al formulario no consumen el presupuesto de escritura", async ({
  context,
  page,
}) => {
  const admin = await fixture.createUser("admin", mesa);
  await setSessionCookie(context, admin.signedSessionId);

  for (let i = 0; i < LIMIT; i += 1) {
    const response = await context.request.get(CREATE_PATH);
    expect(response.status()).toBe(200);
  }

  const csrfToken = await readCsrfToken(page, CREATE_PATH);
  const resultado = await postCreate(context, csrfToken, mesa.invgateId);
  expect(resultado.status).toBe(REDIRECT);
  expect(isThrottled(resultado)).toBe(false);
});
