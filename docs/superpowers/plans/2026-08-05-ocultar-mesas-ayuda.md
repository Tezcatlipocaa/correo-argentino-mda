# Ocultar Mesas de Ayuda (Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que solo un admin oculte (y luego muestre) mesas de ayuda en `/mesas-de-ayuda`, las cuales quedan excluidas del listado principal para todos los roles y se ven únicamente en un menú solo-admin.

**Architecture:** Nueva tabla SQLite `hidden_helpdesks` (invgate_id único + who/when). Dos endpoints API POST (`hide`, `show`) con guard admin + auditoría. La página `SoportesPublicContent.astro` (server island) lee la tabla, excluye las ocultas del grid normal, y si el usuario es admin renderiza las ocultas como cards marcadas `data-hidden="true"` y un toggle `#toggle-hidden` en la barra de filtros que alterna el modo "solo ocultas". `HelpdeskCard.astro` recibe `isHidden`/`adminOnly` y muestra botón Ocultar/Mostrar que hace fetch al API y recarga. La página de asignación también excluye las ocultas.

**Tech Stack:** Astro SSR, Drizzle ORM + better-sqlite3, DaisyUI v5 + Tailwind v4, boxicons (astro-icon), Playwright E2E.

## Global Constraints

- Solo rol `admin` puede ocultar/mostrar y ver el menú de ocultas (guard: `ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin`).
- Copys de UI en español CON tildes (estilo actual tras PR #96, ej. "tópico…", "áreas"). Decisión del usuario: "Con tildes (estilo actual)".
- Iconos: usar `size` numérico siempre (CONTEXT.md regla 9). NUNCA `class="size-4"` ni clases de dimensión en iconos.
- NOTA: tras el merge de PR #96, los números de línea de las tareas 2 y 3 están desactualizados. Anclar cada edición POR CONTENIDO (los bloques de código que se reemplazan), no por línea.
- Sin clases arbitrarias (`-[...]`); solo tokens Tailwind/DaisyUI (`btn-soft`, `badge-error`, etc.). Sin hex hardcodeado.
- Icons disponibles (verificado en `@iconify-json/boxicons`): `low-vision` (sí), `eye` (sí); `show` y `hide` NO existen — no usarlos.
- No re-declarar `const base = import.meta.env.BASE_URL || "/"` en frontmatter; usar `getCleanBase()` de `@lib/baseUrl`. En el `<script>` de HelpdeskCard ya existe `cleanBase` (línea 313-316) — reutilizarlo, no duplicar.
- Usar `jsonResponse` de `@lib/apiResponse` y `logAdminAction` de `@lib/auditLogger` en los endpoints.
- Commits: conventional, minúscula, prefijo `soportes` (ej. `feat(soportes): ...`).
- Después de tocar `src/db/schema.ts` correr `npm run db:push`.
- Playwright: workers=1 (serial), requiere dev server en `http://127.0.0.1:4321`. `astro check` tiene 70 errores pre-existentes en specs no relacionados — el código nuevo NO debe sumar errores.

---

### Task 1: Persistencia + endpoints API hide/show

**Files:**
- Modify: `src/db/schema.ts` (agregar tabla `hiddenHelpdesks` después de `supportGuides`, línea 674)
- Create: `src/pages/api/soportes/helpdesks/hide.ts`
- Create: `src/pages/api/soportes/helpdesks/show.ts`
- Create: `tests/mesas-ayuda-hidden.spec.ts` (solo tests de API en esta task; se extiende en Task 2)

**Interfaces:**
- Consumes: `db` (`@db/index`), `hiddenHelpdesks` (nueva tabla), `ROLE_HIERARCHY` (`@lib/rbac`), `logAdminAction`, `jsonResponse`.
- Produces: tabla `hidden_helpdesks` (`invgateId`, `hiddenBy`, `hiddenAt`) — leída en Task 2 y 3; endpoints `POST /api/soportes/helpdesks/hide` y `POST /api/soportes/helpdesks/show`, ambos con body `{ invgate_id: number }`, respuesta `{ ok: true }` (200) o `{ error }` (403/400/500).

- [ ] **Step 1: Agregar tabla al schema**

Insertar en `src/db/schema.ts` justo después del bloque `supportGuides` (después de la línea 674, antes de `auditLogs`):

```ts
export const hiddenHelpdesks = sqliteTable("hidden_helpdesks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invgateId: integer("invgate_id").notNull().unique(),
  hiddenBy: text("hidden_by").notNull(),
  hiddenAt: text("hidden_at").notNull(),
});
```

- [ ] **Step 2: Push schema**

Run: `npm run db:push`
Expected: crea la tabla `hidden_helpdesks` en `database/mda.db`.

- [ ] **Step 3: Escribir los tests de API (failing)**

Crear `tests/mesas-ayuda-hidden.spec.ts`:

```ts
import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
  type TestUser,
} from './helpers/auth';
import { db } from '../src/db/index';
import { hiddenHelpdesks } from '../src/db/schema';
import { eq } from 'drizzle-orm';

let adminUser: TestUser;
let agentUser: TestUser;

async function getFirstVisibleCardId(page: Page): Promise<number> {
  await page.goto('/mesas-de-ayuda');
  const card = page
    .locator('[data-card-for]:not([data-hidden="true"])')
    .first();
  await expect(card).toBeVisible();
  const id = Number(await card.getAttribute('data-card-for'));
  expect(Number.isInteger(id) && id > 0).toBeTruthy();
  return id;
}

async function unHideByDb(invgateId: number): Promise<void> {
  await db
    .delete(hiddenHelpdesks)
    .where(eq(hiddenHelpdesks.invgateId, invgateId));
}

test.beforeAll(async () => {
  adminUser = await createTestUserAndSession('admin');
  agentUser = await createTestUserAndSession('agent');
});

test.afterAll(async () => {
  await cleanupTestUser(adminUser.userId, adminUser.sessionId);
  await cleanupTestUser(agentUser.userId, agentUser.sessionId);
});

test.beforeEach(async ({ context }) => {
  await setSessionCookie(context, adminUser.signedSessionId);
});

test('Admin oculta y muestra una mesa por API (persistencia)', async ({
  page,
  context,
}) => {
  await setSessionCookie(context, adminUser.signedSessionId);
  const id = await getFirstVisibleCardId(page);

  const hideResp = await page.request.post('/api/soportes/helpdesks/hide', {
    data: { invgate_id: id },
  });
  expect(hideResp.status()).toBe(200);
  expect(await hideResp.json()).toEqual({ ok: true });

  const rows = await db
    .select()
    .from(hiddenHelpdesks)
    .where(eq(hiddenHelpdesks.invgateId, id));
  expect(rows).toHaveLength(1);

  const showResp = await page.request.post('/api/soportes/helpdesks/show', {
    data: { invgate_id: id },
  });
  expect(showResp.status()).toBe(200);

  const after = await db
    .select()
    .from(hiddenHelpdesks)
    .where(eq(hiddenHelpdesks.invgateId, id));
  expect(after).toHaveLength(0);
});

test('Agente no puede ocultar ni mostrar mesas', async ({
  page,
  context,
}) => {
  await setSessionCookie(context, agentUser.signedSessionId);
  const id = await getFirstVisibleCardId(page);

  const hideResp = await page.request.post('/api/soportes/helpdesks/hide', {
    data: { invgate_id: id },
  });
  expect(hideResp.status()).toBe(403);

  const showResp = await page.request.post('/api/soportes/helpdesks/show', {
    data: { invgate_id: id },
  });
  expect(showResp.status()).toBe(403);
});
```

- [ ] **Step 4: Correr los tests para verlos fallar**

Run: `npx playwright test tests/mesas-ayuda-hidden.spec.ts`
Expected: FAIL — la tabla o los endpoints no existen (`404` en los POST, o import de `hiddenHelpdesks` falla).

- [ ] **Step 5: Crear endpoint hide**

Crear `src/pages/api/soportes/helpdesks/hide.ts`:

```ts
import type { APIRoute } from "astro";
import { db } from "@db/index";
import { hiddenHelpdesks } from "@db/schema";
import { eq } from "drizzle-orm";
import { logAdminAction } from "@lib/auditLogger";
import { jsonResponse } from "@lib/apiResponse";
import { ROLE_HIERARCHY } from "@lib/rbac";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (
    !user ||
    ROLE_HIERARCHY[user.role as keyof typeof ROLE_HIERARCHY] <
      ROLE_HIERARCHY.admin
  ) {
    return jsonResponse({ error: "Acceso denegado" }, 403);
  }

  try {
    const body = await request.json();
    const invgateId = Number(body.invgate_id);

    if (!invgateId || isNaN(invgateId)) {
      return jsonResponse(
        { error: "invgate_id es requerido y debe ser un numero" },
        400,
      );
    }

    const existing = await db
      .select({ id: hiddenHelpdesks.id })
      .from(hiddenHelpdesks)
      .where(eq(hiddenHelpdesks.invgateId, invgateId));

    if (existing.length === 0) {
      await db.insert(hiddenHelpdesks).values({
        invgateId,
        hiddenBy: user.username || "sistema",
        hiddenAt: new Date().toISOString(),
      });
    }

    await logAdminAction(
      user.username || "sistema",
      `Oculto la mesa de ayuda ID ${invgateId}.`,
    );

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("[hide] Error:", err);
    return jsonResponse({ error: "Error interno al ocultar helpdesk" }, 500);
  }
};
```

- [ ] **Step 6: Crear endpoint show**

Crear `src/pages/api/soportes/helpdesks/show.ts`:

```ts
import type { APIRoute } from "astro";
import { db } from "@db/index";
import { hiddenHelpdesks } from "@db/schema";
import { eq } from "drizzle-orm";
import { logAdminAction } from "@lib/auditLogger";
import { jsonResponse } from "@lib/apiResponse";
import { ROLE_HIERARCHY } from "@lib/rbac";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (
    !user ||
    ROLE_HIERARCHY[user.role as keyof typeof ROLE_HIERARCHY] <
      ROLE_HIERARCHY.admin
  ) {
    return jsonResponse({ error: "Acceso denegado" }, 403);
  }

  try {
    const body = await request.json();
    const invgateId = Number(body.invgate_id);

    if (!invgateId || isNaN(invgateId)) {
      return jsonResponse(
        { error: "invgate_id es requerido y debe ser un numero" },
        400,
      );
    }

    await db
      .delete(hiddenHelpdesks)
      .where(eq(hiddenHelpdesks.invgateId, invgateId));

    await logAdminAction(
      user.username || "sistema",
      `Mostro la mesa de ayuda ID ${invgateId}.`,
    );

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("[show] Error:", err);
    return jsonResponse({ error: "Error interno al mostrar helpdesk" }, 500);
  }
};
```

- [ ] **Step 7: Correr los tests para verlos pasar**

Run: `npx playwright test tests/mesas-ayuda-hidden.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Verificar build**

Run: `npm run build`
Expected: build exitoso, sin errores nuevos.

- [ ] **Step 9: Commit**

```bash
git add src/db/schema.ts src/pages/api/soportes/helpdesks/hide.ts src/pages/api/soportes/helpdesks/show.ts tests/mesas-ayuda-hidden.spec.ts
git commit -m "feat(soportes): persistir mesas ocultas y endpoints hide/show"
```

---

### Task 2: UI — menu de ocultas, toggle y botones Ocultar/Mostrar

**Files:**
- Modify: `src/components/soportes/SoportesPublicContent.astro` (frontmatter, toggle button, render de ocultas, empty state, script)
- Modify: `src/components/soportes/HelpdeskCard.astro` (props, data-hidden, badge, botones, script)
- Modify: `tests/mesas-ayuda-hidden.spec.ts` (agregar tests UI)

**Interfaces:**
- Consumes: `hiddenHelpdesks` (Task 1); endpoints `hide`/`show` (Task 1); `can(user.role, "admin")` de `@lib/roleConfig` (ya importado en el archivo).
- Produces: props de `HelpdeskCard` `isHidden?: boolean`, `adminOnly?: boolean`; atributo `data-hidden="true"` en cards ocultas; toggle `#toggle-hidden` (solo admin); botones `[data-hide-helpdesk]` / `[data-show-helpdesk]`.

- [ ] **Step 1: Escribir los tests UI (failing)**

Agregar al final de `tests/mesas-ayuda-hidden.spec.ts`:

```ts
test('Admin oculta una mesa desde la UI y la ve en el menu de ocultas', async ({
  page,
  context,
}) => {
  await setSessionCookie(context, adminUser.signedSessionId);
  const id = await getFirstVisibleCardId(page);

  const card = page.locator(`[data-card-for="${id}"]`);
  await expect(card).toBeVisible();

  await card.locator('[data-hide-helpdesk]').click();
  await expect(page.locator(`[data-card-for="${id}"]`)).toHaveCount(0);

  const toggle = page.locator('#toggle-hidden');
  await expect(toggle).toBeVisible();
  await toggle.click();

  const hiddenCard = page.locator(
    `[data-card-for="${id}"][data-hidden="true"]`,
  );
  await expect(hiddenCard).toBeVisible();
  await expect(hiddenCard.getByText('Oculta')).toBeVisible();
  await expect(hiddenCard.locator('[data-show-helpdesk]')).toBeVisible();

  await hiddenCard.locator('[data-show-helpdesk]').click();
  await expect(
    page.locator(`[data-card-for="${id}"]:not([data-hidden="true"])`),
  ).toBeVisible();

  await unHideByDb(id);
});

test('Agente no ve mesas ocultas ni el menu de ocultas', async ({
  page,
  context,
  browser,
}) => {
  const adminReq = await test.request.newContext({
    baseURL: 'http://127.0.0.1:4321',
    extraHTTPHeaders: { Cookie: `session_id=${adminUser.signedSessionId}` },
  });
  const agentCtx = await browser.newContext({ baseURL: 'http://127.0.0.1:4321' });
  await setSessionCookie(agentCtx, agentUser.signedSessionId);

  await setSessionCookie(context, adminUser.signedSessionId);
  const id = await getFirstVisibleCardId(page);

  const hideResp = await adminReq.post('/api/soportes/helpdesks/hide', {
    data: { invgate_id: id },
  });
  expect(hideResp.status()).toBe(200);

  const agentPage = await agentCtx.newPage();
  await agentPage.goto('/mesas-de-ayuda');

  await expect(agentPage.locator(`[data-card-for="${id}"]`)).toHaveCount(0);
  await expect(agentPage.locator('#toggle-hidden')).toHaveCount(0);

  await agentCtx.close();
  await adminReq.dispose();
  await unHideByDb(id);
});
```

- [ ] **Step 2: Correr los tests para verlos fallar**

Run: `npx playwright test tests/mesas-ayuda-hidden.spec.ts`
Expected: los 2 tests nuevos FALLAN (`[data-hide-helpdesk]` no existe, `#toggle-hidden` no existe).

- [ ] **Step 3: Frontmatter de SoportesPublicContent — leer ocultas**

En `src/components/soportes/SoportesPublicContent.astro`:

a) Agregar `isAdminOnly` después de la línea 24 (`const canExport = ...`):

