import "dotenv/config";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/db/index";
import { kbArticles, kbCategories } from "../src/db/schema";
import { setSessionCookie } from "./helpers/auth";
import {
  KbTestFixture,
  readCsrfToken,
  setEasyMdeContent,
  uniqueToken,
  type KbTestMesa,
} from "./helpers/kb";

const REDIRECT = 302;
const CSRF_MESSAGE = "Token CSRF inválido o ausente";
const CSRF_TTL_MS = 60 * 60 * 1000;
const SECRET_KEY =
  process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";
const BASE_URL = "http://localhost:4321";

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

type PostResult = { status: number; location: URL | null; body: string };

const toResult = async (response: {
  status: () => number;
  headers: () => Record<string, string>;
  text: () => Promise<string>;
}): Promise<PostResult> => {
  const locationHeader = response.headers().location;
  return {
    status: response.status(),
    location: locationHeader ? new URL(locationHeader, BASE_URL) : null,
    body: await response.text(),
  };
};

const postCategorias = async (
  context: BrowserContext,
  form: Record<string, string>,
  csrfToken?: string,
): Promise<PostResult> =>
  toResult(
    await context.request.post("/base-conocimiento/categorias", {
      form: csrfToken ? { ...form, csrf_token: csrfToken } : form,
      maxRedirects: 0,
    }),
  );

const postPagina = async (
  context: BrowserContext,
  path: string,
  form: Record<string, string>,
  csrfToken?: string,
): Promise<PostResult> =>
  toResult(
    await context.request.post(path, {
      form: csrfToken ? { ...form, csrf_token: csrfToken } : form,
      maxRedirects: 0,
    }),
  );

const csrfFirmado = (sessionId: string, issuedAt: number): string => {
  const signature = createHmac("sha256", SECRET_KEY)
    .update(`${sessionId}.${issuedAt}`)
    .digest("hex");
  return `${sessionId}.${issuedAt}.${signature}`;
};

const csrfVencido = (token: string): string => {
  const [sessionId] = token.split(".");
  return csrfFirmado(sessionId, Date.now() - CSRF_TTL_MS - 60_000);
};

const csrfDeHtml = (html: string): string => {
  const match = html.match(/name="csrf_token"[^>]*value="([^"]+)"/);
  if (!match) throw new Error("El HTML re-renderizado no trae token CSRF");
  return match[1];
};

const expectDenegado = (result: PostResult, pathname: string) => {
  expect(result.status).toBe(REDIRECT);
  expect(result.location?.pathname).toBe(pathname);
  expect(result.location?.searchParams.get("toast_msg")).toBe(CSRF_MESSAGE);
  expect(result.location?.searchParams.get("toast_type")).toBe("error");
};

const expectReRender = (
  result: PostResult,
  valores: { title: string; content: string },
) => {
  expect(result.status).toBe(200);
  expect(result.location).toBeNull();
  expect(result.body).toContain(valores.title);
  expect(result.body).toContain(valores.content);
  return csrfDeHtml(result.body);
};

const catalogo = () =>
  db
    .select({ id: kbCategories.id, name: kbCategories.name })
    .from(kbCategories)
    .where(eq(kbCategories.helpdeskId, mesa.invgateId))
    .all();

const articulosPorTitulo = (title: string) =>
  db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(eq(kbArticles.title, title));

const crearCategoriaPorUi = async (page: Page, name: string) => {
  await page.goto("/base-conocimiento/categorias");
  await page.locator("#kb-category-name").fill(name);
  await page.getByRole("button", { name: "Agregar categoría" }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  const [row] = await db
    .select({ id: kbCategories.id })
    .from(kbCategories)
    .where(
      and(
        eq(kbCategories.helpdeskId, mesa.invgateId),
        eq(kbCategories.name, name),
      ),
    )
    .limit(1);
  if (!row) throw new Error(`Category "${name}" was not created`);
  return row.id;
};

test("el alta de categoría sin token CSRF se rechaza y no crea la fila", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);
  await page.goto("/base-conocimiento/categorias");

  const antes = await catalogo();
  const result = await postCategorias(context, {
    action: "create",
    name: `CSRF alta ${uniqueToken()}`,
    returnTo: "/base-conocimiento/categorias",
  });

  expectDenegado(result, "/base-conocimiento/categorias");
  expect(await catalogo()).toEqual(antes);
});

