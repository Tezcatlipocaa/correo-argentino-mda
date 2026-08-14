# Agents Ticket — Robust Duplicate Detection Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "desconexión de agentes" duplicate check reliably detect any open ticket for the same office, matching by category OR by title pattern, across both categories used in production.

**Architecture:** The check endpoint currently filters open tickets by exact `category_id === 257`. Production data shows the same problem is logged under two different categories (257 "STS- Problema con agentes" and 2625 "Alarma") with highly variable titles ("Desconexión de Agentes", "Agentes Caidos", with/without "STS-", with/without brackets). The fix widens the filter to a shared helper that matches either the known category IDs or a normalized title pattern, still constrained to the same `location_id`.

**Tech Stack:** Astro SSR, InvGate REST API v1, TypeScript

---

## Root cause (verified against prod)

Production has open "desconexión de agentes" tickets under two categories:

| category_id | name | parent |
|---|---|---|
| 257 | "STS- Problema con agentes" | 244 "Fallas" |
| 2625 | "Alarma" | 1071 "Operación Telegráfica (OPT)" |

Observed titles (all open, all "desconexión de agentes"):
- `"I2473 STS – Desconexión de Agentes "`
- `"STS I1123 - Desconexión de Agentes"`
- `"I1295STS - Agentes Caidos "`
- `"[I1913] STS- Desconexión de Agentes"`
- `"I1913 STS - Desconexión de agentes"`

The current filter `category_id === 257 && location_id === X` misses every 2625 ticket, so duplicates go undetected. The user also asked the title pattern to be a fallback ("misma categoría o string similar por desconexión de agentes").

---

### Task 1: Add a title-pattern matcher for agent disconnection tickets

**Files:**
- Modify: `src/lib/telegrafiaTicket.ts`

- [ ] **Step 1: Add the categories and a title matcher to the shared module**

Add below the existing `PROD_CATEGORY_ID` block in `src/lib/telegrafiaTicket.ts` (near line 24-28). The module already exports `AGENTS_TICKET_CATEGORY_ID`; add a set of known related category IDs and a regex that normalizes common title variants.

```typescript
// --- Categorías conocidas del problema "desconexión de agentes" ---
// 257 = STS- Problema con agentes (categoría que usa este portal)
// 2625 = Alarma (Operación Telegráfica) — misma problemática registrada en prod
export const AGENTS_TICKET_CATEGORY_IDS = [
  AGENTS_TICKET_CATEGORY_ID,
  2625,
];

// Patrón de título para "desconexión de agentes" / "agentes caídos",
// tolera variantes: "STS - Desconexión de Agentes", "Agentes Caidos", "[I1913] STS- ...", etc.
export const AGENTS_TICKET_TITLE_PATTERN = /desconexi[oó]n\s*de\s*agentes|agentes\s*ca[ií]dos/i;

export function isAgentsTicketTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return AGENTS_TICKET_TITLE_PATTERN.test(title);
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx astro check`
Expected: No new errors in `src/lib/telegrafiaTicket.ts` (project has ~47 pre-existing errors in unrelated files).

- [ ] **Step 3: Commit**

```bash
git add src/lib/telegrafiaTicket.ts
git commit -m "feat(agents-ticket): add category set and title pattern for duplicate detection"
```

---

### Task 2: Use the wider matcher in the check endpoint

**Files:**
- Modify: `src/pages/api/offices/check-agents-ticket.ts:7-11` (imports), `src/pages/api/offices/check-agents-ticket.ts:86-92` (filter)

- [ ] **Step 1: Import the new helpers**

Replace the import from `@lib/telegrafiaTicket` in `src/pages/api/offices/check-agents-ticket.ts`:

```typescript
import {
  USE_QA_INVGATE,
  AGENTS_TICKET_CATEGORY_IDS,
  isAgentsTicketTitle,
} from "@lib/telegrafiaTicket";
```