```ts
const isAdminOnly = user ? can(user.role, "admin") : false;
```

b) Reemplazar el bloque de las líneas 49-51:

```ts
const visibleHelpdesks = parentHelpdesks
  .filter((hd) => !HIDDEN_HELPDESK_IDS.includes(hd.id))
  .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
```

por:

```ts
const hiddenRows = await db.query.hiddenHelpdesks.findMany();
const dbHiddenIds = new Set(hiddenRows.map((r) => r.invgateId));
const staticHiddenIds = new Set(HIDDEN_HELPDESK_IDS);

const visibleHelpdesks = parentHelpdesks
  .filter((hd) => !dbHiddenIds.has(hd.id) && !staticHiddenIds.has(hd.id))
  .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

const hiddenManagedHelpdesks = parentHelpdesks
  .filter((hd) => dbHiddenIds.has(hd.id))
  .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
```

c) Reemplazar el bloque `parentNameMap` (líneas 53-58):

```ts
const parentNameMap = new Map<number, string>();
visibleHelpdesks.forEach((hd) => {
  if (hd.parent_id && parentMap.has(hd.parent_id)) {
    parentNameMap.set(hd.id, parentMap.get(hd.parent_id)!.name || "");
  }
});
```

por:

```ts
const parentNameMap = new Map<number, string>();
parentHelpdesks.forEach((hd) => {
  if (hd.parent_id && parentMap.has(hd.parent_id)) {
    parentNameMap.set(hd.id, parentMap.get(hd.parent_id)!.name || "");
  }
});
```

