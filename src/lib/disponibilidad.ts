import { db } from "@db/index";
import { agents, schedules, assignmentLock, assignmentHistory } from "@db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { getHelpdeskMembers } from "@/lib/invgate/helpdeskMembersCache";
import { getUnassignedTicketsByHelpdesk, reassignTicketToAgent, setTicketWaitingForDate, addTicketComment } from "@/lib/invgate/agsTickets";

const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos

export interface AgentDisponibilidad {
  agentId: number;
  invgateId?: number;
  nombre: string;
  username?: string;
  location: string;
  disponible: boolean;
  motivo?: string;            // "En break", "Fuera de horario", "Licencia", "Vacaciones", "Franco", etc.
  horarioHoy?: string;        // "08:00 - 17:00"
  breakInicioHoy?: string;    // "12:00"
  breakFinHoy?: string;       // "13:00"
  retornoEstimado?: string;   // "13:00"
  breakInminente?: boolean;   // true si faltan <= 10 min para entrar en break
  breakInminenteMin?: number; // minutos que faltan para el break
  salidaInminente?: boolean;  // true si faltan <= 10 min para terminar su jornada
  salidaInminenteMin?: number; // minutos que faltan para el fin de jornada
  proximoTurnoDisponible?: string; // Formato "YYYY-MM-DDTHH:mm"
  proximoTurnoMotivo?: string;     // "Fin de break (13:00)", "Próximo turno (Vie 21/08 08:00)"
  lastAutogestionAssignedAt: number | null;
  lastAutogestionAssignedBy?: string | null;
  lastAutogestionUndo?: number | null;
  modalidadHoy?: string;      // "Presencial", "Home Office", "Horas Extras", "Franco", etc.
  estadoExcepcional?: string;          // Tipo de excepción activa: "devolucion_supervisor" | "break_extendido" | "problema_tecnico"
  estadoExcepcionalMotivo?: string;    // Comentario del supervisor
  estadoExcepcionalAt?: number;        // Timestamp
  estadoExcepcionalMinutos?: number | null; // Tiempo extra para break extendido en minutos
}

export const EXCEPTION_LABELS: Record<string, string> = {
  devolucion_supervisor: "Devolución Supervisor",
  break_extendido: "Break Extendido",
  problema_tecnico: "Problema Técnico",
};

// Format date as YYYY-MM-DD using local time
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Calcula el próximo turno disponible para un operador (o fin de break si está en break).
 * Excluye operadores en vacaciones.
 */
export function calcularProximoTurnoDisponible(
  agent: {
    name: string;
    horarioDefault?: string | null;
    esquemaSemanal?: string | null;
  },
  dbSchedules: Array<{ date: string; agentName: string; status: string; horario?: string | null }>,
  currentStatus: string,
  currentMotivo: string | undefined,
  currentHorario: string,
  currentBreakFin: string,
  retornoEstimado: string | undefined,
  isCurrentlyOnBreak: boolean,
  isDisponible: boolean,
  now: Date = new Date()
): { proximoTurnoDisponible?: string; proximoTurnoMotivo?: string } {
  // Solo aplica para operadores no disponibles o en break (no para operadores actualmente disponibles)
  if (isDisponible && !isCurrentlyOnBreak) {
    return {};
  }

  // Excluir vacaciones según requerimiento explícito
  if (currentStatus === "Vacaciones" || currentMotivo === "Vacaciones") {
    return {};
  }

  const workingStatuses = ["Presencial Monte Grande", "Presencial Parque Patricios", "Home Office"];
  const dayNames = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  const shortDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const pad = (n: number) => String(n).padStart(2, "0");

  const todayStr = getLocalDateString(now);

  // 1. Si está en break o break extendido hoy
  if (isCurrentlyOnBreak) {
    const returnTime = retornoEstimado && /^\d{1,2}:\d{2}$/.test(retornoEstimado)
      ? retornoEstimado
      : currentBreakFin && /^\d{1,2}:\d{2}$/.test(currentBreakFin)
        ? currentBreakFin
        : null;

    if (returnTime) {
      const [rH, rM] = returnTime.split(":").map(Number);
      const returnDate = new Date(now);
      returnDate.setHours(rH, rM, 0, 0);

      // Si la hora de retorno aún no pasó hoy
      if (returnDate > now) {
        return {
          proximoTurnoDisponible: `${todayStr}T${pad(rH)}:${pad(rM)}`,
          proximoTurnoMotivo: `Fin de break (${pad(rH)}:${pad(rM)})`,
        };
      }
    }
  }

  // 2. Si hoy es un día laborable pero aún no empezó su turno (now < startTime)
  if (workingStatuses.includes(currentStatus) && currentHorario) {
    const [startStr] = currentHorario.split(" - ");
    if (startStr && /^\d{1,2}:\d{2}$/.test(startStr.trim())) {
      const [sH, sM] = startStr.trim().split(":").map(Number);
      const startDate = new Date(now);
      startDate.setHours(sH, sM, 0, 0);

      if (now < startDate) {
        return {
          proximoTurnoDisponible: `${todayStr}T${pad(sH)}:${pad(sM)}`,
          proximoTurnoMotivo: `Inicio de turno hoy (${pad(sH)}:${pad(sM)})`,
        };
      }
    }
  }

  // 3. Buscar el próximo turno hábil en los próximos 14 días (desde mañana)
  let esquemaObj: Record<string, any> | null = null;
  if (agent.esquemaSemanal) {
    try {
      esquemaObj = JSON.parse(agent.esquemaSemanal);
    } catch {}
  }

  for (let d = 1; d <= 14; d++) {
    const targetDate = new Date(now.getTime() + d * 24 * 3600 * 1000);
    const targetDateStr = getLocalDateString(targetDate);
    const targetDayName = dayNames[targetDate.getDay()];
    const targetShortDay = shortDays[targetDate.getDay()];

    // Buscar si hay excepción para ese día
    const override = dbSchedules.find((s) => s.date === targetDateStr && s.agentName === agent.name);

    let dayStatus = "Franco";
    let dayHorario = "";

    if (override) {
      dayStatus = override.status;
      dayHorario = override.horario || "";
    } else if (esquemaObj && esquemaObj[targetDayName]) {
      const diaConfig = esquemaObj[targetDayName];
      if (diaConfig.activo !== false) {
        dayStatus = diaConfig.modalidad || "Home Office";
        dayHorario = diaConfig.horario || "";
      }
    }

    if (workingStatuses.includes(dayStatus)) {
      if (!dayHorario || dayHorario === "-" || dayHorario.trim() === "") {
        dayHorario = agent.horarioDefault || "08:00 - 17:00";
      }

      const [startStr] = dayHorario.split(" - ");
      const [hS, mS] = (startStr || "08:00").trim().split(":").map(Number);
      const validH = isNaN(hS) ? 8 : hS;
      const validM = isNaN(mS) ? 0 : mS;

      const dateLabel = `${targetShortDay} ${pad(targetDate.getDate())}/${pad(targetDate.getMonth() + 1)}`;
      const timeLabel = `${pad(validH)}:${pad(validM)}`;

      return {
        proximoTurnoDisponible: `${targetDateStr}T${timeLabel}`,
        proximoTurnoMotivo: `Próximo turno (${dateLabel} ${timeLabel})`,
      };
    }
  }

  return {};
}

