/**
 * Pantalla completa reutilizable (Fullscreen API) para contenedores de tabla.
 *
 * Marca el contenedor con `data-fullscreen-root`, agrega un botón con
 * `data-fullscreen-toggle`, y dos íconos `data-fs-enter` / `data-fs-exit`.
 * Al entrar en fullscreen, el root recibe la clase `is-fullscreen`.
 */
export function initFullscreenToggle(): void {
  if (typeof window === "undefined") {
    return;
  }

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLElement>("[data-fullscreen-toggle]");
    if (!button) return;

    const root = button.closest<HTMLElement>("[data-fullscreen-root]");
    if (!root) return;

    if (document.fullscreenElement === root) {
      void document.exitFullscreen();
    } else {
      void root.requestFullscreen?.();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    document
      .querySelectorAll<HTMLElement>("[data-fullscreen-root]")
      .forEach((root) => {
        const isFullscreen = document.fullscreenElement === root;
        root.classList.toggle("is-fullscreen", isFullscreen);
        root
          .querySelector("[data-fs-enter]")
          ?.classList.toggle("hidden", isFullscreen);
        root
          .querySelector("[data-fs-exit]")
          ?.classList.toggle("hidden", !isFullscreen);
      });
  });
}
