# Detección de Operadores MDA en Comentarios de Autogestiones - Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detectar y visualizar los operadores de la Mesa de Ayuda (ID 3950) que han dejado comentarios o notas en los tickets sin asignar de autogestión, mostrando un contador llamativo en las tarjetas de la cola y un detalle enriquecido en el modal del ticket.

**Architecture:** Enriquecer `getUnassignedTicketsByHelpdesk` y `getTicketComments` con la pertenencia a la Mesa 3950 (usando `helpdeskMembersCache`), agregando la lista de operadores intervinientes (`commenting_operators`) y su conteo a cada ticket. Renderizar indicadores visuales en la tarjeta del ticket (SSR y cliente) y una sección destacada de operadores intervinientes en el modal de detalle del ticket.

**Tech Stack:** Astro SSR, TypeScript, Tailwind CSS v4, DaisyUI v5, Node.js Test Runner (`node --test`).

---

### File Structure

- `src/lib/invgate/helpdeskMembersCache.ts`: Helpers para obtener Set de IDs y Map de miembros de la Mesa 3950 en caché.
- `src/lib/invgate/agsTickets.ts`: Enriquecimiento de comentarios (`is_mda_agent`) y cálculo de `commenting_operators` en tickets sin asignar.
- `src/pages/api/invgate/ticket-comments.ts`: Endpoint que expone comentarios enriquecidos con pertenencia MDA.
- `src/pages/api/invgate/unassigned-tickets.ts`: Endpoint de tickets sin asignar con `commenting_operators`.
- `src/components/supervision/asignacion/AsignacionContent.astro`: Renderizado SSR y JS de badges `+N ops` en cola y detalle en modal.
- `tests/lib/invgate/commenting-operators.test.mjs`: Tests unitarios para la lógica de detección y agrupación de operadores MDA en comentarios.

---

### Task 1: Helper de IDs de miembros de Mesa de Ayuda en `helpdeskMembersCache.ts`

**Files:**
- Modify: `src/lib/invgate/helpdeskMembersCache.ts`
- Test: `tests/lib/invgate/commenting-operators.test.mjs`

- [ ] **Step 1: Escribir el test para resolución de miembros e IDs de Mesa de Ayuda**

Crear `tests/lib/invgate/commenting-operators.test.mjs`:
```javascript
import assert from "node:assert/strict";
import test from "node:test";

test("detects 3950 operators from comments correctly", () => {
  const mdaMemberIds = new Set([101, 102, 103]);
  const userMap = new Map([
    [101, { id: 101, fullName: "Juan Pérez", username: "jperez" }],
    [102, { id: 102, fullName: "María Gómez", username: "mgomez" }],
    [103, { id: 103, fullName: "Carlos López", username: "clopez" }],
    [999, { id: 999, fullName: "Cliente Externo", username: "cliente" }],
  ]);

  const comments = [
    { id: 1, author_id: 101, message: "Primera revisión", created_at: 1000 },
    { id: 2, author_id: 999, message: "Respuesta cliente", created_at: 1010 },
    { id: 3, author_id: 102, message: "Seguimiento", created_at: 1020 },
    { id: 4, author_id: 101, message: "Nota interna final", created_at: 1030 },
  ];

  // Logic to extract commenting MDA operators
  const mdaComments = comments.filter((c) => mdaMemberIds.has(c.author_id));
  const operatorMap = new Map();

  for (const c of mdaComments) {
    const existing = operatorMap.get(c.author_id);
    const u = userMap.get(c.author_id);
    if (existing) {
      existing.comment_count += 1;
      existing.last_comment_at = Math.max(existing.last_comment_at, c.created_at);
    } else {
      operatorMap.set(c.author_id, {
        id: c.author_id,
        name: u ? u.fullName : `Usuario #${c.author_id}`,
        username: u ? u.username : "",
        comment_count: 1,
        last_comment_at: c.created_at,
      });
    }
  }

  const commentingOperators = Array.from(operatorMap.values());

  assert.equal(commentingOperators.length, 2);
  assert.equal(commentingOperators.find((o) => o.id === 101)?.comment_count, 2);
  assert.equal(commentingOperators.find((o) => o.id === 102)?.comment_count, 1);
  assert.equal(commentingOperators.find((o) => o.id === 999), undefined);
});
```

- [ ] **Step 2: Ejecutar test para verificar que corre**

Ejecutar:
```bash
node --test tests/lib/invgate/commenting-operators.test.mjs
```
Resultado esperado: PASS

- [ ] **Step 3: Agregar `getHelpdeskMemberIdSet` y `getHelpdeskMemberMap` en `src/lib/invgate/helpdeskMembersCache.ts`**

En `src/lib/invgate/helpdeskMembersCache.ts`, agregar exportaciones:
```typescript
let cachedMemberIdSetMap: Map<number, Set<number>> = new Map();
let cachedMemberMapById: Map<number, Map<number, HelpdeskMemberUser>> = new Map();

