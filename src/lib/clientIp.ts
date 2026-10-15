function isLoopback(addr: string): boolean {
  return addr === "::1" || addr === "::ffff:127.0.0.1" || addr.startsWith("127.");
}

/**
 * IP del cliente detrás del proxy inverso (#235). Sólo confía en
 * `X-Forwarded-For` cuando la conexión directa es loopback (Apache local), y
 * toma el **último** hop: `mod_proxy_http` *agrega* la IP real al final de la
 * cadena, así que el último valor es el que puso el proxy de confianza y un
 * cliente remoto no puede spoofearlo rotando el header.
 * Mismas semánticas que Express `trust proxy: "loopback"`.
 */
export function resolveClientIp(
  socketAddress: string | undefined,
  forwardedFor: string | null | undefined,
): string {
  if (socketAddress && !isLoopback(socketAddress)) return socketAddress;
  const chain = forwardedFor?.split(",").map((s) => s.trim());
  const last = chain?.[chain.length - 1];
  if (last) return last;
  return socketAddress ?? "unknown";
}
