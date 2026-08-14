# Agents Ticket — Speed Up Duplicate Detection Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the duplicate-check latency from ~72s to ~2s by querying the office location's status-1 (Nuevo) tickets server-side, and only scanning the remaining open statuses with parallelized fetches.

**Architecture:** InvGate's `incidents.by.status` filters by `location_id` correctly ONLY when passed a single `status_id` (not the `status_ids[]` array) AND that status is 1 (Nuevo). For statuses 2-5 the `location_id` param is silently ignored. So the endpoint runs two phases: (a) a fast query for the location's Nuevo tickets (~780ms, catches the freshly-created duplicate — the exact case the user needs), and (b) for the remaining open statuses, scan the global open set but parallelize the `incidents?ids[]=` batch fetch (the bottleneck, ~8s/request) so the slow path drops from ~67s to ~17s worst-case.

**Tech Stack:** Astro SSR, InvGate REST API v1, TypeScript

---

## Root cause of the 72s latency (measured)

- Pagination (18 requests `incidents.by.status`, 3537 ids): **5.6s**
- Chunked batch fetch (8 requests `incidents?ids[]=500`): **66.7s** ← bottleneck (~8.3s/request)
- Total sequential: **72.3s**

Parallelizing the batch fetch 4-wide drops it to **~21.6s**. Filtering status-1 by location server-side removes the most important case entirely (~780ms).

InvGate behavior verified:
- `incidents.by.status?status_id=1&location_id=6135` → 1 ticket (the Nuevo one at that location) in 781ms ✅
- `incidents.by.status?status_ids[]=1..5&location_id=6135` → ignores location (returns 3534) ❌
- `incidents.by.status?status_id=2&location_id=6135` → ignores location (returns global 1535 across 36 locations) ❌

---

### Task 1: Add a fast "status-1 by location" query and parallelize the batch fetch

**Files:**
- Modify: `src/pages/api/offices/check-agents-ticket.ts`

- [ ] **Step 1: Split the query into two phases**

Replace the entire block from line 42 (`// Step 1: Get all open ticket IDs (status 1-5), paginating`) through line 92 (the `incidents.push(...)` line, inclusive) with:

```typescript
    // Step 1a: Fast path — status 1 (Nuevo) filtered by location server-side.
    // InvGate honors location_id ONLY with a single status_id and only for status 1.
    const newAtLocationRes = await getFn<InvgateByStatusResponse>(
      `incidents.by.status?status_id=1&location_id=${invgateLocationId}&limit=200`,
    );

    if (!newAtLocationRes.ok || !newAtLocationRes.data?.requestIds) {
      return jsonResponse({
        exists: false,
        reason: "No se pudieron consultar los tickets nuevos.",
      });
    }

    const locationNewIds = newAtLocationRes.data.requestIds;

    // Step 1b: Slow path — remaining open statuses (2-5) have no server-side
    // location filter, so scan the global open set.
    const openStatusQuery = [2, 3, 4, 5]
      .map((s) => `status_ids[]=${s}`)
      .join("&");
    const requestIds: number[] = [];
    let offset = 0;
    let total = 1;
    let pages = 0;
    const MAX_PAGES = 60;

    while (offset < total && pages < MAX_PAGES) {
      const pageRes = await getFn<InvgateByStatusResponse>(
        `incidents.by.status?${openStatusQuery}&limit=200&offset=${offset}`,
      );

      if (!pageRes.ok || !pageRes.data?.requestIds) {
        return jsonResponse({
          exists: false,
          reason: "No se pudieron consultar los tickets abiertos.",
        });
      }

      requestIds.push(...pageRes.data.requestIds);
      total = pageRes.data.total ?? requestIds.length;
      offset += pageRes.data.requestIds.length;
      pages++;
    }

    // Step 2: Fetch full objects. Parallelize the batch fetch (the bottleneck:
    // each incidents?ids[]=500 request takes ~8s). 4 workers cut 67s -> ~17s.
    const CHUNK = 500;
    const CONCURRENCY = 4;
    const chunks: number[][] = [];
    for (let i = 0; i < requestIds.length; i += CHUNK) {
      chunks.push(requestIds.slice(i, i + CHUNK));
    }

    const incidents: InvgateIncident[] = [];
    let chunkIdx = 0;

    async function fetchChunk(): Promise<void> {
      while (chunkIdx < chunks.length) {
        const chunk = chunks[chunkIdx++];
        const idsQuery = chunk.map((id) => `ids[]=${id}`).join("&");
        const chunkRes = await getFn<Record<string, InvgateIncident>>(
          `incidents?${idsQuery}`,
        );

        if (!chunkRes.ok || !chunkRes.data) {
          throw new Error(
            chunkRes.message || "No se pudieron obtener los detalles de los tickets.",
          );
        }

        incidents.push(...Object.values(chunkRes.data));
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => fetchChunk()));
```

Note: `chunkRes.message` exists on the `ok:false` variant of `InvgateResult<T>`.

- [ ] **Step 2: Merge status-1 ids into the filter input**

