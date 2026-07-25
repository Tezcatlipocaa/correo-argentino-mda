# Branch Personnel & Multi-Office Junction Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show branch personnel (supervisory roles + fallback) in OfficeRow detail panels and user search cards, using a local DB junction table (`employee_offices`) to support users assigned to multiple locations.

**Architecture:** Add `employee_offices` junction table and `position` column to `employees`. Update `syncInvgateLocations()` to populate the junction table during daily cron. Create `branch-personnel/[nis].ts` endpoint that queries the junction table with fallback to `employees.sucursal`. Update `search.ts` to return `sucursales` array. Render multi-office CopyButtons in user search cards via flex-wrap cloning.

**Tech Stack:** Astro SSR, Drizzle ORM, SQLite, TypeScript, DaisyUI v5, Tailwind v4

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/db/schema.ts` | Modify | Add `position` to `employees`, create `employee_offices` table |
| `src/types/invgate.ts` | Modify | Add `position` field to `InvgateUser` |
| `src/lib/invgate/userSync.ts` | Modify | Sync `position` during full sync |
| `src/lib/invgate/locationSync.ts` | Modify | Populate `employee_offices` junction table, use `extractUsersArray()` |
| `src/pages/api/offices/branch-personnel/[nis].ts` | Create | Query personnel by NIS from local DB |
| `src/components/offices/OfficeRow.astro` | Modify | Add personnel section with badges and copy |
| `src/pages/api/usuarios/search.ts` | Modify | Return `sucursales` array from junction table |
| `src/components/UserCard.astro` | Modify | Wrap sucursal button in flex-wrap container |
| `src/components/buscador-usuarios/BuscadorUsuariosContent.astro` | Modify | Render multi-office CopyButtons with cloning |

---

### Task 1: Schema — Add `position` and `employee_offices`

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `position` column to `employees` table**

In `src/db/schema.ts`, find the `employees` table definition (line 20) and add `position` after the `invgateExists` field (line 27):

```typescript
export const employees = sqliteTable("employees", {
  dni: text("dni").primaryKey(),
  username: text("username").notNull(),
  fullname: text("fullname").notNull(),
  interno: text("interno"),
  telefono: text("telefono"),
  sucursal: text("sucursal"),
  invgateExists: integer("invgate_exists", { mode: "boolean" }).default(false),
  position: text("position"),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});
```

- [ ] **Step 2: Add `employee_offices` junction table after the `employees` table (after line 29)**

```typescript
export const employeeOffices = sqliteTable(
  "employee_offices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    sucursal: text("sucursal").notNull(),
  },
  (table) => ({
    uniqueUsernameSucursal: uniqueIndex("employee_offices_username_sucursal_idx").on(
      table.username,
      table.sucursal,
    ),
  }),
);
```

- [ ] **Step 3: Add import for `uniqueIndex` at the top of schema.ts**

The `uniqueIndex` import is already present on line 8:

```typescript
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
```

No change needed — `uniqueIndex` is already imported.

- [ ] **Step 4: Run db:push**

```bash
npm run db:push
```

Expected: `"Tables synced successfully"` or similar. Verify with:

```bash
npx drizzle-kit studio
# Check that employee_offices table exists with columns id, username, sucursal
```

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(db): add position to employees and employee_offices junction table"
```

---

### Task 2: Types — Add `position` to InvgateUser

**Files:**
- Modify: `src/types/invgate.ts`

- [ ] **Step 1: Add `position` field to InvgateUser interface**

In `src/types/invgate.ts`, modify the `InvgateUser` interface (line 15). Add `position` after `role_name` (line 26):

```typescript
export interface InvgateUser {
  id: number;
  username: string;
  name: string;
  lastname: string;
  email: string;
  user_type: number;
  type: number;
  is_disabled: boolean;
  is_deleted: boolean;
  is_external: boolean;
  role_name: string | null;
  position: string | null;
  manager_id: number | null;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/types/invgate.ts
git commit -m "feat(types): add position field to InvgateUser"
```

---

### Task 3: User Sync — Sync position from InvGate

**Files:**
- Modify: `src/lib/invgate/userSync.ts`

- [ ] **Step 1: Build a position lookup map during the active users loop**

The current code at `src/lib/invgate/userSync.ts` loops through `activeUsers` building a `chunk` of usernames for batch UPDATE. We need to also build a `positionMap` for each username and include `position` in the UPDATE.

