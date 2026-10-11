import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { automationManualData } from "../src/db/schema";
import { getManualData, saveManualData } from "../src/lib/workflow/manual-data";

/**
 * CRUD de datos manuales (override local del formulario).
 * Ejecución: npx tsx tests/workflow-manual-data.test.mjs
 */

const failures = [];
const check = (name, condition) => {
  console.log(condition ? `ok ${name}` : `FAIL ${name}`);
  if (!condition) failures.push(name);
};

const testId = 990001;
db.delete(automationManualData)
  .where(eq(automationManualData.automationId, testId))
  .run();

check("sin datos devuelve null", getManualData(testId) === null);

saveManualData({
  automationId: testId,
  jefeName: "Veronica Sotelo",
  jefeDni: "25164485",
  jefeLegajo: "30913",
  jefeZonal: "Julian Diego Della Villa",
  contactNumber: "11 5555-1234",
  openingHours: "10 a 17hs",
  notes: "Contactar por la mañana",
  updatedBy: "test",
});

const saved = getManualData(testId);
check("guarda el jefe", saved?.jefeName === "Veronica Sotelo");
check(
  "guarda DNI/legajo",
  saved?.jefeDni === "25164485" && saved?.jefeLegajo === "30913",
);
check(
  "guarda contacto/franja",
  saved?.contactNumber === "11 5555-1234" &&
    saved?.openingHours === "10 a 17hs",
);

saveManualData({
  automationId: testId,
  jefeName: "Jefe Corregido",
  jefeDni: null,
  jefeLegajo: null,
  jefeZonal: null,
  contactNumber: null,
  openingHours: null,
  notes: null,
  updatedBy: "test",
});
const updated = getManualData(testId);
check("upsert actualiza el jefe", updated?.jefeName === "Jefe Corregido");
check(
  "upsert limpia campos",
  updated?.jefeDni === null && updated?.contactNumber === null,
);

db.delete(automationManualData)
  .where(eq(automationManualData.automationId, testId))
  .run();
check("limpieza", getManualData(testId) === null);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("workflow-manual-data: all checks passed");
