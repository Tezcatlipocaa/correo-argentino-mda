/**
 * Servicio de presencia y estados en tiempo real desde Wise CX Analytics (Wallboard)
 */

export interface WiseCxAgentRaw {
  agent_auto_id: number;
  agent_id_chat?: string;
  agent_name: string;
  agent_status: string;
  status_id: number;
  field_color: string;
  agentstatus_type: number;
  user_status_date: string;
  agent_capacity_slots?: string;
}

export type WiseCxStatusCategory =
  | "disponible"
  | "en_llamada"
  | "bloqueado"
  | "desconectado"
  | "invisible";

export type WiseCxBadgeVariant = "success" | "warning" | "error" | "neutral";

export interface WiseCxPresence {
  agentAutoId: number;
  agentName: string;
  status: string;
  statusCategory: WiseCxStatusCategory;
  badgeVariant: WiseCxBadgeVariant;
  fieldColor: string;
  userStatusDate: string; // UTC string
  minutesInStatus: number;
  inCall: boolean;
  phoneLive: boolean;
  canReceiveAgs: boolean;
  motivoBloqueo?: string;
}

// Mapeos manuales de alias para diferencias fonéticas / nombres compuestos
const MANUAL_ALIASES: Record<string, string[]> = {
  "paredes joel": ["alan yoel paredes", "yoel paredes"],
  "lopez moreno nicolas": ["fernando nicolas moreno lopez"],
  "gonzalez franco": ["franco nahuel gonzalez"],
};

// Cache en memoria
let presenceCache: { data: Map<string, WiseCxPresence>; timestamp: number } | null = null;
const CACHE_TTL_MS = 15 * 1000; // 15 segundos

/**
 * Normaliza una cadena de texto quitando tildes, signos de puntuación y espacios extras
 */
export function normalizePresenceText(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Clasifica el estado de telefonía según las reglas de negocio MDA
 */
export function classifyWiseCxStatus(
  statusRaw: string,
  inCall: boolean
): {
  statusCategory: WiseCxStatusCategory;
  badgeVariant: WiseCxBadgeVariant;
  canReceiveAgs: boolean;
  motivoBloqueo?: string;
} {
  const norm = normalizePresenceText(statusRaw);

  if (inCall) {
    return {
      statusCategory: "en_llamada",
      badgeVariant: "warning",
      canReceiveAgs: true,
    };
  }

  if (norm.includes("disponible") && !norm.includes("no disponible")) {
    return {
      statusCategory: "disponible",
      badgeVariant: "success",
      canReceiveAgs: true,
    };
  }

  if (norm.includes("desconectado")) {
    return {
      statusCategory: "desconectado",
      badgeVariant: "neutral",
      canReceiveAgs: false,
      motivoBloqueo: "Desconectado",
    };
  }

  if (norm.includes("invisible")) {
    return {
      statusCategory: "invisible",
      badgeVariant: "neutral",
      canReceiveAgs: false,
      motivoBloqueo: "Invisible (Wise CX)",
    };
  }

  // Estados bloqueantes (indicador rojo): Administrativo, Almuerzo, Baño, Devolución Supervisión,
  // Llamada saliente, Llamada Sin Atender, No Disponible, Reunión
  let motivo = `${statusRaw.trim()} (Wise CX)`;
  if (norm.includes("almuerzo")) {
    motivo = "En almuerzo (Wise CX)";
  } else if (norm.includes("reunion") || norm.includes("reunión")) {
    motivo = "En reunión (Wise CX)";
  } else if (norm.includes("bano") || norm.includes("baño")) {
    motivo = "En pausa/baño (Wise CX)";
  } else if (norm.includes("devolucion") || norm.includes("devolución")) {
    motivo = "Devolución Supervisión (Wise CX)";
  } else if (norm.includes("administrativo")) {
    motivo = "En tarea administrativa (Wise CX)";
  } else if (norm.includes("saliente")) {
    motivo = "En llamada saliente (Wise CX)";
  } else if (norm.includes("sin atender")) {
    motivo = "Llamada sin atender (Wise CX)";
  } else if (norm.includes("no disponible")) {
    motivo = "No disponible (Wise CX)";
  }

  return {
    statusCategory: "bloqueado",
    badgeVariant: "error",
    canReceiveAgs: false,
    motivoBloqueo: motivo,
  };
}

/**
 * Calcula los minutos transcurridos desde una fecha UTC "YYYY-MM-DD HH:mm:ss"
 */
function calculateMinutesInStatus(utcDateStr: string): number {
  if (!utcDateStr) return 0;
  try {
    const statusTime = new Date(utcDateStr.replace(" ", "T") + "Z").getTime();
    if (isNaN(statusTime)) return 0;
    const diffMs = Math.max(0, Date.now() - statusTime);
    return Math.floor(diffMs / 60000);
  } catch {
    return 0;
  }
}

function getEnv(key: string): string {
  if (process.env[key]) return process.env[key]!;
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const val = (import.meta.env as any)[key];
    if (val && typeof val === "string") return val;
  }
  return "";
}

/**
 * Obtiene la lista completa de presencia desde el endpoint de Wise CX Analytics
 */
