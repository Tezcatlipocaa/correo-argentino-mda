export function jsonResponse(
  data: unknown,
  status = 200,
  cacheControl?: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cacheControl) {
    headers["Cache-Control"] = cacheControl;
  }
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

export function jsonError(
  message: string,
  status = 400,
  cacheControl?: string,
) {
  // #307: los 401/403 nunca deben cachearse (proxy/intermediario). Default
  // acá para no depender de que cada caller pase "no-store" a mano.
  const cc =
    cacheControl ?? (status === 401 || status === 403 ? "no-store" : undefined);
  return jsonResponse({ error: message }, status, cc);
}

export function sanitizeError(
  error: unknown,
  genericMsg = "Error interno del servidor",
): string {
  if (import.meta.env.DEV) {
    return error instanceof Error ? error.message : String(error);
  }
  return genericMsg;
}