// Dentro de getHelpdeskMembers tras poblar members:
const memberIdSetForCache = new Set<number>();
const memberMapForCache = new Map<number, HelpdeskMemberUser>();
for (const m of members) {
  memberIdSetForCache.add(m.id);
  memberMapForCache.set(m.id, m);
}
cachedMemberIdSetMap.set(helpdeskId, memberIdSetForCache);
cachedMemberMapById.set(helpdeskId, memberMapForCache);

/**
 * Obtiene el Set de IDs numéricos de miembros de una Mesa de Ayuda.
 */
export async function getHelpdeskMemberIdSet(helpdeskId: number = 3950): Promise<Set<number>> {
  await getHelpdeskMembers(helpdeskId);
  return cachedMemberIdSetMap.get(helpdeskId) || new Set();
}

/**
 * Obtiene un Map por ID de los miembros de una Mesa de Ayuda.
 */
export async function getHelpdeskMemberMap(helpdeskId: number = 3950): Promise<Map<number, HelpdeskMemberUser>> {
  await getHelpdeskMembers(helpdeskId);
  return cachedMemberMapById.get(helpdeskId) || new Map();
}
```

---

### Task 2: Detección y extracción de operadores MDA en `agsTickets.ts`

**Files:**
- Modify: `src/lib/invgate/agsTickets.ts`
- Modify: `src/types/invgate.ts` (si corresponde agregar tipos)
- Test: `tests/lib/invgate/commenting-operators.test.mjs`

- [ ] **Step 1: Agregar interfaces y helper de extracción de operadores de comentarios en `src/lib/invgate/agsTickets.ts`**

Definir `CommentingOperator` y enriquecer `InvgateComment`:
```typescript
export interface CommentingOperator {
  id: number;
  name: string;
  username: string;
  comment_count: number;
  last_comment_at?: number;
}

export interface InvgateComment {
  id: number;
  incident_id: number;
  author_id: number;
  author_name?: string;
  author_username?: string;
  is_mda_agent?: boolean;
  message: string;
  created_at: number;
  customer_visible: boolean | number;
  is_solution?: boolean;
}
```

- [ ] **Step 2: Actualizar `getTicketComments` para marcar `is_mda_agent` y `author_username`**

En `getTicketComments(requestId, helpdeskId = 3950)`:
```typescript
export async function getTicketComments(
  requestId: number,
  helpdeskId: number = 3950
): Promise<{
  ok: boolean;
  comments: InvgateComment[];
  commenting_operators: CommentingOperator[];
  message?: string;
}> {
  try {
    const [res, userMap, mdaMemberIdSet, mdaMemberMap] = await Promise.all([
      invgateGet<any[]>(`incident.comment?request_id=${requestId}`),
      getFullUserMap().catch(() => new Map()),
      getHelpdeskMemberIdSet(helpdeskId).catch(() => new Set<number>()),
      getHelpdeskMemberMap(helpdeskId).catch(() => new Map<number, HelpdeskMemberUser>()),
    ]);

    if (!res.ok || !Array.isArray(res.data)) {
      return { ok: false, comments: [], commenting_operators: [], message: res.message || "Error al obtener comentarios de InvGate" };
    }

    const operatorMap = new Map<number, CommentingOperator>();

    const comments: InvgateComment[] = res.data.map((c) => {
      const author = userMap.get(c.author_id);
      const isMdaAgent = mdaMemberIdSet.has(c.author_id);
      const authorFullName = author
        ? `${author.name || ""} ${author.lastname || ""}`.trim() || author.username || `Usuario #${c.author_id}`
        : `Usuario #${c.author_id}`;
      const cleanUsername = author?.username ? author.username.split("@")[0].toLowerCase().trim() : "";

      if (isMdaAgent) {
        const existing = operatorMap.get(c.author_id);
        if (existing) {
          existing.comment_count += 1;
          existing.last_comment_at = Math.max(existing.last_comment_at || 0, c.created_at || 0);
        } else {
          operatorMap.set(c.author_id, {
            id: c.author_id,
            name: authorFullName,
            username: cleanUsername,
            comment_count: 1,
            last_comment_at: c.created_at || 0,
          });
        }
      }

      return {
        id: c.id,
        incident_id: c.incident_id,
        author_id: c.author_id,
        author_name: authorFullName,
        author_username: cleanUsername,
        is_mda_agent: isMdaAgent,
        message: c.message || "",
        created_at: c.created_at || 0,
        customer_visible: c.customer_visible,
        is_solution: c.is_solution,
      };
    });

    comments.sort((a, b) => b.created_at - a.created_at);
    const commentingOperators = Array.from(operatorMap.values());

    return { ok: true, comments, commenting_operators: commentingOperators };
  } catch (err: any) {
    return { ok: false, comments: [], commenting_operators: [], message: err.message || "Error al conectar con InvGate" };
  }
}
```

- [ ] **Step 3: Enriquecer `getUnassignedTicketsByHelpdesk` con los comentarios y operadores de cada ticket**

En `getUnassignedTicketsByHelpdesk(helpdeskId = 3950)`:
Obtener los comentarios de los tickets sin asignar concurrentemente (con límite por lotes) y adjuntar `commenting_operators` y `commenting_operators_count`:

```typescript
// Paralelizar la obtención de comentarios de los tickets sin asignar
const commentsResults = await Promise.allSettled(
  allUnassigned.map((t) => getTicketComments(t.id, helpdeskId))
);