- [ ] **Step 4: Botón toggle en la barra de filtros**

Después del bloque `ExportCsvButton` (actual: líneas 174-184), dentro del mismo segundo `<div class="flex flex-wrap items-center gap-2 md:gap-3 w-full">`, agregar:

```astro
{
  isAdminOnly && (
    <button
      id="toggle-hidden"
      class="btn btn-outline btn-sm md:btn-md gap-2 shrink-0"
      aria-pressed="false"
      title="Ver solo mesas ocultas"
    >
      <Icon name="boxicons:low-vision" size={16} aria-hidden="true" />
      <span class="hidden lg:inline">Mesas ocultas</span>
    </button>
  )
}
```

- [ ] **Step 5: Render de cards ocultas (solo admin)**

Después del cierre del `map` de `visibleHelpdesks` (actual: líneas 192-207), agregar dentro de `#soportes-grid`:

```astro
{
  isAdminOnly &&
    hiddenManagedHelpdesks.map((hd) => {
      const records = groupedRecords.get(hd.id) || [];
      const parentName = parentNameMap.get(hd.id);
      const subLevels = subLevelsByParent.get(hd.id) || [];
      return (
        <HelpdeskCard
          helpdesk={hd}
          records={records}
          isAdmin={isAdminUser}
          parentName={parentName}
          subLevels={subLevels}
          isHidden
          adminOnly
        />
      );
    })
}
```

