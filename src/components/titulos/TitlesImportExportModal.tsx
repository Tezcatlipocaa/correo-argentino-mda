import { useRef, useState } from "react";
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { showToast } from "@lib/toastClient";
import { getCleanBase } from "@lib/baseUrl";

interface Props {
  open: boolean;
  canImport: boolean;
  onClose: () => void;
  /** Recarga la lista tras un import exitoso. */
  onImported: () => void;
}

/** Plantilla CSV de ejemplo (mismas columnas que el export). */
const TEMPLATE = [
  "Título,Categoría,Ruta,Descripción",
  '"Boca de red - Habilitación",Instalaciones,"TI » Redes » Boca de red","Habilitación de una boca de red en la sucursal."',
  '"Celular - Configuración",Hardware,"TI » Mobile » Celular","Configuración inicial del dispositivo móvil."',
].join("\r\n");

function download(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function TitlesImportExportModal({
  open,
  canImport,
  onClose,
  onImported,
}: Props) {
  const cleanBase = getCleanBase();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      showToast("Elegí un archivo CSV", "alert-error", 3000);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${cleanBase}api/titulos/import`, { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "No se pudo importar");
      }
      const data = await res.json();
      showToast(
        `Importado: ${data.created} nuevos, ${data.updated} actualizados${
          data.errors?.length ? `, ${data.errors.length} con error` : ""
        }.`,
        data.errors?.length ? "alert-warning" : "alert-success",
        5000,
      );
      if (data.errors?.length) {
        console.warn("[import titulos] errores:", data.errors);
      }
      if (fileRef.current) fileRef.current.value = "";
      onImported();
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "No se pudo importar",
        "alert-error",
        4000,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-200 flex items-center justify-center transition-all duration-300 ${
        open ? "visible opacity-100" : "invisible opacity-0"
      }`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`bg-base-100 relative w-full max-w-lg rounded-xl p-6 shadow-2xl transition-all duration-300 ${
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-4 scale-95 opacity-0"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Importar / Exportar títulos</h2>
          <button
            className="btn btn-ghost btn-xs shadow-none"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <XMarkIcon className="size-5" />
          </button>
        </div>

        <p className="text-base-content/70 mb-4 text-sm">
          El CSV tiene las columnas{" "}
          <span className="font-mono">Título, Categoría, Ruta, Descripción</span>
          . La categoría debe existir en el portal. Al crear/editar, el formato
          del título se normaliza (guion con espacios y sin CamelCase tras el
          guion).
        </p>

        <div className="flex flex-col gap-3">
          <div className="border-base-300 rounded-lg border p-3">
            <h3 className="mb-2 text-sm font-semibold">Exportar</h3>
            <div className="flex flex-wrap gap-2">
              <a
                className="btn btn-sm shadow-none"
                href={`${cleanBase}api/titulos/export.csv`}
                download
              >
                <ArrowDownTrayIcon className="size-4" />
                Exportar títulos (CSV)
              </a>
              <button
                className="btn btn-sm shadow-none"
                onClick={() => download("plantilla-titulos.csv", TEMPLATE)}
              >
                <DocumentArrowDownIcon className="size-4" />
                Descargar plantilla
              </button>
            </div>
          </div>

          {canImport && (
            <div className="border-base-300 rounded-lg border p-3">
              <h3 className="mb-2 text-sm font-semibold">Importar</h3>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="file-input file-input-sm w-full"
              />
              <button
                className="btn btn-primary btn-sm mt-3 shadow-none"
                onClick={handleImport}
                disabled={busy}
              >
                <ArrowUpTrayIcon className="size-4" />
                {busy ? "Importando..." : "Importar CSV"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