export async function getDisponibilidadHoy(): Promise<AgentDisponibilidad[]> {
  const todayStr = getLocalDateString();
  const now = new Date();
  
  // Spanish day names mapping
  const dayNames = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  const dayName = dayNames[now.getDay()];

  // Obtener miembros de la Mesa 3950 de InvGate
  const helpdeskMembers = await getHelpdeskMembers(3950);
  const helpdeskUsernames = new Set(
    helpdeskMembers
      .map((m) => (m.username ? m.username.split("@")[0].toLowerCase().trim() : ""))
      .filter(Boolean)
  );
  const helpdeskFullNames = new Set(
    helpdeskMembers
      .map((m) => m.fullName.toLowerCase().replace(/\s+/g, " ").trim())
      .filter(Boolean)
  );

  // 1. Fetch all agents
  const dbAgentsAll = await db.select({
    id: agents.id, name: agents.name, username: agents.username, location: agents.location,
    horarioDefault: agents.horarioDefault,
    esquemaSemanal: agents.esquemaSemanal, esquemaHorario: agents.esquemaHorario,
    esquemaBreakInicio: agents.esquemaBreakInicio, esquemaBreakFin: agents.esquemaBreakFin,
    lastAutogestionAssignedAt: agents.lastAutogestionAssignedAt,
    lastAutogestionAssignedBy: agents.lastAutogestionAssignedBy,
    lastAutogestionUndo: agents.lastAutogestionUndo,
    estadoExcepcional: agents.estadoExcepcional,
    estadoExcepcionalMotivo: agents.estadoExcepcionalMotivo,
    estadoExcepcionalAt: agents.estadoExcepcionalAt,
    estadoExcepcionalMinutos: agents.estadoExcepcionalMinutos,
  }).from(agents);

  // Filtrar solo operadores que pertenecen a la Mesa 3950 de InvGate
  const dbAgents = dbAgentsAll.filter((agent) => {
    if (helpdeskMembers.length === 0) return true; // Fallback por seguridad si falla InvGate
    
    // Check 1: Match por username
    if (agent.username) {
      const cleanUser = agent.username.split("@")[0].toLowerCase().trim();
      if (helpdeskUsernames.has(cleanUser)) return true;
    }
    
    // Check 2: Match por nombre completo o cruzado (Apellido / Nombre)
    if (agent.name) {
      const cleanName = agent.name.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
      const tokens = cleanName.split(" ").filter((t) => t.length > 2);

      for (const member of helpdeskMembers) {
        const memberClean = member.fullName.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
        // Exact match normalized
        if (cleanName === memberClean) return true;

        // Si los tokens principales del nombre están incluidos
        if (tokens.length >= 2) {
          const matchesAllTokens = tokens.every((tok) => memberClean.includes(tok));
          if (matchesAllTokens) return true;
        }
      }
    }

    return false;
  });

  const endDate14Str = getLocalDateString(new Date(now.getTime() + 14 * 24 * 3600 * 1000));

  // 2. Fetch today's and upcoming persistent schedule overrides (next 14 days)
  const dbSchedules = await db
    .select()
    .from(schedules)
    .where(and(gte(schedules.date, todayStr), lte(schedules.date, endDate14Str)));

  // 3. Process each agent
  const list: AgentDisponibilidad[] = dbAgents.map((agent) => {
    const workingStatuses = ["Presencial Monte Grande", "Presencial Parque Patricios", "Home Office"];
    // Check if there is an override for this agent today
    const schedule = dbSchedules.find((s) => s.date === todayStr && s.agentName === agent.name);

    let status = "Franco";
    let horario = "";
    let breakInicio = "";
    let breakFin = "";

    if (schedule) {
      status = schedule.status;
      horario = schedule.horario || "";
      breakInicio = schedule.breakInicio || "";
      breakFin = schedule.breakFin || "";
    } else if (agent.esquemaSemanal) {
      try {
        const esquema = JSON.parse(agent.esquemaSemanal);
        if (esquema && esquema[dayName]) {
          const diaConfig = esquema[dayName];
          if (diaConfig.activo === false) {
            status = "Franco";
          } else {
            status = diaConfig.modalidad || "Home Office";
            if (diaConfig.horario) horario = diaConfig.horario;
            if (diaConfig.breakInicio) breakInicio = diaConfig.breakInicio;
            if (diaConfig.breakFin) breakFin = diaConfig.breakFin;
          }
        }
      } catch (e) {
        console.error("Error parsing esquemaSemanal for agent:", agent.name, e);
      }
    }

    // Map database blank or invalid status to Franco
    if (!status || status.trim() === "") {
      status = "Franco";
    }

    // Fallback for horario if working but empty
    if (status !== "Franco" && (!horario || horario.trim() === "" || horario.trim() === "-")) {
      horario = agent.horarioDefault || "";
    }

    // Check if shift ended (auto-cleanup of exceptional state)
    let shiftEnded = false;
    if (!workingStatuses.includes(status)) {
      // Not a working day today
      shiftEnded = true;
    } else {
      const parts = horario.split(" - ");
      if (parts.length === 2) {
        const [_, endStr] = parts;
        const [hE, mE] = endStr.split(":").map(Number);
        if (!isNaN(hE) && !isNaN(mE)) {
          const endTime = new Date(now);
          endTime.setHours(hE, mE, 0, 0);
          if (now > endTime) {
            shiftEnded = true;
          }
        }
      }
    }

    let matchedInvgateId: number | undefined;

    // Check 1: Match por username
    if (agent.username) {
      const cleanUser = agent.username.split("@")[0].toLowerCase().trim();
      const m = helpdeskMembers.find((mem) => {
        if (!mem.username) return false;
        const memClean = mem.username.split("@")[0].toLowerCase().trim();
        return memClean === cleanUser;
      });
      if (m) matchedInvgateId = m.id;
    }

    // Check 2: Match por nombre completo o cruzado (Apellido / Nombre)
    if (!matchedInvgateId && agent.name) {
      const cleanName = agent.name.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
      const tokens = cleanName.split(" ").filter((t) => t.length > 2);

      for (const mem of helpdeskMembers) {
        const memClean = mem.fullName.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
        if (cleanName === memClean) {
          matchedInvgateId = mem.id;
          break;
        }
        if (tokens.length >= 2 && tokens.every((tok) => memClean.includes(tok))) {
          matchedInvgateId = mem.id;
          break;
        }
      }
    }

    const info: AgentDisponibilidad = {
      agentId: agent.id,
      invgateId: matchedInvgateId,
      nombre: agent.name,
      username: agent.username || undefined,
      location: agent.location || "Monte Grande",
      disponible: false,
      horarioHoy: horario || undefined,
      breakInicioHoy: breakInicio || undefined,
      breakFinHoy: breakFin || undefined,
      lastAutogestionAssignedAt: agent.lastAutogestionAssignedAt,
      lastAutogestionAssignedBy: agent.lastAutogestionAssignedBy,
      lastAutogestionUndo: agent.lastAutogestionUndo,
      modalidadHoy: status,
      estadoExcepcional: agent.estadoExcepcional || undefined,
      estadoExcepcionalMotivo: agent.estadoExcepcionalMotivo || undefined,
      estadoExcepcionalAt: agent.estadoExcepcionalAt || undefined,
      estadoExcepcionalMinutos: agent.estadoExcepcionalMinutos,
    };

    const applyOverride = () => {
      if (agent.estadoExcepcional) {
        info.disponible = false;
        info.motivo = EXCEPTION_LABELS[agent.estadoExcepcional] || agent.estadoExcepcional;
      }
    };

    // If status is not a working status, they are unavailable
    if (!workingStatuses.includes(status)) {
      info.disponible = false;
      info.motivo = status; // "Franco", "Vacaciones", "Licencia"
      applyOverride();
    } else {
      // Parse the shift hours
      const parts = horario.split(" - ");
      if (parts.length !== 2) {
        info.disponible = false;
        info.motivo = "Fuera de horario";
        applyOverride();
      } else {
        const [startStr, endStr] = parts;
        const [hS, mS] = startStr.split(":").map(Number);
        const [hE, mE] = endStr.split(":").map(Number);

        if (isNaN(hS) || isNaN(mS) || isNaN(hE) || isNaN(mE)) {
          info.disponible = false;
          info.motivo = "Fuera de horario";
          applyOverride();
        } else {
          const startTime = new Date(now);
          startTime.setHours(hS, mS, 0, 0);

          const endTime = new Date(now);
          endTime.setHours(hE, mE, 0, 0);

          // Check if within shift
          if (now < startTime) {
            info.disponible = false;
            info.motivo = "Fuera de horario";
            info.retornoEstimado = startStr;
            applyOverride();
          } else if (now > endTime) {
            info.disponible = false;
            info.motivo = "Fuera de horario";
            applyOverride();
          } else {
            // Check break times
            let breakStart: Date;
            let breakEnd: Date;

            if (breakInicio && breakFin) {
              const [bhS, bmS] = breakInicio.split(":").map(Number);
              const [bhE, bmE] = breakFin.split(":").map(Number);

              if (!isNaN(bhS) && !isNaN(bmS) && !isNaN(bhE) && !isNaN(bmE)) {
                breakStart = new Date(now);
                breakStart.setHours(bhS, bmS, 0, 0);
                breakEnd = new Date(now);
                breakEnd.setHours(bhE, bmE, 0, 0);
              } else {
                // Fallback calculation if breaks format is invalid
                const shiftDuration = endTime.getTime() - startTime.getTime();
                breakStart = new Date(startTime.getTime() + shiftDuration / 2 - 30 * 60000);
                breakEnd = new Date(breakStart.getTime() + 60 * 60000);
              }
            } else {
              // Estimate 1 hour break in the middle of the shift
              const shiftDuration = endTime.getTime() - startTime.getTime();
              breakStart = new Date(startTime.getTime() + shiftDuration / 2 - 30 * 60000);
              breakEnd = new Date(breakStart.getTime() + 60 * 60000);
            }

            // Auto-cleanup of break_extendido if it expired
            if (agent.estadoExcepcional === "break_extendido") {
              if (agent.estadoExcepcionalMinutos !== null && agent.estadoExcepcionalMinutos !== undefined) {
                const extraMinutes = agent.estadoExcepcionalMinutos;
                const extendedBreakEnd = new Date(breakEnd.getTime() + extraMinutes * 60000);
                if (now >= extendedBreakEnd) {
                  // Clear in DB asynchronously
                  db.update(agents)
                    .set({
                      estadoExcepcional: null,
                      estadoExcepcionalMotivo: null,
                      estadoExcepcionalAt: null,
                      estadoExcepcionalMinutos: null,
                    })
                    .where(eq(agents.id, agent.id))
                    .catch((err) =>
                      console.error(`Error auto-clearing break_extendido state for agent ${agent.id}:`, err)
                    );

                  // Mutate local object and info so we don't apply the override in this render
                  agent.estadoExcepcional = null;
                  agent.estadoExcepcionalMotivo = null;
                  agent.estadoExcepcionalAt = null;
                  agent.estadoExcepcionalMinutos = null;
                  
                  info.estadoExcepcional = undefined;
                  info.estadoExcepcionalMotivo = undefined;
                  info.estadoExcepcionalAt = undefined;
                  info.estadoExcepcionalMinutos = undefined;
                } else {
                  // Format return time
                  const retHours = String(extendedBreakEnd.getHours()).padStart(2, "0");
                  const retMins = String(extendedBreakEnd.getMinutes()).padStart(2, "0");
                  info.retornoEstimado = `${retHours}:${retMins}`;
                }
              } else {
                // Manual / No auto-cleanup
                info.retornoEstimado = "Manual";
              }
            }

            // Check if currently in break
            if (now >= breakStart && now <= breakEnd) {
              info.disponible = false;
              info.motivo = "En break";
              
              // Format return time if not already set
              if (!info.retornoEstimado) {
                const retHours = String(breakEnd.getHours()).padStart(2, "0");
                const retMins = String(breakEnd.getMinutes()).padStart(2, "0");
                info.retornoEstimado = `${retHours}:${retMins}`;
              }
              applyOverride();
            } else {
              // If we passed all checks, agent is available
              info.disponible = true;
              applyOverride();
            }
          }
        }
      }
    }

    // Verificar si el break es inminente (faltan <= 10 min y está disponible)
    if (info.disponible && breakInicio) {
      const [bhS, bmS] = breakInicio.split(":").map(Number);
      if (!isNaN(bhS) && !isNaN(bmS)) {
        const breakStartTime = new Date(now);
        breakStartTime.setHours(bhS, bmS, 0, 0);
        const diffMs = breakStartTime.getTime() - now.getTime();
        const diffMin = Math.ceil(diffMs / 60000);
        if (diffMin > 0 && diffMin <= 10) {
          info.breakInminente = true;
          info.breakInminenteMin = diffMin;
        }
      }
    }

    // Verificar si el fin de jornada / salida es inminente (faltan <= 10 min y está disponible)
    if (info.disponible && horario) {
      const parts = horario.split(" - ");
      if (parts.length === 2) {
        const [_, endStr] = parts;
        const [ehS, emS] = endStr.split(":").map(Number);
        if (!isNaN(ehS) && !isNaN(emS)) {
          const shiftEndTime = new Date(now);
          shiftEndTime.setHours(ehS, emS, 0, 0);
          const diffMs = shiftEndTime.getTime() - now.getTime();
          const diffMin = Math.ceil(diffMs / 60000);
          if (diffMin > 0 && diffMin <= 10) {
            info.salidaInminente = true;
            info.salidaInminenteMin = diffMin;
          }
        }
      }
    }

    // Calcular sugerencia de próximo turno disponible
    const proximoTurno = calcularProximoTurnoDisponible(
      agent,
      dbSchedules,
      status,
      info.motivo,
      horario,
      breakFin,
      info.retornoEstimado,
      info.motivo === "En break" || agent.estadoExcepcional === "break_extendido",
      info.disponible,
      now
    );

    info.proximoTurnoDisponible = proximoTurno.proximoTurnoDisponible;
    info.proximoTurnoMotivo = proximoTurno.proximoTurnoMotivo;

    return info;
  });

  return list;
}

