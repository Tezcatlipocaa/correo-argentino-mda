import "dotenv/config";
import { expect, test } from "@playwright/test";
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

type PostResult = { status: number; location: URL | null };

const postCategorias = async (
  context: any,
  form: Record<string, string>,
  csrfToken?: string,
): Promise<PostResult> => {
  const response = await context.request.post("/base-conocimiento/categorias", {
    form: csrfToken ? { ...form, csrf_token: csrfToken } : form,
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

const postPagina = async (
  context: any,
  path: string,
  form: Record<string, string>,
  csrfToken?: string,
): Promise<PostResult> => {
  const response = await context.request.post(path, {
    form: csrfToken ? { ...form, csrf_token: csrfToken } : form,
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

const expectDenegado = (result: PostResult, pathname: string) => {
  expect(result.status).toBe(REDIRECT);
  expect(result.location?.pathname).toBe(pathname);
  expect(result.location?.searchParams.get("toast_msg")).toBe(CSRF_MESSAGE);
  expect(result.location?.searchParams.get("toast_type")).toBe("error");
};

const catalogo = () =>
  db
    .select({ id: kbCategories.id, name: kbCategories.name })
    .from(kbCategories)
    .where(eq(kbCategories.helpdeskId, mesa.invgateId))
    .all();

const crearCategoriaPorUi = async (page: any, name: string) => {
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

test("el alta de artículo sin token CSRF se rechaza y no crea la fila", async ({
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

  const result = await postPagina(context, "/base-conocimiento/create", {
    title: titulo,
    category: "Accesos",
    content: "Contenido válido enviado sin token CSRF.",
    status: "draft",
  });

  expectDenegado(result, "/base-conocimiento");
  const rows = await db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(eq(kbArticles.title, titulo));
  expect(rows).toEqual([]);
});

test("la edición sin token CSRF se rechaza y no cambia título, contenido ni estado", async ({
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

  const result = await postPagina(
    context,
    `/base-conocimiento/edit/${articulo.id}`,
    {
      title: `${articulo.title} editado`,
      content: "Contenido inyectado sin token.",
      category: "Accesos",
      status: "published",
    },
  );

  expectDenegado(result, "/base-conocimiento");
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
