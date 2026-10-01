import type { ChannelType } from "@/types/quality";
import { wiseCxGet } from "@/lib/wise-cx-client";
import { invgateGet } from "@/lib/invgateClient";

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
  rawDetails?: Record<string, any>;
}

export function formatSecondsToMinutes(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function parseWiseCallMetadata(caseData: any, activities: any[] = []): ExtractedQualityMetadata {
  const caseNumber = (caseData?.number ?? caseData?.id ?? "").toString();
  const dateStr = (caseData?.created_at || "").split(" ")[0] || new Date().toISOString().split("T")[0];

  let durationSeconds = 0;
  let ringTimeSeconds = 0;
  let operatorName = "";

  // Buscar actividad de llamada con call_data
  const callActivity = activities.find(
    (a) => a.call_data || a.channel === "incoming_call" || a.type === "contact_message",
  );

  if (callActivity?.call_data) {
    const cd = callActivity.call_data;
    durationSeconds = typeof cd.duration === "number" ? cd.duration : 0;

    // Calcular ring time si existen started_at y assigned_at
    if (cd.started_at && cd.assigned_at) {
      const start = new Date(cd.started_at.replace(" ", "T")).getTime();
      const assigned = new Date(cd.assigned_at.replace(" ", "T")).getTime();
      if (!isNaN(start) && !isNaN(assigned) && assigned >= start) {
        ringTimeSeconds = Math.round((assigned - start) / 1000);
      }
    }

    // Buscar operador en los logs si está presente
    if (Array.isArray(cd.logs)) {
      for (const log of cd.logs) {
        const msg = log.message || "";
        if (msg.includes("[call_attended]")) {
          operatorName = msg.replace("[call_attended]", "").trim();
          break;
        } else if (msg.includes("[call_available_agents]") && !operatorName) {
          operatorName = msg.replace("[call_available_agents]", "").split(",")[0].trim();
        }
      }
    }
  }

  return {
    caseNumber,
    operator: operatorName,
    date: dateStr,
    duration: formatSecondsToMinutes(durationSeconds),
    ringTime: formatSecondsToMinutes(ringTimeSeconds),
    rawDetails: {
      caseId: caseData?.id,
      channel: caseData?.source_channel,
      status: caseData?.status,
    },
  };
}

export function parseWiseEmailMetadata(caseData: any, operatorName = ""): ExtractedQualityMetadata {
  const caseNumber = (caseData?.number ?? caseData?.id ?? "").toString();
  const createdAt = caseData?.created_at || "";
  const dateStr = createdAt.split(" ")[0] || new Date().toISOString().split("T")[0];
  const takeTime = caseData?.first_read || caseData?.last_read || createdAt;

  return {
    caseNumber,
    operator: operatorName,
    date: dateStr,
    creationTime: createdAt,
    takeTime,
    rawDetails: {
      caseId: caseData?.id,
      subject: caseData?.subject,
      channel: caseData?.source_channel,
    },
  };
}

export function parseInvgateAgMetadata(incident: any): ExtractedQualityMetadata {
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

  const priorityName = incident?.priority?.name ?? (typeof incident?.priority === "string" ? incident.priority : "Media");
  const operatorName = incident?.assigned_to?.name ?? incident?.collaborator ?? "";

  // Condición PAS: ubicación, cliente o helpdesk contiene 'pas'
  const locName = (incident?.location?.name || "").toLowerCase();
  const hdName = (incident?.helpdesk?.name || "").toLowerCase();
  const isPas = locName.includes("pas") || hdName.includes("pas");

  return {
    caseNumber,
    operator: operatorName,
    date: dateStr,
    priority: priorityName,
    creationTime,
    takeTime,
    isPas,
    rawDetails: {
      incidentId: incident?.id,
      title: incident?.title,
      status: incident?.status?.name || incident?.status,
    },
  };
}

export async function fetchWiseCaseData(identifier: string | number) {
  const cleanId = identifier.toString().replace("#", "").trim();

  // 1. Intentar obtener por ID directo si es numérico largo (>6 dígitos)
  if (/^\d{8,}$/.test(cleanId)) {
    const direct = await wiseCxGet<any>(`/core/v1/cases/${cleanId}?fields=id,number,group_id,user_id,contact_id,status,source_channel,tags,subject,created_at,solved_at,closed_at,last_read,first_read`);
    if (direct.ok && direct.data?.id) {
      return direct.data;
    }
  }

  // 2. Buscar por número de caso en Wise CX (con paginación o filtro)
  // Intentamos por query param directo o paginación estimada
  const listRes = await wiseCxGet<any>(`/core/v1/cases?filtering[0][field]=number&filtering[0][operator]=EQUAL&filtering[0][value]=${encodeURIComponent(cleanId)}&fields=id,number,group_id,user_id,contact_id,status,source_channel,tags,subject,created_at,solved_at,closed_at,last_read,first_read`);

  if (listRes.ok && Array.isArray(listRes.data?.data)) {
    const matched = listRes.data.data.find((c: any) => c.number?.toString() === cleanId || c.id?.toString() === cleanId);
    if (matched) return matched;
  }

  // 3. Fallback: intentar consulta por ID estándar
  const fallback = await wiseCxGet<any>(`/core/v1/cases/${cleanId}`);
  if (fallback.ok && fallback.data) return fallback.data;

  return null;
}

export async function fetchQualityCaseMetadata(
  channel: ChannelType,
  identifier: string | number,
): Promise<{ ok: boolean; data?: ExtractedQualityMetadata; error?: string }> {
  const cleanId = identifier.toString().replace("#", "").trim();
  if (!cleanId) return { ok: false, error: "Identificador de caso requerido" };

  try {
    if (channel === "wise_call") {
      const caseData = await fetchWiseCaseData(cleanId);
      if (!caseData?.id) {
        return { ok: false, error: `No se encontró la llamada Wise con número/ID ${cleanId}` };
      }

      // Obtener actividades (pueden venir como array directo o bajo data)
      const actRes = await wiseCxGet<any>(`/core/v1/cases/${caseData.id}/activities`);
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

      const metadata = parseWiseEmailMetadata(caseData, operatorName);
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

