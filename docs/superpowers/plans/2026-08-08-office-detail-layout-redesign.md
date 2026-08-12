# Office Detail Dropdown — Reorden Dinámico de Secciones (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the office detail dropdown in `/oficinas` into a dynamic 3-column layout (info | center | equipos), moving Contacts to the center column when >5 records and switching equipment cards to a compact vertical design only when the center column exists.

**Architecture:** Extract pure layout decision logic into a testable helper (`src/lib/officeLayout.ts`); extract the Contacts section and the equipment card into reusable Astro components; rewire `OfficeRow.astro` to render columns conditionally based on the helper's flags and width classes. All logic decisions (which columns, which widths, compact mode) live in the pure helper.

**Tech Stack:** Astro SSR, TypeScript, daisyUI 5 / Tailwind v4, `node --import tsx --test` for unit tests, Playwright for E2E.

---

## Context for the Engineer

- The office directory detail dropdown lives in `src/components/offices/OfficeRow.astro` (currently ~820 lines). The detail panel (lines ~260-647) is a `flex flex-col lg:flex-row gap-6` with up to 2 columns: a left "info" column (`lg:w-2/5`) and a right "Equipos" column (`lg:w-3/5`).
- Design spec (source of truth): `docs/superpowers/specs/2026-08-08-office-detail-layout-redesign.md`. Read it.
- Layout decision rules (from the spec):
  - `contactsCount > 5` → Contacts section moves to the center column; otherwise it stays in the left column.
  - Center column exists when `hasSiblings` OR `contactsCount > 5`.
  - Left column renders when: `hasInvgateDetail` OR `hasInfo` OR contacts stay in left. Personal placeholder always lives in left but only shows when left renders.
  - Left column section order: **Información → Datos InvGate → Personal → Contactos (si ≤5)**.
  - Equipos cards: **compact vertical** (IP below hostname) ONLY when the center column exists (3-col layout). Otherwise keep the current horizontal card (IP to the right).
  - Equipos gets `max-height` + internal scroll only in the compact (3-col) mode.
- Column width classes per combination: L+C+R → `lg:flex-[2]` / `lg:flex-[1]` / `lg:flex-[2]`; L+R → `lg:w-2/5` / `lg:w-3/5`; L+C → `lg:flex-[3]` / `lg:flex-[2]`; C+R → `lg:flex-[2]` / `lg:flex-[3]`; single column → `w-full`.
- Existing data attributes are a test contract: `data-sibling-office`, `data-sibling-code`, `data-copy-control`, `data-copy-value`. Keep them.
- The project has ~70 PRE-EXISTING errors in `npx astro check` (drizzle/schema.ts, admin components, test files, and an `@types/offices` resolution failure in OfficeRow). Do NOT fix them. Only ensure your changes add no NEW errors.

---

## File Structure

- **Create** `src/lib/officeLayout.ts` — pure `getDetailColumnLayout()` returning flags + width classes (no imports that break tsx runtime; only `import type`).
- **Create** `src/lib/officeLayout.test.ts` — unit tests for the pure helper.
- **Create** `src/components/offices/OfficeContactsSection.astro` — the Contacts section block (extracted, reused in left or center column).
- **Create** `src/components/offices/OfficeEquipmentCard.astro` — one equipment card, `compact` prop switches vertical/horizontal layout.
- **Create** `tests/office-detail-layout.spec.ts` — E2E for 3-col layout + compact assets.
- **Modify** `src/components/offices/OfficeRow.astro` — wire helper, reorder left column, add center column, conditional Equipos.

---

### Task 1: Pure layout helper + unit tests (TDD)

**Files:**
- Create: `src/lib/officeLayout.ts`
- Create: `src/lib/officeLayout.test.ts`

- [ ] **Step 1: Write the failing unit test**