- [ ] **Step 6: Empty state para el menu de ocultas**

Después de `<SearchEmptyState ... />` (líneas 225-233), antes del cierre de `#soportes-grid`, agregar:

```astro
{
  isAdminOnly && (
    <div
      id="no-hidden-state-soportes"
      class="hidden col-span-full flex-col items-center gap-3 py-16 text-base-content/50"
    >
      <div class="rounded-full bg-base-200 p-4">
        <Icon
          name="boxicons:low-vision"
          size={32}
          class="opacity-30"
          aria-hidden="true"
        />
      </div>
      <p class="text-sm font-semibold">No hay mesas ocultas</p>
    </div>
  )
}
```

- [ ] **Step 7: Script — modo hiddenOnly**

En el `<script>` de `SoportesPublicContent.astro`:

a) Después de `const cards = ...` (línea 251) agregar:

```js
const toggleHiddenBtn = document.querySelector<HTMLButtonElement>(
  "#toggle-hidden",
);
let hiddenOnly = false;
```

b) En `applyFiltersAndSort`, reemplazar la definición de las variables de filtro (líneas 254-257):

```js
const query = searchInput?.value.trim() || "";
const statusFilter = filterStatus?.value || "all";
const parentFilter = filterParent?.value || "all";
const sortValue = sortBy?.value || "name-asc";
```

