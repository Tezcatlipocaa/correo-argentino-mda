import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeProgressPercent,
  computeWorkflowOverview,
} from "./metrics-engine";
import type {
  WorkflowProcessInstance,
  WorkflowStageItem,
} from "@/types/workflows";

test("computeProgressPercent devuelve 0 si el array de etapas está vacío", () => {
  assert.equal(computeProgressPercent([]), 0);
});

test("computeProgressPercent calcula 100% cuando todas las etapas están completas", () => {
  const stages: WorkflowStageItem[] = [
    { id: "s1", name: "Etapa 1", order: 1, status: "completed" },
    { id: "s2", name: "Etapa 2", order: 2, status: "completed" },
  ];
  assert.equal(computeProgressPercent(stages), 100);
});

test("computeProgressPercent calcula porcentaje redondeado para etapas mixtas", () => {
  const stages: WorkflowStageItem[] = [
    { id: "s1", name: "Etapa 1", order: 1, status: "completed" },
    { id: "s2", name: "Etapa 2", order: 2, status: "current" },
    { id: "s3", name: "Etapa 3", order: 3, status: "pending" },
  ];
  assert.equal(computeProgressPercent(stages), 33);

  const stagesHalf: WorkflowStageItem[] = [
    { id: "s1", name: "Etapa 1", order: 1, status: "completed" },
    { id: "s2", name: "Etapa 2", order: 2, status: "completed" },
    { id: "s3", name: "Etapa 3", order: 3, status: "pending" },
    { id: "s4", name: "Etapa 4", order: 4, status: "skipped" },
  ];
  assert.equal(computeProgressPercent(stagesHalf), 50);

  const stagesNone: WorkflowStageItem[] = [
    { id: "s1", name: "Etapa 1", order: 1, status: "pending" },
    { id: "s2", name: "Etapa 2", order: 2, status: "current" },
  ];
  assert.equal(computeProgressPercent(stagesNone), 0);
});

test("computeWorkflowOverview devuelve ceros y distribuciones por defecto con array vacío", () => {
  const result = computeWorkflowOverview([]);
  assert.deepEqual(result, {
    totalInstances: 0,
    activeInstances: 0,
    completedInstances: 0,
    pendingApprovalsCount: 0,
    avgLeadTimeHours: 0,
    slaCompliancePercent: 0,
    statusDistribution: {
      in_progress: 0,
      waiting_approval: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
      cancelled: 0,
    },
    groupDistribution: {},
  });
});

test("computeWorkflowOverview calcula métricas correctamente en fixture multi-instancia", () => {
  const instances: WorkflowProcessInstance[] = [
    {
      id: 1,
      prettyId: "WF-001",
      title: "Solicitud 1",
      status: "in_progress",
      statusLabel: "En Progreso",
      assignedGroup: "Mesa TI",
      creatorName: "Juan",
      createdAt: "2026-10-01T10:00:00Z",
      slaBreached: false,
      progressPercent: 33,
      stages: [],
      approvals: [
        {
          id: "app-1",
          title: "Aprobación Jefe",
          approverName: "Carlos",
          status: "pending",
          requestedAt: "2026-10-01T10:00:00Z",
        },
      ],
      childTickets: [],
    },
    {
      id: 2,
      prettyId: "WF-002",
      title: "Solicitud 2",
      status: "waiting_approval",
      statusLabel: "Esperando Aprobación",
      assignedGroup: "Mesa TI",
      creatorName: "Ana",
      createdAt: "2026-10-02T10:00:00Z",
      leadTimeHours: 12,
      slaBreached: false,
      progressPercent: 50,
      stages: [],
      approvals: [
        {
          id: "app-2",
          title: "Aprobación Seguridad",
          approverName: "Maria",
          status: "pending",
          requestedAt: "2026-10-02T10:00:00Z",
        },
        {
          id: "app-3",
          title: "Aprobación Gerencia",
          approverName: "Roberto",
          status: "approved",
          requestedAt: "2026-10-02T10:00:00Z",
        },
      ],
      childTickets: [],
    },
    {
      id: 3,
      prettyId: "WF-003",
      title: "Solicitud 3",
      status: "completed",
      statusLabel: "Completado",
      assignedGroup: "Infraestructura",
      creatorName: "Pedro",
      createdAt: "2026-10-03T10:00:00Z",
      leadTimeHours: 24,
      slaBreached: false,
      progressPercent: 100,
      stages: [],
      approvals: [
        {
          id: "app-4",
          title: "Aprobación Final",
          approverName: "Laura",
          status: "approved",
          requestedAt: "2026-10-03T10:00:00Z",
        },
      ],
      childTickets: [],
    },
    {
      id: 4,
      prettyId: "WF-004",
      title: "Solicitud 4",
      status: "rejected",
      statusLabel: "Rechazado",
      assignedGroup: "Infraestructura",
      creatorName: "Marta",
      createdAt: "2026-10-04T10:00:00Z",
      leadTimeHours: 0,
      slaBreached: true,
      progressPercent: 25,
      stages: [],
      approvals: [
        {
          id: "app-5",
          title: "Aprobación Rechazada",
          approverName: "Luis",
          status: "rejected",
          requestedAt: "2026-10-04T10:00:00Z",
        },
      ],
      childTickets: [],
    },
    {
      id: 5,
      prettyId: "WF-005",
      title: "Solicitud 5",
      status: "cancelled",
      statusLabel: "Cancelado",
      assignedGroup: "Mesa TI",
      creatorName: "Esteban",
      createdAt: "2026-10-05T10:00:00Z",
      leadTimeHours: 0,
      slaBreached: false,
      progressPercent: 0,
      stages: [],
      approvals: [],
      childTickets: [],
    },
    {
      id: 6,
      prettyId: "WF-006",
      title: "Solicitud 6",
      status: "approved",
      statusLabel: "Aprobado",
      assignedGroup: "Seguridad",
      creatorName: "Sofia",
      createdAt: "2026-10-06T10:00:00Z",
      leadTimeHours: 36,
      slaBreached: true,
      progressPercent: 80,
      stages: [],
      approvals: [],
      childTickets: [],
    },
  ];

  const result = computeWorkflowOverview(instances);

  assert.equal(result.totalInstances, 6);
  assert.equal(result.activeInstances, 3);
  assert.equal(result.completedInstances, 1);
  assert.equal(result.pendingApprovalsCount, 2);
  assert.equal(result.avgLeadTimeHours, 24);
  assert.equal(result.slaCompliancePercent, 66.7);

  assert.deepEqual(result.statusDistribution, {
    in_progress: 1,
    waiting_approval: 1,
    approved: 1,
    rejected: 1,
    completed: 1,
    cancelled: 1,
  });

  assert.deepEqual(result.groupDistribution, {
    "Mesa TI": 3,
    "Infraestructura": 2,
    "Seguridad": 1,
  });
});