export async function asignarSiguienteAutogestion(
  assignedBy: string = "Sistema",
  authorInvgateId?: number
): Promise<{
  success: boolean;
  agent?: AgentDisponibilidad;
  ticketNumber?: string;
  error?: string;
}> {
  const list = await getDisponibilidadHoy();
  const available = list.filter((a) => a.disponible);

  if (available.length === 0) {
    return {
      success: false,
      error: "No hay operadores disponibles o dentro de horario operativo para asignar.",
    };
  }

  // Sort by lastAutogestionAssignedAt ASC
  // Agents who have never been assigned (null) go first
  available.sort((a, b) => {
    const tA = a.lastAutogestionAssignedAt ?? 0;
    const tB = b.lastAutogestionAssignedAt ?? 0;
    
    if (a.lastAutogestionAssignedAt === null && b.lastAutogestionAssignedAt !== null) return -1;
    if (a.lastAutogestionAssignedAt !== null && b.lastAutogestionAssignedAt === null) return 1;
    
    return tA - tB;
  });

  const winner = available[0];
  const now = Date.now();

  // Consultar ticket sin asignar de InvGate Mesa 3950
  const unassignedRes = await getUnassignedTicketsByHelpdesk(3950);
  if (!unassignedRes.ok || unassignedRes.tickets.length === 0) {
    return {
      success: false,
      error: "No hay autogestiones sin asignar en la mesa de ayuda para entregar.",
    };
  }

  const oldestTicket = unassignedRes.tickets[0];
  if (!winner.invgateId) {
    return {
      success: false,
      error: `El operador ${winner.nombre} no tiene un ID de InvGate vinculado en Mesa 3950.`,
    };
  }
  const targetInvgateId = winner.invgateId;
  const authorId = authorInvgateId || targetInvgateId || 1;
  const reassignRes = await reassignTicketToAgent(oldestTicket.id, targetInvgateId, 3950, authorId);
  if (!reassignRes.ok) {
    return {
      success: false,
      error: `Error al reasignar ticket #${oldestTicket.id} en InvGate a ${winner.nombre}: ${reassignRes.message}`,
    };
  }
  const ticketAssigned = oldestTicket.pretty_id || `#${oldestTicket.id}`;

  // Clear any existing undo states
  await db
    .update(agents)
    .set({ lastAutogestionUndo: null });

  const prevValue = winner.lastAutogestionAssignedAt;

  // Update in DB
  await db
    .update(agents)
    .set({ 
      lastAutogestionAssignedAt: now,
      lastAutogestionAssignedBy: assignedBy,
      lastAutogestionUndo: prevValue
    })
    .where(eq(agents.id, winner.agentId));

  winner.lastAutogestionAssignedAt = now;
  winner.lastAutogestionAssignedBy = assignedBy;
  winner.lastAutogestionUndo = prevValue;

  // Record audit history entry
  try {
    await db.insert(assignmentHistory).values({
      agentId: winner.agentId,
      agentName: winner.nombre,
      ticketNumber: ticketAssigned || null,
      assignedBy,
      assignedAt: now,
      type: "cyclic",
    });
  } catch (historyErr) {
    console.error("Error saving assignment history:", historyErr);
  }

  return {
    success: true,
    agent: winner,
    ticketNumber: ticketAssigned,
  };
}

