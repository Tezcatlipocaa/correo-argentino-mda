import type { ChannelType } from "@/types/quality";
import { wiseCxGet } from "@/lib/wise-cx-client";
import { invgateGet } from "@/lib/invgateClient";
import { cleanHtmlText } from "@/lib/titleNormalizer";

export interface ExtractedQualityMetadata {
  caseNumber: string;
  operator: string;
  date: string;
  duration?: string;
  ringTime?: string;
  creationTime?: string;
  takeTime?: string;
  priority?: string;
  isPas?: boolean;
  title?: string;
  description?: string;
  category?: string;
  status?: string;
  creator?: string;
  customer?: string;
  createdBy?: string;
  helpdesk?: string;
  source?: string;
  recordingUrl?: string;
  recordingId?: string;
  rawDetails?: Record<string, any>;
}


export function formatSecondsToMinutes(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function formatDurationToTime(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return "00:00";
  const hours = Math.floor(seconds / 3600);
  const remainder = seconds % 3600;
  const mins = Math.floor(remainder / 60);
  const secs = Math.floor(remainder % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function calculateWiseEmailResponseTime(
  createdAt?: string | null,
  replyAt?: string | null,
  solvedAt?: string | null,
  closedAt?: string | null,
): string {
  if (!createdAt) return "00:00";
  const endStr = replyAt || solvedAt || closedAt;
  if (!endStr) return "00:00";

  const startMs = Date.parse(createdAt.replace(" ", "T"));
  const endMs = Date.parse(endStr.replace(" ", "T"));

  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
    return "00:00";
  }

  const diffSeconds = Math.floor((endMs - startMs) / 1000);
  return formatDurationToTime(diffSeconds);
}


export function parseWiseCallMetadata(caseData: any, activities: any[] = []): ExtractedQualityMetadata {
  const caseNumber = (caseData?.number ?? caseData?.id ?? "").toString();
  const dateStr = (caseData?.created_at || "").split(" ")[0] || new Date().toISOString().split("T")[0];

  let durationSeconds = 0;
  let ringTimeSeconds = 0;
  let operatorName = "";

  let recordingUrl = "";
  let recordingId = "";

  // Buscar actividad de llamada con call_data o grabaciones
  const callActivity = activities.find(
    (a) => a.call_data || a.channel === "incoming_call" || a.type === "contact_message" || (Array.isArray(a.recordings) && a.recordings.length > 0),
  );

  if (callActivity) {
    if (Array.isArray(callActivity.recordings) && callActivity.recordings.length > 0) {
      const rec = callActivity.recordings[0];
      recordingUrl = rec.url || "";
      recordingId = rec.recording_id || "";
    }
  }

  // Si no estaba en callActivity principal, buscar en cualquier actividad que contenga recordings
  if (!recordingUrl) {
    const actWithRec = activities.find((a) => Array.isArray(a.recordings) && a.recordings.length > 0);
    if (actWithRec) {
      recordingUrl = actWithRec.recordings[0]?.url || "";
      recordingId = actWithRec.recordings[0]?.recording_id || "";
    }
  }

  if (callActivity?.call_data) {
    const cd = callActivity.call_data;
    durationSeconds = typeof cd.duration === "number" ? cd.duration : 0;

    // Buscar operador y evento de atencion en logs
    let attendedTimeStr = "";
    let assignedLogTimeStr = "";

    if (Array.isArray(cd.logs)) {
      for (const log of cd.logs) {
        const msg = log.message || "";
        if (msg.includes("[call_attended]")) {
          operatorName = msg.replace("[call_attended]", "").trim();
          attendedTimeStr = log.time || "";
        } else if (msg.includes("[assigned_limit]") || msg.includes("[call_transferred_area]")) {
          if (!assignedLogTimeStr) {
            assignedLogTimeStr = log.time || "";
          }
        } else if (msg.includes("[call_available_agents]") && !operatorName) {
          operatorName = msg.replace("[call_available_agents]", "").split(",")[0].trim();
        }
      }
    }

    // Calcular ring time: desde que se asigna/empieza a sonar hasta que atiende
    if (attendedTimeStr) {
      const parseLogSeconds = (t: string) => {
        const parts = t.split(":");
        if (parts.length === 3) {
          return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
        }
        return NaN;
      };

      const attendedSec = parseLogSeconds(attendedTimeStr);
      let assignSec = assignedLogTimeStr ? parseLogSeconds(assignedLogTimeStr) : NaN;

      if (!isNaN(attendedSec) && !isNaN(assignSec) && attendedSec >= assignSec) {
        ringTimeSeconds = Math.round(attendedSec - assignSec);
      } else if (cd.assigned_at) {
        const assignDate = new Date(cd.assigned_at.replace(" ", "T")).getTime();
        // Fallback usando cd.assigned_at contra logs o diferencia
        if (!isNaN(assignDate) && !isNaN(attendedSec) && Array.isArray(cd.logs) && cd.logs[0]?.time) {
          const startLogSec = parseLogSeconds(cd.logs[0].time);
          if (!isNaN(startLogSec)) {
            const startTimestamp = cd.started_at ? new Date(cd.started_at.replace(" ", "T")).getTime() : NaN;
            if (!isNaN(startTimestamp)) {
              const elapsedSinceStart = (attendedSec - startLogSec) * 1000;
              const attendedTimestamp = startTimestamp + elapsedSinceStart;
              if (attendedTimestamp >= assignDate) {
                ringTimeSeconds = Math.round((attendedTimestamp - assignDate) / 1000);
              }
            }
          }
        }
      }
    } else if (cd.started_at && cd.assigned_at) {
      // Fallback si no hay logs de [call_attended]
      const start = new Date(cd.started_at.replace(" ", "T")).getTime();
      const assigned = new Date(cd.assigned_at.replace(" ", "T")).getTime();
      if (!isNaN(start) && !isNaN(assigned) && assigned >= start) {
        ringTimeSeconds = Math.round((assigned - start) / 1000);
      }
    }
  }

  return {
    caseNumber,
    operator: operatorName,
    date: dateStr,
    duration: formatSecondsToMinutes(durationSeconds),
    ringTime: formatSecondsToMinutes(ringTimeSeconds),
    recordingUrl: recordingUrl || undefined,
    recordingId: recordingId || undefined,
    rawDetails: {
      caseId: caseData?.id,
      channel: caseData?.source_channel,
      status: caseData?.status,
    },
  };
}

export function parseWiseEmailMetadata(
  caseData: any,
  operatorName = "",
  firstReplyAt?: string | null,
): ExtractedQualityMetadata {
  const caseNumber = (caseData?.number ?? caseData?.id ?? "").toString();
  const createdAt = caseData?.created_at || "";
  const dateStr = createdAt.split(" ")[0] || new Date().toISOString().split("T")[0];
  const takeTime = caseData?.first_read || caseData?.last_read || createdAt;
  const duration = calculateWiseEmailResponseTime(
    createdAt,
    firstReplyAt,
    caseData?.solved_at,
    caseData?.closed_at,
  );

  return {
    caseNumber,
    operator: operatorName,
    date: dateStr,
    duration,
    creationTime: createdAt,
    takeTime,
    rawDetails: {
      caseId: caseData?.id,
      subject: caseData?.subject,
      channel: caseData?.source_channel,
      firstReplyAt: firstReplyAt || undefined,
      solvedAt: caseData?.solved_at,
      closedAt: caseData?.closed_at,
    },
  };
}

export const INVGATE_STATUS_NAMES: Record<number, string> = {
  1: "Nuevo",
  2: "Abierto",
  3: "Pendiente",
  4: "En espera",
  5: "Solucionado",
  6: "Cerrado",
  7: "Rechazado",
  8: "Cancelado",
};

export const INVGATE_PRIORITY_NAMES: Record<number, string> = {
  1: "Baja",
  2: "Media",
  3: "Alta",
  4: "Urgente",
};

export const INVGATE_SOURCE_NAMES: Record<number, string> = {
  1: "Correo",
  2: "Portal Web",
  3: "Teléfono",
  4: "Chat",
  5: "Presencial",
  6: "Móvil",
  7: "Monitoreo",
  8: "API",
};

export function parseInvgateAgMetadata(
  incident: any,
  extra?: {
    customerName?: string;
    createdByName?: string;
    categoryName?: string;
    operatorName?: string;
    helpdeskName?: string;
    sourceName?: string;
  },
): ExtractedQualityMetadata {
  const caseNumber = (incident?.id ?? "").toString();
  const rawCreated = incident?.created_at;
  const dateStr =
    typeof rawCreated === "number"
      ? new Date(rawCreated * 1000).toISOString().split("T")[0]
      : typeof rawCreated === "string"
        ? rawCreated.split(" ")[0]
        : new Date().toISOString().split("T")[0];

  const rawTake = incident?.updated_at || incident?.first_response_at || rawCreated;
  const takeTime =
    typeof rawTake === "number"
      ? new Date(rawTake * 1000).toISOString().replace("T", " ").substring(0, 19)
      : typeof rawTake === "string"
        ? rawTake
        : "";

  const creationTime =
    typeof rawCreated === "number"
      ? new Date(rawCreated * 1000).toISOString().replace("T", " ").substring(0, 19)
      : typeof rawCreated === "string"
        ? rawCreated
        : "";

  const priorityName =
    incident?.priority?.name ??
    (typeof incident?.priority === "string" ? incident.priority : null) ??
    (typeof incident?.priority_id === "number" ? INVGATE_PRIORITY_NAMES[incident.priority_id] : null) ??
    "Media";

  const operatorName =
    extra?.operatorName ??
    incident?.assigned_to?.name ??
    incident?.collaborator ??
    "";

  const title = incident?.title || "";
  const description = cleanHtmlText(incident?.description || "");

  const categoryName =
    extra?.categoryName ??
    incident?.category?.name ??
    (typeof incident?.category === "string" ? incident.category : "") ??
    "";

  const helpdeskName =
    extra?.helpdeskName ??
    incident?.helpdesk?.name ??
    (typeof incident?.helpdesk === "string" ? incident.helpdesk : "") ??
    "";

  const sourceName =
    extra?.sourceName ??
    incident?.source?.name ??
    (typeof incident?.source === "string" ? incident.source : null) ??
    (typeof incident?.source_id === "number" ? INVGATE_SOURCE_NAMES[incident.source_id] : null) ??
    "";

  const statusName =
    incident?.status?.name ??
    (typeof incident?.status === "string" ? incident.status : null) ??
    (typeof incident?.status_id === "number" ? INVGATE_STATUS_NAMES[incident.status_id] : null) ??
    "";

  const customerName =
    extra?.customerName ??
    incident?.customer?.name ??
    incident?.user?.name ??
    (typeof incident?.customer === "string" ? incident.customer : "") ??
    "";

  const createdByName =
    extra?.createdByName ??
    incident?.creator?.name ??
    (typeof incident?.creator === "string" ? incident.creator : "") ??
    customerName ??
    "";

  const creatorName = customerName || createdByName || "";

  // Condición PAS: ubicación, cliente o helpdesk contiene 'pas'
  const locName = (incident?.location?.name || "").toLowerCase();
  const hdName = (helpdeskName || incident?.helpdesk?.name || "").toLowerCase();
  const isPas = locName.includes("pas") || hdName.includes("pas");

  return {
    caseNumber,
    operator: operatorName,
    date: dateStr,
    priority: priorityName,
    creationTime,
    takeTime,
    isPas,
    title,
    description,
    category: categoryName,
    helpdesk: helpdeskName || undefined,
    source: sourceName || undefined,
    status: statusName,
    creator: creatorName,
    customer: customerName || creatorName || undefined,
    createdBy: createdByName || creatorName || undefined,
    rawDetails: {
      incidentId: incident?.id,
      title,
      description,
      status: statusName,
      category: categoryName,
      creator: creatorName,
      customer: customerName || creatorName,
      createdBy: createdByName || creatorName,
      priority: priorityName,
      location: incident?.location?.name || incident?.location,
      helpdesk: helpdeskName || incident?.helpdesk?.name || incident?.helpdesk,
      source: sourceName || incident?.source?.name || incident?.source,
    },
  };
}


export async function fetchInvgateTicketMetadata(
  ticketId: string | number,
): Promise<{ ok: boolean; data?: ExtractedQualityMetadata; error?: string }> {
  const cleanId = ticketId.toString().replace("#", "").trim();
  if (!cleanId) return { ok: false, error: "Identificador de ticket InvGate requerido" };

  try {
    const res = await invgateGet<any>(`incident?id=${cleanId}`);
    if (!res.ok || !res.data) {
      return { ok: false, error: `No se encontró el incidente InvGate #${cleanId}` };
    }
    const incident = res.data;

    let customerName = "";
    let createdByName = "";
    let operatorName = "";
    let categoryName = "";
    let helpdeskName = incident.helpdesk?.name || (typeof incident.helpdesk === "string" ? incident.helpdesk : "");

    // 1. Resolver solicitante (user_id) y creador (creator_id)
    const targetUserId = incident.user_id;
    const targetCreatorId = incident.creator_id;

    if (targetUserId) {
      try {
        const uRes = await invgateGet<any>(`user?id=${targetUserId}`);
        if (uRes.ok && uRes.data) {
          const u = uRes.data;
          customerName = `${u.name || ""} ${u.lastname || ""}`.trim() || u.username || "";
        }
      } catch {
        // Fallback silencioso
      }
    }

    if (targetCreatorId) {
      if (targetUserId && targetCreatorId === targetUserId) {
        createdByName = customerName;
      } else {
        try {
          const cRes = await invgateGet<any>(`user?id=${targetCreatorId}`);
          if (cRes.ok && cRes.data) {
            const c = cRes.data;
            createdByName = `${c.name || ""} ${c.lastname || ""}`.trim() || c.username || "";
          }
        } catch {
          // Fallback silencioso
        }
      }
    }

    // Fallback cruzado si falta alguno de los dos
    if (!customerName && createdByName) {
      customerName = createdByName;
    } else if (!createdByName && customerName) {
      createdByName = customerName;
    }

    // 2. Resolver operador si existe assigned_id

    if (incident.assigned_id) {
      try {
        const aRes = await invgateGet<any>(`user?id=${incident.assigned_id}`);
        if (aRes.ok && aRes.data) {
          const a = aRes.data;
          operatorName = `${a.name || ""} ${a.lastname || ""}`.trim() || a.username || "";
        }
      } catch {
        // Fallback silencioso
      }
    }

    // 3. Resolver categoría si existe category_id
    if (incident.category_id) {
      try {
        const catRes = await invgateGet<any>("categories?page_size=500");
        if (catRes.ok && Array.isArray(catRes.data)) {
          const cat = catRes.data.find((c: any) => c.id === incident.category_id);
          if (cat?.name) {
            categoryName = cat.name;
          }
        } else if (catRes.ok && Array.isArray(catRes.data?.data)) {
          const cat = catRes.data.data.find((c: any) => c.id === incident.category_id);
          if (cat?.name) {
            categoryName = cat.name;
          }
        }
      } catch {
        // Fallback silencioso
      }
    }

    // 4. Resolver Helpdesk si no vino con nombre y existe assigned_group_id o helpdesk_id
    const targetGroupId =
      incident.assigned_group_id ??
      incident.helpdesk_id ??
      (typeof incident.helpdesk === "number" ? incident.helpdesk : null);

    if (!helpdeskName && targetGroupId) {
      try {
        const hdLevelsRes = await invgateGet<any>("helpdesksandlevels");
        if (hdLevelsRes.ok && Array.isArray(hdLevelsRes.data)) {
          const allHd = hdLevelsRes.data;
          const found = allHd.find((h: any) => h.id === targetGroupId);

          if (found) {
            if (found.name) {
              helpdeskName = found.name;
            } else if (found.parent_id) {
              // Es un subnivel (ej: Nivel 1) cuyo parent_id es la mesa raíz
              const parent = allHd.find((h: any) => h.id === found.parent_id);
              const parentName = parent?.name || `Mesa #${found.parent_id}`;
              const levelSuffix = found.level_order ? ` Nivel ${found.level_order}` : "";
              helpdeskName = `${parentName}${levelSuffix}`;
            }
          }
        }

        // Si no se encontró en helpdesksandlevels, intentar en helpdesks estándar
        if (!helpdeskName) {
          const hdRes = await invgateGet<any>("helpdesks");
          if (hdRes.ok && Array.isArray(hdRes.data)) {
            const found = hdRes.data.find((h: any) => h.id === targetGroupId);
            if (found?.name) {
              helpdeskName = found.name;
            }
          }
        }
      } catch {
        // Fallback silencioso
      }
    }

    // 5. Resolver Source si existe source_id y no se pudo inferir estáticamente
    let sourceName =
      incident.source?.name ??
      (typeof incident.source === "string" ? incident.source : null) ??
      (typeof incident.source_id === "number" ? INVGATE_SOURCE_NAMES[incident.source_id] : null) ??
      "";

    if (!sourceName && incident.source_id) {
      try {
        const srcRes = await invgateGet<any>("incident.attributes.source");
        if (srcRes.ok && Array.isArray(srcRes.data)) {
          const found = srcRes.data.find((s: any) => s.id === incident.source_id);
          if (found?.name) {
            sourceName = found.name;
          }
        }
      } catch {
        // Fallback silencioso
      }
    }

    if (!customerName && !incident.customer && !incident.creator && !incident.user) {
      customerName = "Desconocido";
    }
    if (!categoryName && !incident.category) {
      categoryName = "Sin categoría";
    }
    if (!helpdeskName && !incident.helpdesk) {
      helpdeskName = "Sin mesa asignada";
    }
    if (!sourceName && !incident.source) {
      sourceName = "Sin origen";
    }

    const metadata = parseInvgateAgMetadata(incident, {
      customerName,
      createdByName,
      categoryName,
      operatorName,
      helpdeskName,
      sourceName,
    });
    return { ok: true, data: metadata };

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al consultar ticket de InvGate";
    return { ok: false, error: msg };
  }
}

export async function fetchWiseCaseData(identifier: string | number) {
  const cleanId = identifier.toString().replace("#", "").trim();

  // 1. Si es numérico largo (>= 8 dígitos), puede ser el ID interno de Wise CX
  if (/^\d{8,}$/.test(cleanId)) {
    const direct = await wiseCxGet<any>(
      `/core/v1/cases/${cleanId}?fields=id,number,group_id,user_id,contact_id,status,source_channel,tags,subject,created_at,solved_at,closed_at,last_read,first_read`,
    );
    if (direct.ok && direct.data?.id) {
      return direct.data;
    }
  }

  // 2. Buscar por número de ticket (cases.number) con filtering JSON
  const numVal = isNaN(Number(cleanId)) ? cleanId : Number(cleanId);
  const filterJson = JSON.stringify([
    { field: "cases.number", operator: "EQUAL", value: numVal },
  ]);
  const listRes = await wiseCxGet<any>(
    `/core/v1/cases?filtering=${encodeURIComponent(filterJson)}&fields=id,number,group_id,user_id,contact_id,status,source_channel,tags,subject,created_at,solved_at,closed_at,last_read,first_read`,
  );

  if (listRes.ok && Array.isArray(listRes.data?.data) && listRes.data.data.length > 0) {
    const matched = listRes.data.data.find(
      (c: any) => c.number?.toString() === cleanId || c.id?.toString() === cleanId,
    );
    if (matched) return matched;
  }

  // 3. Si no se encontró por cases.number, intentar por cases.id mediante filtering
  const filterIdJson = JSON.stringify([
    { field: "cases.id", operator: "EQUAL", value: numVal },
  ]);
  const listByIdRes = await wiseCxGet<any>(
    `/core/v1/cases?filtering=${encodeURIComponent(filterIdJson)}&fields=id,number,group_id,user_id,contact_id,status,source_channel,tags,subject,created_at,solved_at,closed_at,last_read,first_read`,
  );
  if (listByIdRes.ok && Array.isArray(listByIdRes.data?.data) && listByIdRes.data.data.length > 0) {
    const matched = listByIdRes.data.data.find(
      (c: any) => c.number?.toString() === cleanId || c.id?.toString() === cleanId,
    );
    if (matched) return matched;
  }

  // 4. Fallback: intentar consulta por ID estándar directo
  const fallback = await wiseCxGet<any>(`/core/v1/cases/${cleanId}`);
  if (fallback.ok && fallback.data?.id) return fallback.data;

  return null;
}

export async function fetchQualityCaseMetadata(
  channel: ChannelType,
  identifier: string | number,
  source?: "wise" | "invgate",
): Promise<{ ok: boolean; data?: ExtractedQualityMetadata; error?: string }> {
  const cleanId = identifier.toString().replace("#", "").trim();
  if (!cleanId) return { ok: false, error: "Identificador de caso requerido" };

  try {
    if (source === "invgate" || channel === "invgate_ticket") {
      return fetchInvgateTicketMetadata(cleanId);
    }
    if (channel === "wise_call") {
      const caseData = await fetchWiseCaseData(cleanId);
      if (!caseData?.id) {
        return { ok: false, error: `No se encontró la llamada Wise con número/ID ${cleanId}` };
      }

      // Obtener actividades (pueden venir como array directo o bajo data)
      const actRes = await wiseCxGet<any>(
        `/core/v1/cases/${caseData.id}/activities?fields=id,case_id,type,user_id,channel,content,contact_from,contacts_to,attachments,recordings,created_at,sending_status`,
      );
      const activities = actRes.ok
        ? (Array.isArray(actRes.data)
            ? actRes.data
            : Array.isArray(actRes.data?.data)
              ? actRes.data.data
              : [])
        : [];

      const metadata = parseWiseCallMetadata(caseData, activities);

      // Si no pudimos resolver el nombre en los logs pero tenemos user_id, consultar el usuario
      if (!metadata.operator && caseData.user_id) {
        const uRes = await wiseCxGet<any>(`/core/v1/users/${caseData.user_id}`);
        if (uRes.ok && (uRes.data?.first_name || uRes.data?.nick)) {
          metadata.operator = `${uRes.data.first_name || ""} ${uRes.data.last_name || ""}`.trim() || uRes.data.nick;
        }
      }

      return { ok: true, data: metadata };
    }

    if (channel === "wise_email") {
      const caseData = await fetchWiseCaseData(cleanId);
      if (!caseData?.id) {
        return { ok: false, error: `No se encontró el correo Wise con número/ID ${cleanId}` };
      }

      let operatorName = "";
      if (caseData.user_id) {
        const uRes = await wiseCxGet<any>(`/core/v1/users/${caseData.user_id}`);
        if (uRes.ok && (uRes.data?.first_name || uRes.data?.nick)) {
          operatorName = `${uRes.data.first_name || ""} ${uRes.data.last_name || ""}`.trim() || uRes.data.nick;
        }
      }

      // Obtener actividades para detectar la primera respuesta del operador (user_reply)
      let firstReplyAt: string | undefined;
      try {
        const actRes = await wiseCxGet<any>(
          `/core/v1/cases/${caseData.id}/activities?fields=id,case_id,type,user_id,channel,created_at`,
        );
        if (actRes.ok) {
          const acts = Array.isArray(actRes.data)
            ? actRes.data
            : Array.isArray(actRes.data?.data)
              ? actRes.data.data
              : [];
          const replyAct = acts.find((a: any) => a.type === "user_reply" && a.created_at);
          if (replyAct?.created_at) {
            firstReplyAt = replyAct.created_at;
          }
        }
      } catch {
        // Fallback silencioso a solved_at/closed_at
      }

      const metadata = parseWiseEmailMetadata(caseData, operatorName, firstReplyAt);
      return { ok: true, data: metadata };
    }

    if (channel === "invgate_ticket") {
      const res = await invgateGet<any>(`incident?id=${cleanId}`);
      if (!res.ok || !res.data) {
        return { ok: false, error: `No se encontró el incidente InvGate #${cleanId}` };
      }

      const metadata = parseInvgateAgMetadata(res.data);
      return { ok: true, data: metadata };
    }

    return { ok: false, error: "Canal no soportado" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado al consultar metadatos";
    return { ok: false, error: msg };
  }
}

