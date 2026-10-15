const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * IP del cliente detrás del proxy inverso (#235). Sólo confía en el primer hop
 * de `X-Forwarded-For` cuando la conexión directa es loopback (Apache local);
 * así un cliente remoto no puede spoofear la IP y evadir el rate limit.
 */
export function resolveClientIp(
  socketAddress: string | undefined,
  forwardedFor: string | null | undefined,
): string {
  if (socketAddress && !LOOPBACK.has(socketAddress)) return socketAddress;
  const first = forwardedFor?.split(",")[0]?.trim();
  if (first) return first;
  return socketAddress ?? "unknown";
}
