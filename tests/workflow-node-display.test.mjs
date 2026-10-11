import { resolveNodeDisplayLabel } from "../src/lib/workflow/node-display";

/**
 * Verificación unitaria de la normalización de display de casos (tickets
 * hijos). Títulos reales de producción (2026-09): Padua (#72658, manual) y
 * Luis Guillón (#79867, workflow AUTSUC nuevo).
 *
 * Ejecución: node --import tsx tests/workflow-node-display.test.mjs
 */

const cases = [
  {
    title:
      "AUTOMATICACIÓN DE SUCURSAL B0174\tSAN ANTONIO DE PADUA - SOLICITUD DE EQUIPAMIENTO.",
    stepLabel: "AUTOMATICACIÓN DE SUCURSAL B0174\tSAN ANTONIO DE PADUA",
    expected: "Solicitud de equipamiento",
  },
  {
    title: "AUTSUC #79867 - 1-Equipamiento (Prep y Despacho)",
    stepLabel: "AUTSUC #79867",
    expected: "Equipamiento (Prep y Despacho)",
  },
  {
    title: "AUTSUC #79867 - 1.1-Equipamiento - Server",
    stepLabel: "AUTSUC #79867",
    expected: "Equipamiento - Server",
  },
  {
    title: "AUTSUC #79867 - 1.2-Equipamiento - HH",
    stepLabel: "AUTSUC #79867",
    expected: "Equipamiento - HH",
  },
  {
    title: "Preparación y envío de HH - Automatización SUC B0174",
    stepLabel: "Preparación y envío de HH",
    expected: "Preparación y envío de HH",
  },
  {
    title: "Dirección IP - Solicitud - Automatización de sucursal B0174",
    stepLabel: "Dirección IP",
    expected: "Dirección IP - Solicitud",
  },
  {
    title:
      "CONFIGURACIÓN DE EQUIPO - AUTOMATIZACIÓN DE SUCURSAL B0174 SAN ANTONIO DE PADUA",
    stepLabel: "CONFIGURACIÓN DE EQUIPO",
    expected: "Configuración de equipo",
  },
  {
    title: "Baja de usuarios en SOP Central - Automatización sucursal B0174",
    stepLabel: "Baja de usuarios en SOP Central",
    expected: "Baja de usuarios en SOP Central",
  },
  {
    title: "Mosaic - Configuración carpeta de escaneos BUI",
    stepLabel: "Mosaic",
    expected: "Mosaic - Configuración carpeta de escaneos BUI",
  },
  {
    title: "ALTA OPERADOR MOSAIC",
    stepLabel: "ALTA OPERADOR MOSAIC",
    expected: "Alta operador Mosaic",
  },
  {
    title: "1°er configuración del server - Automatización SUC B0097",
    stepLabel: "1°er configuración del server",
    expected: "Configuración del server",
  },
  {
    title: "2DA CONFIGURACIÓN DE SERVER - PARA AUTOMATIZACIÓN - B0097 RANELAGH",
    stepLabel: "2DA CONFIGURACIÓN DE SERVER",
    expected: "Configuración de server",
  },
  {
    title:
      "Solicitud de hostnames normalizados por automatización: Sucursal B0174",
    stepLabel:
      "Solicitud de hostnames normalizados por automatización: Sucursal B0174",
    // Segmento único que es referencia de sucursal: cae al stepLabel.
    expected:
      "Solicitud de hostnames normalizados por automatización: Sucursal B0174",
  },
  {
    title:
      "Generación CAI y carga en ambiente INTEGRA - Automatización de sucursal B0022",
    stepLabel: "Generación CAI y carga en ambiente INTEGRA",
    expected: "Generación CAI y carga en ambiente INTEGRA",
  },
  // Formato nuevo (2026-10, workflow con sucursal en el título): prefijo
  // "AUTSUC <sucursal> (B####)" + gestión + "#<id padre>" + fecha estimada.
  {
    title:
      "AUTSUC GLEW (B0101) \u00a0TECO Instalaciones #84909\u00a07 oct 2026",
    stepLabel:
      "AUTSUC GLEW (B0101) \u00a0TECO Instalaciones #84909\u00a07 oct 2026",
    expected: "TECO Instalaciones",
  },
  {
    title:
      "AUTSUC GLEW (B0101) \u00a01-Equipamiento (Prep y Despacho) #84909\u00a07 oct 2026\u200b\u200b\u200b",
    stepLabel:
      "AUTSUC GLEW (B0101) \u00a01-Equipamiento (Prep y Despacho) #84909\u00a07 oct 2026\u200b\u200b\u200b",
    expected: "Equipamiento (Prep y Despacho)",
  },
  {
    title:
      "AUTSUC GLEW (B0101) \u00a01.1-Equipamiento - Server #84909\u00a07 oct 2026\u200b\u200b",
    stepLabel:
      "AUTSUC GLEW (B0101) \u00a01.1-Equipamiento - Server #84909\u00a07 oct 2026\u200b\u200b",
    expected: "Equipamiento - Server",
  },
  {
    title:
      "AUTSUC GLEW (B0101) \u00a01.2-Equipamiento - HH\u00a0#84909\u00a07 oct 2026\u200b\u200b",
    stepLabel:
      "AUTSUC GLEW (B0101) \u00a01.2-Equipamiento - HH\u00a0#84909\u00a07 oct 2026\u200b\u200b",
    expected: "Equipamiento - HH",
  },
  {
    title:
      "AUTSUC GLEW (B0101) \u00a01.3-Equipamiento - Otro HW\u00a0#(84909)\u00a07 oct 2026\u200b\u200b",
    stepLabel:
      "AUTSUC GLEW (B0101) \u00a01.3-Equipamiento - Otro HW\u00a0#(84909)\u00a07 oct 2026\u200b\u200b",
    expected: "Equipamiento - Otro HW",
  },
  {
    title:
      "AUTSUC GLEW (B0101) \u00a0Instalaciones #84909\u00a07 oct 2026\u200b\u200b",
    stepLabel:
      "AUTSUC GLEW (B0101) \u00a0Instalaciones #84909\u00a07 oct 2026\u200b\u200b",
    expected: "Instalaciones",
  },
  {
    title:
      "AUTSUC GLEW (B0101) \u00a0Habilitacion de Servicios M&F #84909\u200b\u200b\u00a07 oct 2026\u200b\u200b",
    stepLabel:
      "AUTSUC GLEW (B0101) \u00a0Habilitacion de Servicios M&F #84909\u200b\u200b\u00a07 oct 2026\u200b\u200b",
    expected: "Habilitacion de Servicios M&F",
  },
];

const failures = [];
for (const testCase of cases) {
  const actual = resolveNodeDisplayLabel(testCase.title, testCase.stepLabel);
  if (actual !== testCase.expected) {
    failures.push(
      `FAIL: "${testCase.title}"\n  esperado: ${JSON.stringify(testCase.expected)}\n  obtenido: ${JSON.stringify(actual)}`,
    );
  } else {
    console.log(
      `ok - ${JSON.stringify(testCase.title)} -> ${JSON.stringify(actual)}`,
    );
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-node-display: all checks passed");