por:

```js
const query = hiddenOnly ? "" : (searchInput?.value.trim() || "");
const statusFilter = hiddenOnly ? "all" : (filterStatus?.value || "all");
const parentFilter = hiddenOnly ? "all" : (filterParent?.value || "all");
const sortValue = hiddenOnly ? "name-asc" : (sortBy?.value || "name-asc");
```

c) En el mismo `applyFiltersAndSort`, después de `const cardParent = card.dataset.parentName || "";` agregar:

```js
const cardHidden = card.dataset.hidden === "true";
```

y reemplazar:

```js
const isVisible = matchesSearch && matchesStatus && matchesParent;
```

por:

```js
const isVisible = hiddenOnly
  ? cardHidden
  : !cardHidden && matchesSearch && matchesStatus && matchesParent;
```

d) Reemplazar el bloque del empty state (líneas 281-290):

```js
const noResultsState = document.getElementById("no-results-state-soportes");
if (noResultsState) {
  if (visible.length === 0) {
    noResultsState.classList.remove("hidden");
    noResultsState.classList.add("flex");
  } else {
    noResultsState.classList.add("hidden");
    noResultsState.classList.remove("flex");
  }
}
```

por:

```js
const noResultsState = document.getElementById("no-results-state-soportes");
const noHiddenState = document.getElementById("no-hidden-state-soportes");

if (hiddenOnly) {
  noResultsState?.classList.add("hidden");
  noResultsState?.classList.remove("flex");
  if (noHiddenState) {
    const showEmpty = visible.length === 0;
    noHiddenState.classList.toggle("hidden", !showEmpty);
    noHiddenState.classList.toggle("flex", showEmpty);
  }
} else {
  noHiddenState?.classList.add("hidden");
  noHiddenState?.classList.remove("flex");
  if (noResultsState) {
    const showEmpty = visible.length === 0;
    noResultsState.classList.toggle("hidden", !showEmpty);
    noResultsState.classList.toggle("flex", showEmpty);
  }
}
```

