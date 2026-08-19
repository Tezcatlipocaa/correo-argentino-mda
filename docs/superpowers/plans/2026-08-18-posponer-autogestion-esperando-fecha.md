# Posponer Autogestión (Asignar y Poner en Estado "Esperando Fecha") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el flujo completo de posponer una autogestión: permitir que el supervisor seleccione un operador, elija una fecha futura a través de un modal UI, asigne el ticket al operador en InvGate vía API y transicione su estado a "Esperando fecha" (`incident.waitingfor.date`).

**Architecture:** 
1. **InvGate Client Extension:** Función `setTicketWaitingForDate(ticketId, date, authorId, reason)` que realiza `POST /incident.waitingfor.date` con `{ request_id, date, author_id, reason }`.
2. **Backend Service & API Route:** Función `asignarYPosponer(...)` en `src/lib/disponibilidad.ts` y nuevo endpoint `POST /api/disponibilidad/asignar-posponer` que valida lock y RBAC, reasigna en InvGate (`incident.reassign`), transiciona estado a "Esperando fecha" (`incident.waitingfor.date`), registra historial en SQLite (`assignmentHistory`) y actualiza disponibilidad.
3. **Frontend UI Modal & Interaction:** Modal dialog `#modal-posponer-ticket` con selector de fecha/hora, resumen del ticket y operador, integrado en el evento click de `data-op-postpone-btn` dentro de `#modal-asignar-operador`.

**Tech Stack:** Astro SSR, TypeScript, SQLite / Drizzle ORM, DaisyUI v5 / Tailwind CSS v4, InvGate Service Management REST API v1.

---

## File Structure

- **Modify:** `src/lib/invgate/agsTickets.ts` — Agregar `setTicketWaitingForDate(requestId, date, authorId, reason)`.
- **Modify:** `src/lib/disponibilidad.ts` — Agregar función `asignarYPosponer(agentId, assignedBy, authorInvgateId, ticketId, postponeDate, reason)`.
- **Create:** `src/pages/api/disponibilidad/asignar-posponer.ts` — Endpoint REST `POST` para ejecutar la asignación con postergación.
- **Modify:** `src/components/supervision/asignacion/AsignacionContent.astro` — Agregar modal de selección de fecha/hora `#modal-posponer-ticket` y cablear el botón "Posponer" de los operadores.

---

### Task 1: InvGate API Client Helper para "Esperando Fecha"

**Files:**
- Modify: `src/lib/invgate/agsTickets.ts:140-168`
- Test: `tests/invgate-waiting-date.test.ts` (o verificación directa de tipos y mock)

- [ ] **Step 1: Escribir la función `setTicketWaitingForDate` en `agsTickets.ts`**

```typescript
/**
 * Pone un ticket de InvGate en estado "Esperando Fecha".
 * Endpoint: POST /incident.waitingfor.date
 */
export async function setTicketWaitingForDate(
  requestId: number,
  date: string,
  authorId: number = 1,
  reason: string = "Pospuesto por supervisión"
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await invgatePost<{ status: string; info?: string }>("incident.waitingfor.date", {
      request_id: requestId,
      date,
      author_id: authorId,
      reason,
    });

    if (!res.ok) {
      return { ok: false, message: res.message };
    }

    if (res.data?.status === "ERROR") {
      return { ok: false, message: res.data.info || "Error al cambiar estado a esperando fecha en InvGate" };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message || "Error al conectar con InvGate" };
  }
}
```

- [ ] **Step 2: Exportar y verificar tipos en `src/lib/invgate/agsTickets.ts`**

---

### Task 2: Lógica de Asignación y Postergación en Servicio de Disponibilidad

**Files:**
- Modify: `src/lib/disponibilidad.ts:510-575`

- [ ] **Step 1: Implementar `asignarYPosponer` en `src/lib/disponibilidad.ts`**

