export const CHANNEL_LABEL_MAP: Record<string, string> = {
  wise_call: "Llamada Wise",
  wise_email: "Mail Wise",
  invgate_ticket: "Autogestión",
};

export function getTicketModeLabel(audit: {
  isReclamoNovedad?: boolean;
  channelType?: string;
  appliesMda?: boolean | null;
  staysInMda?: boolean | null;
}): string {
  if (audit.isReclamoNovedad) {
    return "Reclamo / Novedad (100%)";
  }
  if (audit.channelType === "wise_call" && audit.appliesMda === false) {
    return "Sin Ticket";
  }
  if (audit.channelType === "wise_email" && audit.appliesMda === false) {
    return "Sin Ticket MDA";
  }
  if (audit.channelType === "invgate_ticket" && audit.staysInMda === false) {
    return "Derivado fuera de MDA";
  }
  return "Ticket Nuevo";
}

export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const valStr = typeof val === "string" ? val : String(val);
  if (
    valStr.includes(";") ||
    valStr.includes("\n") ||
    valStr.includes("\r") ||
    valStr.includes('"')
  ) {
    return `"${valStr.replace(/"/g, '""')}"`;
  }
  return valStr;
}

export function getAuditExportHeaders(
  params: { code: string; name: string }[],
): string[] {
  const headers = [
    "Periodo",
    "Canal",
    "Operador",
    "Usuario",
    "Fecha",
    "ID Llamada / Caso",
    "ID Ticket / AG",
    "Duración",
    "Tiempo Ringueo",
    "Creación",
    "Toma / Lectura",
    "Es PAS",
    "Modo Ticket",
    "Puntaje Secc. 1 (%)",
    "Puntaje Secc. 2 (%)",
    "Puntaje Total (%)",
  ];

  params.forEach((p) => {
    headers.push(`[${p.code}] ${p.name}`);
  });

  headers.push("Observaciones");
  return headers;
}
