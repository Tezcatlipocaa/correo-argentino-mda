import { test } from "node:test";
import assert from "node:assert/strict";
import { WORKFLOWS_CATALOG, getWorkflowConfig } from "../registry";
import { IMPLEMENTACION_FIXTURE } from "./implementacion";
import { computeProgressPercent, computeWorkflowOverview } from "../metrics-engine";
import type { WorkflowProcessInstance } from "@/types/workflows";

test("WORKFLOWS_CATALOG incluye la configuración del flujo implementacion", () => {
  assert.ok(Array.isArray(WORKFLOWS_CATALOG));
  assert.ok(WORKFLOWS_CATALOG.length >= 1);

  const implementacion = WORKFLOWS_CATALOG.find((wf) => wf.slug === "implementacion");
  assert.ok(implementacion, "Debe existir la configuración de implementacion");
  assert.equal(implementacion.slug, "implementacion");
  assert.equal(implementacion.name, "Implementación, Cambio y Release");
  assert.equal(implementacion.viewId, 65);
  assert.equal(implementacion.icon, "boxicons:git-repo-forked");
  assert.ok(implementacion.description.length > 0);
});

test("getWorkflowConfig retorna la configuración esperada o undefined", () => {
  const config = getWorkflowConfig("implementacion");
  assert.ok(config);
  assert.equal(config.slug, "implementacion");
  assert.equal(config.viewId, 65);

  const missing = getWorkflowConfig("inexistente");
  assert.equal(missing, undefined);
});

test("IMPLEMENTACION_FIXTURE cumple con las invariantes de estructura y validación", () => {
  assert.ok(Array.isArray(IMPLEMENTACION_FIXTURE));
  assert.ok(IMPLEMENTACION_FIXTURE.length >= 6);

  const validStatuses = new Set([
    "in_progress",
    "waiting_approval",
    "approved",
    "rejected",
    "completed",
    "cancelled",
  ]);

  for (const instance of IMPLEMENTACION_FIXTURE) {
    assert.ok(Number.isInteger(instance.id) && instance.id > 0, `ID debe ser positivo: ${instance.id}`);
    assert.match(instance.prettyId, /^IMP-\d{4}-\d{3}$/, `prettyId inválido: ${instance.prettyId}`);
    assert.ok(instance.title.trim().length > 0, "title no debe estar vacío");
    assert.ok(validStatuses.has(instance.status), `status desconocido: ${instance.status}`);
    assert.ok(instance.statusLabel.trim().length > 0, "statusLabel no debe estar vacío");
    assert.ok(instance.assignedGroup.trim().length > 0, "assignedGroup no debe estar vacío");
    assert.ok(instance.creatorName.trim().length > 0, "creatorName no debe estar vacío");
    assert.ok(Date.parse(instance.createdAt), `createdAt inválida: ${instance.createdAt}`);

    assert.ok(
      instance.progressPercent >= 0 && instance.progressPercent <= 100,
      `progressPercent fuera de rango: ${instance.progressPercent}`,
    );

    assert.ok(
      Array.isArray(instance.stages) && instance.stages.length >= 2,
      `Debe contener al menos 2 etapas: ${instance.prettyId}`,
    );

    for (const stage of instance.stages) {
      assert.ok(stage.id.trim().length > 0);
      assert.ok(stage.name.trim().length > 0);
      assert.ok(stage.order >= 1);
      assert.ok(["pending", "current", "completed", "skipped"].includes(stage.status));
    }

    assert.ok(Array.isArray(instance.approvals));
    for (const app of instance.approvals) {
      assert.ok(app.id.trim().length > 0);
      assert.ok(app.title.trim().length > 0);
      assert.ok(app.approverName.trim().length > 0);
      assert.ok(["pending", "approved", "rejected"].includes(app.status));
      assert.ok(Date.parse(app.requestedAt));
    }

    assert.ok(Array.isArray(instance.childTickets));
    for (const ticket of instance.childTickets) {
      assert.ok(ticket.id > 0);
      assert.ok(ticket.prettyId.trim().length > 0);
      assert.ok(ticket.title.trim().length > 0);
      assert.ok(["open", "in_progress", "solved", "closed"].includes(ticket.status));
    }
  }
});