test("el renombre sin token CSRF se rechaza y no cascadea a los artículos", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);

  const nombre = `CSRF renombre ${uniqueToken()}`;
  const id = await crearCategoriaPorUi(page, nombre);
  await fixture.createArticle({
    mesa,
    authorUserId: leader.userId,
    title: `CSRF artículo ${uniqueToken()}`,
    category: nombre,
    status: "draft",
  });

  const renombrada = `${nombre} v2`;
  const result = await postCategorias(context, {
    action: "rename",
    id: String(id),
    name: renombrada,
    returnTo: "/base-conocimiento/categorias",
  });

  expectDenegado(result, "/base-conocimiento/categorias");
  const [row] = await db
    .select({ name: kbCategories.name })
    .from(kbCategories)
    .where(eq(kbCategories.id, id))
    .limit(1);
  expect(row?.name).toBe(nombre);
  const [cascada] = await db
    .select({ total: sql<number>`count(*)` })
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.helpdeskId, mesa.invgateId),
        eq(kbArticles.category, nombre),
      ),
    );
  expect(Number(cascada?.total)).toBe(1);
});

test("la baja de categoría sin token CSRF se rechaza y conserva la fila", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);

  const nombre = `CSRF baja ${uniqueToken()}`;
  const id = await crearCategoriaPorUi(page, nombre);

  const result = await postCategorias(context, {
    action: "delete",
    id: String(id),
    returnTo: "/base-conocimiento/categorias",
  });

  expectDenegado(result, "/base-conocimiento/categorias");
  const [row] = await db
    .select({ id: kbCategories.id })
    .from(kbCategories)
    .where(eq(kbCategories.id, id))
    .limit(1);
  expect(row).toBeDefined();
});

test("el alta de artículo sin token CSRF re-renderiza el editor y no crea la fila", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);
  await page.goto("/base-conocimiento/create");

  const titulo = `CSRF alta artículo ${uniqueToken()}`;
  await page.locator("#kb-title").fill(titulo);
  await page.locator("#kb-category").selectOption("Accesos");
  await setEasyMdeContent(page, `Contenido ${uniqueToken()}`);

  const contenido = "Contenido válido enviado sin token CSRF.";
  const result = await postPagina(context, "/base-conocimiento/create", {
    title: titulo,
    category: "Accesos",
    content: contenido,
    status: "draft",
  });

  expectReRender(result, { title: titulo, content: contenido });
  expect(await articulosPorTitulo(titulo)).toEqual([]);
});

test("la edición sin token CSRF re-renderiza el editor y no toca el artículo", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  const articulo = await fixture.createArticle({
    mesa,
    authorUserId: leader.userId,
    title: `CSRF edición ${uniqueToken()}`,
    content: "Contenido original.",
    category: "Accesos",
    status: "draft",
  });
  await setSessionCookie(context, leader.signedSessionId);
  await page.goto(`/base-conocimiento/edit/${articulo.id}`);

  const titulo = `${articulo.title} editado`;
  const contenido = "Contenido inyectado sin token.";
  const result = await postPagina(
    context,
    `/base-conocimiento/edit/${articulo.id}`,
    {
      title: titulo,
      content: contenido,
      category: "Accesos",
      status: "published",
    },
  );

  const tokenNuevo = expectReRender(result, {
    title: titulo,
    content: contenido,
  });
  const [row] = await db
    .select({
      title: kbArticles.title,
      content: kbArticles.content,
      status: kbArticles.status,
    })
    .from(kbArticles)
    .where(eq(kbArticles.id, articulo.id))
    .limit(1);
  expect(row?.title).toBe(articulo.title);
  expect(row?.content).toBe("Contenido original.");
  expect(row?.status).toBe("draft");

  const reintento = await postPagina(
    context,
    `/base-conocimiento/edit/${articulo.id}`,
    {
      title: titulo,
      content: contenido,
      category: "Accesos",
      status: "published",
    },
    tokenNuevo,
  );
  expect(reintento.status).toBe(REDIRECT);
  expect(reintento.location?.pathname).toBe(
    `/base-conocimiento/${articulo.id}`,
  );
  expect(reintento.location?.searchParams.get("toast_msg")).toBe(
    "Artículo publicado con éxito.",
  );
  const [guardado] = await db
    .select({
      title: kbArticles.title,
      content: kbArticles.content,
      status: kbArticles.status,
    })
    .from(kbArticles)
    .where(eq(kbArticles.id, articulo.id))
    .limit(1);
  expect(guardado?.title).toBe(titulo);
  expect(guardado?.content).toBe(contenido);
  expect(guardado?.status).toBe("published");
});

