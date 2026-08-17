# Mesa de Ayuda Editor — Form Standardization & Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Componentize the mesa-de-ayuda editor with consistent field styling, replace the categories/topics/contacts textareas with proper controls (InvGate-backed multi-select + free-text tags), and remove contacts entirely.

**Architecture:** Two new reusable form primitives (`MultiSelectField.astro`, `TagInputField.astro`) built on existing daisyUI form patterns (`fieldset` + `FormLegend`, `input`, `badge`, `menu`). A small pure-parse helper (`@lib/supportGuides.ts`) centralizes categories/topics JSON parsing (unit-tested). The editor and helpdesk card modal both resolve InvGate category IDs → names via the `categories` endpoint.

**Tech Stack:** Astro 7 SSR, Tailwind v4 + daisyUI 5, Drizzle ORM + SQLite, vanilla JS component scripts, Playwright E2E, `node --import tsx --test` unit tests.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/types/invgate.ts` (modify) | Add `InvgateCategory` type |
| `src/lib/supportGuides.ts` (create) | Pure parsers `parseCategoryIds`, `parseTopics` |
| `src/lib/supportGuides.test.ts` (create) | Unit tests for parsers |
| `src/components/ui/forms/MultiSelectField.astro` (create) | Searchable multi-select primitive |
| `src/components/ui/forms/TagInputField.astro` (create) | Free-text tag primitive |
| `tests/multi-select-field.test.mjs` (create) | Static daisyUI class assertions |
| `tests/tag-input-field.test.mjs` (create) | Static daisyUI class assertions |
| `src/pages/mesas-de-ayuda/edit.astro` (modify) | Wire new controls + drop contacts |
| `src/components/soportes/SoportesPublicContent.astro` (modify) | Fetch categories once, pass name map |
| `src/components/soportes/HelpdeskCard.astro` (modify) | Render category names, drop contacts |
| `src/db/schema.ts` (modify) | Drop `supportGuides.contacts` column |
| `tests/mesas-ayuda-editor.spec.ts` (create) | E2E editor + card modal |

---

## Task 1: `InvgateCategory` type + parsing helpers

**Files:**
- Modify: `src/types/invgate.ts`
- Create: `src/lib/supportGuides.ts`
- Test: `src/lib/supportGuides.test.ts`

- [ ] **Step 1: Add `InvgateCategory` type**

In `src/types/invgate.ts`, add after `InvgateKbCategory` (line ~110):

```typescript
export interface InvgateCategory {
  id: number;
  name: string;
  parent_id?: number | null;
}
```

- [ ] **Step 2: Write failing unit tests**

Create `src/lib/supportGuides.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCategoryIds, parseTopics } from "./supportGuides";

test("parseCategoryIds returns integer IDs from JSON array", () => {
  assert.deepEqual(parseCategoryIds("[5, 12, 23]"), [5, 12, 23]);
});

test("parseCategoryIds returns [] on invalid input", () => {
  assert.deepEqual(parseCategoryIds("not json"), []);
  assert.deepEqual(parseCategoryIds(null), []);
  assert.deepEqual(parseCategoryIds(undefined), []);
  assert.deepEqual(parseCategoryIds(""), []);
});

test("parseCategoryIds filters non-positive and non-integer values", () => {
  assert.deepEqual(parseCategoryIds("[5, -1, 0, 2.5, 12]"), [5, 12]);
});

test("parseTopics returns trimmed strings from JSON array", () => {
  assert.deepEqual(parseTopics('["VPN", " Correo ", "Hardware"]'), [
    "VPN",
    "Correo",
    "Hardware",
  ]);
});

test("parseTopics falls back to comma split when not JSON", () => {
  assert.deepEqual(parseTopics("VPN, Correo, Hardware"), [
    "VPN",
    "Correo",
    "Hardware",
  ]);
});

test("parseTopics returns [] on empty input", () => {
  assert.deepEqual(parseTopics(null), []);
  assert.deepEqual(parseTopics(""), []);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --import tsx --test src/lib/supportGuides.test.ts`

Expected: FAIL — `Cannot find module './supportGuides'`.

- [ ] **Step 4: Implement the parsers**

Create `src/lib/supportGuides.ts`:

```typescript
export function parseCategoryIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    return [];
  }
}