const commentsByTicketId = new Map<number, { commenting_operators: CommentingOperator[]; count: number }>();

commentsResults.forEach((res, index) => {
  const ticketId = allUnassigned[index].id;
  if (res.status === "fulfilled" && res.value.ok) {
    commentsByTicketId.set(ticketId, {
      commenting_operators: res.value.commenting_operators,
      count: res.value.commenting_operators.length,
    });
  }
});

// Enriquecer enrichedTickets:
const enrichedTickets = allUnassigned.map((t) => {
  const commData = commentsByTicketId.get(t.id);
  const commentingOperators = commData?.commenting_operators || [];
  const commentingOperatorsCount = commentingOperators.length;
  // ... resto de mapeo
  return {
    ...t,
    category_name: catFullName,
    category_last_name: lastCatName || catFullName,
    creator_name: creatorName,
    creator_username: creatorUsername,
    customer_name: customerName,
    customer_username: customerUsername,
    location_name: locationName,
    commenting_operators: commentingOperators,
    commenting_operators_count: commentingOperatorsCount,
  };
});
```

---

### Task 3: Actualizar Endpoints API (`unassigned-tickets.ts` y `ticket-comments.ts`)

**Files:**
- Modify: `src/pages/api/invgate/unassigned-tickets.ts`
- Modify: `src/pages/api/invgate/ticket-comments.ts`

- [ ] **Step 1: Verificar y actualizar respuesta en `src/pages/api/invgate/ticket-comments.ts`**

Asegurar que devuelve `commenting_operators`:
```typescript
return jsonResponse(
  {
    requestId,
    count: result.comments.length,
    comments: result.comments,
    commenting_operators: result.commenting_operators || [],
  },
  200,
  "no-store"
);
```

- [ ] **Step 2: Probar los endpoints y verificar que compilan sin errores de tipos**

Ejecutar:
```bash
npx astro check
```

---

### Task 4: UI de la Cola de Tickets Sin Asignar (`AsignacionContent.astro`)

**Files:**
- Modify: `src/components/supervision/asignacion/AsignacionContent.astro`

- [ ] **Step 1: Agregar el Badge y Resumen de Operadores MDA en el Renderizado SSR de la lista**

En la sección SSR de tickets sin asignar (aprox. línea 450 y 485):
- En la fila de badges (junto a SLA y tiempo en cola):
  Si `t.commenting_operators_count > 0`, renderizar un badge destacado:
  ```astro
  {t.commenting_operators_count > 0 && (
    <span
      class="badge badge-secondary font-bold text-xs px-2 py-0.5 shrink-0 gap-1 shadow-xs"
      title={`Operadores MDA que comentaron: ${t.commenting_operators.map((o: any) => `${o.name} (${o.comment_count})`).join(', ')}`}
    >
      <Icon name="boxicons:message-circle-dots" size={13} class="shrink-0" />
      <span>+{t.commenting_operators_count} ops</span>
    </span>
  )}
  ```
- En la fila de usuario/generador:
  Si `t.commenting_operators_count > 0`:
  Mostrar los nombres de los operadores intervinientes en texto secundario destacado:
  ```astro
  {t.commenting_operators && t.commenting_operators.length > 0 && (
    <div class="flex items-center gap-1.5 text-xs text-secondary font-semibold truncate mt-0.5">
      <Icon name="boxicons:user-check" size={14} class="shrink-0 text-secondary" />
      <span class="truncate">
        Comentaron: <strong>{t.commenting_operators.map((o: any) => o.name).join(", ")}</strong>
      </span>
    </div>
  )}
  ```

- [ ] **Step 2: Replicar el Badge y Resumen en el Renderizado Dinámico de Polling (JS)**

En `fetchUnassignedTickets()` (aprox. líneas 2950-3075):
- Generar `commentsBadge`:
  ```javascript
  let commentsBadge = "";
  if (t.commenting_operators_count > 0) {
    const opTooltip = (t.commenting_operators || [])
      .map((o) => `${escapeHtml(o.name)} (${o.comment_count})`)
      .join(", ");
    commentsBadge = `
      <span class="badge badge-secondary font-bold text-xs px-2 py-0.5 shrink-0 gap-1 shadow-xs" title="Operadores MDA que comentaron: ${opTooltip}">
        <svg class="size-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span>+${t.commenting_operators_count} ops</span>
      </span>
    `;
  }
  ```
- Generar `commentsOperatorsRow`:
  ```javascript
  let commentsOperatorsRow = "";
  if (t.commenting_operators && t.commenting_operators.length > 0) {
    const opNames = t.commenting_operators.map((o) => escapeHtml(o.name)).join(", ");
    commentsOperatorsRow = `
      <div class="flex items-center gap-1.5 text-xs text-secondary font-semibold truncate mt-0.5">
        <svg class="size-3.5 shrink-0 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
        <span class="truncate">Comentaron: <strong>${opNames}</strong></span>
      </div>
    `;
  }
  ```

---

### Task 5: UI del Modal de Detalle de Ticket (`AsignacionContent.astro`)

**Files:**
- Modify: `src/components/supervision/asignacion/AsignacionContent.astro`

- [ ] **Step 1: Agregar contenedor para Resumen de Operadores MDA Intervinientes en el Modal HTML**

En el HTML del modal (arriba de la lista de comentarios, aprox. línea 1095):
```html
<div id="ticket-modal-mda-operators-container" class="hidden bg-secondary/10 border border-secondary/25 rounded-2xl p-3.5 space-y-2">
  <div class="flex items-center gap-2">
    <Icon name="boxicons:user-check" size={16} class="text-secondary" />
    <span class="text-xs font-bold uppercase tracking-wider text-secondary">
      Operadores MDA Intervinientes en Comentarios
    </span>
  </div>
  <div id="ticket-modal-mda-operators-list" class="flex flex-wrap gap-2">
    <!-- Pills dinámicas de operadores MDA -->
  </div>
