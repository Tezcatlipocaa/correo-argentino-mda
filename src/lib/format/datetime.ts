const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });

/** Formatea un timestamp epoch (segundos) como fecha+hora corta en español. */
export function formatEpochDateTime(epochSeconds: number): string {
  return dateTimeFormatter.format(new Date(epochSeconds * 1000));
}

/** Formatea un timestamp epoch (segundos) como fecha corta (sin hora). */
export function formatEpochDate(epochSeconds: number): string {
  return dateFormatter.format(new Date(epochSeconds * 1000));
}