Replace the entire `for (const user of activeUsers)` loop (lines 48-62) and the `if (chunk.length > 0)` block (lines 64-70) with:

```typescript
  const positionMap = new Map<string, string | null>();

  for (const user of activeUsers) {
    if (user.username) {
      const localPart = user.username.split("@")[0].toLowerCase();
      chunk.push(localPart);
      if (user.position) {
        positionMap.set(localPart, user.position);
      }
    }

    if (chunk.length >= CHUNK_SIZE) {
      await db
        .update(employees)
        .set({ invgateExists: true })
        .where(inArray(sql`lower(${employees.username})`, chunk));
      await flushPositions(chunk, positionMap);
      totalSynced += chunk.length;
      chunk.length = 0;
    }
  }

  if (chunk.length > 0) {
    await db
      .update(employees)
      .set({ invgateExists: true })
      .where(inArray(sql`lower(${employees.username})`, chunk));
    await flushPositions(chunk, positionMap);
    totalSynced += chunk.length;
  }
```

- [ ] **Step 2: Add the `flushPositions` helper function before `fullInvgateSync()`**

Add this helper right after the `CHUNK_SIZE` constant (after line 8):

```typescript
async function flushPositions(
  usernames: string[],
  positionMap: Map<string, string | null>,
) {
  for (const username of usernames) {
    const pos = positionMap.get(username);
    if (pos) {
      await db
        .update(employees)
        .set({ position: pos })
        .where(sql`lower(${employees.username}) = ${username}`);
    }
  }
}
```

- [ ] **Step 3: Add `position` to the `import { employees }` line**

Verify the `employees` import already includes the `position` field. Schema changes auto-propagate in Drizzle — no import change needed since we use `set({ position: pos })` on the full table object.

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/invgate/userSync.ts
git commit -m "feat(sync): sync position field from InvGate during user sync"
```

---

### Task 4: Location Sync — Populate junction table for multi-office support

**Files:**
- Modify: `src/lib/invgate/locationSync.ts`

- [ ] **Step 1: Update imports at the top of the file**

Import `employeeOffices` and `extractUsersArray`. Replace lines 1-5:

```typescript
import { db } from "../../db/index";
import { employees, offices, employeeOffices } from "../../db/schema";
import { invgateGet } from "../invgateClient";
import { sql } from "drizzle-orm";
import { parseInvgateLocationName } from "./locationMatcher";
import { extractUsersArray } from "./normalizeUsers";
```

- [ ] **Step 2: Rewrite the location processing loop to populate `employee_offices`**

Replace the entire location processing block (lines 39-86) — the chunk loop that calls `invgateGet` for each location's users:

```typescript
  const populated = locations.filter((l: any) => l.total > 0);
  console.log(`[SyncInvGate] Se encontraron ${populated.length} ubicaciones con usuarios.`);

  let locationsProcessed = 0;
  let totalUsersUpdated = 0;
  let totalJunctionInserts = 0;

  for (let i = 0; i < populated.length; i += 20) {
    const chunk = populated.slice(i, i + 20);
    await Promise.all(
      chunk.map(async (loc: any) => {
        const locUsersResult = await invgateGet<any[]>(`locations.users?id=${loc.id}`);
        if (!locUsersResult.ok) return;

        const locUsers = extractUsersArray(
          "data" in locUsersResult ? locUsersResult.data : null,
        );
        if (locUsers.length === 0) return;

        const parsed = parseInvgateLocationName(loc.name);
        let sucursalToSave = loc.name;
        if (parsed.nis && officesSet.has(parsed.nis)) {
          sucursalToSave = parsed.nis;
        }

        for (const user of locUsers) {
          if (user.username) {
            const baseUsername = user.username.split("@")[0].toLowerCase();
            try {
              const res = await db
                .update(employees)
                .set({ sucursal: sucursalToSave })
                .where(sql`lower(${employees.username}) = lower(${baseUsername})`);

              if (res.changes > 0) {
                totalUsersUpdated += res.changes;
              }

              await db
                .insert(employeeOffices)
                .values({ username: baseUsername, sucursal: sucursalToSave })
                .onConflictDoNothing();
              totalJunctionInserts++;
            } catch (e) {
              // ignore individual failures
            }
          }
        }
      }),
    );

    locationsProcessed += chunk.length;
    console.log(`[SyncInvGate] Procesadas ${locationsProcessed} / ${populated.length} ubicaciones...`);
  }

  console.log(`[SyncInvGate] Sincronización de ubicaciones finalizada. Empleados actualizados: ${totalUsersUpdated}. Junction inserts: ${totalJunctionInserts}`);
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/invgate/locationSync.ts
git commit -m "feat(sync): populate employee_offices junction table during location sync"
```

---

### Task 5: API — Create branch personnel endpoint

**Files:**
- Create: `src/pages/api/offices/branch-personnel/[nis].ts`

- [ ] **Step 1: Create the endpoint file**

Create the directory and file `src/pages/api/offices/branch-personnel/[nis].ts`:

```typescript
import type { APIRoute } from "astro";
import { db } from "@db/index";
import { employees, employeeOffices, offices } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { jsonResponse, jsonError } from "@lib/apiResponse";