export function parseTopics(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => String(v).trim())
      .filter(Boolean);
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --import tsx --test src/lib/supportGuides.test.ts`

Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/invgate.ts src/lib/supportGuides.ts src/lib/supportGuides.test.ts
git commit -m "feat(support-guides): add InvgateCategory type and parse helpers"
```

---

## Task 2: `MultiSelectField` primitive

**Files:**
- Create: `src/components/ui/forms/MultiSelectField.astro`
- Test: `tests/multi-select-field.test.mjs`

- [ ] **Step 1: Create the component**

Create `src/components/ui/forms/MultiSelectField.astro`:

```astro
---
import type { HTMLAttributes } from "astro/types";
import { Icon } from "astro-icon/components";
import FormLegend from "@components/ui/forms/FormLegend.astro";

interface Option {
  value: string;
  label: string;
}

interface Props extends HTMLAttributes<"div"> {
  id: string;
  name: string;
  label: string;
  options?: Option[];
  selected?: string[];
  helpText?: string;
  required?: boolean;
  placeholder?: string;
}

const {
  id,
  name,
  label,
  options = [],
  selected = [],
  helpText,
  required = false,
  placeholder = "Buscar…",
  class: className = "",
} = Astro.props;

const selectedSet = new Set(selected);
---

<fieldset
  class:list={["fieldset", className]}
  data-multiselect-root
  data-name={name}
>
  <FormLegend class="font-bold tracking-wider">
    {label}
    {required && <span class="text-error">*</span>}
  </FormLegend>

  <div class="flex flex-wrap gap-1.5" data-multiselect-chips>
    {
      options
        .filter((o) => selectedSet.has(o.value))
        .map((o) => (
          <span class="badge badge-neutral gap-1" data-multiselect-chip data-value={o.value}>
            <span data-multiselect-chip-label>{o.label}</span>
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              data-multiselect-remove={o.value}
              aria-label={`Quitar ${o.label}`}
            >
              <Icon name="boxicons:x" size={12} />
            </button>
            <input type="hidden" name={name} value={o.value} />
          </span>
        ))
    }
  </div>

  <div class="relative mt-2">
    <input
      type="text"
      id={id}
      class="input input-bordered input-sm w-full"
      data-multiselect-search
      placeholder={placeholder}
      autocomplete="off"
      role="combobox"
      aria-expanded="false"
    />
    <ul
      class="menu bg-base-100 border-base-300 absolute top-full z-50 mt-1 hidden max-h-48 w-full overflow-y-auto rounded-box border shadow-lg"
      data-multiselect-list
      role="listbox"
    >
      {options.map((o) => (
        <li data-multiselect-option data-value={o.value} data-label={o.label}>
          <button type="button" role="option" data-value={o.value}>
            {o.label}
          </button>
        </li>
      ))}
    </ul>
  </div>

  {
    helpText && (
      <p class="fieldset-label text-base-content/50 text-xs">{helpText}</p>
    )
  }
</fieldset>

<template data-multiselect-chip-tpl>
  <span class="badge badge-neutral gap-1" data-multiselect-chip>
    <span data-multiselect-chip-label></span>
    <button
      type="button"
      class="btn btn-ghost btn-xs btn-circle"
      data-multiselect-remove
      aria-label="Quitar"
    >
      <Icon name="boxicons:x" size={12} />
    </button>
    <input type="hidden" data-multiselect-hidden />
  </span>
</template>

<script>
  function initMultiSelect(root: HTMLElement) {
    if (root.dataset.initialized === "true") return;
    root.dataset.initialized = "true";

    const name = root.dataset.name || "";
    const chips = root.querySelector<HTMLElement>("[data-multiselect-chips]");
    const search = root.querySelector<HTMLInputElement>(
      "[data-multiselect-search]",
    );
    const list = root.querySelector<HTMLElement>("[data-multiselect-list]");
    const tpl = document.querySelector<HTMLTemplateElement>(
      "[data-multiselect-chip-tpl]",
    );
    if (!chips || !search || !list) return;

    const selected = new Set<string>();
    const labelMap = new Map<string, string>();
    const optionEls = new Map<string, HTMLElement>();

    list.querySelectorAll<HTMLElement>("[data-multiselect-option]").forEach((li) => {
      const v = li.dataset.value || "";
      optionEls.set(v, li);
      labelMap.set(v, li.dataset.label || v);
    });

    chips.querySelectorAll<HTMLElement>("[data-multiselect-chip]").forEach((chip) => {
      const v = chip.dataset.value || "";
      if (v) selected.add(v);
    });

    let query = "";

    function renderOptions() {
      optionEls.forEach((li, v) => {
        const label = (labelMap.get(v) || "").toLowerCase();
        const matches = !query || label.includes(query);
        li.hidden = selected.has(v) || !matches;
      });
    }

    function renderChips() {
      chips.replaceChildren();
      selected.forEach((v) => {
        const chip = tpl
          ? (tpl.content.firstElementChild?.cloneNode(true) as HTMLElement)
          : null;
        if (!chip) return;
        chip.dataset.value = v;
        const labelEl = chip.querySelector<HTMLElement>(
          "[data-multiselect-chip-label]",
        );
        if (labelEl) labelEl.textContent = labelMap.get(v) || v;
        const removeBtn = chip.querySelector<HTMLButtonElement>(
          "[data-multiselect-remove]",
        );
        if (removeBtn) {
          removeBtn.dataset.multiselectRemove = v;
          removeBtn.setAttribute("aria-label", `Quitar ${labelMap.get(v) || v}`);
        }
        const hidden = chip.querySelector<HTMLInputElement>(
          "[data-multiselect-hidden]",
        );
        if (hidden) {
          hidden.name = name;
          hidden.value = v;
        }
        chips.appendChild(chip);
      });
    }

    function select(v: string) {
      if (selected.has(v)) return;
      selected.add(v);
      renderChips();
      renderOptions();
    }

    function remove(v: string) {
      if (!selected.has(v)) return;
      selected.delete(v);
      renderChips();
      renderOptions();
    }

    search.addEventListener("input", () => {
      query = search.value.trim().toLowerCase();
      renderOptions();
      open();
    });

    search.addEventListener("focus", open);

    function open() {
      list.classList.remove("hidden");
      search.setAttribute("aria-expanded", "true");
    }

    function close() {
      list.classList.add("hidden");
      search.setAttribute("aria-expanded", "false");
    }

    document.addEventListener("click", (event) => {
      if (event.target instanceof Node && root.contains(event.target)) return;
      close();
    });

    list.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-value]",
      );
      if (!btn || !list.contains(btn)) return;
      const v = btn.dataset.value || "";
      select(v);
      search.value = "";
      query = "";
      renderOptions();
      search.focus();
    });

    chips.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-multiselect-remove]",
      );
      if (!btn || !chips.contains(btn)) return;
      remove(btn.dataset.multiselectRemove || "");
    });

    search.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });

    renderOptions();
  }

  document
    .querySelectorAll<HTMLElement>("[data-multiselect-root]")
    .forEach(initMultiSelect);
  document.addEventListener("astro:page-load", () => {
    document
      .querySelectorAll<HTMLElement>("[data-multiselect-root]")
      .forEach(initMultiSelect);
  });
</script>
```