export async function asignarManual(
  agentId: number,
  assignedBy: string = "Sistema",
  authorInvgateId?: number,
  ticketId?: number
): Promise<{ success: boolean; ticketNumber?: string; error?: string }> {
  const list = await getDisponibilidadHoy();
  const targetAgent = list.find((a) => a.agentId === agentId);

  // Consultar ticket sin asignar de InvGate Mesa 3950
  const unassignedRes = await getUnassignedTicketsByHelpdesk(3950);
  if (!unassignedRes.ok || unassignedRes.tickets.length === 0) {
    return {
      success: false,
      error: "No hay autogestiones sin asignar en la mesa de ayuda para entregar.",
    };
  }

  let targetTicket = ticketId
    ? unassignedRes.tickets.find((t) => t.id === ticketId)
    : unassignedRes.tickets[0];

  if (!targetTicket) {
    if (ticketId) {
      return {
        success: false,
        error: `El ticket #${ticketId} ya no se encuentra sin asignar en la Mesa 3950.`,
      };
    }
    targetTicket = unassignedRes.tickets[0];
  }

  if (!targetAgent?.invgateId) {
    return {
      success: false,
      error: `El operador seleccionado (ID ${agentId}) no tiene un ID de InvGate vinculado en Mesa 3950.`,
    };
  }
  const targetInvgateId = targetAgent.invgateId;
  const authorId = authorInvgateId || targetInvgateId || 1;
  const reassignRes = await reassignTicketToAgent(targetTicket.id, targetInvgateId, 3950, authorId);
  if (!reassignRes.ok) {
    return {
      success: false,
      error: `Error al reasignar ticket #${targetTicket.id} en InvGate: ${reassignRes.message}`,
    };
  }
  const ticketAssigned = targetTicket.pretty_id || `#${targetTicket.id}`;

  // Clear any existing undo states
  await db
    .update(agents)
    .set({ lastAutogestionUndo: null });

  // Get current state to preserve
  const [ag] = await db.select({ lastAutogestionAssignedAt: agents.lastAutogestionAssignedAt }).from(agents).where(eq(agents.id, agentId));
  const prevValue = ag ? ag.lastAutogestionAssignedAt : null;

  // Update lastAutogestionAssignedAt for the manually assigned agent
  const assignTime = Date.now();
  await db
    .update(agents)
    .set({ 
      lastAutogestionAssignedAt: assignTime,
      lastAutogestionAssignedBy: assignedBy,
      lastAutogestionUndo: prevValue
    })
    .where(eq(agents.id, agentId));

  // Record audit history entry
  try {
    const targetName = targetAgent?.nombre || ag?.name || `ID ${agentId}`;
    await db.insert(assignmentHistory).values({
      agentId,
      agentName: targetName,
      ticketNumber: ticketAssigned || null,
      assignedBy,
      assignedAt: assignTime,
      type: "manual",
    });
  } catch (historyErr) {
    console.error("Error saving assignment history:", historyErr);
  }

  return { success: true, ticketNumber: ticketAssigned };
}

