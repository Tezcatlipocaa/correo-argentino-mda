import "dotenv/config";
import {
  getQueueOverrideIds,
  resolveAutomationQueueIds,
} from "../src/lib/workflow/queue-resolver";
import {
  readPersistedCache,
  writePersistedCache,
  deletePersistedCache,
} from "../src/lib/invgate/cache";

/**
 * Verificación unitaria del override multi-valor de colas y del cache
 * persistido en SQLite (sin llamadas a InvGate).
 * Ejecución: npx tsx tests/workflow-queue-cache.test.mjs
 */

const failures = [];
const check = (name, condition) => {
  if (condition) {
    console.log(`ok ${name}`);
  } else {
    failures.push(`FAIL ${name}`);
  }
};

delete process.env.INVGATE_AUTOMATION_GROUP_ID;
check("sin override devuelve null", getQueueOverrideIds() === null);

process.env.INVGATE_AUTOMATION_GROUP_ID = "6409";
check(
  "override simple devuelve un id",
  JSON.stringify(getQueueOverrideIds()) === "[6409]",
);

process.env.INVGATE_AUTOMATION_GROUP_ID = "6409, 6410 ,6409";
check(
  "override multi separa por coma y deduplica",
  JSON.stringify(getQueueOverrideIds()) === "[6409,6410]",
);

const overrideResolved = await resolveAutomationQueueIds(3023);
check(
  "resolveAutomationQueueIds usa el override sin tocar la API",
  JSON.stringify(overrideResolved) === "[6409,6410]",
);

delete process.env.INVGATE_AUTOMATION_GROUP_ID;

const key = "test.roundtrip";
deletePersistedCache(key);
check("cache: miss inicial", readPersistedCache(key) === null);

writePersistedCache(key, { value: 42 }, 60_000);
check(
  "cache: roundtrip JSON",
  JSON.stringify(readPersistedCache(key)) === '{"value":42}',
);

writePersistedCache(key, { value: 7 }, 60_000);
check(
  "cache: upsert actualiza el valor",
  JSON.stringify(readPersistedCache(key)) === '{"value":7}',
);

writePersistedCache(key, { value: 9 }, -1);
check("cache: expirado no se lee", readPersistedCache(key) === null);

deletePersistedCache(key);
check("cache: delete limpia", readPersistedCache(key) === null);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-queue-cache: all checks passed");
