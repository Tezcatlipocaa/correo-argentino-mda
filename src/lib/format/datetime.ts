const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Formatea un timestamp epoch (segundos) como fecha+hora corta en español. */
export function formatEpochDateTime(epochSeconds: number): string {
  return dateTimeFormatter.format(new Date(epochSeconds * 1000));
}