/**
 * Asigna un ticket manualmente a un agente y lo pone en estado 'Esperando fecha' en InvGate.
 */
export async function asignarYPosponer(
  agentId: number,
  assignedBy: string,
  authorInvgateId?: number,
  ticketId?: number,
  postponeDate?: string,
  reason: string = "Pospuesto por supervisión"
): Promise<{ success: boolean; error?: string; ticketNumber?: string; postponeDate?: string }> {
  if (!ticketId) {
    return { success: false, error: "Se requiere especificar un ticket para posponer." };
  }
  if (!postponeDate) {
    return { success: false, error: "Se requiere especificar una fecha futura para posponer." };
  }

  const allOps = await getDisponibilidadHoy();
  const targetAgent = allOps.find((op) => op.agentId === agentId);
  if (!targetAgent?.invgateId) {
    return {
      success: false,
      error: `El operador seleccionado (ID ${agentId}) no tiene un ID de InvGate vinculado en Mesa 3950.`,
    };
  }

  const targetInvgateId = targetAgent.invgateId;
  const authorId = authorInvgateId || targetInvgateId || 1;

  // 1. Reasignar ticket al operador
  const reassignRes = await reassignTicketToAgent(ticketId, targetInvgateId, 3950, authorId);
  if (!reassignRes.ok) {
    return {
      success: false,
      error: `Error al reasignar ticket #${ticketId} en InvGate: ${reassignRes.message}`,
    };
  }

  // 2. Cambiar estado a 'esperando fecha' con la fecha especificada
  const waitDateRes = await setTicketWaitingForDate(ticketId, postponeDate, authorId, reason || "Pospuesto por supervisión");
  if (!waitDateRes.ok) {
    return {
      success: false,
      error: `Ticket #${ticketId} reasignado al operador, pero falló al posponer (Esperando fecha) en InvGate: ${waitDateRes.message}`,
    };
  }

  // 2b. Si se especificó un motivo/comentario, publicarlo como nota interna (visible para el operador)
  const trimmedComment = reason?.trim();
  if (trimmedComment && trimmedComment !== "Pospuesto por supervisión") {
    try {
      await addTicketComment(ticketId, trimmedComment, authorId, 0);
    } catch (commentErr) {
      console.error(`Error agregando nota interna a ticket #${ticketId}:`, commentErr);
    }
  }

  const ticketAssigned = `#${ticketId}`;

  // 3. Limpiar undo y actualizar estado del agente
  await db.update(agents).set({ lastAutogestionUndo: null });

  const [ag] = await db.select({ lastAutogestionAssignedAt: agents.lastAutogestionAssignedAt }).from(agents).where(eq(agents.id, agentId));
  const prevValue = ag ? ag.lastAutogestionAssignedAt : null;
  const assignTime = Date.now();

  await db
    .update(agents)
    .set({
      lastAutogestionAssignedAt: assignTime,
      lastAutogestionAssignedBy: assignedBy,
      lastAutogestionUndo: prevValue,
    })
    .where(eq(agents.id, agentId));

  // 4. Registrar en historial de asignaciones
  try {
    const targetName = targetAgent?.nombre || ag?.name || `ID ${agentId}`;
    await db.insert(assignmentHistory).values({
      agentId,
      agentName: targetName,
      ticketNumber: ticketAssigned,
      assignedBy,
      assignedAt: assignTime,
      type: "manual",
    });
  } catch (historyErr) {
    console.error("Error guardando historial de asignación pospuesta:", historyErr);
  }

  return { success: true, ticketNumber: ticketAssigned, postponeDate };
}