- [ ] **Step 2: Write static test**

Create `tests/multi-select-field.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const path = "src/components/ui/forms/MultiSelectField.astro";
assert.ok(existsSync(new URL(path, root)), "Expected MultiSelectField.astro to exist");

const src = await read(path);

assert.match(src, /fieldset/, "should use daisyUI fieldset");
assert.match(src, /FormLegend/, "should reuse FormLegend");
assert.match(src, /input input-bordered/, "should use daisyUI input-bordered");
assert.match(src, /badge badge-neutral/, "should use daisyUI badge for chips");
assert.match(src, /menu/, "should use daisyUI menu for the option list");
assert.match(src, /type="hidden"/, "should emit hidden inputs for formData");
assert.doesNotMatch(
  src,
  /[a-z]-\[[a-z0-9]/i,
  "should not use arbitrary Tailwind values with []",
);
assert.match(src, /astro:page-load/, "should re-init on view transitions");
```

- [ ] **Step 3: Run static test**

Run: `node tests/multi-select-field.test.mjs`

Expected: PASS.

- [ ] **Step 4: Build check**

Run: `npm run build`

Expected: build succeeds (component compiles).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/forms/MultiSelectField.astro tests/multi-select-field.test.mjs
git commit -m "feat(forms): add MultiSelectField primitive"
```

---

## Task 3: `TagInputField` primitive

**Files:**
- Create: `src/components/ui/forms/TagInputField.astro`
- Test: `tests/tag-input-field.test.mjs`

- [ ] **Step 1: Create the component**

Create `src/components/ui/forms/TagInputField.astro`:

```astro
---
import type { HTMLAttributes } from "astro/types";
import { Icon } from "astro-icon/components";
import FormLegend from "@components/ui/forms/FormLegend.astro";