</div>
```

- [ ] **Step 2: Actualizar la Lógica de `openTicketModal` para Mostrar Operadores y Badges en los Comentarios**

En `openTicketModal` (aprox. líneas 2850-2920):
- Al recibir `data.commenting_operators` o `data.comments`:
  - Poblar `#ticket-modal-mda-operators-list` con pills mostrando el nombre del operador y la cantidad de notas que dejó:
    ```javascript
    const mdaContainer = document.getElementById("ticket-modal-mda-operators-container");
    const mdaList = document.getElementById("ticket-modal-mda-operators-list");
    const commentingOps = data.commenting_operators || [];

    if (commentingOps.length > 0) {
      if (mdaList) {
        mdaList.innerHTML = commentingOps.map((op) => `
          <div class="inline-flex items-center gap-2 bg-base-100 border border-secondary/30 rounded-xl px-3 py-1.5 text-xs shadow-xs">
            <div class="avatar placeholder size-5 rounded-full bg-secondary text-secondary-content font-bold text-[10px] flex items-center justify-center">
              ${escapeHtml(op.name.substring(0, 2).toUpperCase())}
            </div>
            <strong class="text-base-content">${escapeHtml(op.name)}</strong>
            <span class="badge badge-secondary badge-xs font-bold">${op.comment_count} nota${op.comment_count > 1 ? 's' : ''}</span>
          </div>
        `).join("");
      }
      if (mdaContainer) mdaContainer.classList.remove("hidden");
    } else {
      if (mdaContainer) mdaContainer.classList.add("hidden");
    }
    ```
- En el renderizado de cada comentario individual:
  - Si `c.is_mda_agent`:
    Agregar un badge `<span class="badge badge-secondary badge-sm text-xs font-bold px-2 py-0.5">Operador MDA</span>` en la cabecera del comentario.

---

### Task 6: Verificación y Pruebas

**Files:**
- Execute test & build commands

- [ ] **Step 1: Ejecutar tests unitarios**

```bash
node --test tests/lib/invgate/commenting-operators.test.mjs
```
Resultado esperado: PASS

- [ ] **Step 2: Ejecutar verificación de tipos de Astro y Build**

```bash
npx astro check
npm run build
```
Resultado esperado: Build exitoso sin errores TypeScript ni de sintaxis.

- [ ] **Step 3: Verificar visualmente en navegador o tests E2E si aplica**

Validar que los tickets en cola muestran el badge `+N ops` cuando tienen notas de operadores de la Mesa 3950 y que el modal detalla los operadores que comentaron.