```typescript
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
  const waitDateRes = await setTicketWaitingForDate(ticketId, postponeDate, authorId, reason);
  if (!waitDateRes.ok) {
    console.warn(`Ticket #${ticketId} asignado a agente ${targetInvgateId} pero falló al poner en esperando fecha: ${waitDateRes.message}`);
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
```

---

### Task 3: API Endpoint `POST /api/disponibilidad/asignar-posponer`

**Files:**
- Create: `src/pages/api/disponibilidad/asignar-posponer.ts`

- [ ] **Step 1: Crear endpoint con validación RBAC, Lock y parámetros**

```typescript
import type { APIRoute } from "astro";
import { asignarYPosponer, getDisponibilidadHoy, ensureHasLock, resetAssignmentLock } from "@lib/disponibilidad";
import { db } from "@db/index";
import { agents } from "@db/schema";
import { eq } from "drizzle-orm";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { jsonResponse, sanitizeError } from "@lib/apiResponse";

export const POST: APIRoute = async ({ request, locals }) => {
  const denied = requireWriteAccess(locals, "asignacion_ag");
  if (denied) return denied;

  const lockCheck = await ensureHasLock(locals);
  if (!lockCheck.ok) return lockCheck.response;

  try {
    const { agentId, ticketId, postponeDate, reason } = await request.json();

    if (!agentId || typeof agentId !== "number") {
      return jsonResponse({ success: false, error: "ID de agente inválido" }, 400);
    }
    if (!ticketId || typeof ticketId !== "number") {
      return jsonResponse({ success: false, error: "ID de ticket inválido" }, 400);
    }
    if (!postponeDate || typeof postponeDate !== "string") {
      return jsonResponse({ success: false, error: "Fecha de postergación inválida" }, 400);
    }

    const assignedBy = locals.user?.username || "Sistema";
    const userClean = locals.user?.username ? locals.user.username.split("@")[0].toLowerCase().trim() : "";
    const list = await getDisponibilidadHoy();
    const loggedOp = list.find((op) => op.username && op.username.split("@")[0].toLowerCase().trim() === userClean);
    const authorInvgateId = loggedOp?.invgateId;

    const result = await asignarYPosponer(
      agentId,
      assignedBy,
      authorInvgateId,
      ticketId,
      postponeDate,
      reason || "Pospuesto por supervisión"
    );

    if (result.success) {
      await resetAssignmentLock();
    }

    let agentName = `ID ${agentId}`;
    try {
      const [ag] = await db
        .select({ name: agents.name })
        .from(agents)
        .where(eq(agents.id, agentId));
      if (ag) {
        agentName = ag.name;
      }
    } catch (dbErr) {
      console.error("Error retrieving agent name:", dbErr);
    }

    return jsonResponse({ ...result, agentName }, result.success ? 200 : 400);
  } catch (error: any) {
    console.error("POST /api/disponibilidad/asignar-posponer Error:", error);
    return jsonResponse({ success: false, error: sanitizeError(error) }, 500);
  }
};
```

---

### Task 4: UI Modal `#modal-posponer-ticket` e Interacción Frontend

**Files:**
- Modify: `src/components/supervision/asignacion/AsignacionContent.astro`

- [ ] **Step 1: Agregar markup del modal `#modal-posponer-ticket` en `AsignacionContent.astro`**

