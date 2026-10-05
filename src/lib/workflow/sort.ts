export interface SortableNode {
  createdAt: number | null;
  refId: number;
}

/** Timeline ascendente: sin fecha va al final; desempate por refId. */
export function compareChronologically<T extends SortableNode>(a: T, b: T): number {
  return (
    (a.createdAt ?? Number.MAX_SAFE_INTEGER) -
      (b.createdAt ?? Number.MAX_SAFE_INTEGER) || a.refId - b.refId
  );
}

export function sortChronologically<T extends SortableNode>(nodes: readonly T[]): T[] {
  return [...nodes].sort(compareChronologically);
}