interface Props extends HTMLAttributes<"div"> {
  id: string;
  name: string;
  label: string;
  tags?: string[];
  helpText?: string;
  required?: boolean;
  placeholder?: string;
}

const {
  id,
  name,
  label,
  tags = [],
  helpText,
  required = false,
  placeholder = "Escribí y presioná Enter…",
  class: className = "",
} = Astro.props;
---

<fieldset class:list={["fieldset", className]} data-taginput-root data-name={name}>
  <FormLegend class="font-bold tracking-wider">
    {label}
    {required && <span class="text-error">*</span>}
  </FormLegend>

  <div class="flex flex-wrap gap-1.5" data-taginput-chips>
    {tags.map((t) => (
      <span class="badge badge-secondary badge-soft uppercase" data-taginput-chip data-value={t}>
        {t}
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-circle"
          data-taginput-remove={t}
          aria-label={`Quitar ${t}`}
        >
          <Icon name="boxicons:x" size={12} />
        </button>
        <input type="hidden" name={name} value={t} />
      </span>
    ))}
  </div>

  <input
    type="text"
    id={id}
    class="input input-bordered input-sm mt-2 w-full"
    data-taginput-input
    placeholder={placeholder}
    autocomplete="off"
  />

  {
    helpText && (
      <p class="fieldset-label text-base-content/50 text-xs">{helpText}</p>
    )
  }
</fieldset>

<template data-taginput-chip-tpl>
  <span class="badge badge-secondary badge-soft uppercase" data-taginput-chip>
    <span data-taginput-chip-label></span>
    <button
      type="button"
      class="btn btn-ghost btn-xs btn-circle"
      data-taginput-remove
      aria-label="Quitar"
    >
      <Icon name="boxicons:x" size={12} />
    </button>
    <input type="hidden" data-taginput-hidden />
  </span>
</template>

<script>
  function initTagInput(root: HTMLElement) {
    if (root.dataset.initialized === "true") return;
    root.dataset.initialized = "true";

    const name = root.dataset.name || "";
    const chips = root.querySelector<HTMLElement>("[data-taginput-chips]");
    const input = root.querySelector<HTMLInputElement>("[data-taginput-input]");
    const tpl = document.querySelector<HTMLTemplateElement>(
      "[data-taginput-chip-tpl]",
    );
    if (!chips || !input) return;

    const tags = new Set<string>();

    chips.querySelectorAll<HTMLElement>("[data-taginput-chip]").forEach((chip) => {
      const v = chip.dataset.value || "";
      if (v) tags.add(v);
    });

    function renderChips() {
      chips.replaceChildren();
      tags.forEach((t) => {
        const chip = tpl
          ? (tpl.content.firstElementChild?.cloneNode(true) as HTMLElement)
          : null;
        if (!chip) return;
        chip.dataset.value = t;
        const labelEl = chip.querySelector<HTMLElement>("[data-taginput-chip-label]");
        if (labelEl) labelEl.textContent = t;
        const removeBtn = chip.querySelector<HTMLButtonElement>(
          "[data-taginput-remove]",
        );
        if (removeBtn) {
          removeBtn.dataset.taginputRemove = t;
          removeBtn.setAttribute("aria-label", `Quitar ${t}`);
        }
        const hidden = chip.querySelector<HTMLInputElement>("[data-taginput-hidden]");
        if (hidden) {
          hidden.name = name;
          hidden.value = t;
        }
        chips.appendChild(chip);
      });
    }

    function addTag(raw: string) {
      const value = raw.trim().toUpperCase();
      if (!value || tags.has(value)) return;
      tags.add(value);
      renderChips();
    }

    function removeTag(t: string) {
      if (!tags.has(t)) return;
      tags.delete(t);
      renderChips();
    }

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addTag(input.value);
        input.value = "";
      }
    });

    chips.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-taginput-remove]",
      );
      if (!btn || !chips.contains(btn)) return;
      removeTag(btn.dataset.taginputRemove || "");
    });
  }

  document
    .querySelectorAll<HTMLElement>("[data-taginput-root]")
    .forEach(initTagInput);
  document.addEventListener("astro:page-load", () => {
    document
      .querySelectorAll<HTMLElement>("[data-taginput-root]")
      .forEach(initTagInput);
  });