`src/lib/officeLayout.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDetailColumnLayout } from "./officeLayout";

const flags = (overrides: Partial<Parameters<typeof getDetailColumnLayout>[0]> = {}) => ({
  hasInvgate: false,
  hasInfo: false,
  contactsCount: 0,
  hasSiblings: false,
  hasAssets: false,
  ...overrides,
});

test("3-column layout: left + center + right → flex 2/1/2, compact assets", () => {
  const l = getDetailColumnLayout(flags({ hasInfo: true, hasSiblings: true, hasAssets: true }));
  assert.equal(l.hasLeft, true);
  assert.equal(l.hasCenter, true);
  assert.equal(l.hasRight, true);
  assert.equal(l.leftClass, "lg:flex-[2]");
  assert.equal(l.centerClass, "lg:flex-[1]");
  assert.equal(l.rightClass, "lg:flex-[2]");
  assert.equal(l.compactAssets, true);
});

test("2-column layout: left + right only → w-2/5 / w-3/5, not compact", () => {
  const l = getDetailColumnLayout(flags({ hasInfo: true, hasAssets: true }));
  assert.equal(l.hasCenter, false);
  assert.equal(l.leftClass, "lg:w-2/5");
  assert.equal(l.rightClass, "lg:w-3/5");
  assert.equal(l.compactAssets, false);
});

test("left + center only → flex 3/2", () => {
  const l = getDetailColumnLayout(flags({ hasInfo: true, hasSiblings: true }));
  assert.equal(l.hasRight, false);
  assert.equal(l.leftClass, "lg:flex-[3]");
  assert.equal(l.centerClass, "lg:flex-[2]");
});

test("center + right only → flex 2/3", () => {
  const l = getDetailColumnLayout(flags({ hasSiblings: true, hasAssets: true }));
  assert.equal(l.hasLeft, false);
  assert.equal(l.centerClass, "lg:flex-[2]");
  assert.equal(l.rightClass, "lg:flex-[3]");
});

test("single column: only assets → right w-full", () => {
  const l = getDetailColumnLayout(flags({ hasAssets: true }));
  assert.equal(l.leftClass, "");
  assert.equal(l.centerClass, "");
  assert.equal(l.rightClass, "w-full");
});

test("single column: only center (siblings) → center w-full", () => {
  const l = getDetailColumnLayout(flags({ hasSiblings: true }));
  assert.equal(l.centerClass, "w-full");
});

test("contacts > 5 moves contacts to center and enables compact assets only with center", () => {
  const l = getDetailColumnLayout(flags({ hasInfo: true, contactsCount: 6, hasAssets: true }));
  assert.equal(l.hasCenter, true);
  assert.equal(l.contactsToCenter, true);
  assert.equal(l.compactAssets, true);
  assert.equal(l.hasLeft, true); // invgate/info still render left
});

test("contacts === 5 stays in left, no center", () => {
  const l = getDetailColumnLayout(flags({ hasInfo: true, contactsCount: 5, hasAssets: true }));
  assert.equal(l.contactsToCenter, false);
  assert.equal(l.hasCenter, false);
  assert.equal(l.compactAssets, false);
});

test("left does not render when only siblings exist", () => {
  const l = getDetailColumnLayout(flags({ hasSiblings: true, hasAssets: true }));
  assert.equal(l.hasLeft, false);
});

test("left renders when info present even with contacts moved to center", () => {
  const l = getDetailColumnLayout(flags({ hasInfo: true, contactsCount: 8 }));
  assert.equal(l.hasLeft, true);
  assert.equal(l.hasCenter, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/officeLayout.test.ts`
Expected: error `Cannot find module './officeLayout'`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/officeLayout.ts`:

```ts
export interface DetailColumnFlags {
  hasInvgate: boolean;
  hasInfo: boolean;
  contactsCount: number;
  hasSiblings: boolean;
  hasAssets: boolean;
}

export interface DetailColumnLayout {
  hasLeft: boolean;
  hasCenter: boolean;
  hasRight: boolean;
  leftClass: string;
  centerClass: string;
  rightClass: string;
  contactsToCenter: boolean;
  compactAssets: boolean;
}

