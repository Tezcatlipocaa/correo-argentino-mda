import rawTreeData from "./mda-ti-canonical.json";

export interface MdaTreeNode {
  id?: number | string;
  name: string;
  type?: string;
  tickets: number;
  oldPath?: string;
  conf?: boolean;
  pend?: boolean;
  children: MdaTreeNode[];
  n?: string;
  v?: number;
  t?: string;
  o?: string;
  h?: MdaTreeNode[];
}

export interface MdaPropuestaC {
  id?: string | number;
  name: string;
  families: MdaTreeNode[];
  standalone: MdaTreeNode[];
  retired: MdaTreeNode[];
  children: MdaTreeNode[];
  totalLeaves: number;
  totalNodes: number;
  maxDepth: number;
  length: number;
  [key: number]: MdaTreeNode;
  [Symbol.iterator](): Iterator<MdaTreeNode>;
}

export interface MdaComparativaModelMetrics {
  totalNodes: number;
  deadNodes: number;
  maxDepth?: number;
  selectionsAvg?: number;
  leaves: number;
  firstScreenOptions: string;
  maxScreenOptions: number;
  ticketsUnder2Selections: number;
  ticketsUnder3Selections: number;
  ticketsOver6Selections: number;
  repeatingParentName: number;
  singleChildNodes: number;
  intermediateWithTickets: number;
  homonymsUnderParent: number;
  twoParentsConflict: number;
}

export interface MdaComparativaRow {
  metric: string;
  unit?: string;
  actual: string;
  a: string;
  b: string;
  c: string;
  mejor?: string;
}

