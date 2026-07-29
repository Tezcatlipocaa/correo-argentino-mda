# Office Branch Personnel Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the office detail row's branch personnel section to load server-side concurrently with other details, preventing client-side layout shifts and avoiding rendering empty space when there is no personnel.

**Architecture:** Retrieve employee and employeeOffices data in the frontmatter of `OfficeRow.astro` on the server using Drizzle ORM. Render the personnel list server-side. Remove the client-side fetch API call, the custom client-side rendering script, and only render the section if personnel is present.

**Tech Stack:** Astro v6, Drizzle ORM, SQLite, Tailwind CSS, DaisyUI

---

### Task 1: Server-Side Query Integration in OfficeRow

**Files:**
- Modify: `src/components/offices/OfficeRow.astro:1-57`

- [ ] **Step 1: Import database objects and utilities**
  Add Drizzle ORM query imports and URL base utilities at the top of `OfficeRow.astro` frontmatter.

  ```typescript
  import { db } from "@db/index";
  import { employees, employeeOffices } from "@db/schema";
  import { eq, sql } from "drizzle-orm";
  import { getCleanBase } from "@lib/baseUrl";
  ```

- [ ] **Step 2: Add queries to load branch personnel on the server**
  Implement the senior sorting and branch query logic directly in the frontmatter.

  ```typescript
  const SENIOR_KEYWORDS = [
    "jefe", "supervisor", "gerente", "director", "coordinador",
    "subgerente", "responsable", "lider", "líder",
  ];

  function isSenior(position: string | null): boolean {
    if (!position) return false;
    const lower = position.toLowerCase();
    return SENIOR_KEYWORDS.some((kw) => lower.includes(kw));
  }

  const nis = office.code;
  let personnel: any[] = [];
  try {
    if (nis) {
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
        .innerJoin(
          employees,
          eq(employeeOffices.username, sql`lower(${employees.username})`),
        )
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

      const senior = results
        .filter((r) => isSenior(r.position))
        .sort((a, b) => (a.position ?? "").localeCompare(b.position ?? "") || (a.fullname ?? "").localeCompare(b.fullname ?? ""));
      const others = results
        .filter((r) => !isSenior(r.position))
        .sort((a, b) => (a.position ?? "").localeCompare(b.position ?? "") || (a.fullname ?? "").localeCompare(b.fullname ?? ""));

      personnel = [...senior, ...others].slice(0, 10);
    }
  } catch (error) {
    console.error(`[OfficeRow] Error loading personnel for NIS ${nis}:`, error);
  }

  const hasPersonnel = personnel.length > 0;
  const cleanBase = getCleanBase();
  ```

- [ ] **Step 3: Update detail and info section conditions**
  Modify `hasInfoSection` to include `hasPersonnel` so that the collapsible container opens and renders correctly even if there are no other details besides personnel.

  ```typescript
  const hasInfoSection = hasContacts || hasInfo || hasInvgateDetail || hasPersonnel;
  ```

---

### Task 2: Server-Side Personnel Markup and Script Clean up

**Files:**
- Modify: `src/components/offices/OfficeRow.astro:368-741`

- [ ] **Step 1: Replace personnel markup to render server-side**
  Render the `personnel` array using Astro map syntax and `CopyButton` component.

  ```astro
                  {/* Personal de la sucursal */}
                  {hasPersonnel && (
                    <section class="space-y-3">
                      <h2 class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-base-content/70">
                        <Icon
                          name="boxicons:group-filled"
                          size={16}
                          class="text-secondary"
                          aria-hidden="true"
                        />
                        Personal
                      </h2>
                      <div class="rounded-lg border border-base-300 bg-base-100/50 p-3 shadow-sm divide-y divide-base-200">
                        {personnel.map((p) => (
                          <div class="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                            <div class="min-w-0">
                              <p class="text-xs font-semibold text-base-content truncate">
                                {p.fullname ?? "Sin nombre"}
                                {p.position && (
                                  <span class="badge badge-soft badge-secondary text-xxs ml-1 align-middle">
                                    {p.position}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                              {p.telefono && (
                                <CopyButton
                                  value={p.telefono}
                                  variant="value"
                                  label={p.telefono}
                                  copiedLabel="Copiado"
                                  size="xs"
                                  appearance="ghost"
                                  monospace={true}
                                  class="text-accent text-xs font-normal"
                                />
                              )}
                              {p.interno && (
                                <CopyButton
                                  value={p.interno}
                                  variant="value"
                                  label={p.interno}
                                  copiedLabel="Copiado"
                                  size="xs"
                                  appearance="ghost"
                                  monospace={true}
                                  class="text-info text-xs font-normal"
                                />
                              )}
                              {p.dni && (
                                <a
                                  href={`${cleanBase}buscador-usuarios?q=${encodeURIComponent(p.dni)}`}
                                  class="btn btn-ghost btn-xs gap-1 text-base-content/50"
                                  title="Ver en buscador de usuarios"
                                  target="_blank"
                                >
                                  <Icon name="boxicons:search" size={14} />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
  ```

- [ ] **Step 2: Remove client-side javascript tag**
  Completely remove the `<script>` tag at the bottom of the file which previously loaded/observed the personnel sections.

---

### Task 3: Verification and Build Validation

**Files:**
- Test: Build validation and type-checking

- [ ] **Step 1: Check code types**
  Run: `npx astro check`
  Expected: No TypeScript or Astro compilation errors.

- [ ] **Step 2: Test building the application**
  Run: `npm run build`
  Expected: Success.
