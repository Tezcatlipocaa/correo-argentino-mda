/**
 * Ejecuta `mapper` sobre `items` con concurrencia acotada, preservando el
 * orden de los resultados. Para acotar ráfagas de HTTP cuando el pipeline
 * dispara una llamada por elemento (tareas/comentarios de hijos en el
 * detalle de automatización).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      for (;;) {
        const current = nextIndex;
        nextIndex += 1;
        if (current >= items.length) return;
        results[current] = await mapper(items[current], current);
      }
    },
  );

  await Promise.all(workers);
  return results;
}