test("un token vencido conserva el borrador y permite reintentar con el token nuevo", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);

  const tokenDeLaPagina = await readCsrfToken(
    page,
    "/base-conocimiento/create",
  );
  expect(tokenDeLaPagina).toMatch(/^\S+\.\d+\.[0-9a-f]{64}$/);
  const [sessionId] = tokenDeLaPagina.split(".");

  const control = `CSRF control ${uniqueToken()}`;
  const aceptado = await postPagina(
    context,
    "/base-conocimiento/create",
    {
      title: control,
      category: "Accesos",
      content: "Control de la firma del spec.",
      status: "draft",
    },
    csrfFirmado(sessionId, Date.now()),
  );
  expect(aceptado.status).toBe(REDIRECT);
  expect(aceptado.location?.searchParams.get("toast_type")).toBe("success");
  expect(await articulosPorTitulo(control)).toHaveLength(1);

  const titulo = `CSRF vencido ${uniqueToken()}`;
  const contenido = "Draft de más de una hora que no puede perderse.";
  const vencido = await postPagina(
    context,
    "/base-conocimiento/create",
    {
      title: titulo,
      category: "Accesos",
      content: contenido,
      status: "draft",
    },
    csrfVencido(tokenDeLaPagina),
  );

  const tokenNuevo = expectReRender(vencido, {
    title: titulo,
    content: contenido,
  });
  expect(tokenNuevo).toMatch(/^\S+\.\d+\.[0-9a-f]{64}$/);
  expect(await articulosPorTitulo(titulo)).toEqual([]);

  const reintento = await postPagina(
    context,
    "/base-conocimiento/create",
    {
      title: titulo,
      category: "Accesos",
      content: contenido,
      status: "draft",
    },
    tokenNuevo,
  );
  expect(reintento.status).toBe(REDIRECT);
  expect(reintento.location?.searchParams.get("toast_msg")).toBe(
    "Artículo creado con éxito.",
  );
  expect(await articulosPorTitulo(titulo)).toHaveLength(1);
});

test("un token emitido para otra sesión se rechaza", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  const otro = await fixture.createUser("team_leader", mesa);

  await setSessionCookie(context, otro.signedSessionId);
  const tokenAjeno = await readCsrfToken(page, "/base-conocimiento/categorias");
  await setSessionCookie(context, leader.signedSessionId);

  const antes = await catalogo();
  const result = await postCategorias(
    context,
    {
      action: "create",
      name: `CSRF ajena ${uniqueToken()}`,
      returnTo: "/base-conocimiento/categorias",
    },
    tokenAjeno,
  );

  expectDenegado(result, "/base-conocimiento/categorias");
  expect(await catalogo()).toEqual(antes);
});

test("con el token de la página el alta de categoría se aplica", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);
  const token = await readCsrfToken(page, "/base-conocimiento/categorias");

  const nombre = `CSRF ok ${uniqueToken()}`;
  const result = await postCategorias(
    context,
    {
      action: "create",
      name: nombre,
      returnTo: "/base-conocimiento/categorias",
    },
    token,
  );

  expect(result.status).toBe(REDIRECT);
  expect(result.location?.searchParams.get("toast_msg")).toBe(
    `Categoría "${nombre}" creada.`,
  );
  expect(result.location?.searchParams.get("toast_type")).toBe("success");
  const [creada] = await db
    .select({ id: kbCategories.id })
    .from(kbCategories)
    .where(
      and(
        eq(kbCategories.helpdeskId, mesa.invgateId),
        eq(kbCategories.name, nombre),
      ),
    )
    .limit(1);
  expect(creada).toBeDefined();
});

test("el alta inline de create manda el token de la página", async ({
  context,
  page,
}) => {
  const leader = await fixture.createUser("team_leader", mesa);
  await setSessionCookie(context, leader.signedSessionId);
  await page.goto("/base-conocimiento/create");

  await expect(
    page.locator('#kb-new-category-form input[name="csrf_token"]'),
  ).toHaveValue(/^\S+\.\d+\.[0-9a-f]{64}$/);

  const nombre = `CSRF inline ${uniqueToken()}`;
  await page.getByText("Nueva categoría", { exact: true }).click();
  await page.getByLabel("Nombre de la nueva categoría").fill(nombre);
  await page.getByRole("button", { name: "Crear categoría" }).click();

  await expect(page.locator("#kb-category")).toHaveValue(nombre);
  const [creada] = await db
    .select({ id: kbCategories.id })
    .from(kbCategories)
    .where(
      and(
        eq(kbCategories.helpdeskId, mesa.invgateId),
        eq(kbCategories.name, nombre),
      ),
    )
    .limit(1);
  expect(creada).toBeDefined();
});