export interface MdaComparativa {
  actual: MdaComparativaModelMetrics;
  propuestaA: MdaComparativaModelMetrics;
  propuestaB: MdaComparativaModelMetrics;
  propuestaC: MdaComparativaModelMetrics;
  rows: MdaComparativaRow[];
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function normalizeNode(raw: Record<string, unknown> | null | undefined): MdaTreeNode {
  if (!raw) {
    return {
      name: "",
      tickets: 0,
      children: [],
      n: "",
      v: 0,
      h: [],
    };
  }

  const rawChildren = Array.isArray(raw.children)
    ? raw.children
    : Array.isArray(raw.h)
    ? raw.h
    : [];

  const children = rawChildren.map((item) =>
    normalizeNode(item as Record<string, unknown>)
  );

  const name = String(raw.name ?? raw.n ?? "");
  const tickets = Number(raw.tickets ?? raw.v ?? 0);
  const type = typeof raw.type === "string" ? raw.type : typeof raw.t === "string" ? raw.t : undefined;
  const oldPath = typeof raw.oldPath === "string" ? raw.oldPath : typeof raw.o === "string" ? raw.o : undefined;
  const conf = Boolean(raw.conf);
  const pend = Boolean(raw.pend);
  const id =
    raw.id !== undefined && raw.id !== null
      ? typeof raw.id === "string" && !isNaN(Number(raw.id))
        ? Number(raw.id)
        : (raw.id as number | string)
      : undefined;

  const node: MdaTreeNode = {
    id,
    name,
    type,
    tickets,
    ...(oldPath ? { oldPath } : {}),
    ...(conf ? { conf: true } : {}),
    ...(pend ? { pend: true } : {}),
    children,
    n: name,
    v: tickets,
    t: type,
    ...(oldPath ? { o: oldPath } : {}),
    h: children,
  };

  return node;
}

export function countTreeLeaves(
  target:
    | MdaTreeNode
    | MdaTreeNode[]
    | { families?: MdaTreeNode[]; children?: MdaTreeNode[]; totalLeaves?: number }
): number {
  if (!target) return 0;
  if (Array.isArray(target)) {
    return target.reduce((acc, item) => acc + countTreeLeaves(item), 0);
  }
  if ("families" in target && Array.isArray(target.families)) {
    if ("children" in target && Array.isArray(target.children)) {
      return countTreeLeaves(target.children);
    }
    return countTreeLeaves(target.families);
  }
  const node = target as MdaTreeNode;
  if (!node.children || node.children.length === 0) {
    return 1;
  }
  return node.children.reduce((acc, child) => acc + countTreeLeaves(child), 0);
}

export function countTreeNodes(
  target:
    | MdaTreeNode
    | MdaTreeNode[]
    | { families?: MdaTreeNode[]; children?: MdaTreeNode[]; totalNodes?: number }
): number {
  if (!target) return 0;
  if (Array.isArray(target)) {
    return target.reduce((acc, item) => acc + countTreeNodes(item), 0);
  }
  if ("families" in target && Array.isArray(target.families)) {
    if ("children" in target && Array.isArray(target.children)) {
      return countTreeNodes(target.children);
    }
    return countTreeNodes(target.families);
  }
  const node = target as MdaTreeNode;
  let count = 1;
  if (node.children) {
    count += node.children.reduce((acc, child) => acc + countTreeNodes(child), 0);
  }
  return count;
}

export function getTreeMaxDepth(
  target:
    | MdaTreeNode
    | MdaTreeNode[]
    | { families?: MdaTreeNode[]; children?: MdaTreeNode[]; maxDepth?: number }
): number {
  if (!target) return 0;
  if (Array.isArray(target)) {
    return Math.max(0, ...target.map((item) => getTreeMaxDepth(item)));
  }
  if ("families" in target && Array.isArray(target.families)) {
    if ("children" in target && Array.isArray(target.children)) {
      return getTreeMaxDepth(target.children);
    }
    return getTreeMaxDepth(target.families);
  }
  const node = target as MdaTreeNode;
  if (!node.children || node.children.length === 0) {
    return 1;
  }
  return 1 + Math.max(0, ...node.children.map((child) => getTreeMaxDepth(child)));
}

export const MDA_TI_ARBOL_ACTUAL: MdaTreeNode = deepFreeze(
  normalizeNode(rawTreeData.actual as Record<string, unknown>)
);

export const MDA_TI_PROPUESTA_A: MdaTreeNode[] = deepFreeze(
  (rawTreeData.a || []).map((item) => normalizeNode(item as Record<string, unknown>))
);

export const MDA_TI_PROPUESTA_B: MdaTreeNode[] = deepFreeze(
  (rawTreeData.b || []).map((item) => normalizeNode(item as Record<string, unknown>))
);

const rawC = (rawTreeData.c || []).map((item) =>
  normalizeNode(item as Record<string, unknown>)
);
const familiesC = rawC.filter((n) => n.type === "l1");
const standaloneC = rawC.filter((n) => n.type === "int");
const retiredC = rawC.filter((n) => n.type === "dead");
const childrenC = [...familiesC, ...standaloneC];

const propuestaCBase = {
  id: "propuesta_c",
  name: "Propuesta C - Híbrida (Recomendada)",
  families: familiesC,
  standalone: standaloneC,
  retired: retiredC,
  children: childrenC,
  totalLeaves: countTreeLeaves(childrenC),
  totalNodes: countTreeNodes(childrenC),
  maxDepth: getTreeMaxDepth(childrenC),
  length: familiesC.length,
  [Symbol.iterator]() {
    return familiesC[Symbol.iterator]();
  },
};

for (let i = 0; i < familiesC.length; i++) {
  Object.defineProperty(propuestaCBase, i, {
    value: familiesC[i],
    enumerable: true,
    configurable: true,
  });
}

export const MDA_TI_PROPUESTA_C: MdaPropuestaC = deepFreeze(
  propuestaCBase as unknown as MdaPropuestaC
);

export const MDA_TI_COMPARATIVA: MdaComparativa = deepFreeze({
  actual: {
    totalNodes: 719,
    deadNodes: 377,
    maxDepth: 7,
    selectionsAvg: 4.71,
    leaves: 490,
    firstScreenOptions: "11 ramas",
    maxScreenOptions: 11,
    ticketsUnder2Selections: 209,
    ticketsUnder3Selections: 1539,
    ticketsOver6Selections: 552,
    repeatingParentName: 72,
    singleChildNodes: 39,
    intermediateWithTickets: 2,
    homonymsUnderParent: 0,
    twoParentsConflict: 0,
  },
  propuestaA: {
    totalNodes: 453,
    deadNodes: 0,
    maxDepth: 3,
    selectionsAvg: 3.0,
    leaves: 340,
    firstScreenOptions: "5 intenciones",
    maxScreenOptions: 42,
    ticketsUnder2Selections: 0,
    ticketsUnder3Selections: 11875,
    ticketsOver6Selections: 0,
    repeatingParentName: 0,
    singleChildNodes: 0,
    intermediateWithTickets: 0,
    homonymsUnderParent: 64,
    twoParentsConflict: 36,
  },
  propuestaB: {
    totalNodes: 392,
    deadNodes: 0,
    maxDepth: 2,
    selectionsAvg: 2.0,
    leaves: 340,
    firstScreenOptions: "52 sistemas",
    maxScreenOptions: 56,
    ticketsUnder2Selections: 11875,
    ticketsUnder3Selections: 11875,
    ticketsOver6Selections: 0,
    repeatingParentName: 0,
    singleChildNodes: 0,
    intermediateWithTickets: 0,
    homonymsUnderParent: 64,
    twoParentsConflict: 0,
  },
  propuestaC: {
    totalNodes: 402,
    deadNodes: 0,
    maxDepth: 3,
    selectionsAvg: 3.0,
    leaves: 340,
    firstScreenOptions: "10 familias",
    maxScreenOptions: 28,
    ticketsUnder2Selections: 0,
    ticketsUnder3Selections: 11875,
    ticketsOver6Selections: 0,
    repeatingParentName: 0,
    singleChildNodes: 0,
    intermediateWithTickets: 0,
    homonymsUnderParent: 64,
    twoParentsConflict: 0,
  },
  rows: (rawTreeData.comp || []).map((row: Record<string, unknown>) => ({
    metric: String(row.m ?? ""),
    unit: typeof row.u === "string" ? row.u : undefined,
    actual: String(row.actual ?? ""),
    a: String(row.a ?? ""),
    b: String(row.b ?? ""),
    c: String(row.c ?? ""),
    mejor: typeof row.mejor === "string" ? row.mejor : undefined,
  })),
});
