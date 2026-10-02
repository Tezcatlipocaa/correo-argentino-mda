import "dotenv/config";
import {
  canManualClose,
  getCloseThreshold,
  getClosure,
  listClosures,
  recordClosure,
  removeClosure,
  shouldAutoClose,
} from "../src/lib/workflow/closures";
import { getModulePermissions } from "../src/lib/rbac";

/**
 * Verificación unitaria de la política de cierre y del CRUD de cierres locales.
 * Ejecución: npx tsx tests/workflow-closures.test.mjs
 */

const failures = [];
const check = (name, condition) => {
  if (condition) {
    console.log(`ok ${name}`);
  } else {
    failures.push(`FAIL ${name}`);
  }
};

delete process.env.AUTOMATION_CLOSE_THRESHOLD;
check("umbral por defecto = 80", getCloseThreshold() === 80);

process.env.AUTOMATION_CLOSE_THRESHOLD = "90";
check("umbral configurable = 90", getCloseThreshold() === 90);
check("canManualClose(89) = false", canManualClose(89) === false);
check("canManualClose(90) = true", canManualClose(90) === true);

process.env.AUTOMATION_CLOSE_THRESHOLD = "no-numero";
check("umbral inválido cae al default", getCloseThreshold() === 80);
delete process.env.AUTOMATION_CLOSE_THRESHOLD;

check(
  "auto: 100% sin faltantes y padre activo = true",
  shouldAutoClose({
    statusId: 2,
    percent: 100,
    missingBlockingCount: 0,
    hasClosure: false,
  }) === true,
);
check(
  "auto: 99% = false",
  shouldAutoClose({
    statusId: 2,
    percent: 99,
    missingBlockingCount: 0,
    hasClosure: false,
  }) === false,
);
check(
  "auto: con faltantes bloqueantes = false",
  shouldAutoClose({
    statusId: 2,
    percent: 100,
    missingBlockingCount: 1,
    hasClosure: false,
  }) === false,
);
check(
  "auto: ya cerrado = false",
  shouldAutoClose({
    statusId: 2,
    percent: 100,
    missingBlockingCount: 0,
    hasClosure: true,
  }) === false,
);
check(
  "auto: padre finalizado en InvGate = false",
  shouldAutoClose({
    statusId: 6,
    percent: 100,
    missingBlockingCount: 0,
    hasClosure: false,
  }) === false,
);

const id = 999999999;
removeClosure(id);
check("sin cierre previo", getClosure(id) === null);

const created = recordClosure({
  automationId: id,
  kind: "manual",
  reason: "test",
  percent: 85,
  closedBy: "tester",
});
check(
  "cierre creado",
  created.kind === "manual" &&
    created.percent === 85 &&
    created.closedBy === "tester",
);
check("listClosures lo incluye", listClosures().get(id)?.reason === "test");

recordClosure({
  automationId: id,
  kind: "auto",
  reason: "auto",
  percent: 100,
  closedBy: "sistema",
});
check("upsert actualiza a auto", getClosure(id)?.kind === "auto");

removeClosure(id);
check("reabrir borra el cierre", getClosure(id) === null);

check(
  "rbac: agent no puede escribir automatizaciones",
  getModulePermissions("automatizaciones", "agent").canWrite === false,
);
check(
  "rbac: admin sí puede escribir automatizaciones",
  getModulePermissions("automatizaciones", "admin").canWrite === true,
);
check(
  "rbac: todos leen automatizaciones",
  getModulePermissions("automatizaciones", "referent").canRead === true,
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-closures: all checks passed");
