# Mesas de Ayuda — UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five bugs in the "Mesas de Ayuda" (Soportes) section: excessive InvGate requests causing HTTP 429, disappearing icons after filtering, non-responsive action button row, topics not uppercased, and a poorly-separated member-count in level badges.

**Architecture:** The page `src/pages/mesas-de-ayuda/index.astro` renders `SoportesPublicContent.astro` (a `server:defer` island) which renders one `HelpdeskCard.astro` per helpdesk. Client filtering (`applyFiltersAndSort`) removes non-matching cards from the DOM. Two astro-icon/InvGate issues stem from this: (1) astro-icon dedupes repeated icons into a `<symbol>` + `<use>` sprite, and the `<symbol>` lives only in the first card in DOM order — removing cards orphans the `<use>` references; (2) every card eagerly fires a `helpdesk-members` request which does N+1 user lookups server-side, flooding InvGate. Fixes: add `is:inline` to card icons (self-contained SVGs), lazy-load members only on modal open, and cache the incidents endpoint.

**Tech Stack:** Astro SSR, astro-icon v1.1.5, Tailwind v4 + DaisyUI v5, Playwright E2E, InvGate API.

**Prereqs:** Dev server running at `http://localhost:4321` (`npm run dev`). Tests run serial with `npx playwright test` (worker 1). Requires `.env` with InvGate credentials.

---

### Task 1: Fix disappearing icons (astro-icon sprite dedup)

> **Implementation note (deviation):** The `is:inline` approach was tried first and REJECTED — Astro strips `is:inline` from non-`<script>`/`<style>` elements, so it is a no-op on the astro-icon `<Icon>` component. Final fix: keep cards in the DOM during filtering. `applyFiltersAndSort` now toggles the `hidden` class on non-matching cards instead of `removeChild`, so the `<symbol>` sprite holders never leave the DOM and `<use>` references stay valid. CSV export skips cards with the `hidden` class to preserve the "export only visible" behavior.

**Files:**
- Modify: `src/components/soportes/SoportesPublicContent.astro` (filter logic + CSV export)
- Test: `tests/mesas-ayuda-ui.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/mesas-ayuda-ui.spec.ts`:

```ts
import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
  type TestUser,
} from "./helpers/auth";

let adminUser: TestUser;

test.beforeAll(async () => {
  adminUser = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  await cleanupTestUser(adminUser.userId, adminUser.sessionId);
});

test.beforeEach(async ({ context }) => {
  await setSessionCookie(context, adminUser.signedSessionId);
});

test("Los iconos sobreviven al filtrado (sin referencias <use> huerfanas)", async ({
  page,
}) => {
  await page.goto("/mesas-de-ayuda");
  await expect(page.locator("#soportes-search")).toBeVisible();

  await expect(page.locator("svg[data-icon]")).not.toHaveCount(0);

  await page.locator("#filter-status").selectOption("active");

  const orphanedUses = await page.evaluate(() => {
    const ids = new Set(
      Array.from(document.querySelectorAll("symbol")).map((s) => s.id),
    );
    return Array.from(document.querySelectorAll("use")).filter((u) => {
      const href = u.getAttribute("href") || "";
      return href.startsWith("#") && !ids.has(href.slice(1));
    }).length;
  });
  expect(orphanedUses).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts -g "iconos"`
Expected: FAIL — orphaned `<use>` references exist after filtering (a card holding the `<symbol>` was removed).

- [ ] **Step 3: Keep cards in the DOM during filtering**

In `src/components/soportes/SoportesPublicContent.astro`, in `applyFiltersAndSort`, replace the visibility branch so non-matching cards get the `hidden` class instead of being skipped (which previously led to them being removed from the grid):

```diff
      const isVisible = hiddenOnly
        ? cardHidden
        : !cardHidden && matchesSearch && matchesStatus && matchesParent;

-     if (isVisible) {
-       card.classList.remove("hidden");
-       visible.push(card);
-       highlightSearchTargets(card, query);
-     }
+     // Hide non-matching cards instead of removing them from the DOM.
+     // astro-icon dedupes repeated icons into <symbol>/<use> sprites whose
+     // <symbol> lives in the first card; removing cards would orphan the
+     // <use> references and make icons disappear.
+     card.classList.toggle("hidden", !isVisible);
+     if (isVisible) {
+       visible.push(card);
+       highlightSearchTargets(card, query);
+     }
```

And replace the reorder block (no more `removeChild`):

