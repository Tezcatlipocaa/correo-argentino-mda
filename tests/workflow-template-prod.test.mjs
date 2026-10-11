import { buildStageGroups } from "../src/lib/workflow/stages";

/**
 * Validación del matching de la plantilla contra títulos reales de producción
 * (2026-09: 12 padres, 201 hijos). Cubre el workflow manual viejo (Padua
 * #72658), otros legacy (Guillón viejo, Libertad) y el AUTSUC nuevo (#79867).
 *
 * Ejecución: node --import tsx tests/workflow-template-prod.test.mjs
 */

function ticket(
  id,
  stageId,
  matchLabel,
  blocking,
  aliases = [],
  matchDescription = [],
) {
  return {
    id,
    stageId,
    matchLabel,
    aliases,
    matchDescription,
    displayName: null,
    blocking,
    position: 0,
  };
}

function stage(id, name, position, scope = "workflow", gateItemId = null) {
  return { id, name, description: null, position, scope, gateItemId };
}

const SERVER_ALIASES = [
  "Configuración de server",
  "Configuración de servidor",
  "Configuración de equipo",
  "CONFIGURACIÓN DE SERVER",
  "CONFIGURACIÓN DE EQUIPO",
  "CONFIGURACIÓN FINAL DE SERVER",
];
const MF_ALIASES = [
  "Solicitud Smart Point y configuración de QR",
  "Solicitud Smart Point",
  "Creación de Punto de Venta",
  "Generación CAI y carga en ambiente INTEGRA",
  "Generación de CAI y carga en ambiente INTEGRA",
];
const ALTA_OPERADOR_ALIASES = [
  "ALTA OPERADOR MOSAIC",
  "ALTA OEPRADOR MOSAIC",
  "ALTA NUEVO OPERADORES MOSAIC",
  "Mosaic- Alta de operador",
  "Mosaic - Alta de operador",
];
const BUI_ALIASES = ["Configuración ruta BUIS", "Mosaic- Configuración ruta BUIS"];
const EQUIPMENT_ALIASES = [
  "Equipamiento",
  "1-Equipamiento",
  "1.1-Equipamiento - Server",
  "1.2-Equipamiento - HH",
  "1.3-Equipamiento",
];
const RELEVAMIENTO_DESC = [
  "acondicionamiento de redes y cableado",
  "redes y cableado",
];
const VISITA_DESC = [
  "programar instalaciones",
  "programar la visita",
  "visita técnica",
];
const REVIEW_ALIASES = [
  "REVISIÓN GENERAL",
  "REVISIÓN ESTADO GENERAL",
  "Validación de estado",
];

const template = {
  stages: [
    stage(1, "Etapa 1", 1),
    stage(2, "Etapa 2", 2, "workflow", 1),
    stage(3, "Etapa 3", 3),
    stage(4, "Etapa 4", 4),
    stage(5, "Etapa 5", 5),
  ],
  tickets: [
    ticket(1, 1, "Solicitud de equipamiento", true, EQUIPMENT_ALIASES),
    ticket(
      2,
      1,
      "Relevamiento de conexiones",
      true,
      ["Revisión del Switch"],
      RELEVAMIENTO_DESC,
    ),
    ticket(3, 1, "Preparación y envío de HH", true),
    ticket(4, 1, "Habilitación de terminales de GDI", true, [
      "Habilitación de terminales de GDI a servidores Mosaic",
    ]),
    ticket(
      5,
      1,
      "Visita técnica para instalaciones",
      false,
      [],
      VISITA_DESC,
    ),

    ticket(6, 2, "Configuración serv", true, SERVER_ALIASES),
    ticket(7, 2, "Solicitud de Hostnames", true),
    ticket(8, 2, "Dirección IP", true),
    ticket(9, 2, "Habilitación de servicios M&F", false, MF_ALIASES),
    ticket(10, 2, "Validación de NIS en OnBase", true),
    ticket(11, 2, "Alta en OfficeTrack", false),

    ticket(12, 3, "Punto de control Go / No Go", false),

    ticket(13, 4, "Solicitud de asistencia técnica", true),
    ticket(14, 4, "Alta operador Mosaic", true, ALTA_OPERADOR_ALIASES),
    ticket(15, 4, "Validación Central PAQ", true),
    ticket(16, 4, "Baja de usuarios en SOP Central", true, [
      "Solicitud baja de usuarios SOP Central",
    ]),
    ticket(17, 4, "Modificación de tipo", true),
    ticket(18, 4, "Configuración carpeta de escaneos BUI", false, BUI_ALIASES),

    ticket(19, 5, "Revisión general", false, REVIEW_ALIASES),
  ],
};