e) Después de `sortBy?.addEventListener("change", applyFiltersAndSort);` (línea 324) agregar:

```js
toggleHiddenBtn?.addEventListener("click", () => {
  hiddenOnly = !hiddenOnly;
  toggleHiddenBtn.setAttribute("aria-pressed", String(hiddenOnly));
  toggleHiddenBtn.classList.toggle("btn-active", hiddenOnly);
  applyFiltersAndSort();
});
```

f) En `resetFilters` (líneas 338-344), al inicio agregar:

```js
hiddenOnly = false;
toggleHiddenBtn?.setAttribute("aria-pressed", "false");
toggleHiddenBtn?.classList.remove("btn-active");
```

- [ ] **Step 8: HelpdeskCard — props y data-hidden**

En `src/components/soportes/HelpdeskCard.astro`:

a) En la interface `Props` (líneas 9-15) agregar:

```ts
isHidden?: boolean;
adminOnly?: boolean;
```

y en la desestructuración (línea 17):

```ts
const { helpdesk, records, isAdmin, parentName, subLevels, isHidden = false, adminOnly = false } = Astro.props;
```

b) En la raíz del card (actual: líneas 85-94), reemplazar `class="card bg-base-100 shadow-sm border border-base-300 h-full hover:border-secondary/40 transition-colors"` por `class:list` y agregar `data-hidden`:

```astro
<div
  class:list={[
    "card bg-base-100 shadow-sm border border-base-300 h-full hover:border-secondary/40 transition-colors",
    isHidden && "hidden",
  ]}
  data-card-for={helpdesk.id}
  data-hidden={isHidden ? "true" : undefined}
  data-search-text={searchableText}
  data-status={isActive ? "active" : "inactive"}
  data-parent-name={parentName || ""}
  data-member-count={helpdesk.total_members}
  data-topic-count={topicsList.length}
  data-name={hdName}
>
```

c) Después del badge de estado (actual: líneas 128-130, `<span class:list={["badge badge-sm font-medium", statusBadge]}>...{statusLabel}</span>`), dentro del mismo `<div class="flex flex-wrap items-center gap-1.5 mt-1">`, agregar:

```astro
{
  isHidden && (
    <span class="badge badge-sm gap-1 badge-error">
      <Icon name="boxicons:low-vision" size={12} aria-hidden="true" />
      Oculta
    </span>
  )
}
```

- [ ] **Step 9: HelpdeskCard — botones Ocultar/Mostrar**

En `.card-actions` (actual: línea 220, `class="card-actions justify-end items-center gap-2 pt-4 border-t border-base-200 mt-3 flex-wrap sm:flex-nowrap"`), antes del bloque `isAdmin && (...)` (actual: líneas 243-254), agregar:

```astro
{
  adminOnly && !isHidden && (
    <button
      data-hide-helpdesk={helpdesk.id}
      class="btn btn-sm btn-soft btn-error gap-1"
      title="Ocultar esta mesa de ayuda del listado"
    >
      <Icon name="boxicons:low-vision" size={16} aria-hidden="true" />
      <span class="hidden xl:inline">Ocultar</span>
    </button>
  )
}
{
  adminOnly && isHidden && (
    <button
      data-show-helpdesk={helpdesk.id}
      class="btn btn-sm btn-soft btn-success gap-1"
      title="Mostrar esta mesa de ayuda en el listado"
    >
      <Icon name="boxicons:eye" size={16} aria-hidden="true" />
      <span class="hidden xl:inline">Mostrar</span>
    </button>
  )
}
```

- [ ] **Step 10: HelpdeskCard — script de hide/show**

En el `<script>` de `HelpdeskCard.astro`, después de `loadIncidentsSequentially();` (actual: línea 385), agregar (`cleanBase` ya existe, línea 349):