const SUPERVISORY_KEYWORDS = [
  "jefe zonal",
  "jefe suc",
  "jefe cdd",
  "jefe de suc",
  "jefe de cdd",
  "supervisor",
  "jefe",
];

function isSupervisory(position: string | null): boolean {
  if (!position) return false;
  const lower = position.toLowerCase();
  return SUPERVISORY_KEYWORDS.some((kw) => lower.includes(kw));
}

export const GET: APIRoute = async ({ params }) => {
  try {
    const nis = params.nis;
    if (!nis) return jsonError("NIS requerido", 400);

    const rows = await db
      .select({
        username: employeeOffices.username,
        fullname: employees.fullname,
        dni: employees.dni,
        interno: employees.interno,
        telefono: employees.telefono,
        position: employees.position,
        sucursal: employeeOffices.sucursal,
      })
      .from(employeeOffices)
      .innerJoin(employees, eq(employeeOffices.username, sql`lower(${employees.username})`))
      .where(eq(employeeOffices.sucursal, nis));

    let results = rows.map((r) => ({
      dni: r.dni,
      fullname: r.fullname,
      username: r.username,
      interno: r.interno,
      telefono: r.telefono,
      position: r.position,
    }));

    if (results.length === 0) {
      const fallback = await db
        .select({
          dni: employees.dni,
          fullname: employees.fullname,
          username: employees.username,
          interno: employees.interno,
          telefono: employees.telefono,
          position: employees.position,
        })
        .from(employees)
        .where(eq(employees.sucursal, nis))
        .limit(10);

      results = fallback;
    }

    const supervisory = results.filter((r) => isSupervisory(r.position));
    const others = results.filter((r) => !isSupervisory(r.position));

    const sorted = [
      ...supervisory.sort((a, b) => (a.fullname ?? "").localeCompare(b.fullname ?? "")),
      ...others.sort((a, b) => (a.fullname ?? "").localeCompare(b.fullname ?? "")),
    ];

    const display = sorted.slice(0, 10);

    return jsonResponse({
      ok: true,
      nis,
      total: display.length,
      personnel: display,
    });
  } catch (error) {
    console.error("[BranchPersonnel] Error:", error);
    return jsonError("Error al obtener personal", 500);
  }
};
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/offices/branch-personnel/
git commit -m "feat(api): add branch-personnel endpoint with junction table support"
```

---

### Task 6: UI — Add personnel section to OfficeRow.astro

**Files:**
- Modify: `src/components/offices/OfficeRow.astro`

- [ ] **Step 1: Add personnel section below the InvGate data block**

In the detail panel, after the InvGate data section (after line 356, where `{hasInfo && (` starts for the "Información" section) and BEFORE the Info section, add a new personnel section.

Insert before line 357 (`{hasInfo && (` line):

```astro
                {/* Personal de la sucursal */}
                <section class="space-y-3" data-branch-personnel data-nis={office.code}>
                  <h2 class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-base-content/70">
                    <Icon
                      name="boxicons:group-filled"
                      size={16}
                      class="text-secondary"
                      aria-hidden="true"
                    />
                    Personal
                  </h2>
                  <div
                    data-branch-personnel-content
                    class="rounded-lg border border-base-300 bg-base-100/50 p-3 shadow-sm"
                  >
                    <div class="flex items-center gap-2 text-xs text-base-content/50">
                      <span class="loading loading-spinner loading-xs"></span>
                      <span>Cargando personal...</span>
                    </div>
                  </div>
                </section>
```

- [ ] **Step 2: Add script at the bottom of the file for lazy-loading personnel**

Before the closing `</article>` tag (before line 573), add:

```html
<script>
  function initBranchPersonnel() {
    const sections = document.querySelectorAll("[data-branch-personnel]");
    sections.forEach((section) => {
      const nis = section.getAttribute("data-nis");
      const content = section.querySelector("[data-branch-personnel-content]");
      if (!nis || !content) return;

      fetch(`${window.location.origin}/api/offices/branch-personnel/${nis}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.ok || !data.personnel || data.personnel.length === 0) {
            section.classList.add("hidden");
            return;
          }

          const personnel = data.personnel;
          const html = personnel
            .map(
              (p) => `
              <div class="flex items-center justify-between gap-3 py-2 border-b border-base-200 last:border-b-0">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-base-content truncate">${escapeHTML(p.fullname ?? "Sin nombre")}</p>
                  <p class="text-xs text-base-content/50">${escapeHTML(p.position ?? "Sin cargo")}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  ${p.telefono ? `
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs gap-1 text-accent"
                      onclick="navigator.clipboard.writeText('${p.telefono}')"
                      title="Copiar teléfono: ${p.telefono}"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      <span class="font-mono text-xs">${p.telefono}</span>
                    </button>
                  ` : ""}
                  ${p.interno ? `
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs gap-1 text-info"
                      onclick="navigator.clipboard.writeText('${p.interno}')"
                      title="Copiar interno: ${p.interno}"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                      <span class="font-mono text-xs">${p.interno}</span>
                    </button>
                  ` : ""}
                </div>
              </div>
            `,
            )
            .join("");

          content.innerHTML = html;
        })
        .catch(() => {
          content.innerHTML =
            '<p class="text-xs text-error">Error al cargar personal</p>';
        });
    });
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  document.addEventListener("astro:page-load", initBranchPersonnel);
  initBranchPersonnel();
</script>
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/offices/OfficeRow.astro
git commit -m "feat(ui): add branch personnel section to OfficeRow with phone/interno copy badges"
```

---

### Task 7: API — Return `sucursales` array in user search

**Files:**
- Modify: `src/pages/api/usuarios/search.ts`

- [ ] **Step 1: Add imports for `employeeOffices` and `inArray`**

Replace lines 1-5:

```typescript
import type { APIRoute } from "astro";
import { db } from "@db/index";
import { employees, offices, employeeOffices } from "@db/schema";
import { or, and, eq, sql, getTableColumns, inArray } from "drizzle-orm";
import { jsonResponse, jsonError } from "@lib/apiResponse";
```

- [ ] **Step 2: Add junction table query and sucursales mapping after the main query**

After the main results query (line 60 `.limit(50);`), add:

```typescript
    const usernames = results
      .map((r) => (r.username?.split("@")[0] ?? "").toLowerCase())
      .filter(Boolean);
    const officesMap = new Map<string, { code: string; name: string | null }[]>();
    if (usernames.length > 0) {
      const rows = await db
        .select({
          username: employeeOffices.username,
          code: employeeOffices.sucursal,
          name: offices.name,
        })
        .from(employeeOffices)
        .leftJoin(offices, eq(employeeOffices.sucursal, offices.code))
        .where(inArray(employeeOffices.username, usernames));

      for (const row of rows) {
        const list = officesMap.get(row.username) ?? [];
        list.push({ code: row.code, name: row.name ?? null });
        officesMap.set(row.username, list);
      }
    }
```

- [ ] **Step 3: Update the response mapping to include `sucursales`**

Replace the existing return block (lines 62-73):

```typescript
    return jsonResponse({
      results: results.map((e) => ({
        fullname: e.fullname,
        dni: e.dni,
        username: e.username,
        interno: e.interno,
        telefono: e.telefono,
        sucursal: e.sucursal,
        sucursalNombre: e.officeName || null,
        sucursales: officesMap.get(
          (e.username?.split("@")[0] ?? "").toLowerCase(),
        ) ?? [],
        invgateExists: e.invgateExists ?? false,
      })),
      total: results.length,
    });
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/usuarios/search.ts
git commit -m "feat(api): return sucursales array from employee_offices junction table in user search"
```

---

### Task 8: UI — Wrap sucursal button in flex-wrap container in UserCard template

**Files:**
- Modify: `src/components/UserCard.astro`

- [ ] **Step 1: Replace the single CopyButton with a flex-wrap wrapper**

Replace lines 119-134 (the "Ubicación" section):

```astro
        {/* Ubicación */}
        <div class="flex flex-col gap-1">
          <span
            class="text-xxs uppercase font-bold text-base-content/40 tracking-wider"
            >Ubicación</span
          >
          <div class="flex flex-wrap gap-1.5 user-card-sucursal-wrap">
            <CopyButton
              value=""
              variant="value"
              size="xs"
              appearance="surface"
              monospace={true}
              fullWidth={false}
              class="user-card-sucursal-btn"
            />
          </div>
        </div>
```

Key change: `fullWidth={true}` → `fullWidth={false}` (so cloned buttons don't stretch). The `user-card-sucursal-wrap` container handles layout: flex-wrap for multiple, single button stays compact.

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/UserCard.astro
git commit -m "feat(ui): wrap sucursal button in flex-wrap container for multi-office support"
```

---

### Task 9: UI — Render multi-office CopyButtons in search results

**Files:**
- Modify: `src/components/buscador-usuarios/BuscadorUsuariosContent.astro`

- [ ] **Step 1: Replace the sucursal rendering in `displayResults()`**

In the `displayResults` function, find the "Ubicación" section rendering (approximately lines 651-662 in the original file). Replace the `if (sucursal)` block:

```javascript
      // Ubicación — multi-office support
      const sucursales = user.sucursales || [];
      const sucursal = user.sucursal;
      const sucursalNombre = user.sucursalNombre;

      if (sucursales.length > 0 || sucursal) {
        const sucursalBtn = clone.querySelector(".user-card-sucursal-btn");
        const wrap = clone.querySelector(".user-card-sucursal-wrap");
        if (sucursalBtn && wrap) {
          if (sucursales.length > 1) {
            for (let i = 0; i < sucursales.length; i++) {
              const s = sucursales[i];
              const text = s.name ? `${s.code} — ${s.name}` : s.code;

              let btn;
              if (i === 0) {
                btn = sucursalBtn;
              } else {
                btn = sucursalBtn.cloneNode(true);
              }

              btn.setAttribute("data-copy-value", s.code);
              btn.setAttribute("data-copy-label-default", text);
              btn.setAttribute("aria-label", `Copiar NIS ${s.code}`);
              const label = btn.querySelector("[data-copy-label]");
              if (label) label.textContent = text;
              wrap.appendChild(btn);
            }
            sucursalBtn.remove();
          } else if (sucursales.length === 1) {
            const s = sucursales[0];
            const text = s.name ? `${s.code} — ${s.name}` : s.code;
            sucursalBtn.setAttribute("data-copy-value", s.code);
            sucursalBtn.setAttribute("data-copy-label-default", text);
            sucursalBtn.setAttribute("aria-label", `Copiar NIS ${s.code}`);
            sucursalBtn.classList.add("w-full", "max-w-full", "justify-between");
            const label = sucursalBtn.querySelector("[data-copy-label]");
            if (label) label.textContent = text;
          } else {
            const valorCompleto = sucursalNombre
              ? `${sucursal} — ${sucursalNombre}`
              : sucursal;
            sucursalBtn.setAttribute("data-copy-value", valorCompleto);
            sucursalBtn.setAttribute("data-copy-label-default", valorCompleto);
            sucursalBtn.setAttribute("aria-label", `Copiar: ${valorCompleto}`);
            sucursalBtn.classList.add("w-full", "max-w-full", "justify-between");
            const label = sucursalBtn.querySelector("[data-copy-label]");
            if (label) label.textContent = valorCompleto;
          }
        }
      } else {
        const parentRow = clone.querySelector(".user-card-sucursal-btn")?.closest(".flex.flex-col");
        if (parentRow) parentRow.classList.add("hidden");
      }
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/buscador-usuarios/BuscadorUsuariosContent.astro
git commit -m "feat(ui): render multi-office CopyButtons with flex-wrap in user search cards"
```

---

## Verification

After all tasks:

1. Run the full build:
   ```bash
   npm run build
   ```
   Expected: clean build.

2. Run the location sync manually to populate data:
   ```bash
   npx tsx -e "import { syncInvgateLocations } from './src/lib/invgate/locationSync'; syncInvgateLocations().then(() => console.log('Done'))"
   ```

3. Test branch-personnel endpoint:
   ```
   GET /api/offices/branch-personnel/{nis}
   ```
   Expected: JSON with `personnel` array.

4. Test search endpoint:
   ```
   GET /api/usuarios/search?q=scordoba
   ```
   Expected: `sucursales` array with entries from junction table.

5. Verify UI at `/directorio-oficinas` — expand a branch row, see personnel section.

6. Verify UI at `/buscador-usuarios` — search, see multi-office CopyButtons.