const cases = [
  // Etapa 1
  ["Preparación y envío de HH - Automatización SUC B0174", 1],
  ["AUTOMATICACIÓN DE SUCURSAL B0174\tSAN ANTONIO DE PADUA - SOLICITUD DE EQUIPAMIENTO.", 1],
  ["Relevamiento de conexiones - Automatización de sucursal B0174", 1],
  ["Habilitación de terminales de GDI a servidores Mosaic - B0174", 1],
  ["Revisión del Switch - Automatización de sucursal B0174", 1],
  ["Revisión del Switch - Automatización de sucursal B1618", 1],
  ["AUTSUC #79867 - 1-Equipamiento (Prep y Despacho)", 1],
  ["AUTSUC #79867 - 1.1-Equipamiento - Server", 1],
  ["AUTSUC #79867 - 1.2-Equipamiento - HH", 1],
  ["AUTSUC #79867 - 1.3-Equipamiento", 1],
  // Etapa 2
  ["Configuración de servidor - Automatización de sucursal B0174", 2],
  ["CONFIGURACIÓN DE SERVER - PARA AUTOMATIZACIÓN B1618\tTRISTAN SUAREZ", 2],
  ["CONFIGURACIÓN FINAL DE SERVER - PARA AUTOMATIZACIÓN - B0084 RAFAEL CALZADA", 2],
  ["CONFIGURACIÓN DE EQUIPO - AUTOMATIZACIÓN DE SUCURSAL B0174 SAN ANTONIO DE PADUA", 2],
  ["Solicitud de hostnames normalizados por automatización: Sucursal B0174", 2],
  ["Dirección IP - Solicitud - Automatización de sucursal B0174", 2],
  ["Alta en OfficeTrack - Automatización SUC B0174", 2],
  ["Solicitud Smart Point - Automatización de sucursal B0174", 2],
  ["Solicitud Smart Point y configuración de QR - Automatización SUC B0168", 2],
  ["Creación de Punto de Venta - Automatización de sucursal B0174", 2],
  ["Generación CAI y carga en ambiente INTEGRA - Automatización de sucursal B0174", 2],
  ["Automatización SUC Padua - Validación de NIS en OnBase", 2],
  ["AUTSUC #79867 - Habilitacion de Servicios M&F", 2],
  // Etapa 4
  ["Validación Central PAQ - Automatización de sucursal B0174", 4],
  ["ALTA OPERADOR MOSAIC", 4],
  ["ALTA OEPRADOR MOSAIC", 4],
  ["ALTA NUEVO OPERADORES MOSAIC", 4],
  ["Mosaic- Alta de operador", 4],
  ["Automatización SUC SAN ANTONIO DE PADUA B0174 - Solicitud de asistencia técnica", 4],
  ["Baja de usuarios en SOP Central - Automatización sucursal B0174", 4],
  ["Solicitud baja de usuarios SOP Central - automatización de sucursal B1618", 4],
  ["Modificación de tipo - Automatización de sucursal B0174", 4],
  ["Mosaic - Configuración carpeta de escaneos BUI", 4],
  ["Mosaic- Configuración ruta BUIS", 4],
  // Etapa 5 (Revisión de estado general)
  ["REVISIÓN ESTADO GENERAL - AUTOMATIZACIÓN DE SUCURSAL B0174 SAN ANTONIO DE PADUA", 5],
  ["REVISIÓN GENERAL - AUTOMATIZACIÓN DE SUCURSAL B0084 RAFAEL CALZADA", 5],
  // Sin etapa (título "Instalaciones…" sin descripción matcheable)
  ["Instalaciones para AUTSUC #79867  (B0106) 25 sep 2026", null],
];

