import type { APIRoute } from "astro";
import { db } from "@db/index";
import {
  agents,
  qualityAudits,
  auditParameters,
  auditScores,
} from "@db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { normalizeRole } from "@lib/rbac";
import { generateXlsxBuffer } from "@lib/xlsx";
import {
  CHANNEL_LABEL_MAP,
  getTicketModeLabel,
  getAuditExportHeaders,
} from "@lib/qualityExport";

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const role = normalizeRole(user.role);
  const url = new URL(request.url);
  const agentIdParam = url.searchParams.get("agentId");
  const monthParam = url.searchParams.get("month") || "";

  if (!agentIdParam) {
    return new Response(JSON.stringify({ error: "agentId es requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const agentId = parseInt(agentIdParam, 10);
  if (isNaN(agentId)) {
    return new Response(JSON.stringify({ error: "agentId inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get agent
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) {
    return new Response(JSON.stringify({ error: "Operador no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // If role is agent, can only export self
  if (role === "agent") {
    if (agent.username?.toLowerCase() !== user.username.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Acceso denegado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Get parameters ordered
  const allParams = await db
    .select()
    .from(auditParameters)
    .orderBy(auditParameters.order);

  // Get audits for this agent and month (or all if month empty)
  const auditConditions = [eq(qualityAudits.agentId, agentId)];
  if (monthParam) {
    auditConditions.push(eq(qualityAudits.month, monthParam));
  }

  const audits = await db
    .select()
    .from(qualityAudits)
    .where(and(...auditConditions))
    .orderBy(qualityAudits.date);

  // Get scores for these audits
  const auditIds = audits.map((a) => a.id);
  const scores =
    auditIds.length > 0
      ? await db
          .select()
          .from(auditScores)
          .where(inArray(auditScores.auditId, auditIds))
      : [];

  const scoresByAudit = new Map<number, typeof scores>();
  for (const s of scores) {
    if (!scoresByAudit.has(s.auditId)) {
      scoresByAudit.set(s.auditId, []);
    }
    scoresByAudit.get(s.auditId)!.push(s);
  }

  const headers = getAuditExportHeaders(allParams);

  const rows = audits.map((audit) => {
    const auditScoresList = scoresByAudit.get(audit.id) || [];
    const scoreMap = new Map<number, boolean>();
    for (const sc of auditScoresList) {
      scoreMap.set(sc.parameterId, sc.score);
    }

    const ticketMode = getTicketModeLabel(audit);

    const row: (string | number | boolean | null | undefined)[] = [
      audit.month,
      CHANNEL_LABEL_MAP[audit.channelType] || audit.channelType,
      agent.name,
      agent.username || "",
      audit.date ? audit.date.substring(0, 10) : "",
      audit.callId,
      audit.ticketId,
      audit.duration || "",
      audit.ringTime || "",
      audit.creationTime || "",
      audit.takeTime || "",
      audit.isPas ? "Sí" : "No",
      ticketMode,
      audit.section1Score,
      audit.section2Score,
      audit.totalScore,
    ];

    allParams.forEach((param) => {
      if (audit.isReclamoNovedad && (param.section === "ticket" || param.section === "mda")) {
        row.push("Eximido (Reclamo)");
      } else if (scoreMap.has(param.id)) {
        row.push(scoreMap.get(param.id) ? "Cumple" : "No cumple");
      } else {
        row.push("N/A");
      }
    });

    row.push(audit.notes || "");
    return row;
  });

  const xlsxBuffer = generateXlsxBuffer(
    `Auditorías ${monthParam || "General"}`,
    headers,
    rows,
  );

  const safeFilename = `auditorias_${agent.username || agent.id}_${monthParam || "total"}.xlsx`;

  return new Response(xlsxBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "private, no-cache",
    },
  });
};