export async function fetchWiseCxPresenceList(): Promise<WiseCxPresence[]> {
  const codeCompany = getEnv("WISE_CX_WALLBOARD_COMPANY");
  const tabGuid = getEnv("WISE_CX_WALLBOARD_TAB_GUID");
  const widgetIdStr = getEnv("WISE_CX_WALLBOARD_WIDGET_ID");
  const widgetId = widgetIdStr ? parseInt(widgetIdStr, 10) : 0;

  if (!codeCompany || !tabGuid || !widgetId) {
    console.warn(
      "[Wise CX Presence] Variables de entorno WISE_CX_WALLBOARD_COMPANY, WISE_CX_WALLBOARD_TAB_GUID o WISE_CX_WALLBOARD_WIDGET_ID no configuradas."
    );
    return [];
  }

  const payload = {
    widgetType: 64,
    widgetID: widgetId,
    widget: {
      id: widgetId,
      type: 64,
      wql: "agent_group NONE (24249) AND agent_status IN (1,2,6,5,3,1227,963,965,1177,982,1536,4,966)",
      dataSource: "agents",
      groupBy: "agent_name",
      orderBy: "agent_status ASC",
      config: {
        pageNumber: 0,
        pageSize: 100,
        series: [
          { field: "agent_name", type: "string" },
          { field: "agent_status", type: "string" },
        ],
      },
    },
    reportValues: {
      codeCompany,
      tab_guid: tabGuid,
      wqlPublic: "",
    },
  };

  const response = await fetch(
    `https://analytics.wcx.cloud/Reports.svc/getDataReportByWidget?_t=${Date.now()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Referer: "https://analytics.wcx.cloud/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(`[Wise CX Analytics] HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  const parsed = JSON.parse(json.d);
  const rawList: WiseCxAgentRaw[] = parsed?.data?.list || [];

  return rawList.map((raw) => {
    let inCall = false;
    let phoneLive = false;

    if (raw.agent_capacity_slots) {
      try {
        const slots = JSON.parse(raw.agent_capacity_slots);
        phoneLive = Boolean(slots.phone_live);
        inCall = Boolean(
          slots.phone?.busy > 0 ||
          (slots.current_call && String(slots.current_call).trim() !== "")
        );
      } catch {
        // Fallback silencioso si falla el parseo de slots
      }
    }

    const { statusCategory, badgeVariant, canReceiveAgs, motivoBloqueo } =
      classifyWiseCxStatus(raw.agent_status, inCall);

    return {
      agentAutoId: raw.agent_auto_id,
      agentName: (raw.agent_name || "").trim(),
      status: raw.agent_status || "Desconectado",
      statusCategory,
      badgeVariant,
      fieldColor: raw.field_color || "#D2D2D2",
      userStatusDate: raw.user_status_date,
      minutesInStatus: calculateMinutesInStatus(raw.user_status_date),
      inCall,
      phoneLive,
      canReceiveAgs,
      motivoBloqueo,
    };
  });
}

/**
 * Obtiene el mapa de presencia con cache en memoria (15s)
 */
export async function getWiseCxPresenceMap(forceRefresh = false): Promise<WiseCxPresence[]> {
  const now = Date.now();
  if (!forceRefresh && presenceCache && now - presenceCache.timestamp < CACHE_TTL_MS) {
    return Array.from(presenceCache.data.values());
  }

  try {
    const list = await fetchWiseCxPresenceList();
    const map = new Map<string, WiseCxPresence>();
    list.forEach((p) => {
      map.set(normalizePresenceText(p.agentName), p);
    });
    presenceCache = { data: map, timestamp: now };
    return list;
  } catch (error) {
    console.error("[Wise CX Presence] Error al actualizar estados:", error);
    // Si falla la red, usar cache viejo si existe
    if (presenceCache) {
      return Array.from(presenceCache.data.values());
    }
    return [];
  }
}

/**
 * Encuentra el estado de Wise CX correspondiente a un operador de la BD
 */
export function findWiseCxPresenceForAgent(
  dbName: string,
  presenceList: WiseCxPresence[]
): WiseCxPresence | null {
  if (!dbName || presenceList.length === 0) return null;

  const normDb = normalizePresenceText(dbName);
  const dbWords = normDb.split(" ").filter(Boolean);

  // 1. Coincidencia exacta de string
  const exact = presenceList.find((p) => normalizePresenceText(p.agentName) === normDb);
  if (exact) return exact;

  // 2. Comprobar aliases manuales
  if (MANUAL_ALIASES[normDb]) {
    const aliases = MANUAL_ALIASES[normDb];
    const matchAlias = presenceList.find((p) => {
      const normW = normalizePresenceText(p.agentName);
      return aliases.some((a) => normW.includes(a) || a.includes(normW));
    });
    if (matchAlias) return matchAlias;
  }

  // 3. Coincidencia por tokens (palabras clave de nombre y apellido)
  for (const p of presenceList) {
    const wNorm = normalizePresenceText(p.agentName);
    const wWords = new Set(wNorm.split(" ").filter(Boolean));
    const matchCount = dbWords.filter((w) => wWords.has(w)).length;
    if (matchCount >= Math.min(2, dbWords.length)) {
      return p;
    }
  }

  return null;
}