const failures = [];

const nodes = cases.map(([title], index) => ({
  kind: "request",
  refId: index + 1,
  prettyId: `#${index + 1}`,
  stepLabel: title,
  title,
  lifecycle: "pending",
  rawStatusId: 1,
  createdAt: 100 + index,
  invgateUrl: "",
  activity: [],
  solution: null,
  solutionAuthorName: null,
}));

const result = buildStageGroups(nodes, template, { workflowKind: "workflow" });

function stageNumberOf(refId) {
  for (const group of result.groups) {
    const found = group.items.some((item) =>
      item.nodes.some((node) => node.refId === refId),
    );
    if (found) {
      return group.template.position;
    }
  }
  return null;
}

cases.forEach(([title, expected], index) => {
  const refId = index + 1;
  const stageless = result.stagelessNodes.some((node) => node.refId === refId);
  const actual = stageless ? null : stageNumberOf(refId);
  if (actual !== expected) {
    failures.push(
      `FAIL: "${title}"\n  esperado etapa: ${expected}\n  obtenido: ${stageless ? "Sin etapa" : `Etapa ${actual}`}`,
    );
  } else {
    console.log(`ok - Etapa ${expected ?? "Sin etapa"} <- ${JSON.stringify(title)}`);
  }
});

// Desambiguación por descripción: los dos "Instalaciones…" (mismo título).
{
  const descCases = [
    [
      "Se solicita gestionar el acondicionamiento de redes y cableado para las instalaciones programadas.",
      "Relevamiento de conexiones",
    ],
    [
      "Se solicita programar instalaciones para el día 24 sep 2026 en Sucursal Metro » BA.",
      "Visita técnica para instalaciones",
    ],
  ];
  const descNodes = descCases.map(([description], i) => ({
    kind: "request",
    refId: 1000 + i,
    prettyId: `#${1000 + i}`,
    stepLabel: "Instalaciones para AUTSUC #79867  (B0106) 25 sep 2026",
    title: "Instalaciones para AUTSUC #79867  (B0106) 25 sep 2026",
    description,
    lifecycle: "pending",
    rawStatusId: 1,
    createdAt: 1,
    invgateUrl: "",
    activity: [],
    solution: null,
    solutionAuthorName: null,
    tasks: [],
  }));
  const descResult = buildStageGroups(descNodes, template, {
    workflowKind: "workflow",
  });
  const itemLabelFor = (refId) => {
    for (const group of descResult.groups) {
      for (const item of group.items) {
        if (item.nodes.some((node) => node.refId === refId)) {
          return item.template.matchLabel;
        }
      }
    }
    return null;
  };
  descCases.forEach(([, expectedLabel], index) => {
    const actual = itemLabelFor(1000 + index);
    if (actual !== expectedLabel) {
      failures.push(
        `FAIL descripción: esperado "${expectedLabel}", obtenido "${actual}"`,
      );
    } else {
      console.log(`ok - descripción -> ${expectedLabel}`);
    }
  });
}

// Etapa 5: el ticket de revisión no bloquea; cierra con el padre finalizado.
{
  const active = buildStageGroups(nodes, template, {
    workflowKind: "workflow",
    finalized: false,
  });
  const finalized = buildStageGroups(nodes, template, {
    workflowKind: "workflow",
    finalized: true,
  });
  const lastActive = active.groups.at(-1);
  const lastFinalized = finalized.groups.at(-1);

  if (lastActive.status !== "in_progress") {
    failures.push(`FAIL: Etapa 5 activa debería estar 'in_progress', fue '${lastActive.status}'`);
  } else {
    console.log("ok - Etapa 5 activa: in_progress");
  }
  if (lastFinalized.status !== "completed") {
    failures.push(`FAIL: Etapa 5 finalizada debería estar 'completed', fue '${lastFinalized.status}'`);
  } else {
    console.log("ok - Etapa 5 finalizada: completed");
  }
}

if (failures.length > 0) {
  console.error("\n" + failures.join("\n"));
  process.exit(1);
}
console.log("\nworkflow-template-prod: all checks passed");
