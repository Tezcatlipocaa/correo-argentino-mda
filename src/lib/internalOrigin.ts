export function getInternalOrigin(): string {
  const configured =
    import.meta.env?.INTERNAL_ORIGIN || process.env.INTERNAL_ORIGIN;
  if (configured) return configured.replace(/\/+$/, "");
  return `http://127.0.0.1:${process.env.PORT || 4321}`;
}
