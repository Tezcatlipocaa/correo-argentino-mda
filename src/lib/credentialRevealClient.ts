import { showToast } from "./toastClient";

function getCsrfToken(): string {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute("content") || "";
}

/**
 * Obtiene el secreto desencriptado bajo demanda desde /api/credentials/reveal
 */
export async function fetchRevealedCredential(params: {
  entityType: "resource_link" | "application";
  entityId: number;
  metaIndex?: number;
}): Promise<string | null> {
  const csrfToken = getCsrfToken();

  try {
    const res = await fetch("/api/credentials/reveal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const errorMsg = data.error || `Error al obtener credencial (${res.status})`;
      showToast(errorMsg, "alert-error");
      return null;
    }

    const data = await res.json();
    return typeof data.value === "string" ? data.value : "";
  } catch (err: any) {
    showToast("Error de conexión al obtener credencial", "alert-error");
    return null;
  }
}

/**
 * Copia un texto al portapapeles con feedback visual
 */
export async function copySecretToClipboard(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fallback
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}
