import {
  parseEstimatedEndFromTitle,
  stripAutomationEmbeddedRefs,
} from "../src/lib/workflow/branch-title";

/**
 * Verificación del título del workflow AUTSUC nuevo (2026-10): prefijo de
 * sucursal, id de padre embebido y fecha estimada.
 * Ejecución: node --import tsx tests/workflow-branch-title.test.mjs
 */

const failures = [];

function check(name, condition) {
  if (!condition) {
    failures.push(`FAIL: ${name}`);
  } else {
    console.log(`ok - ${name}`);
  }
}

check(
  "fecha ISO del padre (GLEW)",
  parseEstimatedEndFromTitle("AUTSUC GLEW (B0101)  2026-10-07") ===
    "7 oct 2026",
);
check(
  "fecha ISO del padre (El Pato)",
  parseEstimatedEndFromTitle("AUTSUC EL PATO (B4601)  2026-10-09") ===
    "9 oct 2026",
);
check(
  "fecha ISO del padre (Guillón)",
  parseEstimatedEndFromTitle("AUTSUC Luis Guillón (B0106)  2026-09-25") ===
    "25 sep 2026",
);
check(
  "fecha en prosa del hijo",
  parseEstimatedEndFromTitle(
    "AUTSUC GLEW (B0101)  1-Equipamiento #84909 7 oct 2026",
  ) === "7 oct 2026",
);
check(
  "título viejo sin fecha",
  parseEstimatedEndFromTitle("Automatización de sucursal B0168 - Libertad") ===
    null,
);

check(
  "strip prefijo + ref + fecha (hijo equipamiento)",
  stripAutomationEmbeddedRefs(
    "AUTSUC GLEW (B0101)  1.1-Equipamiento - Server #84909 7 oct 2026",
  ) === "1.1-Equipamiento - Server",
);
check(
  "strip prefijo + ref + fecha (hijo M&F con zero-width)",
  stripAutomationEmbeddedRefs(
    "AUTSUC GLEW (B0101)  Habilitacion de Servicios M&F #84909\u200b 7 oct 2026\u200b",
  ) === "Habilitacion de Servicios M&F",
);
check(
  "strip deja intacto un título sin referencias",
  stripAutomationEmbeddedRefs(
    "Dirección IP - Solicitud - Automatización de sucursal B0174",
  ) === "Dirección IP - Solicitud - Automatización de sucursal B0174",
);
check(
  "strip del id de padre en formato viejo",
  stripAutomationEmbeddedRefs(
    "AUTSUC #79867 - 1-Equipamiento (Prep y Despacho)",
  ) === "AUTSUC - 1-Equipamiento (Prep y Despacho)",
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-branch-title: all checks passed");
