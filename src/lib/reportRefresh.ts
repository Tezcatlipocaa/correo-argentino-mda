import { showToast } from "@lib/toastClient";

/**
 * Inicializa los botones `[data-report-refresh]`: POST al endpoint, toast y
 * recarga. El endpoint se prefija con `BASE_URL` en el cliente.
 */
export function initReportRefresh(): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-report-refresh]")
    .forEach((btn) => {
      if (btn.dataset.refreshInitialized === "true") return;
      btn.dataset.refreshInitialized = "true";

      btn.addEventListener("click", async () => {
        const endpoint = btn.dataset.refreshEndpoint;
        if (!endpoint) return;

        btn.classList.add("loading");
        btn.disabled = true;
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}${endpoint}`, {
            method: "POST",
          });
          if (res.ok) {
            showToast(
              btn.dataset.refreshSuccess ?? "Datos actualizados",
              "alert-success",
            );
            setTimeout(() => window.location.reload(), 600);
          } else {
            let errorDetail = "";
            try {
              const body = await res.json();
              errorDetail = body.error || body.message || "";
            } catch {
              // ignore
            }
            const fallback = btn.dataset.refreshError ?? "Error al actualizar los datos";
            const message = errorDetail ? `${fallback}: ${errorDetail}` : `${fallback} (HTTP ${res.status})`;
            showToast(message, "alert-error");
          }
        } catch (e) {
          console.error(e);
          showToast(
            btn.dataset.refreshError ?? "Error de conexión al actualizar",
            "alert-error",
          );
        } finally {
          btn.classList.remove("loading");
          btn.disabled = false;
        }
      });
    });
}