export interface BatchAssignmentItem {
  ticketId: number;
  ticketPrettyId?: string;
  agentId: number;
  agentName: string;
  creatorName?: string;
}

export interface BatchAssignmentResult {
  success: boolean;
  assignedCount: number;
  totalAttempted: number;
  items: Array<BatchAssignmentItem & { success: boolean; error?: string }>;
  error?: string;
}

export async function asignarSugeridasAutogestion(
  assignedBy: string = "Sistema",
  authorInvgateId?: number
): Promise<BatchAssignmentResult> {
  const list = await getDisponibilidadHoy();
  const unassignedRes = await getUnassignedTicketsByHelpdesk(3950);

  if (!unassignedRes.ok || unassignedRes.tickets.length === 0) {
    return {
      success: false,
      assignedCount: 0,
      totalAttempted: 0,
      items: [],
      error: "No hay autogestiones sin asignar en la mesa de ayuda.",
    };
  }

  // Find matches where creator is available and has an invgateId
  const pairs: Array<{ ticket: (typeof unassignedRes.tickets)[0]; op: AgentDisponibilidad }> = [];

  for (const ticket of unassignedRes.tickets) {
    const creatorUsername = (ticket.creator_username || "").toLowerCase().trim();
    const creatorNameNorm = (ticket.creator_name || "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

    const matchingOp = list.find((op) => {
      if (!op.disponible || !op.invgateId) return false;
      if (op.username && creatorUsername && op.username.split("@")[0].toLowerCase().trim() === creatorUsername) return true;
      if (op.nombre && creatorNameNorm) {
        const opNameNorm = op.nombre.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
        if (opNameNorm === creatorNameNorm) return true;
        const tokens = creatorNameNorm.split(" ").filter((k: string) => k.length > 2);
        if (tokens.length >= 2 && tokens.every((k: string) => opNameNorm.includes(k))) return true;
      }
      return false;
    });

    if (matchingOp) {
      pairs.push({ ticket, op: matchingOp });
    }
  }

  if (pairs.length === 0) {
    return {
      success: false,
      assignedCount: 0,
      totalAttempted: 0,
      items: [],
      error: "No hay autogestiones con creadores disponibles actualmente.",
    };
  }

  const results: Array<BatchAssignmentItem & { success: boolean; error?: string }> = [];
  let assignedCount = 0;
  const now = Date.now();

  for (let i = 0; i < pairs.length; i++) {
    const { ticket, op } = pairs[i];
    const authorId = authorInvgateId || op.invgateId || 1;
    const reassignRes = await reassignTicketToAgent(ticket.id, op.invgateId!, 3950, authorId);
    const ticketAssigned = ticket.pretty_id || `#${ticket.id}`;

    if (reassignRes.ok) {
      assignedCount++;
      const assignTime = now + i;
      await db
        .update(agents)
        .set({
          lastAutogestionAssignedAt: assignTime,
          lastAutogestionAssignedBy: assignedBy,
          lastAutogestionUndo: null,
        })
        .where(eq(agents.id, op.agentId));

      try {
        await db.insert(assignmentHistory).values({
          agentId: op.agentId,
          agentName: op.nombre,
          ticketNumber: ticketAssigned,
          assignedBy,
          assignedAt: assignTime,
          type: "batch_suggested",
        });
      } catch (hErr) {
        console.error("Error saving batch suggested history:", hErr);
      }

      results.push({
        ticketId: ticket.id,
        ticketPrettyId: ticketAssigned,
        agentId: op.agentId,
        agentName: op.nombre,
        creatorName: ticket.creator_name,
        success: true,
      });
    } else {
      results.push({
        ticketId: ticket.id,
        ticketPrettyId: ticketAssigned,
        agentId: op.agentId,
        agentName: op.nombre,
        creatorName: ticket.creator_name,
        success: false,
        error: reassignRes.message,
      });
    }
  }

  return {
    success: assignedCount > 0,
    assignedCount,
    totalAttempted: pairs.length,
    items: results,
    error: assignedCount === 0 ? "No se pudo asignar ninguna autogestión sugerida." : undefined,
  };
}

export async function asignarTodasEnCola(
  assignedBy: string = "Sistema",
  authorInvgateId?: number
): Promise<BatchAssignmentResult> {
  const list = await getDisponibilidadHoy();
  const available = list.filter((a) => a.disponible && a.invgateId);

  if (available.length === 0) {
    return {
      success: false,
      assignedCount: 0,
      totalAttempted: 0,
      items: [],
      error: "No hay operadores disponibles con ID de InvGate para asignar.",
    };
  }

  // Sort available by queue order (lastAutogestionAssignedAt ASC)
  available.sort((a, b) => {
    const tA = a.lastAutogestionAssignedAt ?? 0;
    const tB = b.lastAutogestionAssignedAt ?? 0;
    if (a.lastAutogestionAssignedAt === null && b.lastAutogestionAssignedAt !== null) return -1;
    if (a.lastAutogestionAssignedAt !== null && b.lastAutogestionAssignedAt === null) return 1;
    return tA - tB;
  });

  const unassignedRes = await getUnassignedTicketsByHelpdesk(3950);
  if (!unassignedRes.ok || unassignedRes.tickets.length === 0) {
    return {
      success: false,
      assignedCount: 0,
      totalAttempted: 0,
      items: [],
      error: "No hay autogestiones sin asignar en la mesa de ayuda.",
    };
  }

  // Pair up tickets with operators sequentially
  const assignCountToAttempt = Math.min(unassignedRes.tickets.length, available.length);
  const results: Array<BatchAssignmentItem & { success: boolean; error?: string }> = [];
  let assignedCount = 0;
  const now = Date.now();

  for (let i = 0; i < assignCountToAttempt; i++) {
    const ticket = unassignedRes.tickets[i];
    const op = available[i];
    const authorId = authorInvgateId || op.invgateId || 1;
    const reassignRes = await reassignTicketToAgent(ticket.id, op.invgateId!, 3950, authorId);
    const ticketAssigned = ticket.pretty_id || `#${ticket.id}`;

    if (reassignRes.ok) {
      assignedCount++;
      const assignTime = now + i;
      await db
        .update(agents)
        .set({
          lastAutogestionAssignedAt: assignTime,
          lastAutogestionAssignedBy: assignedBy,
          lastAutogestionUndo: null,
        })
        .where(eq(agents.id, op.agentId));

      try {
        await db.insert(assignmentHistory).values({
          agentId: op.agentId,
          agentName: op.nombre,
          ticketNumber: ticketAssigned,
          assignedBy,
          assignedAt: assignTime,
          type: "batch_all",
        });
      } catch (hErr) {
        console.error("Error saving batch all history:", hErr);
      }

      results.push({
        ticketId: ticket.id,
        ticketPrettyId: ticketAssigned,
        agentId: op.agentId,
        agentName: op.nombre,
        creatorName: ticket.creator_name,
        success: true,
      });
    } else {
      results.push({
        ticketId: ticket.id,
        ticketPrettyId: ticketAssigned,
        agentId: op.agentId,
        agentName: op.nombre,
        creatorName: ticket.creator_name,
        success: false,
        error: reassignRes.message,
      });
    }
  }

  return {
    success: assignedCount > 0,
    assignedCount,
    totalAttempted: assignCountToAttempt,
    items: results,
    error: assignedCount === 0 ? "No se pudo asignar ninguna autogestión en cola." : undefined,
  };
}

export async function marcarEstadoExcepcional(
  agentId: number,
  tipo: string,
  motivo?: string,
  tiempoExtra?: number | null
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(agents)
      .set({
        estadoExcepcional: tipo,
        estadoExcepcionalMotivo: motivo || null,
        estadoExcepcionalAt: Date.now(),
        estadoExcepcionalMinutos: tiempoExtra || null,
      })
      .where(eq(agents.id, agentId));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al marcar estado excepcional" };
  }
}

