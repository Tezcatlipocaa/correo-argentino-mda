# AGS Tabs Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-architect `AsignacionContent.astro` into a 2-Tab layout: Tab 1 "Asignación Operativa" (full-width 50/50 split of Unassigned Tickets + Queue/History) and Tab 2 "Monitoreo de Operadores" (KPI cards + filters + full DataTable).

**Architecture:** Add a DaisyUI tab navigation bar at top of `AsignacionContent.astro`. Wrap the operative sidebar cards ("Sin Asignar", "Próximos en Cola", "Última Asignación", "Asignar Siguiente") into Tab 1 panel (`#tab-asignacion`), and wrap operator KPIs + control bar + DataTable into Tab 2 panel (`#tab-monitoreo`). Manage tab switching cleanly with CSS classes and JS state.

**Tech Stack:** Astro SSR, DaisyUI v5, Vanilla JS, Tailwind CSS v4.

---

### Task 1: Re-architect Layout & Add DaisyUI Tabs to AsignacionContent.astro

**Files:**
- Modify: `src/components/supervision/asignacion/AsignacionContent.astro`

- [ ] **Step 1: Inspect current layout structure in AsignacionContent.astro**

View lines 350-410 to confirm header section.

- [ ] **Step 2: Add DaisyUI Tabs Header & Tab Panels**

Modify `AsignacionContent.astro` to add:
```html
<div class="flex items-center justify-between mb-6">
  <div class="role-tabs tabs tabs-box bg-base-200/60 p-1.5 rounded-2xl inline-flex gap-1 border border-base-300">
    <button
      type="button"
      id="tab-btn-asignacion"
      data-tab-target="panel-asignacion"
      class="tab tab-active font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition-all flex items-center gap-2"
    >
      <Icon name="boxicons:user-check" size={18} />
      Asignación Operativa
    </button>
    <button
      type="button"
      id="tab-btn-monitoreo"
      data-tab-target="panel-monitoreo"
      class="tab font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition-all flex items-center gap-2"
    >
      <Icon name="boxicons:group" size={18} />
      Monitoreo de Operadores
    </button>
  </div>
</div>
```

- [ ] **Step 3: Wrap Panel 1 (Asignación Operativa)**

Create `#panel-asignacion` container:
- Top: Action Card ("Asignar Siguiente" master button + lock indicator).
- Grid (50% / 50% `grid-cols-1 lg:grid-cols-2 gap-6`):
  - Left: "Sin Asignar (Mesa 2510)" list card with scrollable height (`max-h-[calc(100vh-300px)]`).
  - Right: "Próximos en Cola" list card + "Última Asignación" card.

- [ ] **Step 4: Wrap Panel 2 (Monitoreo de Operadores)**

Create `#panel-monitoreo` container (hidden by default via `hidden` class):
- KPI Cards ("Disponibilidad Actual" & "Fuera de Servicio").
- Control Bar (Filter switch *Solo disponibles* + Undo button).
- Full Operators DataTable.

- [ ] **Step 5: Add Tab Switching Script**

In the `<script>` block of `AsignacionContent.astro`, add tab event handlers:
```javascript
const tabBtns = document.querySelectorAll("[data-tab-target]");
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-tab-target");
    tabBtns.forEach((b) => b.classList.remove("tab-active", "bg-primary", "text-primary-content"));
    btn.classList.add("tab-active");
    
    document.getElementById("panel-asignacion")?.classList.toggle("hidden", targetId !== "panel-asignacion");
    document.getElementById("panel-monitoreo")?.classList.toggle("hidden", targetId !== "panel-monitoreo");
  });
});
```

- [ ] **Step 6: Build & Verify**

Run `npm run build` and ensure clean SSR build without errors.

---

### Task 2: Verify Build & UI Integration

**Files:**
- Modify: `src/components/supervision/asignacion/AsignacionContent.astro`

- [ ] **Step 1: Execute npm run build**
Verify 0 compilation or type errors.

- [ ] **Step 2: Commit changes**
```bash
git add src/components/supervision/asignacion/AsignacionContent.astro docs/superpowers/specs/2026-08-03-ags-tabs-redesign-design.md docs/superpowers/plans/2026-08-03-ags-tabs-redesign.md
git commit -m "feat(ags): redesign Asignacion Autogestiones with 2-Tab operative layout"
```