export function getDetailColumnLayout(
  flags: DetailColumnFlags,
): DetailColumnLayout {
  const contactsToCenter = flags.contactsCount > 5;
  const leftContacts = flags.contactsCount > 0 && !contactsToCenter;

  const hasLeft = flags.hasInvgate || flags.hasInfo || leftContacts;
  const hasCenter = flags.hasSiblings || contactsToCenter;
  const hasRight = flags.hasAssets;

  const columnCount = (hasLeft ? 1 : 0) + (hasCenter ? 1 : 0) + (hasRight ? 1 : 0);

  let leftClass = "";
  let centerClass = "";
  let rightClass = "";

  if (columnCount === 1) {
    if (hasLeft) leftClass = "w-full";
    if (hasCenter) centerClass = "w-full";
    if (hasRight) rightClass = "w-full";
  } else if (hasLeft && hasCenter && hasRight) {
    leftClass = "lg:flex-[2]";
    centerClass = "lg:flex-[1]";
    rightClass = "lg:flex-[2]";
  } else if (hasLeft && hasRight) {
    leftClass = "lg:w-2/5";
    rightClass = "lg:w-3/5";
  } else if (hasLeft && hasCenter) {
    leftClass = "lg:flex-[3]";
    centerClass = "lg:flex-[2]";
  } else if (hasCenter && hasRight) {
    centerClass = "lg:flex-[2]";
    rightClass = "lg:flex-[3]";
  }

  return {
    hasLeft,
    hasCenter,
    hasRight,
    leftClass,
    centerClass,
    rightClass,
    contactsToCenter,
    compactAssets: hasCenter,
  };
}
```

Note: `import type` only (nothing imported here), so the file runs under `tsx` with no alias resolution needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/officeLayout.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/officeLayout.ts src/lib/officeLayout.test.ts
git commit -m "feat: add pure dynamic column layout helper for office detail"
```

---

### Task 2: Extract Contacts section into a component

**Files:**
- Create: `src/components/offices/OfficeContactsSection.astro`
- Modify: `src/components/offices/OfficeRow.astro`

- [ ] **Step 1: Create the component**

`src/components/offices/OfficeContactsSection.astro`:

```astro
---
import { Icon } from "astro-icon/components";
import type { OfficeContact } from "@types/offices";

interface Props {
  contacts: OfficeContact[];
  dense?: boolean;
}

const { contacts, dense = false } = Astro.props;
---

<section class="min-w-0 space-y-3">
  <h2 class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-base-content/70">
    <Icon
      name="boxicons:user-filled"
      size={16}
      class="text-secondary"
      aria-hidden="true"
    />
    Contactos
  </h2>

  <div
    class={dense
      ? "grid gap-3"
      : "grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-3"}
  >
    {contacts.map((contact) => (
      <article class="rounded-lg border border-base-300 bg-base-100/50 p-3 shadow-sm">
        <h3 class="truncate text-sm font-semibold text-base-content">
          {contact.name}
        </h3>
        <div class="mt-3 space-y-2 text-xs text-base-content/70">
          {contact.timeSlot && (
            <p class="flex items-center gap-2">
              <Icon
                name="boxicons:clock-filled"
                size={14}
                class="shrink-0 text-base-content/50"
                aria-hidden="true"
              />
              <span>{contact.timeSlot}</span>
            </p>
          )}
          {contact.phone && (
            <p class="flex items-center gap-2">
              <Icon
                name="boxicons:phone-filled"
                size={14}
                class="shrink-0 text-base-content/50"
                aria-hidden="true"
              />
              <span class="font-mono">{contact.phone}</span>
            </p>
          )}
        </div>
      </article>
    ))}
  </div>
</section>
```

- [ ] **Step 2: Replace the inline Contacts block in OfficeRow**

In `src/components/offices/OfficeRow.astro`:
1. Add import: `import OfficeContactsSection from "@components/offices/OfficeContactsSection.astro";` (alphabetically near the other `@components/offices/...` imports, none exist yet — add after the `CopyButton` import).
2. Remove the inline `{hasContacts && ( <section class="min-w-0 space-y-3"> ... Contactos ... </section> )}` block (the one with the `boxicons:user-filled` heading and `office.contacts.map`, currently lines ~476-522).
3. Replace it with:

```astro
                {hasContacts && (
                  <OfficeContactsSection contacts={office.contacts} />
                )}
```

No layout change in this task — Contacts still renders in the same (left) column position.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds (only pre-existing warnings).

- [ ] **Step 4: Commit**