export async function limpiarEstadoExcepcional(
  agentId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(agents)
      .set({
        estadoExcepcional: null,
        estadoExcepcionalMotivo: null,
        estadoExcepcionalAt: null,
        estadoExcepcionalMinutos: null,
      })
      .where(eq(agents.id, agentId));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al limpiar estado excepcional" };
  }
}

export async function deshacerAsignacion(): Promise<{ success: boolean; agentName?: string; error?: string }> {
  const all = await db.select({ id: agents.id, name: agents.name, lastAutogestionUndo: agents.lastAutogestionUndo }).from(agents);
  const target = all.find(a => a.lastAutogestionUndo !== null);
  if (!target) {
    return { success: false, error: "No hay ninguna asignación para deshacer." };
  }

  const restoredTime = target.lastAutogestionUndo;
  await db
    .update(agents)
    .set({
      lastAutogestionAssignedAt: restoredTime,
      lastAutogestionUndo: null
    })
    .where(eq(agents.id, target.id));

  try {
    await db.insert(assignmentHistory).values({
      agentId: target.id,
      agentName: target.name,
      ticketNumber: null,
      assignedBy: "Sistema (Deshacer)",
      assignedAt: Date.now(),
      type: "undo",
    });
  } catch (historyErr) {
    console.error("Error saving undo history:", historyErr);
  }

  return { success: true, agentName: target.name };
}

