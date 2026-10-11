import { getBaseNoSlash } from "@lib/baseUrl";

export type ToastType = "success" | "error" | "warning";

export function redirectWithToast(
  path: string,
  message: string,
  type: ToastType = "success",
  base: string = getBaseNoSlash(),
): Response {
  const cleanBase = base;
  const hashIndex = path.indexOf("#");
  const pathname = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const separator = pathname.includes("?") ? "&" : "?";
  const url = `${cleanBase}${pathname}${separator}toast_msg=${encodeURIComponent(message)}&toast_type=${type}${hash}`;
  return new Response(null, { status: 302, headers: { Location: url } });
}