</script>
```

- [ ] **Step 2: Write static test**

Create `tests/tag-input-field.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const path = "src/components/ui/forms/TagInputField.astro";
assert.ok(existsSync(new URL(path, root)), "Expected TagInputField.astro to exist");

const src = await read(path);

assert.match(src, /fieldset/, "should use daisyUI fieldset");
assert.match(src, /FormLegend/, "should reuse FormLegend");
assert.match(src, /input input-bordered/, "should use daisyUI input-bordered");
assert.match(
  src,
  /badge badge-secondary badge-soft/,
  "should use daisyUI secondary soft badge for tags",
);
assert.match(src, /type="hidden"/, "should emit hidden inputs for formData");
assert.match(src, /toUpperCase/, "should normalize tags to uppercase");
assert.match(src, /Enter/, "should add tag on Enter key");
assert.doesNotMatch(
  src,
  /[a-z]-\[[a-z0-9]/i,
  "should not use arbitrary Tailwind values with []",
);
```

- [ ] **Step 3: Run static test**

Run: `node tests/tag-input-field.test.mjs`

Expected: PASS.

- [ ] **Step 4: Build check**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/forms/TagInputField.astro tests/tag-input-field.test.mjs
git commit -m "feat(forms): add TagInputField primitive"
```

---

## Task 4: Wire editor frontmatter + form template

**Files:**
- Modify: `src/pages/mesas-de-ayuda/edit.astro`

- [ ] **Step 1: Update imports**

In `src/pages/mesas-de-ayuda/edit.astro`, replace the import block (lines 2-15) so it reads:

```typescript
import { getCleanBase } from "@lib/baseUrl";
import BaseLayout from "@layouts/BaseLayout.astro";
import PageContainer from "@components/ui/PageContainer.astro";
import PageHeader from "@components/ui/PageHeader.astro";
import FormTextarea from "@components/ui/forms/FormTextarea.astro";
import SectionCard from "@components/ui/SectionCard.astro";
import MultiSelectField from "@components/ui/forms/MultiSelectField.astro";
import TagInputField from "@components/ui/forms/TagInputField.astro";
import { Icon } from "astro-icon/components";
import { db } from "@db/index";
import { supportGuides } from "@db/schema";
import { eq, isNull } from "drizzle-orm";
import { logAdminFromAstro } from "@lib/auditLogger";
import { redirectWithToast } from "@lib/api/redirectWithToast";
import { invgateGet } from "@lib/invgateClient";
import { parseCategoryIds, parseTopics } from "@lib/supportGuides";
import type { InvgateHelpdeskAndLevel, InvgateCategory } from "@/types/invgate";
```

(Remove the now-unused `FormField` import if it was present; it is not imported in the current file.)

- [ ] **Step 2: Fetch categories in frontmatter**

After the `hdResult` block (after line ~31, the `linkedHd` definition), add:

```typescript
const catResult = await invgateGet<InvgateCategory[]>("categories");
let categoryOptions: { value: string; label: string }[] = [];
if (catResult.ok) {
  const cats = Array.isArray(catResult.data)
    ? catResult.data
    : (catResult.data as { data?: InvgateCategory[] })?.data;
  if (Array.isArray(cats)) {
    categoryOptions = cats
      .filter((c) => c && c.id != null && c.name)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: String(c.id), label: c.name }));
  }
}
```

- [ ] **Step 3: Compute selected values**

After the `const first = linkedRecords[0];` line (line 56), add:

```typescript
const selectedCategories = parseCategoryIds(first?.categories).map(String);
const topicTags = parseTopics(first?.topics);
```

- [ ] **Step 4: Replace the fields grid in the template**

Replace lines 286-322 (the `<div class="grid grid-cols-1 gap-6 md:grid-cols-2">` containing the four textareas) with:

```astro
        <SectionCard
          title="Metadata de derivación"
          icon="boxicons:tag"
          class="shadow-md"
        >
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <MultiSelectField
              id="categories"
              name="categories"
              label="Categorías de derivación"
              options={categoryOptions}
              selected={selectedCategories}
              helpText="Categorías de InvGate a las que deriva esta mesa."
            />

            <TagInputField
              id="topics"
              name="topics"
              label="Tópicos"
              tags={topicTags}
              helpText="Escribí un tópico y presioná Enter para agregarlo."
            />
          </div>

          <FormTextarea
            id="notes"
            name="notes"
            label="Notas"
            rows={4}
            value={first?.notes || ""}
          />
        </SectionCard>
```

- [ ] **Step 5: Build check**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/pages/mesas-de-ayuda/edit.astro
git commit -m "feat(mesas-ayuda): wire MultiSelectField and TagInputField into editor"
```

---

## Task 5: Update editor POST handler (getAll + drop contacts)

**Files:**
- Modify: `src/pages/mesas-de-ayuda/edit.astro`

- [ ] **Step 1: Replace the field extraction**

Replace lines 72-77 (inside the `if (Astro.request.method === "POST")` block):

```typescript
    const data = await Astro.request.formData();
    const categories = data.get("categories")?.toString() || null;
    const route = categories;
    const topics = data.get("topics")?.toString() || null;
    const contacts = data.get("contacts")?.toString() || null;
    const notes = data.get("notes")?.toString() || null;
```

with:

```typescript
    const data = await Astro.request.formData();
    const categoryIds = data
      .getAll("categories")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0);
    const categories =
      categoryIds.length > 0 ? JSON.stringify(categoryIds) : null;
    const route = categories;
    const topicsArr = data
      .getAll("topics")
      .map((v) => v.toString().trim())
      .filter(Boolean);
    const topics = topicsArr.length > 0 ? JSON.stringify(topicsArr) : null;
    const notes = data.get("notes")?.toString() || null;