```diff
     if (grid) {
-       cards.forEach((card) => {
-         if (card.parentNode === grid) grid.removeChild(card);
-       });
       visible.forEach((card) => grid.appendChild(card));
     }
```

Also update the CSV export to skip filter-hidden cards (they stay in the DOM now):

```diff
-     const visibleCards = Array.from(cards).filter((c) => c.parentNode === grid);
+     const visibleCards = Array.from(cards).filter(
+       (c) => c.parentNode === grid && !c.classList.contains("hidden"),
+     );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts -g "iconos"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/soportes/SoportesPublicContent.astro tests/mesas-ayuda-ui.spec.ts
git commit -m "fix(soportes): keep cards in DOM during filtering so icons survive"
```

---

### Task 2: Topics always uppercase

**Files:**
- Modify: `src/components/soportes/HelpdeskCard.astro` (topic badge)
- Test: `tests/mesas-ayuda-ui.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/mesas-ayuda-ui.spec.ts`:

```ts
test("Los tópicos se muestran en mayúsculas", async ({ page }) => {
  await page.goto("/mesas-de-ayuda");
  await expect(page.locator("#soportes-search")).toBeVisible();

  const badge = page.locator(".badge-secondary").first();
  if ((await badge.count()) === 0) {
    test.skip(true, "Sin tópicos en los datos de InvGate");
  }
  await expect(badge).toHaveClass(/uppercase/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts -g "tópicos"`
Expected: FAIL — `.badge-secondary` does not have `uppercase` class.

- [ ] **Step 3: Add `uppercase` class to the topic badge**

In `src/components/soportes/HelpdeskCard.astro`, change the topic badge (inside `topicsList.map`):

```diff
  <span
-   class="badge badge-sm badge-secondary badge-soft font-medium"
+   class="badge badge-sm badge-secondary badge-soft font-medium uppercase"
    data-highlight-target
  >
    {t}
  </span>
```

