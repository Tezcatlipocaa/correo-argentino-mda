# Phone/Internal Display in Office Personnel Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display phone or internal number as plain text in each personnel container within office directory, prioritizing internal number over phone.

**Architecture:** Modify the personnel rendering logic in `OfficeRow.astro` to show a single contact number (internal preferred) as plain text with an icon, removing the existing copy button functionality.

**Tech Stack:** Astro, JavaScript (client-side rendering)

---

## File Structure

Only one file needs modification:

- **Modify:** `src/components/offices/OfficeRow.astro` - Update personnel rendering HTML template (lines ~605-664)

## Tasks

### Task 1: Update personnel rendering in OfficeRow.astro

**Files:**
- Modify: `src/components/offices/OfficeRow.astro:605-664`

- [ ] **Step 1: Replace phone/internal button rendering with plain text logic**

Replace the current phone and internal button rendering section (lines 616-645) with logic that:
1. Determines which number to display (internal if exists, otherwise phone)
2. Displays the number as plain text with an appropriate icon

Current code to replace (lines 616-645):
```javascript
${
  p.telefono
    ? `
  <button
    type="button"
    class="btn btn-ghost btn-xs gap-1 text-accent"
    onclick="copyValue('${escapeHTML(p.telefono)}', this)"
    title="Copiar teléfono: ${escapeHTML(p.telefono)}"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
    <span class="font-mono text-xs">${escapeHTML(p.telefono)}</span>
  </button>
`
    : ""
}
${
  p.interno
    ? `
  <button
    type="button"
    class="btn btn-ghost btn-xs gap-1 text-info"
    onclick="copyValue('${escapeHTML(p.interno)}', this)"
    title="Copiar interno: ${escapeHTML(p.interno)}"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
    <span class="font-mono text-xs">${escapeHTML(p.interno)}</span>
  </button>
`
    : ""
}
```

New code to implement:
```javascript
${
  (p.interno || p.telefono)
    ? `
  <div class="flex items-center gap-1 text-xs text-base-content/70">
    <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
    <span class="font-mono">${escapeHTML(p.interno ?? p.telefono)}</span>
  </div>
`
    : ""
}
```

- [ ] **Step 2: Add wrap handling with top margin for the role badge**

The name/position paragraph currently uses `truncate`, which prevents wrapping and clips long role badges. Change it to a flex-wrap container so a long role badge wraps below the user's name, with a small vertical gap applied only when wrapping occurs (e.g. when the number is also rendered, or the role text is long).

Current code (lines 608-614):
```javascript
<div class="flex items-center justify-between gap-3 py-2 border-b border-base-200 last:border-b-0">
  <div class="min-w-0">
    <p class="text-xs font-semibold text-base-content truncate">
      ${escapeHTML(p.fullname ?? "Sin nombre")}
      ${p.position ? `<span class="badge badge-soft badge-secondary text-xxs ml-1 align-middle">${escapeHTML(p.position)}</span>` : ""}
    </p>
  </div>
```

New code:
```javascript
<div class="flex items-center justify-between gap-3 py-2 border-b border-base-200 last:border-b-0">
  <div class="min-w-0">
    <p class="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs font-semibold text-base-content">
      <span class="truncate min-w-0">${escapeHTML(p.fullname ?? "Sin nombre")}</span>
      ${p.position ? `<span class="badge badge-soft badge-secondary text-xxs">${escapeHTML(p.position)}</span>` : ""}
    </p>
  </div>
```

Why this works:
- `flex flex-wrap items-center` — name and badge become flex items; when the container is too narrow (number present and/or long role text), the badge wraps to a second line below the name.
- `gap-x-1 gap-y-0.5` — horizontal gap on the same line; `gap-y-0.5` (2px) is the small top margin, applied only when the badge sits on a new line below the name.
- `ml-1 align-middle` removed from the badge — replaced by `gap-x-1` + `items-center`.
- `truncate min-w-0` on the name span keeps ellipsis for long names while letting the badge wrap independently.

- [ ] **Step 3: Remove the copyValue function (no longer needed)**

The `copyValue` function (lines 684-697) is no longer needed since we're removing copy functionality. Remove it along with the related `showToast` function (lines 699-723) if no other code references it.

Check if `showToast` is used elsewhere in the file before removing.

- [ ] **Step 4: Test the change**

1. Run the dev server: `npm run dev`
2. Navigate to the offices directory
3. Expand an office that has personnel assigned
4. Verify that personnel entries show:
   - Internal number (if exists) with chat bubble icon
   - Phone number (if no internal exists) with chat bubble icon
   - No copy buttons
   - Plain text display
5. Verify role badge wrapping:
   - Find a personnel entry with a very long role text (or narrow the panel) and confirm the badge wraps below the name with a small top margin (`gap-y-0.5`).
   - Confirm that when the badge fits on the same line as the name, there is no extra top margin (only the 4px horizontal `gap-x-1`).

- [ ] **Step 5: Commit the changes**

```bash
git add src/components/offices/OfficeRow.astro
git commit -m "feat: display phone/internal as plain text in office personnel

Show internal number prioritized over phone number as plain text
with icon in personnel containers within office directory.
Remove copy button functionality and add wrap-safe role badge."
```

---

## Notes

- The icon used is the chat bubble icon (same as previously used for internal numbers) to represent contact information
- The logic prioritizes `interno` over `telefono` as requested
- The `font-mono` class is preserved for number readability
- The role badge uses `flex flex-wrap gap-y-0.5` so it gets a 2px top margin only when it wraps below the user's name; when it fits inline there is only the 4px `gap-x-1` horizontal spacing
- No changes to the API or data fetching logic are needed
