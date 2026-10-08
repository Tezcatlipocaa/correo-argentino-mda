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
import { generateMultiSheetXlsxBuffer, type XlsxSheetDefinition } from "@lib/xlsx";
import {
  CHANNEL_LABEL_MAP,
  getTicketModeLabel,
  getAuditExportHeaders,
  buildOperatorFullEvaluationSheet,
  buildGeneralSummarySheet,
  type OperatorMonthlySummary,
  type QualityAuditExportData,
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
  const allParam = url.searchParams.get("all");

  const isAgentRole = role === "agent";

  // Determine if single agent or all agents
  let isSingleAgent = false;
  let targetAgentId: number | null = null;

  if (isAgentRole) {
    // Regular agent can only ever export themselves
    const [selfAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.username, user.username))
      .limit(1);

    if (!selfAgent) {
      return new Response(JSON.stringify({ error: "Ficha de operador no encontrada" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    isSingleAgent = true;
    targetAgentId = selfAgent.id;
  } else if (agentIdParam && agentIdParam !== "all" && allParam !== "true" && allParam !== "1") {
    // Explicit single agent requested by supervisor/admin
    const parsedId = parseInt(agentIdParam, 10);
    if (isNaN(parsedId)) {
      return new Response(JSON.stringify({ error: "agentId inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    isSingleAgent = true;
    targetAgentId = parsedId;
  }

  // Get all audit parameters ordered
  const allParams = await db
    .select()
    .from(auditParameters)
    .orderBy(auditParameters.order);

  const paramById = new Map<number, (typeof allParams)[0]>();
  allParams.forEach((p) => paramById.set(p.id, p));

  // Fetch all agents
  const allAgents = await db
    .select()
    .from(agents)
    .orderBy(agents.name);

  const agentMap = new Map<number, (typeof allAgents)[0]>();
  allAgents.forEach((a) => agentMap.set(a.id, a));

  // Determine agents list to export
  let targetAgents: typeof allAgents = [];
  if (isSingleAgent && targetAgentId !== null) {
    const singleAgent = agentMap.get(targetAgentId);
    if (!singleAgent) {
      return new Response(JSON.stringify({ error: "Operador no encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    targetAgents = [singleAgent];
  } else {
    targetAgents = allAgents;
  }

  // Build audit query conditions
  const auditConditions = [];
  if (isSingleAgent && targetAgentId !== null) {
    auditConditions.push(eq(qualityAudits.agentId, targetAgentId));
  }
  if (monthParam) {
    auditConditions.push(eq(qualityAudits.month, monthParam));
  }

  const audits = await db
    .select()
    .from(qualityAudits)
    .where(auditConditions.length > 0 ? and(...auditConditions) : undefined)
    .orderBy(qualityAudits.agentId, qualityAudits.id);

  // Group audits by agent
  const auditsByAgentId = new Map<number, typeof audits>();
  for (const a of audits) {
    if (!auditsByAgentId.has(a.agentId)) {
      auditsByAgentId.set(a.agentId, []);
    }
    auditsByAgentId.get(a.agentId)!.push(a);
  }

  // Filter target agents to those who have audits (unless single agent requested)
  const activeAgents = isSingleAgent
    ? targetAgents
    : targetAgents.filter((ag) => auditsByAgentId.has(ag.id));

  // Fetch all scores for these audits
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

  // Prepare sheets collection
  const sheets: XlsxSheetDefinition[] = [];
  const operatorSummaries: OperatorMonthlySummary[] = [];

  // For each agent, build their full evaluation sheet and calculate channel averages
  for (const ag of activeAgents) {
    const agentAudits = auditsByAgentId.get(ag.id) || [];
    const calls = agentAudits.filter((a) => a.channelType === "wise_call");
    const emails = agentAudits.filter((a) => a.channelType === "wise_email");
    const ags = agentAudits.filter((a) => a.channelType === "invgate_ticket");

    const callAvg = calls.length > 0 ? Math.round(calls.reduce((s, a) => s + a.totalScore, 0) / calls.length) : null;
    const emailAvg = emails.length > 0 ? Math.round(emails.reduce((s, a) => s + a.totalScore, 0) / emails.length) : null;
    const agAvg = ags.length > 0 ? Math.round(ags.reduce((s, a) => s + a.totalScore, 0) / ags.length) : null;
    const overallAvg = agentAudits.length > 0 ? Math.round(agentAudits.reduce((s, a) => s + a.totalScore, 0) / agentAudits.length) : 0;

    operatorSummaries.push({
      name: ag.name,
      callAvg,
      emailAvg,
      agAvg,
      overallAvg,
    });

    const exportAuditsData: QualityAuditExportData[] = agentAudits.map((a) => {
      const auditScoresList = scoresByAudit.get(a.id) || [];
      return {
        id: a.id,
        channelType: a.channelType,
        date: a.date,
        callId: a.callId,
        ticketId: a.ticketId,
        duration: a.duration,
        ringTime: a.ringTime,
        creationTime: a.creationTime,
        takeTime: a.takeTime,
        appliesMda: a.appliesMda,
        staysInMda: a.staysInMda,
        isPas: a.isPas,
        isReclamoNovedad: a.isReclamoNovedad,
        notes: a.notes,
        section1Score: a.section1Score,
        section2Score: a.section2Score,
        totalScore: a.totalScore,
        scores: auditScoresList.map((sc) => {
          const param = paramById.get(sc.parameterId);
          return {
            parameterCode: param ? param.code : String(sc.parameterId),
            score: sc.score,
            comment: sc.comment,
          };
        }),
      };
    });

    const evalSheet = buildOperatorFullEvaluationSheet(ag.name, exportAuditsData);
    sheets.push({
      name: evalSheet.name,
      colWidths: evalSheet.colWidths,
      rawRows: evalSheet.rawRows,
    });
  }

  // If exporting all operators, put the General Summary sheet as Sheet 1
  if (!isSingleAgent && operatorSummaries.length > 0) {
    const summarySheet = buildGeneralSummarySheet(monthParam, operatorSummaries);
    sheets.unshift({
      name: summarySheet.name,
      colWidths: summarySheet.colWidths,
      rawRows: summarySheet.rawRows,
    });
  }

  // Append "Listado Detallado" sheet
  const headers = getAuditExportHeaders(allParams);
  const detailedRows = audits.map((audit) => {
    const agObj = agentMap.get(audit.agentId);
    const auditScoresList = scoresByAudit.get(audit.id) || [];
    const scoreMap = new Map<number, boolean>();
    for (const sc of auditScoresList) {
      scoreMap.set(sc.parameterId, sc.score);
    }

    const ticketMode = getTicketModeLabel(audit);

    const row: (string | number | boolean | null | undefined)[] = [
      audit.month,
      CHANNEL_LABEL_MAP[audit.channelType] || audit.channelType,
      agObj ? agObj.name : `Operador ${audit.agentId}`,
      agObj ? agObj.username || "" : "",
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

  sheets.push({
    name: "Listado Detallado",
    headers,
    rows: detailedRows,
  });

  const xlsxBuffer = generateMultiSheetXlsxBuffer(sheets);

  const safeFilename = isSingleAgent
    ? `evaluacion_${targetAgents[0].name.replace(/[^a-zA-Z0-9_\-]/g, "_")}_${monthParam || "total"}.xlsx`
    : `MDA - Gestion de Desempeno - ${monthParam || "General"}.xlsx`;

  return new Response(xlsxBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(safeFilename)}"`,
      "Cache-Control": "private, no-cache",
    },
  });
};
