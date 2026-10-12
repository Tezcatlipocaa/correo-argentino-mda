import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInOutRatio, computeHelpdesksOverview } from "./metrics-engine";
import type { HelpdeskMetricsItem } from "@/types/helpdesks";

test("computeInOutRatio devuelve 0 ante incoming cero o negativo", () => {
  assert.equal(computeInOutRatio(0, 10), 0);
  assert.equal(computeInOutRatio(-5, 10), 0);
  assert.equal(computeInOutRatio(0, 0), 0);
});

test("computeInOutRatio calcula correctamente el ratio y redondea a dos decimales", () => {
  assert.equal(computeInOutRatio(100, 95), 0.95);
  assert.equal(computeInOutRatio(3, 2), 0.67);
  assert.equal(computeInOutRatio(100, 150), 1.5);
  assert.equal(computeInOutRatio(100, 0), 0);
});

test("computeHelpdesksOverview maneja lista vacía sin NaN ni divisiones por cero", () => {
  const result = computeHelpdesksOverview([]);
  assert.deepEqual(result, {
    totalHelpdesks: 0,
    totalActiveTickets: 0,
    totalWaitingTickets: 0,
    totalResolvedMonth: 0,
    globalSlaCompliancePercent: 0,
    globalAvgCsat: 0,
    globalInOutRatio: 0,
  });
});

test("computeHelpdesksOverview agrega múltiples mesas correctamente", () => {
  const items: HelpdeskMetricsItem[] = [
    {
      id: 1,
      name: "mda-ti",
      displayName: "Mesa de Ayuda TI",
      isMainMda: true,
      totalMembers: 15,
      incomingTicketsMonth: 9000,
      resolvedTicketsMonth: 8500,
      inOutRatio: 0.94,
      backlog: {
        active: 500,
        waiting: 150,
        closed: 8500,
        total: 9150,
      },
      serviceTimes: {
        firstReplyAvgMinutes: 12,
        mttrAvgHours: 4.5,
        slaFirstReplyCompliancePercent: 95.0,
        slaResolutionCompliancePercent: 90.2,
      },
      csat: {
        averageRating: 4.5,
        totalResponses: 1200,
        positiveSentimentPercent: 88,
        neutralSentimentPercent: 8,
        negativeSentimentPercent: 4,
      },
    },
    {
      id: 2,
      name: "mda-infra",
      displayName: "Mesa Infraestructura",
      isMainMda: false,
      totalMembers: 8,
      incomingTicketsMonth: 4500,
      resolvedTicketsMonth: 4250,
      inOutRatio: 0.94,
      backlog: {
        active: 250,
        waiting: 80,
        closed: 4250,
        total: 4580,
      },
      serviceTimes: {
        firstReplyAvgMinutes: 20,
        mttrAvgHours: 6.2,
        slaFirstReplyCompliancePercent: 91.0,
        slaResolutionCompliancePercent: 86.0,
      },
      csat: {
        averageRating: 4.3,
        totalResponses: 600,
        positiveSentimentPercent: 84,
        neutralSentimentPercent: 10,
        negativeSentimentPercent: 6,
      },
    },
  ];

  const result = computeHelpdesksOverview(items);

  assert.equal(result.totalHelpdesks, 2);
  assert.equal(result.totalActiveTickets, 750);
  assert.equal(result.totalWaitingTickets, 230);
  assert.equal(result.totalResolvedMonth, 12750);
  assert.equal(result.globalInOutRatio, 0.94);
  assert.equal(result.globalAvgCsat, 4.4);
  assert.equal(result.globalSlaCompliancePercent, 88.1);
});
