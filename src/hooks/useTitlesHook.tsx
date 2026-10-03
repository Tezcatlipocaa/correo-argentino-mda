import { useState, useEffect, useCallback, useMemo } from "react";
import { useDebounce } from "./useDebounce";
import { showToast } from "@lib/toastClient";
import type { ModulePermission } from "@/lib/rbac";

declare const chrome: any;

export interface Title {
  id: number;
  name: string;
  categoryId: number;
  category: string;
  icon: string;
  tone: string;
  route: string | null;
  description: string | null;
  articleOnKdb: string | null;
}

export interface TitleFormData {
  name: string;
  categoryId: number;
  route: string;
  description: string;
  articleOnKdb: string;
}

export interface TitleCategory {
  id: number;
  name: string;
  icon: string;
  tone: string;
}

interface Props {
  permissions: ModulePermission;
  loggedIn: boolean;
}
export function useTitles({ permissions, loggedIn }: Props) {
  const [titles, setTitles] = useState<Title[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<TitleCategory[]>([]);

  // Favoritos por usuario (ids de título); se cargan de la API si hay sesión.
  const [favorites, setFavorites] = useState<Set<number>>(() => new Set());
  // Ids con un toggle en vuelo (para deshabilitar el botón y evitar dobles clics).
  const [pendingFavorites, setPendingFavorites] = useState<Set<number>>(
    () => new Set(),
  );

  // Debounce
  const debouncedSearch = useDebounce(searchQuery, 200);

  const refreshTitles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/titulos");

      if (!res.ok) {
        throw new Error("Error cargando títulos.");
      }

      const data: Title[] = await res.json();
      setTitles(data);
    } catch (error) {
      console.error(error);
      showToast("No se pudieron obtener los títulos", "alert-error", 3000);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/titulos/categorias");

      if (!res.ok) throw new Error();

      const data: TitleCategory[] = await res.json();

      setCategories(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    refreshTitles();
    refreshCategories();
  }, [refreshTitles, refreshCategories]);

  const createTitle = async (title: TitleFormData) => {
    try {
      if (!permissions.canWrite) {
        showToast(
          "No tenés permisos para realizar esta acción.",
          "alert-error",
          3000,
        );

        return false;
      }

      const res = await fetch("/api/titulos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(title),
      });
      if (!res.ok) {
        throw new Error();
      }

      showToast("Título creado correctamente.", "alert-success", 3000);

      await refreshTitles();
      await refreshCategories();
      return true;
    } catch (error) {
      showToast("No se pudo crear el título", "alert-error", 3000);
      return false;
    }
  };

  const updateTitle = async (id: number, title: TitleFormData) => {
    try {
      if (!permissions.canWrite) {
        showToast(
          "No tenés permisos para realizar esta acción.",
          "alert-error",
          3000,
        );

        return false;
      }
      const res = await fetch(`/api/titulos/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(title),
      });

      if (!res.ok) {
        throw new Error();
      }

      showToast("Título actualizado", "alert-success", 3000);

      await refreshTitles();
      await refreshCategories();
      return true;
    } catch (error) {
      showToast("Error actualizando título", "alert-error", 3000);

      return false;
    }
  };

  const deleteTitle = async (id: number) => {
    try {
      if (!permissions.canWrite) {
        showToast(
          "No tenés permisos para realizar esta acción.",
          "alert-error",
          3000,
        );

        return false;
      }

      const res = await fetch(`/api/titulos/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error();
      }

      showToast("Título eliminado", "alert-success", 3000);

      await refreshTitles();

      return true;
    } catch {
      showToast("No se pudo eliminar", "alert-error", 3000);

      return false;
    }
  };

  // Favoritos: cargar del perfil (API) cuando hay sesión.
  useEffect(() => {
    if (!loggedIn) {
      setFavorites(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/titulos/favoritos");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.favorites)) {
          setFavorites(new Set<number>(data.favorites));
        }
      } catch {
        /* sin red: se queda vacío */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  // Migración one-time: favoritos viejos del localStorage (por nombre) pasan a
  // la DB (por id) y se limpia la clave local.
  useEffect(() => {
    if (!loggedIn || titles.length === 0) return;
    const raw = localStorage.getItem("favorites");
    if (!raw) return;
    localStorage.removeItem("favorites");

    let names: string[] = [];
    try {
      names = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(names) || names.length === 0) return;

    const ids = names
      .map((name) => titles.find((title) => title.name === name)?.id)
      .filter((id): id is number => typeof id === "number");
    if (ids.length === 0) return;

    void (async () => {
      for (const id of ids) {
        try {
          await fetch("/api/titulos/favoritos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ titleId: id }),
          });
        } catch {
          /* se reintenta en la próxima visita */
        }
      }
      setFavorites((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
    })();
  }, [loggedIn, titles]);

  const toggleFavorite = useCallback(
    async (titleId: number) => {
      if (!loggedIn) return;

      const wasFavorite = favorites.has(titleId);
      const titleName =
        titles.find((title) => title.id === titleId)?.name ?? String(titleId);

      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(titleId);
        else next.add(titleId);
        return next;
      });
      setPendingFavorites((prev) => new Set(prev).add(titleId));

      try {
        const res = wasFavorite
          ? await fetch(`/api/titulos/favoritos?titleId=${titleId}`, {
              method: "DELETE",
            })
          : await fetch("/api/titulos/favoritos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ titleId }),
            });
        if (!res.ok) throw new Error();

        showToast(
          wasFavorite
            ? `Título "${titleName}" eliminado de favoritos.`
            : `Título "${titleName}" agregado a favoritos.`,
          wasFavorite ? "alert-info" : "alert-success",
          3000,
        );
      } catch {
        setFavorites((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(titleId);
          else next.delete(titleId);
          return next;
        });
        showToast("No se pudo actualizar favoritos", "alert-error", 3000);
      } finally {
        setPendingFavorites((prev) => {
          const next = new Set(prev);
          next.delete(titleId);
          return next;
        });
      }
    },
    [favorites, loggedIn, titles],
  );

  // Búsqueda y filtros
  const filteredTitles = useMemo(() => {
    const normalize = (str: string) =>
      str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const term = normalize(debouncedSearch);

    let result = [...titles];

    // Filtro de búsqueda
    if (term) {
      result = result.filter(
        (title) =>
          normalize(title.name).includes(term) ||
          normalize(title.description ?? "").includes(term) ||
          normalize(title.route ?? "").includes(term),
      );
    }

    // Filtro de favoritos y categorías
    if (activeFilter === "Favoritos" && loggedIn) {
      result = result.filter((title) => favorites.has(title.id));
    } else if (activeFilter !== "Todos" && activeFilter !== "Favoritos") {
      result = result.filter(
        (title) => normalize(title.category) === normalize(activeFilter),
      );
    }
    return result;
  }, [titles, favorites, debouncedSearch, activeFilter]);

  // Filtros: chips con su tono (categorías) o neutros (Todos / Favoritos).
  const filters = useMemo(() => {
    const toneByCategory = new Map<string, string>();
    for (const title of titles) {
      if (title.category && !toneByCategory.has(title.category)) {
        toneByCategory.set(title.category, title.tone);
      }
    }
    const categories = [...toneByCategory.keys()].sort();

    const out: { label: string; tone: string | null }[] = [
      { label: "Todos", tone: null },
    ];
    if (loggedIn) out.push({ label: "Favoritos", tone: null });
    for (const category of categories) {
      out.push({ label: category, tone: toneByCategory.get(category) ?? null });
    }
    return out;
  }, [titles, loggedIn]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await copyText(text);
      setTimeout(() => setCopiedIndex(null), 2000);

      showToast(
        `Titulo "${text}" copiado al portapapeles.`,
        "alert-success",
        3000,
      );
      if (typeof chrome !== "undefined" && chrome.tabs) {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        chrome.tabs.sendMessage(tab.id!, {
          type: "SET_SUBJECT",
          payload: text,
        });
      }
    } catch (err) {
      showToast("Error al copiar al portapapeles", "alert-error", 3000);
      console.error("Error copying to clipboard:", err);
    }
  }, []);

  return {
    titles,
    setTitles,
    categories,
    filters,
    filteredTitles,
    loading,
    searchQuery,
    setSearchQuery,
    copyToClipboard,
    copiedIndex,
    activeFilter,
    setActiveFilter,
    favorites,
    pendingFavorites,
    toggleFavorite,
    refreshTitles,

    updateTitle,
    createTitle,
    deleteTitle,
  };
}

function fallbackCopyToClipboard(value: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;
  try {
    const legacyCopyApi = document as unknown as {
      execCommand?: (commandId: string) => boolean;
    };
    copied =
      typeof legacyCopyApi.execCommand === "function"
        ? legacyCopyApi.execCommand("copy")
        : false;
  } catch {
    copied = false;
  }

  textarea.remove();
  return copied;
}

async function copyText(value: string): Promise<boolean> {
  const canUseClipboardApi =
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard !== "undefined" &&
    typeof navigator.clipboard.writeText === "function";

  if (canUseClipboardApi) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return fallbackCopyToClipboard(value);
    }
  }
  return fallbackCopyToClipboard(value);
}
