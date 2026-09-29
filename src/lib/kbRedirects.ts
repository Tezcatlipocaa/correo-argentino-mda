const PARSE_ORIGIN = "http://kb-redirects.invalid";

const KB_PATH_PREFIX = "/base-conocimiento/";
export const KB_CATEGORIAS_PATH = "/base-conocimiento/categorias";
const KB_CREATE_PATH = "/base-conocimiento/create";
const KB_EDIT_PATH_PREFIX = "/base-conocimiento/edit/";

function basePrefix(base: string): string {
  return base === "/" ? "" : base.replace(/\/+$/, "");
}

export function withBase(base: string, path: string): string {
  return `${basePrefix(base)}${path}`;
}

function parse(value: string): URL | null {
  try {
    return new URL(value, PARSE_ORIGIN);
  } catch {
    return null;
  }
}

export function kbPathname(value: string): string {
  return parse(value)?.pathname ?? "";
}

export function normalizeKbReturnPath(
  raw: string,
  base: string,
): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;

  const url = parse(raw);
  if (!url) return null;

  const prefix = basePrefix(base);
  let pathname = url.pathname;
  if (prefix && pathname.startsWith(`${prefix}/`)) {
    pathname = pathname.slice(prefix.length);
  } else if (prefix && pathname === prefix) {
    pathname = "/";
  }

  if (!pathname.startsWith(KB_PATH_PREFIX)) return null;
  return `${pathname}${url.search}${url.hash}`;
}

export function isCategoryFormKbPath(pathname: string): boolean {
  return (
    pathname === KB_CREATE_PATH || pathname.startsWith(KB_EDIT_PATH_PREFIX)
  );
}

export function buildCategoryRedirectTarget(input: {
  returnTo: string;
  base: string;
  createdName: string;
  fromCategoryForm: boolean;
}): string {
  const normalized = normalizeKbReturnPath(input.returnTo, input.base);
  if (!normalized) return KB_CATEGORIAS_PATH;
  if (!input.createdName || !input.fromCategoryForm) return normalized;

  const url = parse(normalized);
  if (!url) return KB_CATEGORIAS_PATH;
  url.searchParams.set("nueva_categoria", input.createdName);
  return `${url.pathname}${url.search}${url.hash}`;
}