Note: `uppercase` is display-only (CSS `text-transform`). `textContent` stays original-case, so the CSV export in `SoportesPublicContent.astro` (which reads `.badge-secondary` text) is unaffected.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts -g "tópicos"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/soportes/HelpdeskCard.astro tests/mesas-ayuda-ui.spec.ts
git commit -m "fix(soportes): uppercase topics in helpdesk cards"
```

---

### Task 3: Level badge member-count divider

**Files:**
- Modify: `src/components/soportes/HelpdeskCard.astro` (level badge markup)
- Test: `tests/mesas-ayuda-ui.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/mesas-ayuda-ui.spec.ts`:

```ts
test("El contador de miembros de cada nivel tiene un divisor visible", async ({
  page,
}) => {
  await page.goto("/mesas-de-ayuda");
  await expect(page.locator("#soportes-search")).toBeVisible();

  const badge = page.locator("[data-level-badge]").first();
  if ((await badge.count()) === 0) {
    test.skip(true, "Sin niveles de atención en los datos de InvGate");
  }
  await expect(badge.locator("[data-level-divider]")).toHaveCount(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts -g "divisor"`
Expected: FAIL — `[data-level-badge]` does not exist.

- [ ] **Step 3: Restructure the level badge markup**

In `src/components/soportes/HelpdeskCard.astro`, replace the level badge block (currently inside `sortedSubLevels.map`, lines ~189-202):

```jsx
<span
  class:list={[
    "badge badge-sm gap-1.5",
    levelColors[i % levelColors.length],
  ]}
  title={`${sl.total_members} miembros`}
  data-level-badge
>
  <span>{sl.name || `Nivel ${sl.level_order}`}</span>
  <span
    class="h-3 w-px bg-current opacity-40"
    data-level-divider
    aria-hidden="true"
  ></span>
  <span class="font-mono opacity-80">({sl.total_members})</span>
</span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts -g "divisor"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/soportes/HelpdeskCard.astro tests/mesas-ayuda-ui.spec.ts
git commit -m "fix(soportes): add divider between level name and member count"
```

---

### Task 4: Responsive action button row

**Files:**
- Modify: `src/components/soportes/HelpdeskCard.astro` (card-actions container)
- Test: `tests/mesas-ayuda-ui.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/mesas-ayuda-ui.spec.ts`:

```ts
test("La fila de acciones envuelve sin desbordar en anchos angostos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/mesas-de-ayuda");
  await expect(page.locator("#soportes-search")).toBeVisible();

  const actions = page.locator(".card-actions").first();
  await expect(actions).toBeVisible();

  const flexWrap = await actions.evaluate((el) =>
    getComputedStyle(el).flexWrap,
  );
  expect(flexWrap).toBe("wrap");

  const overflows = await actions.evaluate((el) => {
    return el.scrollWidth > el.clientWidth + 1;
  });
  expect(overflows).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts -g "desbordar"`
Expected: FAIL — `flexWrap` is `"nowrap"` (from `sm:flex-nowrap`) and/or overflow detected.

- [ ] **Step 3: Remove `sm:flex-nowrap` from the actions container**

In `src/components/soportes/HelpdeskCard.astro`, change the `card-actions` div (line ~250):

```diff
  <div
-   class="card-actions border-base-200 mt-3 flex-wrap items-center justify-end gap-2 border-t pt-4 sm:flex-nowrap"
+   class="card-actions border-base-200 mt-3 flex-wrap items-center justify-end gap-2 border-t pt-4"
  >
```

The button `flex-1 ... sm:flex-none` classes stay: buttons grow full-width on mobile (`< sm`), and wrap to natural width on larger screens.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts -g "desbordar"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/soportes/HelpdeskCard.astro tests/mesas-ayuda-ui.spec.ts
git commit -m "fix(soportes): allow action buttons to wrap on narrow cards"
```

---

### Task 5: Cache the incidents endpoint (part of 429 fix)

**Files:**
- Modify: `src/pages/api/invgate/incidents-by-helpdesk.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/mesas-ayuda-ui.spec.ts`:

```ts
test("El endpoint de incidentes devuelve caché (no no-store)", async ({
  page,
}) => {
  await page.goto("/mesas-de-ayuda");
  await expect(page.locator("#soportes-search")).toBeVisible();

  const id = await page
    .locator('[data-card-for]')
    .first()
    .getAttribute("data-card-for");
  const resp = await page.request.get(
    `/api/invgate/incidents-by-helpdesk?helpdesk_id=${id}`,
  );
  expect(resp.status()).toBe(200);
  const cacheControl = resp.headers()["cache-control"] ?? "";
  expect(cacheControl).toContain("max-age=300");
  expect(cacheControl).not.toContain("no-store");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts -g "caché"`
Expected: FAIL — `cache-control` is `no-store`.

- [ ] **Step 3: Change the cache-control header**

In `src/pages/api/invgate/incidents-by-helpdesk.ts` (line ~27):

```diff
-    return jsonResponse({ total }, result.status, "no-store");
+    return jsonResponse({ total }, result.status, "private, max-age=300");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts -g "caché"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/invgate/incidents-by-helpdesk.ts tests/mesas-ayuda-ui.spec.ts
git commit -m "fix(soportes): cache incidents-by-helpdesk for 5 minutes"
```

---

### Task 6: Lazy-load helpdesk members on modal open (main 429 fix)

**Files:**
- Modify: `src/components/soportes/HelpdeskCard.astro` ("Ver más" button + `<script>`)
- Test: `tests/mesas-ayuda-ui.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/mesas-ayuda-ui.spec.ts`:

```ts
test("Los miembros se cargan solo al abrir el modal", async ({ page }) => {
  let membersCalls = 0;
  await page.route("**/api/invgate/helpdesk-members*", (route) => {
    membersCalls += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        members: ["Ana Perez", "Juan Gomez"],
        levels: [],
      }),
    });
  });

  await page.goto("/mesas-de-ayuda");
  await expect(page.locator("#soportes-search")).toBeVisible();
  await expect(page.locator('[data-card-for]').first()).toBeVisible();

  expect(membersCalls).toBe(0);

  const memberModal = page.locator("dialog [data-members-for]").first();
  if ((await memberModal.count()) === 0) {
    test.skip(true, "Sin secciones de miembros en los datos de InvGate");
  }
  const invgateId = await memberModal.getAttribute("data-members-for");

  await page
    .locator(`[data-card-for="${invgateId}"] [data-open-modal]`)
    .click();
  await expect(page.locator("dialog[open]")).toBeVisible();

  expect(membersCalls).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts -g "al abrir el modal"`
Expected: FAIL — `membersCalls` is > 0 on page load (eager fetch still present).

- [ ] **Step 3: Add data attributes to the "Ver más" button**

In `src/components/soportes/HelpdeskCard.astro`, replace the "Ver más" button (lines ~270-277):

```diff
  <button
    type="button"
    class="btn btn-sm btn-ghost border-base-300 flex-1 gap-1 border sm:flex-none"
-   onclick={`document.getElementById('${modalId}').showModal()`}
+   data-open-modal={modalId}
+   data-helpdesk-id={helpdesk.id}
  >
-   <Icon name="boxicons:info-circle" size={16} aria-hidden="true" />
+   <Icon name="boxicons:info-circle" size={16} is:inline aria-hidden="true" />
    <span>Ver más</span>
  </button>
```

- [ ] **Step 4: Replace the eager members-fetch block with a lazy loader**

In `src/components/soportes/HelpdeskCard.astro`, replace the entire members-fetch block (the `document.querySelectorAll<HTMLElement>("[data-members-for]").forEach(...)` block at lines ~492-541) with:

```js
  const loadedMembers = new Set<string>();

  async function loadMembers(invgateId: string) {
    const container = document.querySelector<HTMLElement>(
      `[data-members-for="${invgateId}"]`,
    );
    if (!container) return;
    const list = container.querySelector<HTMLElement>("[data-members-list]");
    if (!list || loadedMembers.has(invgateId)) return;
    loadedMembers.add(invgateId);

    try {
      const res = await fetch(
        `${cleanBase}api/invgate/helpdesk-members?invgate_id=${invgateId}`,
      );
      const data = await res.json();
      if (data.members && data.members.length > 0) {
        list.innerHTML = data.members
          .map((m: string) => {
            const initials = getInitials(m);
            return `
              <div class="flex items-center gap-2.5 p-2 rounded-lg bg-base-200/50 border border-base-200 text-sm">
                <div class="avatar placeholder shrink-0">
                  <div class="bg-secondary/15 text-secondary rounded-full w-7 h-7 flex items-center justify-center font-bold text-xs">
                    <span>${initials}</span>
                  </div>
                </div>
                <span class="font-medium text-base-content" data-highlight-target>${m}</span>
              </div>
            `;
          })
          .join("");

        const cardEl = document.querySelector<HTMLElement>(
          `[data-card-for="${invgateId}"]`,
        );
        if (cardEl) {
          const existing = cardEl.dataset.searchText || "";
          const membersText = data.members.join(" ").toLowerCase();
          if (!existing.includes(membersText)) {
            cardEl.dataset.searchText = existing + " " + membersText;
          }
          cardEl.dispatchEvent(new Event("members-loaded"));
        }
      } else {
        list.innerHTML = `
          <div class="p-3 text-center text-xs text-base-content/50 italic bg-base-200/30 rounded-lg">
            Sin miembros registrados en InvGate
          </div>
        `;
      }
    } catch {
      list.innerHTML = `
        <div class="p-3 text-center text-xs text-error/70 italic bg-error/10 rounded-lg">
          Error al cargar miembros
        </div>
      `;
    }
  }

  document.querySelectorAll<HTMLElement>("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.dataset.openModal;
      const invgateId = btn.dataset.helpdeskId;
      if (modalId) {
        const modal = document.getElementById(
          modalId,
        ) as HTMLDialogElement | null;
        modal?.showModal();
      }
      if (invgateId) loadMembers(invgateId);
    });
  });
```

Keep `getInitials` (already defined above this block) unchanged. The `members-loaded` event still re-triggers `applyFiltersAndSort` in `SoportesPublicContent.astro`, so member names become searchable after the modal is opened.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts -g "al abrir el modal"`
Expected: PASS

- [ ] **Step 6: Run the full UI spec**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/soportes/HelpdeskCard.astro tests/mesas-ayuda-ui.spec.ts
git commit -m "fix(soportes): lazy-load members on modal open to avoid InvGate 429"
```

---

### Task 7: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full soportes test suite**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts tests/mesas-ayuda-filters.spec.ts tests/mesas-ayuda-hidden.spec.ts`
Expected: all PASS.

- [ ] **Step 2: Manual smoke check**

Open `http://localhost:4321/mesas-de-ayuda`:
- Filter by status and by search repeatedly — no `429` console errors, icons (git-branch, action buttons) persist.
- Shrink window to ~768px — action buttons wrap inside the card, no horizontal overflow.
- Topics render in uppercase.
- Level badges show name, a thin divider, then `(count)`.

- [ ] **Step 3: Commit any leftover changes (if any)**

```bash
git status
git add -A
git commit -m "test(soportes): regression pass for mesas de ayuda UI fixes"
```
