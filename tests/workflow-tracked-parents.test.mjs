import "dotenv/config";
import {
  listTrackedParents,
  removeTrackedParents,
  upsertTrackedParents,
} from "../src/lib/workflow/tracked-parents";

/**
 * Verificación unitaria del tracking de padres (CRUD, sin red).
 * Ejecución: npx tsx tests/workflow-tracked-parents.test.mjs
 */

const failures = [];
const check = (name, condition) => {
  if (condition) {
    console.log(`ok ${name}`);
  } else {
    failures.push(`FAIL ${name}`);
  }
};

const idA = 999999991;
const idB = 999999992;
removeTrackedParents([idA, idB]);

check("sin trackeados previos", !listTrackedParents().has(idA));

upsertTrackedParents([{ automationId: idA, statusId: 2 }]);
let tracked = listTrackedParents();
check("upsert agrega", tracked.get(idA)?.lastStatusId === 2);

const firstSeenA = tracked.get(idA)?.firstSeenAt;

upsertTrackedParents([{ automationId: idA, statusId: 3 }]);
tracked = listTrackedParents();
check("upsert actualiza status", tracked.get(idA)?.lastStatusId === 3);
check("upsert preserva firstSeenAt", tracked.get(idA)?.firstSeenAt === firstSeenA);

upsertTrackedParents([
  { automationId: idA, statusId: 2 },
  { automationId: idB, statusId: 2 },
]);
check("upsert múltiple", listTrackedParents().has(idA) && listTrackedParents().has(idB));

removeTrackedParents([idA]);
check("remove quita solo el indicado", !listTrackedParents().has(idA) && listTrackedParents().has(idB));

removeTrackedParents([idB]);
check("estado final limpio", !listTrackedParents().has(idA) && !listTrackedParents().has(idB));

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-tracked-parents: all checks passed");
