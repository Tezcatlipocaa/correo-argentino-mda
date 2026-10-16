import { getCleanBase } from "@lib/baseUrl";

const cleanBase = getCleanBase();

let currentFilter = {
  preset: "ultimos_7_dias",
  from: "",
  to: "",
};

interface ChartWindow extends Window {
  __chartCards?: Record<string, { setData: (labels: string[], series: { label: string; data: number[] }[]) => void }>;
  __pendingChartUpdates?: Record<string, { labels: string[]; series: { label: string; data: number[] }[] }>;
}

// Empuja datos a una ChartCard (misma mecánica de registry que usa ChartCard.astro):
// si la card ya está inicializada, setData directo; si no, queda encolado y la
// card lo toma en su init, así no hay carrera de orden de scripts.
function pushChart(
  chartName: string,
  labels: string[],
  series: { label: string; data: number[] }[],
) {
  const win = window as ChartWindow;
  const registered = win.__chartCards?.[chartName];
  if (registered) {
    registered.setData(labels, series);
    return;
  }
  (win.__pendingChartUpdates ??= {})[chartName] = { labels, series };
}

function initWhenReady() {
  const payloadEl = document.getElementById("initial-metrics-payload");
  if (payloadEl && payloadEl.textContent) {
    try {
      const initialData = JSON.parse(payloadEl.textContent);
      currentFilter.preset = initialData.range?.preset || "ultimos_7_dias";
      renderAll(initialData);
    } catch (err) {
      console.error("Error parsing initial metrics data:", err);
    }
  }

  setupEventListeners();
}

function renderAll(data: any) {
  updateKpis(data.kpis);
  updateCharts(data);
  updateTable(data.recentAssignments || []);
  updateTimestamp(data.lastSyncAt);
  updateExportLink();
}

function updateKpis(kpis: any) {
  if (!kpis) return;
  const totalEl = document.getElementById("kpi-total-asignadas");
  if (totalEl) totalEl.textContent = String(kpis.totalAsignadas ?? 0);

  const colaEl = document.getElementById("kpi-cola-pendiente");
  if (colaEl) colaEl.textContent = String(kpis.colaPendiente ?? 0);

  const autoEl = document.getElementById("kpi-tasa-automatizacion");
  if (autoEl) autoEl.textContent = `${kpis.tasaAutomatizacion ?? 0}%`;

  const opsEl = document.getElementById("kpi-operadores-activos");
  if (opsEl) opsEl.textContent = String(kpis.operadoresActivos ?? 0);
}

function updateCharts(data: any) {
  const byType = data.byType || [];
  pushChart(
    "ag-modalidades",
    byType.map((t: any) => t.label),
    [{ label: "Asignaciones", data: byType.map((t: any) => t.count) }],
  );

  const temporal = data.temporal || [];
  pushChart(
    "ag-temporal",
    temporal.map((t: any) => t.label),
    [
      {
        label: "Autogestiones Asignadas",
        data: temporal.map((t: any) => t.count),
      },
    ],
  );

  const byOperator = (data.byOperator || []).slice(0, 15);
  pushChart(
    "ag-operadores",
    byOperator.map((o: any) => o.agentName),
    [
      {
        label: "Tickets Asignados",
        data: byOperator.map((o: any) => o.count),
      },
    ],
  );

  const byCat = data.queueStats?.byCategory || [];
  pushChart(
    "ag-categorias",
    byCat.map((c: any) => c.label),
    [{ label: "En cola", data: byCat.map((c: any) => c.count) }],
  );

  const topCreators = data.queueStats?.topCreators || [];
  pushChart(
    "ag-creadores",
    topCreators.map((c: any) => c.label),
    [{ label: "Tickets Pendientes", data: topCreators.map((c: any) => c.count) }],
  );
}