test("IMPLEMENTACION_FIXTURE contiene las 6 instancias canónicas especificadas en el diseño", () => {
  const byId = new Map(IMPLEMENTACION_FIXTURE.map((inst) => [inst.id, inst]));

  const i1001 = byId.get(1001);
  assert.ok(i1001);
  assert.equal(i1001.prettyId, "IMP-2026-001");
  assert.equal(i1001.title, "Pase a Producción Módulo SITA v3.1");
  assert.equal(i1001.status, "completed");
  assert.equal(i1001.progressPercent, 100);
  assert.equal(i1001.leadTimeHours, 31.5);
  assert.equal(i1001.slaBreached, false);
  assert.equal(i1001.stages.length, 4);
  assert.ok(i1001.stages.every((s) => s.status === "completed"));
  assert.equal(i1001.approvals.length, 1);
  assert.equal(i1001.approvals[0].status, "approved");
  assert.equal(i1001.childTickets.length, 2);

  const i1002 = byId.get(1002);
  assert.ok(i1002);
  assert.equal(i1002.prettyId, "IMP-2026-002");
  assert.equal(i1002.title, "Migración Servidor de Impresión Mosaic - Centro Operativo");
  assert.equal(i1002.status, "in_progress");
  assert.equal(i1002.progressPercent, 50);
  assert.equal(i1002.leadTimeHours, 18.0);
  assert.equal(i1002.stages.length, 4);
  assert.equal(i1002.stages[0].status, "completed");
  assert.equal(i1002.stages[1].status, "completed");
  assert.equal(i1002.stages[2].status, "current");
  assert.equal(i1002.stages[3].status, "pending");
  assert.equal(i1002.childTickets.length, 1);
  assert.equal(i1002.childTickets[0].status, "in_progress");

  const i1003 = byId.get(1003);
  assert.ok(i1003);
  assert.equal(i1003.prettyId, "IMP-2026-003");
  assert.equal(i1003.title, "Actualización Firmware Switches Distribución Monte Grande");
  assert.equal(i1003.status, "waiting_approval");
  assert.equal(i1003.progressPercent, 25);
  assert.ok(i1003.approvals.some((app) => app.approverName === "Seguridad IT" && app.status === "pending"));

  const i1004 = byId.get(1004);
  assert.ok(i1004);
  assert.equal(i1004.prettyId, "IMP-2026-004");
  assert.equal(i1004.title, "Reconfiguración Enlace MPLS Sucursal Rosario Central");
  assert.equal(i1004.status, "completed");
  assert.equal(i1004.progressPercent, 100);
  assert.equal(i1004.leadTimeHours, 31.0);
  assert.equal(i1004.slaBreached, false);

  const i1005 = byId.get(1005);
  assert.ok(i1005);
  assert.equal(i1005.prettyId, "IMP-2026-005");
  assert.equal(i1005.title, "Cambio de Certificados SSL Portal de Autogestión");
  assert.equal(i1005.status, "completed");
  assert.equal(i1005.progressPercent, 100);
  assert.equal(i1005.leadTimeHours, 8.0);
  assert.equal(i1005.slaBreached, false);

  const i1006 = byId.get(1006);
  assert.ok(i1006);
  assert.equal(i1006.prettyId, "IMP-2026-006");
  assert.equal(i1006.title, "Despliegue Parche Crítico Linux Kernel Cluster Correo");
  assert.equal(i1006.status, "rejected");
  assert.equal(i1006.progressPercent, 25);
  assert.ok(i1006.approvals.some((app) => app.status === "rejected"));
});

test("computeProgressPercent calcula porcentajes consistentes con las instancias de fixture", () => {
  for (const instance of IMPLEMENTACION_FIXTURE) {
    const computed = computeProgressPercent(instance.stages);
    assert.equal(
      instance.progressPercent,
      computed,
      `Discrepancia en progressPercent para ${instance.prettyId}: esperado ${instance.progressPercent}, calculado ${computed}`,
    );
  }
});

test("computeWorkflowOverview procesa IMPLEMENTACION_FIXTURE correctamente", () => {
  const overview = computeWorkflowOverview(IMPLEMENTACION_FIXTURE as WorkflowProcessInstance[]);

  assert.equal(overview.totalInstances, 6);
  assert.equal(overview.completedInstances, 3);
  assert.equal(overview.activeInstances, 2); // 1002 in_progress, 1003 waiting_approval
  assert.equal(overview.pendingApprovalsCount, 1); // 1003 has 1 pending
  assert.equal(overview.slaCompliancePercent, 100); // none breached
  assert.ok(overview.avgLeadTimeHours > 0);
});