(Remove the now-unused `AGENTS_TICKET_CATEGORY_ID` import.)

- [ ] **Step 2: Broaden the filter**

Replace the filter block (lines 86-92):

```typescript
    // Step 3: Filter by location and either category or title pattern
    const incidents = Object.values(incidentsRes.data);
    const matchingIncident = incidents.find(
      (inc) =>
        inc.location_id === invgateLocationId &&
        (AGENTS_TICKET_CATEGORY_IDS.includes(inc.category_id ?? -1) ||
          isAgentsTicketTitle(inc.title)),
    );
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx astro check`
Expected: No errors in `check-agents-ticket.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/offices/check-agents-ticket.ts
git commit -m "feat(agents-ticket): detect duplicates by category or title pattern"
```

---

### Task 3: Verify against production data (read-only)

**Files:** none (verification only)

- [ ] **Step 1: Run a read-only verification script**

The `incident`/`incidents.by.status`/`incidents` endpoints are GET-only and safe. Run a temporary script that replicates the new filter logic and asserts it finds the known open tickets (e.g. ticket `69366` "\[I3080\] STS- Desconexión de Agentes", category 2625, location 6319; and `71104` category 257). Use the same script pattern as the investigation:

```javascript
// check-tmp.mjs (run with: node check-tmp.mjs)
import "dotenv/config";
const base = process.env.INVGATE_BASE_URL;
const auth = "Basic " + Buffer.from((process.env.INVGATE_API_USERNAME || "portalmda") + ":" + process.env.INVGATE_API_KEY).toString("base64");
const jf = async (p) => { const r = await fetch(base + p, { headers: { Authorization: auth } }); return r.json(); };
const OPEN = [1,2,3,4,5];
const qs = OPEN.map(s => `status_ids[]=${s}`).join("&");
const ids = [];
let offset = 0, total = 1;
while (offset < total && offset < 10000) {
  const r = await jf(`incidents.by.status?${qs}&limit=200&offset=${offset}`);
  if (!r?.requestIds?.length) break;
  ids.push(...r.requestIds); total = r.total ?? ids.length; offset += r.requestIds.length;
}
const CATEGORIES = [257, 2625];
const pattern = /desconexi[oó]n\s*de\s*agentes|agentes\s*ca[ií]dos/i;
let hits = 0;
for (let i = 0; i < ids.length; i += 100) {
  const idq = ids.slice(i, i + 100).map(x => `ids[]=${x}`).join("&");
  const incs = await jf(`incidents?${idq}`);
  for (const inc of Object.values(incs || {})) {
    if (CATEGORIES.includes(inc.category_id) || pattern.test(inc.title || "")) hits++;
  }
}
console.log("MATCHES:", hits);
if (hits === 0) { console.error("FAIL: no tickets matched"); process.exit(1); }
console.log("OK");
```

- [ ] **Step 2: Run and confirm non-zero matches**

Run: `node check-tmp.mjs`
Expected: `MATCHES:` >= 10 and `OK`. Then delete the temp file.

- [ ] **Step 3: Delete the temp script**

```bash
Remove-Item check-tmp.mjs
```

---

## Self-Review

**1. Spec coverage:**
- "misma categoría o string similar por desconexión de agentes" → Task 1 adds `AGENTS_TICKET_CATEGORY_IDS` (257 + 2625) and `isAgentsTicketTitle` regex; Task 2 applies them.
- "misma ubicación" → the `location_id === invgateLocationId` constraint is preserved in the filter.
- "el aviso no funciona" → root cause is the 257-only filter; the wider match fixes it.

**2. Placeholder scan:** No TBD/TODO; all code blocks complete; verification script is runnable.

**3. Type consistency:** `AGENTS_TICKET_CATEGORY_IDS: number[]`, `isAgentsTicketTitle(title): boolean`, `AGENTS_TICKET_TITLE_PATTERN: RegExp` — used consistently across Task 1 and Task 2.
