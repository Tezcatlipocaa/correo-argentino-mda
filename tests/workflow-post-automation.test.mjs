import {
  classifyCategoryPath,
  isRequestTitle,
  selectMosaicErrors,
  summarizeByKind,
  titleMentionsBranch,
} from "../src/lib/workflow/post-automation";

/**
 * Verificación del matcher/clasificador de errores post-automatización
 * (funciones puras). Ejecución: npx tsx tests/workflow-post-automation.test.mjs
 */

const DAY = 86_400;
const closedAt = 1_800_000_000;

const failures = [];
function check(name, condition) {
  if (condition) {
    console.log(`ok - ${name}`);
  } else {
    failures.push(`FAIL: ${name}`);
  }
}

// Clasificación por ruta de categoría (rutas reales de producción).
check(
  "classifyCategoryPath: hardware (FieldServices / HW TMosaic)",
  classifyCategoryPath(
    "mesa de ayuda ti » fieldservices » servtecnico suc » terminal mosaic » hw tmosaic » impresora labels » label consulta",
  ) === "hardware" &&
    classifyCategoryPath(
      "mesa de ayuda ti » fieldservices » servtecnico suc » terminal mosaic » hw tmosaic » teclado/mouse » teclado no funciona",
    ) === "hardware",
);
check(
  "classifyCategoryPath: mosaic (software)",
  classifyCategoryPath(
    "mesa de ayuda ti » accesos y aplicaciones » comercial » mosaic » error » mosaic fatal error #857",
  ) === "mosaic" &&
    classifyCategoryPath(
      "ti tecnologia informatica » gestion de servicios » soporte tecnico ti » aplicaciones » m-o » mosaic » fatal error",
    ) === "mosaic",
);
check(
  "classifyCategoryPath: otro",
  classifyCategoryPath("otra rama » sin relacion") === "otro" &&
    classifyCategoryPath(null) === "otro",
);

check(
  "isRequestTitle detecta pedidos",
  isRequestTitle("Pedido de Desarrollo") === true &&
    isRequestTitle("  pedido de tablas") === true &&
    isRequestTitle("Mosaic- Fatal error #857") === false,
);

const candidate = {
  closedAt,
  branchName: "Villa Tesei",
  branchCode: "B0035",
};
const locationIds = new Set([5487]);

const tickets = [
  {
    id: 1,
    prettyId: "#1",
    title: "Mosaic- No se pudo generar archivo",
    locationId: 5487,
    createdAt: closedAt + 3600,
    categoryId: 2872,
    helpdeskId: 2,
    helpdeskName: "Mesa de Ayuda TI",
    kind: "mosaic",
    canonicalTitle: "Mosaic - No se pudo generar archivo",
  },
  {
    id: 2,
    prettyId: "#2",
    title: "Láser - Configurar impresora",
    locationId: 9999,
    createdAt: closedAt + 7200,
    categoryId: 220,
    helpdeskId: 3,
    helpdeskName: "Soporte Técnico TI",
    kind: "hardware",
    canonicalTitle: null,
  },
  {
    id: 3,
    prettyId: "#3",
    title: "Mosaic- previo al cierre",
    locationId: 5487,
    createdAt: closedAt - 100,
    categoryId: 2872,
    helpdeskId: 2,
    helpdeskName: "Mesa de Ayuda TI",
    kind: "mosaic",
    canonicalTitle: null,
  },
  {
    id: 4,
    prettyId: "#4",
    title: "Mosaic- fuera de ventana",
    locationId: 5487,
    createdAt: closedAt + 4 * DAY,
    categoryId: 2872,
    helpdeskId: 2,
    helpdeskName: "Mesa de Ayuda TI",
    kind: "mosaic",
    canonicalTitle: null,
  },
  {
    id: 5,
    prettyId: "#5",
    title: "Mosaic- Villa Tesei sin location",
    locationId: null,
    createdAt: closedAt + 1800,
    categoryId: 2872,
    helpdeskId: 2,
    helpdeskName: "Mesa de Ayuda TI",
    kind: "mosaic",
    canonicalTitle: null,
  },
];

const matched = selectMosaicErrors(tickets, candidate, locationIds, 3);
check(
  "matchea por location y por nombre (fallback), respeta la ventana",
  matched.map((e) => e.id).join(",") === "1,5",
);
check(
  "ordena por fecha descendente, conserva el tipo, la mesa y el canónico",
  matched.length === 2 &&
    matched[0].createdAt >= matched[1].createdAt &&
    matched.every((e) => e.kind === "mosaic") &&
    matched.every((e) => e.helpdeskName === "Mesa de Ayuda TI") &&
    matched.some(
      (e) => e.canonicalTitle === "Mosaic - No se pudo generar archivo",
    ),
);

check(
  "titleMentionsBranch: código y nombre",
  titleMentionsBranch("Mosaic- B0035 falla", null, "B0035") === true &&
    titleMentionsBranch("Mosaic- Villa Tesei falla", "Villa Tesei", null) ===
      true &&
    titleMentionsBranch("Mosaic- otra sucursal", "Villa Tesei", "B0035") ===
      false,
);

check(
  "sin location y sin mención de sucursal: no matchea",
  selectMosaicErrors(
    [
      {
        id: 6,
        prettyId: "#6",
        title: "Mosaic- genérico",
        locationId: null,
        createdAt: closedAt + 100,
        categoryId: 2872,
        kind: "mosaic",
      },
    ],
    candidate,
    locationIds,
    3,
  ).length === 0,
);

check(
  "summarizeByKind acumula por tipo",
  JSON.stringify(
    summarizeByKind([
      { byKind: { mosaic: 2, hardware: 1, otro: 0 } },
      { byKind: { mosaic: 1, hardware: 0, otro: 3 } },
    ]),
  ) === JSON.stringify({ mosaic: 3, hardware: 1, otro: 3 }),
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-post-automation: all checks passed");