function updateTable(assignments: any[]) {
  const tbody = document.getElementById("table-assignments-body");
  const countEl = document.getElementById("table-records-count");
  if (countEl) countEl.textContent = `${assignments.length} registros`;
  if (!tbody) return;

  if (assignments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-8 text-base-content/40 font-medium">
          No hay asignaciones registradas en el período seleccionado.
        </td>
      </tr>
    `;
    return;
  }

  const modalityConfig: Record<string, { label: string; badgeClass: string }> = {
    cyclic: {
      label: "Cíclica General",
      badgeClass: "badge-secondary text-secondary-content font-bold",
    },
    batch_suggested: {
      label: "Sugerida por Creador",
      badgeClass: "badge-secondary badge-outline font-bold",
    },
    batch_all: {
      label: "Masiva en Cola",
      badgeClass: "badge-info text-info-content font-bold",
    },
    manual: {
      label: "Manual Supervisor",
      badgeClass: "badge-primary text-primary-content font-bold",
    },
    revision: {
      label: "Revisión Pospuesta",
      badgeClass: "badge-neutral text-neutral-content font-bold",
    },
    undo: {
      label: "Deshecha / Anulada",
      badgeClass: "badge-error text-error-content font-bold",
    },
  };

  tbody.innerHTML = assignments
    .map((r) => {
      const modality = modalityConfig[r.type] || {
        label: r.type,
        badgeClass: "badge-ghost",
      };
      const formattedDate = new Date(r.assignedAt).toLocaleString([], {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      return `
        <tr class="hover:bg-base-200/40 transition-colors">
          <td class="font-mono font-bold">${r.ticketNumber || "—"}</td>
          <td class="font-semibold text-base-content">${r.agentName}</td>
          <td class="text-base-content/70">${r.assignedBy}</td>
          <td><span class="badge badge-sm py-2 px-2.5 text-tiny uppercase tracking-wider ${modality.badgeClass}">${modality.label}</span></td>
          <td class="text-right font-mono text-tiny text-base-content/60">${formattedDate}</td>
        </tr>
      `;
    })
    .join("");
}

function updateTimestamp(ts?: number) {
  const el = document.getElementById("sync-timestamp");
  if (!el) return;
  const date = ts ? new Date(ts) : new Date();
  el.textContent = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function updateExportLink() {
  const link = document.getElementById("btn-export-csv") as HTMLAnchorElement;
  if (!link) return;
  let url = `${cleanBase}api/autogestion/metricas/export.csv?preset=${currentFilter.preset}`;
  if (currentFilter.from) url += `&from=${currentFilter.from}`;
  if (currentFilter.to) url += `&to=${currentFilter.to}`;
  link.href = url;
}

async function fetchMetrics(params: { preset?: string; from?: string; to?: string }) {
  const refreshBtn = document.getElementById("btn-refresh-metrics");
  const refreshIcon = document.getElementById("icon-refresh");
  if (refreshBtn) refreshBtn.setAttribute("disabled", "true");
  if (refreshIcon) refreshIcon.classList.add("animate-spin");

  try {
    const query = new URLSearchParams();
    if (params.preset) query.set("preset", params.preset);
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    query.set("mock", "1");

    const res = await fetch(`${cleanBase}api/autogestion/metricas?${query.toString()}`);
    if (!res.ok) throw new Error("Error al consultar métricas");
    const json = await res.json();
    if (json.data) {
      renderAll(json.data);
    }
  } catch (err) {
    console.error("Error al actualizar métricas:", err);
  } finally {
    if (refreshBtn) refreshBtn.removeAttribute("disabled");
    if (refreshIcon) refreshIcon.classList.remove("animate-spin");
  }
}

function setupEventListeners() {
  // Preset buttons
  const presetButtons = document.querySelectorAll("#presets-filter-bar button[data-preset]");
  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.getAttribute("data-preset");
      if (!preset) return;

      presetButtons.forEach((b) => {
        b.classList.remove("btn-secondary", "text-secondary-content");
        b.classList.add("btn-ghost", "text-base-content/70");
      });
      btn.classList.remove("btn-ghost", "text-base-content/70");
      btn.classList.add("btn-secondary", "text-secondary-content");

      currentFilter.preset = preset;
      currentFilter.from = "";
      currentFilter.to = "";

      const fromInput = document.getElementById("filter-date-from") as HTMLInputElement;
      const toInput = document.getElementById("filter-date-to") as HTMLInputElement;
      if (fromInput) fromInput.value = "";
      if (toInput) toInput.value = "";

      fetchMetrics({ preset });
    });
  });

  // Custom date range button
  const applyBtn = document.getElementById("btn-apply-custom-dates");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      const fromInput = document.getElementById("filter-date-from") as HTMLInputElement;
      const toInput = document.getElementById("filter-date-to") as HTMLInputElement;
      if (!fromInput?.value || !toInput?.value) return;

      presetButtons.forEach((b) => {
        b.classList.remove("btn-secondary", "text-secondary-content");
        b.classList.add("btn-ghost", "text-base-content/70");
      });

      currentFilter.preset = "custom";
      currentFilter.from = fromInput.value;
      currentFilter.to = toInput.value;

      fetchMetrics({ preset: "custom", from: fromInput.value, to: toInput.value });
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById("btn-refresh-metrics");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      fetchMetrics(currentFilter);
    });
  }
}

// Inicializar en DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWhenReady);
} else {
  initWhenReady();
}