export function isLockExpired(lastActivityAt: number, releaseRequested: boolean = false): boolean {
  const timeout = releaseRequested ? 1 * 60 * 1000 : LOCK_TIMEOUT_MS;
  return Date.now() > lastActivityAt + timeout;
}

export async function getAssignmentHistory(limit: number = 50) {
  try {
    return await db
      .select()
      .from(assignmentHistory)
      .orderBy(desc(assignmentHistory.assignedAt))
      .limit(limit);
  } catch (err) {
    console.error("Error fetching assignment history:", err);
    return [];
  }
}

export async function getLockStatus(): Promise<
  { status: "free" } |
  { status: "occupied"; user: { userId: number; username: string; acquiredAt: number; lastActivityAt: number; releaseRequested: boolean } } |
  { status: "expired"; user: { userId: number; username: string; lastActivityAt: number } }
> {
  const [current] = await db.select().from(assignmentLock).where(eq(assignmentLock.id, 1));
  if (!current) return { status: "free" };
  const isExpired = isLockExpired(current.lastActivityAt, current.releaseRequested === 1);
  if (isExpired) {
    return { status: "expired", user: { userId: current.userId, username: current.username, lastActivityAt: current.lastActivityAt } };
  }
  return {
    status: "occupied",
    user: {
      userId: current.userId,
      username: current.username,
      acquiredAt: current.acquiredAt,
      lastActivityAt: current.lastActivityAt,
      releaseRequested: current.releaseRequested === 1,
    },
  };
}

export async function acquireLock(userId: number, username: string): Promise<{ success: true } | { success: false; reason: "occupied"; holder: string } | { success: false; reason: "race_condition" }> {
  return db.transaction((tx) => {
    const currentList = tx.select().from(assignmentLock).where(eq(assignmentLock.id, 1)).all();
    const current = currentList[0];
    const now = Date.now();
    if (current) {
      const isExpired = isLockExpired(current.lastActivityAt, current.releaseRequested === 1);
      if (isExpired) {
        tx.update(assignmentLock).set({
          userId, username, acquiredAt: now, lastActivityAt: now, releaseRequested: 0
        }).where(eq(assignmentLock.id, 1)).run();
        return { success: true };
      } else if (current.userId !== userId) {
        return { success: false, reason: "occupied" as const, holder: current.username };
      } else {
        tx.update(assignmentLock).set({
          lastActivityAt: now, releaseRequested: 0
        }).where(eq(assignmentLock.id, 1)).run();
        return { success: true };
      }
    }
    try {
      tx.insert(assignmentLock).values({
        id: 1, userId, username, acquiredAt: now, lastActivityAt: now, releaseRequested: 0,
      }).run();
      return { success: true };
    } catch {
      return { success: false, reason: "race_condition" as const };
    }
  });
}

export async function releaseLock(userId: number, isAdmin: boolean = false): Promise<boolean> {
  if (isAdmin) {
    await db.delete(assignmentLock).where(eq(assignmentLock.id, 1));
    return true;
  }
  const [current] = await db.select({ userId: assignmentLock.userId }).from(assignmentLock).where(eq(assignmentLock.id, 1));
  if (!current) return true;
  if (current.userId !== userId) return false;
  await db.delete(assignmentLock).where(eq(assignmentLock.id, 1));
  return true;
}

export async function heartbeatLock(userId: number): Promise<void> {
  await db.update(assignmentLock)
    .set({ lastActivityAt: Date.now() })
    .where(and(eq(assignmentLock.id, 1), eq(assignmentLock.userId, userId)));
}

export async function requestRelease(): Promise<void> {
  const currentList = await db.select().from(assignmentLock).where(eq(assignmentLock.id, 1));
  const current = currentList[0];
  if (!current) return;
  const now = Date.now();
  const remaining = (current.lastActivityAt + LOCK_TIMEOUT_MS) - now;
  if (remaining > 60000) {
    await db.update(assignmentLock)
      .set({ releaseRequested: 1, lastActivityAt: now })
      .where(eq(assignmentLock.id, 1));
  } else {
    await db.update(assignmentLock)
      .set({ releaseRequested: 1 })
      .where(eq(assignmentLock.id, 1));
  }
}

export async function rejectRelease(userId: number): Promise<boolean> {
  const [current] = await db.select().from(assignmentLock).where(eq(assignmentLock.id, 1));
  if (!current || current.userId !== userId) return false;
  await db.update(assignmentLock)
    .set({ releaseRequested: 0, lastActivityAt: Date.now() })
    .where(eq(assignmentLock.id, 1));
  return true;
}

export async function resetAssignmentLock(): Promise<void> {
  await db.update(assignmentLock)
    .set({ lastActivityAt: Date.now(), releaseRequested: 0 })
    .where(eq(assignmentLock.id, 1));
}

import { jsonError } from "@lib/apiResponse";

export async function ensureHasLock(locals: App.Locals): Promise<{ ok: true } | { ok: false; response: Response }> {
  const status = await getLockStatus();
  if (status.status === "free" || status.status === "expired") {
    return {
      ok: false,
      response: jsonError("No tenés el control de asignación. Tomá el control primero.", 423),
    };
  }
  if (status.user.userId !== locals.user?.id) {
    return {
      ok: false,
      response: jsonError(`El control está en manos de ${status.user.username}`, 423),
    };
  }
  await heartbeatLock(locals.user.id);
  return { ok: true };
}