```

- [ ] **Step 2: Drop `contacts` from the update branch**

Replace lines 79-91:

```typescript
    if (linkedRecords.length > 0) {
      for (const record of linkedRecords) {
        await db
          .update(supportGuides)
          .set({
            categories,
            route,
            topics,
            contacts,
            notes,
          })
          .where(eq(supportGuides.id, record.id));
      }
    } else {
      await db.insert(supportGuides).values({
        invgate_id: invgateId,
        categories,
        route,
        topics,
        contacts,
        notes,
      });
    }
```

with:

```typescript
    if (linkedRecords.length > 0) {
      for (const record of linkedRecords) {
        await db
          .update(supportGuides)
          .set({
            categories,
            route,
            topics,
            notes,
          })
          .where(eq(supportGuides.id, record.id));
      }
    } else {
      await db.insert(supportGuides).values({
        invgate_id: invgateId,
        categories,
        route,
        topics,
        notes,
      });
    }
```

- [ ] **Step 3: Build check**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/mesas-de-ayuda/edit.astro
git commit -m "feat(mesas-ayuda): persist categories/topics via getAll, drop contacts"
```

---

## Task 6: Card modal category names + drop contacts

**Files:**
- Modify: `src/components/soportes/SoportesPublicContent.astro`
- Modify: `src/components/soportes/HelpdeskCard.astro`

- [ ] **Step 1: Fetch categories once in SoportesPublicContent**

In `src/components/soportes/SoportesPublicContent.astro`, add the type import (line 16 already imports `InvgateHelpdesk`, `InvgateHelpdeskAndLevel`; extend it):

