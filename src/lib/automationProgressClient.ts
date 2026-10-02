import { getCleanBase } from "@lib/baseUrl";
import { formatWorkflowProgressLabel } from "@lib/workflow/node-status";

/**
 * Hidratación perezosa del progreso de las cards del listado de
 * automatizaciones. Vive fuera del `<script>` de la página para poder testear
 * la lógica de cache/single-flight sin montar el DOM completo.
 *
 * Cache en sessionStorage (TTL 5 min) + single-flight por id: la card
 * destacada y su duplicada en "Todas" comparten un mismo fetch y reciben el
 * mismo resultado.
 */

export interface AutomationProgress {
  percent: number;
  completed: number;
  applicableTotal: number;
}

interface CachedProgress extends AutomationProgress {
  savedAt: number;
}

/** Resultado compartido entre slots del mismo id (destacada + duplicada). */
type ProgressOutcome =
  { ok: true; progress: AutomationProgress } | { ok: false };

const baseUrl = getCleanBase();

const PROGRESS_CACHE_PREFIX = "automatizaciones:progress:";
const PROGRESS_CACHE_TTL_MS = 5 * 60_000;

const inflight = new Map<string, Promise<ProgressOutcome>>();

export const OPEN_CARD_SELECTOR = "details.group[open]";
export const PROGRESS_SLOT_SELECTOR = "[data-progress-slot]";

function showEl(el: Element | null, display: "flex" | "block") {
  if (!el) return;
  el.classList.remove("hidden");
  if (display === "flex") el.classList.add("flex");
}

function hideEl(el: Element | null) {
  if (!el) return;
  el.classList.add("hidden");
  el.classList.remove("flex");
}

function isAutomationProgress(value: unknown): value is AutomationProgress {
  const progress = value as Partial<AutomationProgress> | null;
  return (
    progress !== null &&
    typeof progress.percent === "number" &&
    typeof progress.completed === "number" &&
    typeof progress.applicableTotal === "number"
  );
}

function readProgressCache(id: string): CachedProgress | null {
  try {
    const raw = sessionStorage.getItem(PROGRESS_CACHE_PREFIX + id);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedProgress | null;
    if (!entry || !isAutomationProgress(entry)) return null;
    if (Date.now() - entry.savedAt > PROGRESS_CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeProgressCache(id: string, progress: AutomationProgress) {
  try {
    sessionStorage.setItem(
      PROGRESS_CACHE_PREFIX + id,
      JSON.stringify({ ...progress, savedAt: Date.now() }),
    );
  } catch {
    return;
  }
}

function applyProgress(slot: HTMLElement, progress: AutomationProgress) {
  const label = slot.querySelector("[data-progress-label]");
  const bar = slot.querySelector<HTMLProgressElement>("[data-progress-bar]");
  if (label) {
    label.textContent = formatWorkflowProgressLabel(progress);
  }
  if (bar) bar.value = progress.percent;
  hideEl(slot.querySelector("[data-progress-loading]"));
  showEl(slot.querySelector("[data-progress-content]"), "flex");
}

function applyOutcome(slot: HTMLElement, outcome: ProgressOutcome) {
  if (outcome.ok) {
    applyProgress(slot, outcome.progress);
    slot.dataset.loaded = "true";
    return;
  }
  hideEl(slot.querySelector("[data-progress-loading]"));
  showEl(slot.querySelector("[data-progress-error]"), "block");
  slot.dataset.loaded = "error";
}

async function fetchProgress(id: string): Promise<ProgressOutcome> {
  try {
    const res = await fetch(`${baseUrl}api/automatizaciones/${id}/progress`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const progress = data?.progress;
    if (!isAutomationProgress(progress)) {
      throw new Error("Respuesta inesperada");
    }
    writeProgressCache(id, progress);
    return { ok: true, progress };
  } catch {
    return { ok: false };
  } finally {
    inflight.delete(id);
  }
}

/** Hidrata el slot de progreso: cache primero, luego single-flight por id. */
export async function hydrateAutomationProgress(
  slot: HTMLElement,
): Promise<void> {
  const id = slot.dataset.automationId;
  if (!id) return;

  slot.classList.remove("hidden");
  slot.classList.add("flex");

  if (slot.dataset.loaded === "true") return;

  const cached = readProgressCache(id);
  if (cached) {
    applyProgress(slot, cached);
    slot.dataset.loaded = "true";
    return;
  }

  const existing = inflight.get(id);
  if (existing) {
    const outcome = await existing;
    applyOutcome(slot, outcome);
    return;
  }

  slot.dataset.loaded = "loading";
  showEl(slot.querySelector("[data-progress-loading]"), "flex");

  const request = fetchProgress(id);
  inflight.set(id, request);
  const outcome = await request;
  applyOutcome(slot, outcome);
}

/** Hidrata las cards abiertas dentro de `root` (inicial y post view-transition). */
export function hydrateOpenProgressCards(root: ParentNode): void {
  for (const card of root.querySelectorAll(OPEN_CARD_SELECTOR)) {
    const slot = card.querySelector<HTMLElement>(PROGRESS_SLOT_SELECTOR);
    if (slot) void hydrateAutomationProgress(slot);
  }
}