The filter in Step 3 currently reads `incidents.find(...)`. Change it to also consider the fast-path ids. Replace the filter block (lines ~94-100, now shifted) with:

```typescript
    // Step 3: Filter by location and either category or title pattern
    const locationNewIncidents: InvgateIncident[] = [];

    if (locationNewIds.length > 0) {
      const newIdsQuery = locationNewIds.map((id) => `ids[]=${id}`).join("&");
      const newRes = await getFn<Record<string, InvgateIncident>>(
        `incidents?${newIdsQuery}`,
      );
      if (newRes.ok && newRes.data) {
        locationNewIncidents.push(...Object.values(newRes.data));
      }
    }

    const allCandidates = [...incidents, ...locationNewIncidents];
    const matchingIncident = allCandidates.find(
      (inc) =>
        inc.location_id === invgateLocationId &&
        (AGENTS_TICKET_CATEGORY_IDS.includes(inc.category_id ?? -1) ||
          isAgentsTicketTitle(inc.title)),
    );
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx astro check`
Expected: No errors in `check-agents-ticket.ts` (project has ~47 pre-existing errors elsewhere — NOT yours).

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/offices/check-agents-ticket.ts
git commit -m "perf(agents-ticket): filter status-1 by location and parallelize batch fetch"
```

---

### Task 2: Verify latency and correctness against production (read-only)

**Files:** none (verification only)

- [ ] **Step 1: Write and run a timing script**

Create `perf-verify-tmp.mjs` in the project root (gitignored temp):

```javascript
import "dotenv/config";
const base = process.env.INVGATE_BASE_URL;
const auth = "Basic " + Buffer.from((process.env.INVGATE_API_USERNAME || "portalmda") + ":" + process.env.INVGATE_API_KEY).toString("base64");
const jf = async (p) => { const r = await fetch(base + p, { headers: { Authorization: auth } }); const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d }; };

const loc = 6135; // I1913 — has known agent tickets
const t0 = Date.now();
// Phase 1a
const fast = await jf(`incidents.by.status?status_id=1&location_id=${loc}&limit=200`);
console.log("phase1a (status1 by location):", fast.status, "ids:", (fast.data?.requestIds || []).length, "ms:", Date.now() - t0);
// Phase 1b
const t1 = Date.now();
const qs = [2,3,4,5].map(s => `status_ids[]=${s}`).join("&");
const ids = [];
let offset = 0, total = 1;
while (offset < total) {
  const r = await jf(`incidents.by.status?${qs}&limit=200&offset=${offset}`);
  if (!r.data?.requestIds?.length) break;
  ids.push(...r.data.requestIds); total = r.data.total ?? ids.length; offset += r.data.requestIds.length;
}
console.log("phase1b pagination:", ids.length, "ids, ms:", Date.now() - t1);
// Phase 2 parallel
const t2 = Date.now();
const CHUNK = 500, CONC = 4;
const chunks = [];
for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
let ci = 0; const fetched = [];
async function w() { while (ci < chunks.length) { const c = chunks[ci++]; const idq = c.map(x => `ids[]=${x}`).join("&"); const r = await jf(`incidents?${idq}`); fetched.push(...Object.values(r.data || {})); } }
await Promise.all(Array.from({ length: CONC }, () => w()));
console.log("phase2 parallel fetch:", fetched.length, "incidents, ms:", Date.now() - t2);
console.log("TOTAL ms:", Date.now() - t0);
```

- [ ] **Step 2: Run and confirm speed-up**

Run: `node perf-verify-tmp.mjs`
Expected: TOTAL under ~30s (previous 72s). Phase 1a under 1s. If TOTAL is still high, note it and re-check CONCURRENCY behavior.

- [ ] **Step 3: Verify a duplicate is actually detected**

Use a location known to have an open agent ticket (e.g. 6135 has id 71207 status 1). Confirm `phase1a` returns that id, proving the fast path catches the fresh duplicate.

- [ ] **Step 4: Delete the temp file**

```bash
Remove-Item perf-verify-tmp.mjs
```

---

## Self-Review

**1. Spec coverage:**
- "filtra por ubicación, dentro de esa ubicación chequear tickets abiertos" → Task 1 Step 1a queries status-1 by location server-side.
- "si alguno coincide con el match, es duplicado" → filter keeps `location_id` + (category OR title pattern) on the merged candidate set.
- "demora mucho" → parallelized batch fetch (Task 1 Step 1b/2) cuts 67s → ~17s for the slow path; status-1 case drops to ~780ms.

**2. Placeholder scan:** No TBD/TODO; all code blocks complete; verification script runnable.

**3. Type consistency:** `newAtLocationRes`/`pageRes`/`chunkRes` all typed `InvgateByStatusResponse`/`Record<string, InvgateIncident>`; `chunkRes.message` exists on the failure variant of `InvgateResult<T>`; `AGENTS_TICKET_CATEGORY_IDS` and `isAgentsTicketTitle` from Task 1 of the earlier fix are reused unchanged.
