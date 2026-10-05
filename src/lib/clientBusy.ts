/**
 * Helpers de formularios cliente (acciones async de los modales del módulo):
 * estado "cargando" de un botón y lectura tipada de campos por id.
 */

export function setBusy(el: Element | null, busy: boolean): void {
  if (el instanceof HTMLButtonElement) {
    el.disabled = busy;
    el.classList.toggle("loading", busy);
  }
}

export function readFieldValue(id: string): string | null {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value.trim();
  }
  return null;
}