```js
async function toggleHidden(invgateId: number, action: "hide" | "show") {
  try {
    const res = await fetch(`${cleanBase}api/soportes/helpdesks/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invgate_id: invgateId }),
    });
    if (res.ok) {
      window.location.reload();
    }
  } catch (err) {
    console.error(
      `Error al ${action === "hide" ? "ocultar" : "mostrar"} helpdesk`,
      err,
    );
  }
}

document.querySelectorAll<HTMLElement>("[data-hide-helpdesk]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = Number(btn.dataset.hideHelpdesk);
    if (Number.isInteger(id) && id > 0) toggleHidden(id, "hide");
  });
});

document.querySelectorAll<HTMLElement>("[data-show-helpdesk]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = Number(btn.dataset.showHelpdesk);
    if (Number.isInteger(id) && id > 0) toggleHidden(id, "show");
  });
});
```

- [ ] **Step 11: Correr los tests para verlos pasar**

Run: `npx playwright test tests/mesas-ayuda-hidden.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 12: Regresión de filtros existentes**

PR #96 cambió el placeholder a "Buscar por nombre SM, Invgate, tópico…" pero `tests/mesas-ayuda-filters.spec.ts:31` aún espera "topico..." — test roto pre-existente. Decisión del usuario: actualizar la assertion.

a) En `tests/mesas-ayuda-filters.spec.ts`, reemplazar:

```ts
    'Buscar por nombre SM, Invgate, topico...',
```

por:

```ts
    'Buscar por nombre SM, Invgate, tópico…',
```

b) Correr:

Run: `npx playwright test tests/mesas-ayuda-filters.spec.ts tests/admin/rbac.spec.ts`
Expected: PASS (19 tests: 3 filtros + 16 rbac).

- [ ] **Step 13: Verificar build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 14: Commit**

```bash
git add src/components/soportes/SoportesPublicContent.astro src/components/soportes/HelpdeskCard.astro tests/mesas-ayuda-hidden.spec.ts tests/mesas-ayuda-filters.spec.ts
git commit -m "feat(soportes): menu de mesas ocultas solo admin"
```

---

### Task 3: Excluir ocultas de asignacion + regresion final

**Files:**
- Modify: `src/pages/mesas-de-ayuda/asignar.astro:12` (import) y `:29-32` (filtro)

**Interfaces:**
- Consumes: tabla `hiddenHelpdesks` (Task 1).
- Produces: página `/mesas-de-ayuda/asignar` sin mesas ocultas en el select.

- [ ] **Step 1: Excluir mesas ocultas en asignacion**

En `src/pages/mesas-de-ayuda/asignar.astro`:

a) En la línea 8, cambiar el import de `supportGuides` a incluir `hiddenHelpdesks`:

```ts
import { supportGuides, hiddenHelpdesks } from "@db/schema";
```

b) Después de la línea 12 (`import { HIDDEN_HELPDESK_IDS } ...`) — en realidad insertar después del bloque `const hdResult ... allItems ...` (después de la línea 27), agregar:

```ts
const hiddenRows = await db.query.hiddenHelpdesks.findMany();
const dbHiddenIds = new Set(hiddenRows.map((r) => r.invgateId));
```

c) Reemplazar el filtro (líneas 29-32):

```ts
const helpdesks = allItems
  .filter((h) => !h.level_order && !HIDDEN_HELPDESK_IDS.includes(h.id))
```

por:

```ts
const helpdesks = allItems
  .filter(
    (h) =>
      !h.level_order &&
      !HIDDEN_HELPDESK_IDS.includes(h.id) &&
      !dbHiddenIds.has(h.id),
  )
```

- [ ] **Step 2: Suite E2E completa**

Run: `npx playwright test`
Expected: PASS (todos los specs, serial). Incluye el fix de `tests/mesas-ayuda-filters.spec.ts` (placeholder "tópico…") ya committeado en Task 2.

- [ ] **Step 3: Build + typecheck**

Run: `npm run build`
Expected: build exitoso.

Run: `npx astro check`
Expected: los mismos 70 errores pre-existentes en specs no relacionados, NINGUNO nuevo en `src/components/soportes/`, `src/pages/mesas-de-ayuda/`, `src/pages/api/soportes/`, `src/db/schema.ts` ni `tests/mesas-ayuda-hidden.spec.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/mesas-de-ayuda/asignar.astro
git commit -m "fix(soportes): excluir mesas ocultas de la asignacion"
```
