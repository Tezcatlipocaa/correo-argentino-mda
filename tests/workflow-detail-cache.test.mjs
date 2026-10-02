import "dotenv/config";
import {
  readPersistedCache,
  writePersistedCache,
} from "../src/lib/invgate/cache";
import {
  getDetailCacheKey,
  invalidateAutomationDetail,
} from "../src/lib/workflow/resolver";

/**
 * Invalidación del snapshot persistido del detalle (memoria + SQLite).
 * Ejecución: npx tsx tests/workflow-detail-cache.test.mjs
 */

const failures = [];
const check = (name, condition) => {
  console.log(condition ? `ok ${name}` : `FAIL ${name}`);
  if (!condition) failures.push(name);
};

const testId = 990002;

writePersistedCache(getDetailCacheKey(testId), { id: testId, marker: true }, 60_000);
check("snapshot escrito", readPersistedCache(getDetailCacheKey(testId)) !== null);
check(
  "la key incluye el id",
  getDetailCacheKey(testId).endsWith(String(testId)),
);

invalidateAutomationDetail(testId);
check("invalidate borra el snapshot", readPersistedCache(getDetailCacheKey(testId)) === null);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("workflow-detail-cache: all checks passed");