```astro
  <!-- Modal Posponer y Asignar Ticket -->
  <dialog id="modal-posponer-ticket" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box w-11/12 max-w-lg bg-base-100 p-0 border border-base-300 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
      <div class="p-5 border-b border-base-300 bg-base-200/50 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="p-2.5 rounded-xl bg-warning/15 text-warning shrink-0">
            <Icon name="boxicons:calendar" size={22} />
          </div>
          <div class="min-w-0">
            <h3 class="font-extrabold text-base text-base-content uppercase tracking-wider">Posponer Autogestión</h3>
            <p class="text-xs text-base-content/60 font-medium">Asigna al operador y pasa a estado Esperando Fecha</p>
          </div>
        </div>
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:text-base-content">✕</button>
        </form>
      </div>

      <div class="p-5 space-y-4">
        <!-- Resumen del Ticket y Operador -->
        <div class="p-3.5 rounded-xl bg-base-200/50 border border-base-300 space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-base-content/60 font-medium">Ticket:</span>
            <span id="posponer-ticket-badge" class="font-mono font-bold text-primary">#---</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-base-content/60 font-medium">Operador:</span>
            <span id="posponer-operator-name" class="font-bold text-base-content">---</span>
          </div>
        </div>

        <!-- Input de Fecha y Hora -->
        <div class="form-control space-y-1">
          <label class="label-text font-bold text-xs uppercase tracking-wider text-base-content/80">
            Fecha y Hora de Reanudación
          </label>
          <input
            id="posponer-input-datetime"
            type="datetime-local"
            class="input input-bordered input-sm w-full font-mono text-xs focus:outline-none focus:border-warning"
            required
          />
          <p class="text-tiny text-base-content/50">El ticket quedará pausado en InvGate hasta la fecha seleccionada.</p>
        </div>

        <!-- Input de Motivo/Comentario -->
        <div class="form-control space-y-1">
          <label class="label-text font-bold text-xs uppercase tracking-wider text-base-content/80">
            Motivo / Comentario (opcional)
          </label>
          <input
            id="posponer-input-motivo"
            type="text"
            placeholder="Ej. Coordinado con el cliente para el día..."
            class="input input-bordered input-sm w-full text-xs focus:outline-none focus:border-warning"
          />
        </div>
      </div>

      <div class="p-4 bg-base-200/50 border-t border-base-300 flex items-center justify-end gap-3">
        <form method="dialog">
          <button class="btn btn-ghost btn-sm font-semibold">Cancelar</button>
        </form>
        <button
          id="btn-confirm-posponer"
          type="button"
          class="btn btn-warning btn-sm font-bold uppercase tracking-wider px-5 shadow-sm gap-2"
        >
          <Icon name="boxicons:calendar-check" size={18} />
          <span>Confirmar y Posponer</span>
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>cerrar</button>
    </form>
  </dialog>
```

- [ ] **Step 2: Conectar event listeners en el script de `AsignacionContent.astro`**

1. Capturar click en `[data-op-postpone-btn]`:
   - Extraer `agentId` y `ticketId`.
   - Cargar datos en `#modal-posponer-ticket` (ticket badge, nombre del operador).
   - Establecer `min` y valor por defecto del input datetime (por ejemplo, mañana a las 09:00).
   - Mostrar modal: `modalPosponer.showModal()`.
2. Capturar click en `#btn-confirm-posponer`:
   - Validar que haya fecha seleccionada.
   - Enviar `POST /api/disponibilidad/asignar-posponer` con `{ agentId, ticketId, postponeDate, reason }`.
   - Manejar estados de carga (`disabled`, spinner), lock expirado (423), error y éxito.
   - Cerrar ambos modales (`#modal-posponer-ticket` y `#modal-asignar-operador`), mostrar toast de éxito y llamar a `fetchDisponibilidad()`.

---

## Verification Plan

### Automated / Build Verification
- Ejecutar verificación de sintaxis y build con Astro:
  ```bash
  npm run build
  ```

### Manual Verification
1. Abrir la sección de Asignación en `http://localhost:4321/supervision/asignacion`.
2. Tomar el control con el lock status si está libre.
3. En la lista de tickets sin asignar, hacer click en **"Asignar a..."** para abrir `#modal-asignar-operador`.
4. Verificar que cada operador muestre los botones **"Posponer"** y **"Asignar"**.
5. Hacer click en **"Posponer"** en un operador disponible:
   - Debe abrir el modal `#modal-posponer-ticket` con el ticket y el operador seleccionados.
6. Elegir una fecha/hora y hacer click en **"Confirmar y Posponer"**:
   - Verificar llamada a `/api/disponibilidad/asignar-posponer`.
   - Verificar toast de éxito y actualización de la lista de operadores y cola.
   - Verificar en historial de asignaciones el registro de la asignación.