```typescript
import type {
  InvgateHelpdesk,
  InvgateHelpdeskAndLevel,
  InvgateCategory,
} from "@/types/invgate";
```

After the `hdResult` block (after line 31, `const invgateError = !hdResult.ok;`), add:

```typescript
const catResult = await invgateGet<InvgateCategory[]>("categories");
const categoryNames: Record<string, string> = {};
if (catResult.ok) {
  const cats = Array.isArray(catResult.data)
    ? catResult.data
    : (catResult.data as { data?: InvgateCategory[] })?.data;
  if (Array.isArray(cats)) {
    for (const c of cats) {
      if (c && c.id != null && c.name) categoryNames[String(c.id)] = c.name;
    }
  }
}
```

- [ ] **Step 2: Pass `categoryNames` to both `HelpdeskCard` usages**

In the two `<HelpdeskCard ... />` render sites (lines 223-230 and 242-250), add `categoryNames={categoryNames}` to each:

```astro
          <HelpdeskCard
            helpdesk={hd}
            records={records}
            isAdmin={isAdminUser}
            parentName={parentName}
            subLevels={subLevels}
            categoryNames={categoryNames}
            adminOnly={isAdminOnly}
          />
```

and for the hidden one:

```astro
            <HelpdeskCard
              helpdesk={hd}
              records={records}
              isAdmin={isAdminUser}
              parentName={parentName}
              subLevels={subLevels}
              categoryNames={categoryNames}
              isHidden
              adminOnly
            />
```

- [ ] **Step 3: Add `categoryNames` prop to HelpdeskCard**

In `src/components/soportes/HelpdeskCard.astro`, update the `Props` interface and destructure:

```typescript
interface Props {
  helpdesk: InvgateHelpdeskAndLevel;
  records: any[];
  isAdmin: boolean;
  parentName?: string;
  subLevels: InvgateHelpdeskAndLevel[];
  isHidden?: boolean;
  adminOnly?: boolean;
  categoryNames?: Record<string, string>;
}
```

```typescript
const {
  helpdesk,
  records,
  isAdmin,
  parentName,
  subLevels,
  isHidden = false,
  adminOnly = false,
  categoryNames = {},
} = Astro.props;
```

- [ ] **Step 4: Remove `first?.contacts` from searchableText**

Replace the `searchableText` array (lines 81-92) so it no longer references contacts:

```typescript
const searchableText = [
  hdName,
  parentName,
  ...legacyNames,
  topicsList.join(" "),
  first?.notes,
  ...sortedSubLevels.map((sl) => sl.name),
]
  .filter(Boolean)
  .join(" ")
  .toLowerCase();
```

- [ ] **Step 5: Render category names in the modal**

Replace the category IDs badge block (lines 342-349):

```astro
            {categoryIds.map((cid) => (
              <span class="badge badge-xs badge-outline font-mono">
                ID: {cid}
              </span>
            ))}
```

with:

```astro
            {categoryIds.map((cid) => (
              <span class="badge badge-xs badge-outline">
                {categoryNames[String(cid)] ?? `ID: ${cid}`}
              </span>
            ))}
```

- [ ] **Step 6: Remove the contacts block from the modal**

Delete the entire `first?.contacts && (...)` block (lines 353-368).

- [ ] **Step 7: Build check**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/soportes/SoportesPublicContent.astro src/components/soportes/HelpdeskCard.astro
git commit -m "feat(mesas-ayuda): resolve category names and remove contacts from cards"
```

---

## Task 7: Drop `supportGuides.contacts` column

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Remove the column**

In `src/db/schema.ts`, inside `supportGuides` (lines 682-693), remove the line:

```typescript
  contacts: text("contacts"),