```bash
git add src/components/offices/OfficeContactsSection.astro src/components/offices/OfficeRow.astro
git commit -m "refactor: extract office contacts section into reusable component"
```

---

### Task 3: Dynamic 3-column layout in OfficeRow

**Files:**
- Modify: `src/components/offices/OfficeRow.astro`

- [ ] **Step 1: Wire the layout helper in frontmatter**

Add import (after the `officeHelpers` import block):

```astro
import { getDetailColumnLayout } from "@lib/officeLayout";
```

Replace the current flag block (currently lines ~42-56):

```astro
const hasContacts = office.contacts && office.contacts.length > 0;
const hasInfo = Boolean(office.email || office.notes);
const hasInvgateDetail: boolean = office.invgateLinked === true;
const hasInfoSection = hasContacts || hasInfo || hasInvgateDetail;

const totalAssets =
  (office.assets?.length || 0) + (office.terminals?.length || 0);
const hasAssetsSection = totalAssets > 0;
const siblings = office.siblings ?? [];
const hasSiblings = siblings.length > 0;
const hasLeftColumn = hasInfoSection || hasSiblings;
const hasDetails = hasInfoSection || hasAssetsSection || hasInvgateDetail || hasSiblings;

const activeSectionsCount =
  (hasInfoSection ? 1 : 0) + (hasAssetsSection ? 1 : 0);
```

with:

```astro
const hasContacts = office.contacts && office.contacts.length > 0;
const hasInfo = Boolean(office.email || office.notes);
const hasInvgateDetail: boolean = office.invgateLinked === true;

const totalAssets =
  (office.assets?.length || 0) + (office.terminals?.length || 0);
const hasAssetsSection = totalAssets > 0;
const siblings = office.siblings ?? [];
const hasSiblings = siblings.length > 0;

const layout = getDetailColumnLayout({
  hasInvgate: hasInvgateDetail,
  hasInfo,
  contactsCount: office.contacts.length,
  hasSiblings,
  hasAssets: hasAssetsSection,
});

const contactsToCenter = layout.contactsToCenter;
const hasDetails =
  hasInvgateDetail ||
  hasInfo ||
  hasContacts ||
  hasAssetsSection ||
  hasSiblings;
```

Remove the now-unused `activeSectionsCount` const if present (it is dead code).

- [ ] **Step 2: Restructure the left column**

Change the left column opening (currently `{ hasLeftColumn && (` → `{ layout.hasLeft && (`) and its class list to:

```astro
          {
            layout.hasLeft && (
              <div
                class:list={[
                  "flex flex-col gap-5 min-w-0",
                  layout.leftClass,
                ]}
              >
```

**Reorder sections** inside the left column: move the `{hasInfo && (...)}` block (Información) to the **top**, immediately inside the column div, ABOVE the `{hasInvgateDetail && (...)}` block. Resulting order:

1. `{hasInfo && ( ...Información... )}`  (email/notes)
2. `{hasInvgateDetail && ( ...Datos InvGate... )}`
3. `{/* Personal de la sucursal */}` (unchanged)
4. Contacts: replace the current `{hasContacts && ( <OfficeContactsSection contacts={office.contacts} /> )}` with a left-only condition:

```astro
                {hasContacts && !contactsToCenter && (
                  <OfficeContactsSection contacts={office.contacts} />
                )}
```

- [ ] **Step 3: Add the center column**

Insert a NEW block between the left column and the assets column. It renders the siblings section plus Contacts when moved to center:

