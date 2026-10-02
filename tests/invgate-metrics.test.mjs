import {
  getInvGateMetrics,
  recordInvGateCall,
  resetInvGateMetrics,
  isInvGateMetricsEnabled,
} from "../src/lib/invgate/metrics";

/**
 * Contador de llamadas a InvGate.
 * Ejecución: node --import tsx tests/invgate-metrics.test.mjs
 */

const failures = [];
function check(name, condition) {
  if (!condition) {
    failures.push(`FAIL: ${name}`);
  } else {
    console.log(`ok - ${name}`);
  }
}

resetInvGateMetrics();
check("arranca en 0", getInvGateMetrics().total === 0);

recordInvGateCall("incidents?ids[]=1&ids[]=2");
recordInvGateCall("incidents?ids[]=3");
recordInvGateCall("incident.link?request_id=1");

const metrics = getInvGateMetrics();
check("total cuenta todas", metrics.total === 3);
check("agrupa por endpoint sin query", metrics.byEndpoint["incidents"] === 2);
check("endpoint simple", metrics.byEndpoint["incident.link"] === 1);

resetInvGateMetrics();
check("reset vuelve a 0", getInvGateMetrics().total === 0);

check("metrics deshabilitado por defecto", isInvGateMetricsEnabled() === false);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("invgate-metrics: all checks passed");