```

so the table reads:

```typescript
export const supportGuides = sqliteTable("support_guides", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invgate_id: integer("invgate_id"),
  categories: text("categories"),
  legacyName: text("legacy_name"),
  route: text("route"),
  topics: text("topics"),
  referents: text("referents"),
  notes: text("notes"),
  searchableText: text("searchable_text"),
});
```

- [ ] **Step 2: Verify no remaining references to `supportGuides.contacts`**

Run: `rg "supportGuides\.contacts|contacts: text\\(\"contacts\"\\)|first\?\.contacts|\\.contacts" src`

Expected: no matches referencing the removed column (the `contacts` table for `/admin/contactos` is unrelated and must NOT be touched).

- [ ] **Step 3: Push schema**

Run: `npm run db:push`

Expected: drizzle-kit alters the `support_guides` table, dropping `contacts`.

- [ ] **Step 4: Build check**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(db): drop support_guides.contacts column"
```

---

## Task 8: E2E test + full verification

**Files:**
- Create: `tests/mesas-ayuda-editor.spec.ts`

- [ ] **Step 1: Write the E2E spec**

Create `tests/mesas-ayuda-editor.spec.ts`:

```typescript
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

test("El editor muestra multi-select de categorías y tag input de tópicos", async ({
  page,
}) => {
  await page.goto("/mesas-de-ayuda");

  const editLink = page
    .locator("a[href*='mesas-de-ayuda/edit?invgate_id=']")
    .first();
  if ((await editLink.count()) === 0) {
    test.skip(true, "Sin mesas de ayuda editables (sin rol admin o sin datos)");
  }
  await editLink.click();

  await expect(page.locator("[data-multiselect-root]")).toBeVisible();
  await expect(page.locator("[data-taginput-root]")).toBeVisible();
});

test("El editor no muestra el campo de contactos", async ({ page }) => {
  await page.goto("/mesas-de-ayuda");

  const editLink = page
    .locator("a[href*='mesas-de-ayuda/edit?invgate_id=']")
    .first();
  if ((await editLink.count()) === 0) {
    test.skip(true, "Sin mesas de ayuda editables");
  }
  await editLink.click();

  await expect(page.locator("textarea[name='contacts']")).toHaveCount(0);
  await expect(page.locator("input[name='contacts']")).toHaveCount(0);
});

test("El tag input agrega un tópico con Enter", async ({ page }) => {
  await page.goto("/mesas-de-ayuda");

  const editLink = page
    .locator("a[href*='mesas-de-ayuda/edit?invgate_id=']")
    .first();
  if ((await editLink.count()) === 0) {
    test.skip(true, "Sin mesas de ayuda editables");
  }
  await editLink.click();

  const tagInput = page.locator("[data-taginput-input]");
  await tagInput.fill("VPN");
  await tagInput.press("Enter");

  await expect(
    page.locator("[data-taginput-chip]", { hasText: "VPN" }),
  ).toHaveCount(1);
});
```

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

Expected: server listening on `http://localhost:4321`.

- [ ] **Step 3: Run the new E2E spec**

Run: `npx playwright test tests/mesas-ayuda-editor.spec.ts`

Expected: PASS (with skips allowed if no InvGate data/role).

- [ ] **Step 4: Run unit + static tests**

Run:

```bash
node --import tsx --test src/lib/supportGuides.test.ts
node tests/multi-select-field.test.mjs
node tests/tag-input-field.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Run existing mesas-de-ayuda E2E (regression)**

Run: `npx playwright test tests/mesas-ayuda-ui.spec.ts tests/mesas-ayuda-filters.spec.ts tests/mesas-ayuda-hidden.spec.ts`

Expected: PASS (existing behavior intact; no contact/category regressions).

- [ ] **Step 6: Commit**

```bash
git add tests/mesas-ayuda-editor.spec.ts
git commit -m "test(mesas-ayuda): e2e coverage for editor controls"
```

---

## Self-Review Notes

- **Spec coverage:** Categories multi-select (Tasks 2,4,5), topics tags (Tasks 3,4,5), contacts full removal (Tasks 5,6,7), category names in editor + card modal (Tasks 4,6), componentize with consistent `input-sm`/SectionCard (Tasks 2,3,4). All spec sections covered.
- **Type consistency:** `InvgateCategory` defined Task 1 and used Tasks 4,6. `parseCategoryIds`/`parseTopics` defined Task 1 and used Tasks 4. `categoryNames` prop consistent across Tasks 6 (definition + usage).
- **No placeholders:** every code step has complete code.