```astro
          {
            layout.hasCenter && (
              <div
                class:list={[
                  "flex flex-col gap-5 min-w-0",
                  layout.centerClass,
                ]}
              >
                {hasSiblings && (
                  <section class="space-y-3" data-siblings-section>
                    <h2 class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-base-content/70">
                      <Icon
                        name="boxicons:building-filled"
                        size={16}
                        class="text-secondary"
                        aria-hidden="true"
                      />
                      Oficinas en el mismo edificio ({siblings.length})
                    </h2>
                    <div class="grid gap-3">
                      {siblings.map((sib) => (
                        <div
                          data-sibling-office
                          data-sibling-code={sib.code}
                          data-sibling-type={sib.type}
                          class="flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-100/50 p-3 shadow-sm"
                        >
                          <div class="min-w-0">
                            <p
                              class="truncate text-sm font-semibold text-base-content"
                              title={sib.name}
                            >
                              {sib.name}
                            </p>
                            <p class="text-xxs tracking-wide text-base-content/50">
                              {officeTypeLabelByType[sib.type] || sib.type}
                            </p>
                          </div>
                          <CopyButton
                            value={sib.code}
                            variant="value"
                            feedbackOnly={true}
                            monospace={true}
                            size="xs"
                            appearance="ghost"
                            copiedLabel={`NIS ${sib.code} copiado al portapapeles`}
                            class={`shrink-0 font-semibold ${officeTypeChipClassByType[sib.type] || defaultChipClass}`}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {contactsToCenter && hasContacts && (
                  <OfficeContactsSection
                    contacts={office.contacts}
                    dense={true}
                  />
                )}
              </div>
            )
          }
```

Remove the old `{hasSiblings && (...)}` block that previously lived inside the left column (the one with `boxicons:building-filled`).

- [ ] **Step 4: Update the assets column classes**

Change the assets column opening (currently `{ hasAssetsSection && (` with `class:list={["flex flex-col min-w-0", hasLeftColumn ? "lg:w-3/5" : "w-full"]}`) to:

```astro
          {
            layout.hasRight && (
              <div
                class:list={[
                  "flex flex-col min-w-0",
                  layout.rightClass,
                ]}
              >
```

And the inner grid container class list (currently uses `hasLeftColumn ? ... : ...`) to:

```astro
                  <div
                    class:list={[
                      "grid gap-3 p-1",
                      layout.compactAssets
                        ? "grid-cols-1 xl:grid-cols-2"
                        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3",
                    ]}
                  >
```

- [ ] **Step 5: Verify build + existing tests**

Run: `npm run build` — succeeds.
Run: `npx astro check` — no NEW errors in `OfficeRow.astro` beyond the pre-existing `@types/offices` line-7 failure.
Run: `node --import tsx --test src/lib/officeLayout.test.ts` — PASS.
Run: `node --import tsx --test src/lib/officeSiblings.test.ts` — PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/offices/OfficeRow.astro
git commit -m "feat: dynamic 3-column detail layout with center column for siblings and contacts"
```

---

### Task 4: Conditional compact equipment cards

**Files:**
- Create: `src/components/offices/OfficeEquipmentCard.astro`
- Modify: `src/components/offices/OfficeRow.astro`
- Create: `tests/office-detail-layout.spec.ts`

- [ ] **Step 1: Create the equipment card component**

`src/components/offices/OfficeEquipmentCard.astro`:

```astro
---
import { Icon } from "astro-icon/components";
import CopyButton from "@components/ui/CopyButton.astro";
import type { OfficeAsset, OfficeTerminal } from "@types/offices";
import {
  assetColorByType,
  assetIconByType,
  assetLabelByType,
} from "@lib/officeHelpers";
import {
  getTerminalColorClass,
  getTerminalTypeLabel,
} from "@lib/terminalHelpers";

interface Props {
  terminal?: OfficeTerminal;
  asset?: OfficeAsset;
  compact?: boolean;
  isTelegrafia?: boolean;
}

const { terminal, asset, compact = false, isTelegrafia = false } = Astro.props;
const isTerminal = Boolean(terminal);

const iconClass = isTerminal
  ? getTerminalColorClass(terminal!.operatingSystem, isTelegrafia)
  : assetColorByType[asset!.type];
const iconName = isTerminal
  ? "boxicons:desktop-filled"
  : assetIconByType[asset!.type] || "boxicons:info-circle";
const typeLabel = isTerminal
  ? getTerminalTypeLabel(terminal!.operatingSystem)
  : assetLabelByType[asset!.type];
const hostname = isTerminal ? terminal!.hostname : asset!.hostname;
const ip = isTerminal ? terminal!.ipAddress : asset!.ip;
const showHostname = compact && (isTerminal || asset!.type !== "printer");
---

