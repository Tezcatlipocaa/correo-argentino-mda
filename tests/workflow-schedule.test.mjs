import {
  parseScheduledDate,
  parseOpeningHours,
} from "../src/lib/workflow/schedule";

/**
 * Parser de fecha programada y franja horaria desde descripciones de InvGate.
 * Ejecución: node --import tsx tests/workflow-schedule.test.mjs
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
  "día 6 oct 2026",
  parseScheduledDate(
    "Se solicita programar instalaciones para el día 6 oct 2026 en Sucursal",
  ) === "6 oct 2026",
);
check(
  "Esperando fecha 07 oct. 2026",
  parseScheduledDate("Esperando fecha 07 oct. 2026, 15:00") === "7 oct 2026",
);
check(
  "día 24 sep 2026",
  parseScheduledDate("programadas para el día 24 sep 2026") === "24 sep 2026",
);
check("sin fecha", parseScheduledDate("sin fecha aquí") === null);
check("texto vacío", parseScheduledDate("") === null);

check(
  "Horario 10 a 17hs",
  parseOpeningHours("<p>Horario: 10 a 17hs</p>") === "10 a 17hs",
);
check("sin horario", parseOpeningHours("Sin datos") === null);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-schedule: all checks passed");