{
  compact ? (
    <div class="flex items-start gap-2.5 rounded-lg border border-base-300 bg-base-100 p-2.5 shadow-sm min-w-0">
      <span
        class:list={[
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border",
          iconClass,
        ]}
        aria-hidden="true"
      >
        <Icon name={iconName} size={16} />
      </span>
      <div class="min-w-0 flex-1 space-y-1">
        <p class="truncate text-xxs font-medium text-base-content/60">
          {typeLabel}
        </p>
        {showHostname && (
          <p class="truncate font-mono text-xs font-semibold text-base-content">
            {hostname}
          </p>
        )}
        <div class="pt-0.5">
          <CopyButton
            value={ip}
            variant="value"
            monospace={true}
            size="xs"
            appearance="surface"
            class="text-xxs font-medium"
          />
        </div>
      </div>
    </div>
  ) : (
    <div class="flex items-center gap-3 rounded-lg border border-base-300 bg-base-100 p-3 shadow-sm hover:shadow-md transition-shadow min-w-0">
      <span
        class:list={[
          "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border",
          iconClass,
        ]}
        aria-hidden="true"
      >
        <Icon name={iconName} size={18} />
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xxs font-medium text-base-content/60">
          {typeLabel}
        </p>
        <p class="truncate font-mono text-xs font-semibold text-base-content">
          {hostname}
        </p>
      </div>
      <div class="shrink-0 text-right">
        <CopyButton
          value={ip}
          variant="value"
          monospace={true}
          size="xs"
          appearance="surface"
          class="text-xxs font-medium"
        />
      </div>
    </div>
  )
}
```

Notes:
- In compact mode, printers (`asset.type === "printer"`) do not render or reserve a hostname row; the IP copy sits directly under the type label (`showHostname` is false).
- In horizontal mode, behavior is identical to the current card (hostname always shown, IP to the right).

- [ ] **Step 2: Replace the inline equipment cards in OfficeRow**

1. Add import:

```astro
import OfficeEquipmentCard from "@components/offices/OfficeEquipmentCard.astro";
```

2. In the assets grid, replace the entire terminals `.map(...)` block and the entire assets `.map(...)` block (currently lines ~554-641) with:

```astro
                    {/* Terminales sincronizadas */}
                    {[...office.terminals]
                      .sort((a, b) => {
                        const osCompare = (
                          a.operatingSystem || ""
                        ).localeCompare(b.operatingSystem || "");
                        if (osCompare !== 0) return osCompare;
                        return (a.hostname || "").localeCompare(
                          b.hostname || "",
                        );
                      })
                      .map((terminal) => (
                        <OfficeEquipmentCard
                          terminal={terminal}
                          compact={layout.compactAssets}
                          isTelegrafia={office.type === "TELEGRAFIA"}
                        />
                      ))}

                    {/* Activos manuales */}
                    {[...office.assets]
                      .sort(
                        (a, b) =>
                          assetOrderByType[a.type] - assetOrderByType[b.type],
                      )
                      .map((asset) => (
                        <OfficeEquipmentCard
                          asset={asset}
                          compact={layout.compactAssets}
                        />
                      ))}
```

3. Add the compact-mode scroll + test hook. Change the scrollable wrapper div (currently `<div class="flex-1 overflow-y-auto pr-1 min-h-0">`) to:

```astro
                  <div
                    class:list={[
                      "flex-1 overflow-y-auto pr-1 min-h-0",
                      layout.compactAssets && "lg:max-h-[420px]",
                    ]}
                  >
```

And add `data-assets-compact` (value `"true"` when compact) to the grid container div so the E2E test can detect mode:

```astro
                  <div
                    data-assets-compact={layout.compactAssets ? "true" : undefined}
                    class:list={[
                      "grid gap-3 p-1",
                      layout.compactAssets
                        ? "grid-cols-1 xl:grid-cols-2"
                        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3",
                    ]}
                  >
```

Note: `assetOrderByType` is already imported in OfficeRow.

- [ ] **Step 3: Add the E2E layout test**

`tests/office-detail-layout.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("Office detail dropdown dynamic layout", () => {
  test("renders siblings in center column and compact assets when 3-column layout", async ({
    page,
  }) => {
    await page.goto("/oficinas");
    await page.waitForSelector("[data-office-id]", { timeout: 15000 });

    const article = page
      .locator("[data-master-detail-sort-item]:has([data-sibling-office])")
      .first();
    test.skip(
      (await article.count()) === 0,
      "No shared-address offices in the current DB",
    );

    await article.locator("[data-chevron-toggle]").click();
    await expect(article.locator("[data-sibling-office]").first()).toBeVisible();

    // Center column section marker (added in Task 3).
    await expect(article.locator("[data-siblings-section]")).toBeVisible();

    const compactAssets = article.locator("[data-assets-compact]");
    const compactCount = await compactAssets.count();
    test.skip(
      compactCount === 0,
      "No expanded office with assets alongside siblings",
    );
    await expect(compactAssets.first()).toBeVisible();
  });
});
```

- [ ] **Step 4: Verify build + run tests**

Run: `npm run build` — succeeds.
Run: `node --import tsx --test src/lib/officeLayout.test.ts` — PASS.
Run: `node --import tsx --test src/lib/officeSiblings.test.ts` — PASS.

Run E2E (dev server must be running on `http://127.0.0.1:4321`; start with `npm run dev -- --host 127.0.0.1`):
`npx playwright test tests/office-siblings.spec.ts tests/office-detail-layout.spec.ts --reporter=line`
Expected: all tests pass (or skip cleanly where DB lacks data).

- [ ] **Step 5: Commit**

```bash
git add src/components/offices/OfficeEquipmentCard.astro src/components/offices/OfficeRow.astro tests/office-detail-layout.spec.ts
git commit -m "feat: compact vertical equipment cards when 3-column detail layout"
```

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test run**

Run: `node --import tsx --test src/lib/officeLayout.test.ts` and `node --import tsx --test src/lib/officeSiblings.test.ts` — both PASS.
Run: `npm run build` — succeeds.
Run: `npx playwright test tests/office-siblings.spec.ts tests/office-detail-layout.spec.ts --reporter=line` (dev server running) — PASS or clean skip.

- [ ] **Step 2: Manual visual check**

With the dev server running, open `http://127.0.0.1:4321/oficinas`, search `S0000` (Santa Fe, address `MENDOZA 2430`), expand the row, and verify:
1. Three columns: left (Información/Datos InvGate/Personal), center (Oficinas en el mismo edificio), right (Equipos).
2. Left column order: Información (if email/notes present) above Datos InvGate.
3. Center shows the sibling mini cards (name + type-colored NIS).
4. Equipment cards are compact vertical: type label, hostname, IP copy button below the hostname; printers show no hostname row.
5. Equipos area scrolls internally (max-height) instead of stretching the dropdown.
6. An office WITHOUT siblings (e.g. `A0000` Salta, no shared address) keeps the current 2-column layout with horizontal equipment cards and IP to the right.

- [ ] **Step 3: Report**

Confirm in your report that all checks above passed, quoting the test outputs.

---

## Self-Review Notes

- **Spec coverage:** 3-col layout ✓ (Task 3). Información above InvGate ✓ (Task 3 step 2). Contacts to center when >5 ✓ (Task 3). Center = siblings + moved contacts ✓ (Task 3). Compact equipment cards only when center exists ✓ (Task 4, `layout.compactAssets`). Printers no hostname in compact ✓ (Task 4). Equipos max-height scroll only in compact ✓ (Task 4). 2-col keeps current horizontal cards ✓ (Task 4 horizontal branch). Column width matrix ✓ (Task 1 helper). All edge cases in the spec's table map to helper tests ✓.
- **Placeholder scan:** No TBD/TODO. Every code step has full code. Tests have real assertions and exact commands.
- **Type consistency:** `getDetailColumnLayout` signature matches between Task 1 and Task 3. Fields `hasLeft/hasCenter/hasRight/leftClass/centerClass/rightClass/contactsToCenter/compactAssets` used identically in Tasks 3-4. `OfficeContactsSection` props (`contacts`, `dense`) and `OfficeEquipmentCard` props (`terminal`, `asset`, `compact`, `isTelegrafia`) match `OfficeContact` / `OfficeTerminal` / `OfficeAsset` types in `src/types/offices.ts`. `data-sibling-office`, `data-sibling-code`, `data-copy-control` contract preserved across the move to the center column.
