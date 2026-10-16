import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type MouseEvent,
} from "react";
import { Icon } from "@iconify/react";
import type { CategoryNode } from "@/types/categories";
import ActionButton from "@/components/ui/ActionButton";
import {
  computeCategoryTreeLayout,
  filterCategoryTree,
  findCategoryMatches,
  filterVisibleCategoryViewport,
  type CategoryLayoutNode,
  type CategoryFilterOptions,
  CATEGORY_NODE_WIDTH,
  CATEGORY_NODE_HEIGHT,
} from "./categoryTreeLayout";

interface Props {
  rootNode: CategoryNode;
  propuestaCNode?: CategoryNode;
  onSelectNode?: (node: CategoryNode) => void;
}

interface Point {
  x: number;
  y: number;
}

function getTicketBadgeClass(tickets: number): string {
  if (tickets === 0) {
    return "badge badge-sm badge-soft text-base-content/50 border-base-300 font-mono";
  }
  if (tickets < 50) {
    return "badge badge-sm badge-soft badge-info font-mono";
  }
  if (tickets < 200) {
    return "badge badge-sm badge-soft badge-secondary font-mono font-medium";
  }
  return "badge badge-sm badge-secondary font-mono font-bold shadow-xs";
}

function getAnomalyBadgeClass(status: string): string {
  if (status === "duplicate_parent" || status === "error") {
    return "badge badge-xs badge-error";
  }
  if (status === "internal_use" || status === "leaf_internal") {
    return "badge badge-xs badge-secondary";
  }
  if (status === "zero_volume" || status === "zero_tickets") {
    return "badge badge-xs badge-ghost text-base-content/60";
  }
  return "badge badge-xs badge-ghost";
}

// Subcomponente de Tarjeta de Nodo Memoizado
const CategoryCanvasNodeCard = React.memo(function CategoryCanvasNodeCard({
  item,
  isHighlighted,
  onNodeClick,
  onToggleCollapse,
}: {
  item: CategoryLayoutNode;
  isHighlighted: boolean;
  onNodeClick: (node: CategoryNode, e: MouseEvent) => void;
  onToggleCollapse: (id: number, e: MouseEvent) => void;
}) {
  const { node, x, y, width, height, isCollapsed, hasChildren, childrenCount } = item;
  const tickets = node.totalTickets || 0;

  return (
    <div
      onClick={(e) => onNodeClick(node, e)}
      className={`card absolute flex flex-col justify-between rounded-xl border bg-base-100 p-3 shadow-xs select-none transition-all cursor-pointer ${
        isHighlighted
          ? "border-secondary ring-2 ring-secondary/50 shadow-md"
          : "border-base-300 hover:border-secondary hover:shadow-sm"
      }`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {/* Header: Nivel, Badges y Tickets */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <span className="badge badge-xs badge-outline font-mono text-[10px] shrink-0">
            N{node.depth}
          </span>
          {node.status && node.status !== "normal" && (
            <span
              className={`shrink-0 truncate max-w-[90px] ${getAnomalyBadgeClass(node.status)}`}
              title={node.status}
            >
              {node.status === "duplicate_parent"
                ? "Duplicado"
                : node.status === "zero_volume"
                ? "Sin tickets"
                : node.status}
            </span>
          )}
        </div>

        <span
          className={`shrink-0 ${getTicketBadgeClass(tickets)}`}
          title={`${tickets.toLocaleString("es-AR")} tickets en este nivel`}
        >
          {tickets.toLocaleString("es-AR")} tk
        </span>
      </div>

      {/* Título de la Categoría con Tooltip DaisyUI */}
      <div
        className="tooltip tooltip-bottom text-left w-full my-0.5"
        data-tip={node.name}
      >
        <h4 className="font-semibold text-xs leading-tight text-base-content line-clamp-2">
          {node.name}
        </h4>
      </div>

      {/* Footer: Hijos y Botón Plegar / Expandir */}
      <div className="flex items-center justify-between border-t border-base-200 pt-1 text-xs">
        <span className="text-[11px] font-mono text-base-content/60">
          {hasChildren
            ? `${childrenCount} ${childrenCount === 1 ? "hijo" : "hijos"}`
            : "Hoja"}
        </span>

        {hasChildren && (
          <button
            type="button"
            onClick={(e) => onToggleCollapse(node.id, e)}
            className="btn btn-xs btn-ghost border border-base-300 gap-1 text-[11px] h-6 min-h-0 px-2 hover:bg-base-200"
            title={
              isCollapsed
                ? `Expandir rama (${childrenCount} hijos)`
                : "Plegar rama"
            }
            aria-label={
              isCollapsed
                ? `Expandir rama (${childrenCount} hijos)`
                : "Plegar rama"
            }
          >
            <Icon
              icon={isCollapsed ? "boxicons:plus" : "boxicons:minus"}
              width={12}
              height={12}
            />
            <span>{isCollapsed ? `+${childrenCount}` : "Plegar"}</span>
          </button>
        )}
      </div>
    </div>
  );
});

export default function CategoryTreeCanvas({
  rootNode,
  propuestaCNode,
  onSelectNode,
}: Props) {
  const [activeModel, setActiveModel] = useState<"actual" | "propuesta_c">("actual");
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  // Filtros interactivos del Popover
  const [ticketTier, setTicketTier] = useState<"all" | "zero" | "low" | "medium" | "high">("all");
  const [selectedAnomalies, setSelectedAnomalies] = useState<string[]>([]);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState<boolean>(false);

  // Inspector interno integrado (para pantalla completa)
  const [inspectedNode, setInspectedNode] = useState<CategoryNode | null>(null);
  const [kbLoading, setKbLoading] = useState<boolean>(false);
  const [kbArticles, setKbArticles] = useState<{ id: number; title: string; url: string }[]>([]);
  const [invgateStatus, setInvgateStatus] = useState<{ existsInCatalog?: boolean; catalogId?: number } | null>(null);

  // Búsqueda interactiva 1/N
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchMatches, setSearchMatches] = useState<{ targetId: number; node: CategoryNode; path: number[] }[]>([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState<number>(-1);

  // Colapsados por defecto (nivel 1 colapsa nivel 2)
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    if (rootNode?.children) {
      for (const child of rootNode.children) {
        if (child.children && child.children.length > 0) {
          initial.add(child.id);
        }
      }
    }
    return initial;
  });

  // Lienzo, Pan & Zoom
  const [pan, setPan] = useState<Point>({ x: 60, y: 150 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 780,
  });

  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (ticketTier !== "all") count++;
    if (selectedAnomalies.length > 0) count += selectedAnomalies.length;
    if (selectedBranchId !== null) count++;
    return count;
  }, [ticketTier, selectedAnomalies, selectedBranchId]);

  // Selección de nodo base según modelo
  const baseActiveNode = useMemo(() => {
    return activeModel === "propuesta_c" && propuestaCNode ? propuestaCNode : rootNode;
  }, [activeModel, propuestaCNode, rootNode]);

  // Ramas de nivel 1 para el selector
  const availableBranches = useMemo(() => {
    return baseActiveNode?.children || [];
  }, [baseActiveNode]);

  // Árbol filtrado
  const filteredTree = useMemo(() => {
    if (!baseActiveNode) return null;
    const filterOpts: CategoryFilterOptions = {
      ticketTier: ticketTier !== "all" ? ticketTier : undefined,
      anomalies: selectedAnomalies.length > 0 ? selectedAnomalies : undefined,
      selectedBranchId,
    };
    return filterCategoryTree(baseActiveNode, filterOpts) || baseActiveNode;
  }, [baseActiveNode, ticketTier, selectedAnomalies, selectedBranchId]);

  // Cálculo de Layout
  const layoutResult = useMemo(() => {
    if (!filteredTree) {
      return {
        nodes: [],
        connections: [],
        totalWidth: 800,
        totalHeight: 600,
        rootLayout: null,
      };
    }
    return computeCategoryTreeLayout(filteredTree, collapsedIds);
  }, [filteredTree, collapsedIds]);

  // Viewport Culling 2D
  const visibleNodes = useMemo(() => {
    return filterVisibleCategoryViewport(layoutResult.nodes, {
      pan,
      zoom,
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
      overscan: 250,
    });
  }, [layoutResult.nodes, pan, zoom, viewportSize]);

  // Medir contenedor
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setViewportSize({
          width: containerRef.current.clientWidth || 1200,
          height: containerRef.current.clientHeight || 780,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [isFullscreen]);

  // Sincronización con eventos externos (pestañas o botones Astro existentes)
  useEffect(() => {
    const handleSwitchModel = (e: CustomEvent<{ model: "actual" | "propuesta_c" }>) => {
      if (e.detail?.model) {
        setActiveModel(e.detail.model);
        setSelectedBranchId(null);
        setZoom(1);
      }
    };

    const handleFilterBranch = (e: CustomEvent<{ branchId: number | null }>) => {
      setSelectedBranchId(e.detail.branchId ?? null);
      setZoom(1);
    };

    window.addEventListener("category:switch-model", handleSwitchModel as EventListener);
    window.addEventListener("category:filter-branch", handleFilterBranch as EventListener);
    return () => {
      window.removeEventListener("category:switch-model", handleSwitchModel as EventListener);
      window.removeEventListener("category:filter-branch", handleFilterBranch as EventListener);
    };
  }, []);

  // Zoom-to-Pointer con rueda nativa
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom((prevZoom) => {
        const nextZoom = Math.min(Math.max(prevZoom * factor, 0.15), 3.0);
        setPan((prevPan) => ({
          x: mouseX - (mouseX - prevPan.x) * (nextZoom / prevZoom),
          y: mouseY - (mouseY - prevPan.y) * (nextZoom / prevZoom),
        }));
        return nextZoom;
      });
    };

    container.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => container.removeEventListener("wheel", handleWheelNative);
  }, []);

  // Navegación de búsqueda
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || !filteredTree) {
      setSearchMatches([]);
      setCurrentMatchIdx(-1);
      return;
    }
    const matches = findCategoryMatches(filteredTree, searchQuery);
    setSearchMatches(matches);
    if (matches.length > 0) {
      setCurrentMatchIdx(0);
      focusMatch(matches[0]);
    } else {
      setCurrentMatchIdx(-1);
    }
  };

  const focusMatch = (match: { targetId: number; node: CategoryNode; path: number[] }) => {
    // Desplegar ancestros si estuvieran colapsados
    setCollapsedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const ancestorId of match.path) {
        if (next.has(ancestorId)) {
          next.delete(ancestorId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    const targetNode = layoutResult.nodes.find((n) => n.node.id === match.targetId);
    if (targetNode) {
      const targetScreenX = viewportSize.width / 2 - (targetNode.x + CATEGORY_NODE_WIDTH / 2) * zoom;
      const targetScreenY = viewportSize.height / 2 - (targetNode.y + CATEGORY_NODE_HEIGHT / 2) * zoom;
      setPan({ x: targetScreenX, y: targetScreenY });
    }
  };

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIdx + 1) % searchMatches.length;
    setCurrentMatchIdx(nextIdx);
    focusMatch(searchMatches[nextIdx]);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIdx(prevIdx);
    focusMatch(searchMatches[prevIdx]);
  };

  // Ajustar a pantalla
  const fitToScreen = useCallback(() => {
    if (layoutResult.nodes.length === 0) {
      setPan({ x: 50, y: 150 });
      setZoom(1);
      return;
    }

    const padding = 60;
    const availableWidth = Math.max(viewportSize.width - padding * 2, 200);
    const availableHeight = Math.max(viewportSize.height - padding * 2, 200);

    const scaleX = availableWidth / layoutResult.totalWidth;
    const scaleY = availableHeight / layoutResult.totalHeight;
    const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 1.2);

    const centerX = (viewportSize.width - layoutResult.totalWidth * nextZoom) / 2;
    const centerY = (viewportSize.height - layoutResult.totalHeight * nextZoom) / 2;

    setZoom(nextZoom);
    setPan({ x: Math.max(padding, centerX), y: Math.max(padding, centerY) });
  }, [layoutResult, viewportSize]);

  // Manejadores de Fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFs = document.fullscreenElement === containerRef.current;
      setIsFullscreen(isNowFs);
      setTimeout(fitToScreen, 120);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [fitToScreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (inspectedNode) {
          setInspectedNode(null);
          return;
        }
        if (filterPopoverOpen) {
          setFilterPopoverOpen(false);
          return;
        }
        if (document.fullscreenElement) {
          void document.exitFullscreen?.().catch(() => setIsFullscreen(false));
        } else {
          setIsFullscreen(false);
        }
        setTimeout(fitToScreen, 120);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, fitToScreen, inspectedNode, filterPopoverOpen]);

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement === container) {
      void document.exitFullscreen?.().catch(() => {
        setIsFullscreen(false);
        setTimeout(fitToScreen, 120);
      });
    } else if (isFullscreen) {
      setIsFullscreen(false);
      setTimeout(fitToScreen, 120);
    } else if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => {
        setIsFullscreen((prev) => !prev);
        setTimeout(fitToScreen, 120);
      });
    } else {
      setIsFullscreen((prev) => !prev);
      setTimeout(fitToScreen, 120);
    }
  };

  // Drag & Pan
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Colapsar / Expandir
  const toggleCollapse = useCallback((id: number, e: MouseEvent) => {
    e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = () => {
    setCollapsedIds(new Set());
  };

  const collapseAll = () => {
    const allParentIds = new Set<number>();
    const collect = (n: CategoryNode) => {
      if (n.children && n.children.length > 0) {
        allParentIds.add(n.id);
        n.children.forEach(collect);
      }
    };
    if (baseActiveNode) collect(baseActiveNode);
    setCollapsedIds(allParentIds);
  };

  // Selección de nodo e inspección
  const handleNodeClick = useCallback(
    (node: CategoryNode, e: MouseEvent) => {
      e.stopPropagation();
      setInspectedNode(node);
      if (onSelectNode) onSelectNode(node);

      // Despachar evento para componentes Astro externos si no estamos en fullscreen
      const evt = new CustomEvent("category:inspect", {
        bubbles: true,
        detail: { node },
      });
      containerRef.current?.dispatchEvent(evt);

      // Cargar detalles de InvGate y KB asociados
      setKbLoading(true);
      setKbArticles([]);
      setInvgateStatus(null);

      fetch(
        `/api/reportes/categorias/node-details?id=${node.id}&name=${encodeURIComponent(node.name)}`
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setInvgateStatus(data.invgateStatus || null);
            setKbArticles(data.kbArticles || []);
          }
        })
        .catch(() => {})
        .finally(() => setKbLoading(false));
    },
    [onSelectNode]
  );

  return (
    <div
      id="tree-canvas-container"
      ref={containerRef}
      className={`relative w-full overflow-hidden border border-base-300 bg-base-200 select-none cursor-grab active:cursor-grabbing transition-all ${
        isFullscreen
          ? "is-fullscreen fixed inset-0 z-[200] w-screen h-screen bg-base-100 p-4 rounded-none shadow-2xl"
          : "h-[calc(100dvh-9rem)] min-h-[780px] lg:min-h-[860px] rounded-box"
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 1. BARRA SUPERIOR DE HERRAMIENTAS (DaisyUI join + inputs) */}
      <div className="absolute top-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Lado izquierdo: Modelo, Rama y Buscador */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Selector de Modelo (Actual vs Propuesta C) */}
          <div className="join border border-base-300 rounded-lg shadow-sm bg-base-100 p-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveModel("actual");
                setSelectedBranchId(null);
              }}
              className={`btn btn-xs join-item ${
                activeModel === "actual" ? "btn-secondary btn-active" : "btn-ghost"
              }`}
            >
              Actual
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveModel("propuesta_c");
                setSelectedBranchId(null);
              }}
              className={`btn btn-xs join-item ${
                activeModel === "propuesta_c" ? "btn-secondary btn-active" : "btn-ghost"
              }`}
            >
              Propuesta C
            </button>
          </div>

          {/* Selector de Rama Nivel 1 */}
          <div className="bg-base-100 rounded-lg shadow-sm border border-base-300 px-2 py-0.5 flex items-center gap-1.5">
            <span className="text-xs text-base-content/70 font-medium">Rama:</span>
            <select
              value={selectedBranchId ?? "all"}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedBranchId(val === "all" ? null : Number(val));
              }}
              className="select select-ghost select-xs text-xs font-semibold focus:outline-none"
            >
              <option value="all">Todas las ramas</option>
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Buscador de Categorías con navegación 1/N */}
          <form
            onSubmit={handleSearchSubmit}
            className="join bg-base-100 rounded-lg border border-base-300 shadow-sm overflow-hidden"
          >
            <div className="join-item flex items-center px-2 text-base-content/60">
              <Icon icon="boxicons:search" width={14} height={14} />
            </div>
            <input
              type="text"
              placeholder="Buscar categoría..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-xs join-item w-36 sm:w-48 bg-transparent focus:outline-none text-xs"
            />
            {searchMatches.length > 0 && (
              <span className="join-item flex items-center px-2 text-[10px] font-mono text-base-content/70 bg-base-200">
                {currentMatchIdx + 1}/{searchMatches.length}
              </span>
            )}
            {searchMatches.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevMatch}
                  className="btn btn-xs btn-ghost join-item px-1"
                  title="Coincidencia anterior"
                >
                  <Icon icon="boxicons:chevron-up" width={14} height={14} />
                </button>
                <button
                  type="button"
                  onClick={handleNextMatch}
                  className="btn btn-xs btn-ghost join-item px-1"
                  title="Siguiente coincidencia"
                >
                  <Icon icon="boxicons:chevron-down" width={14} height={14} />
                </button>
              </>
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchMatches([]);
                  setCurrentMatchIdx(-1);
                }}
                className="btn btn-xs btn-ghost join-item px-1 text-base-content/60"
                title="Limpiar búsqueda"
              >
                <Icon icon="boxicons:x" width={14} height={14} />
              </button>
            )}
          </form>
        </div>

        {/* Lado derecho: Zoom, Expansión y Pantalla Completa */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-base-100/95 backdrop-blur-md p-1.5 rounded-box shadow-md border border-base-300">
          <ActionButton
            size="xs"
            variant="ghost"
            icon="boxicons:chevron-down-circle"
            onClick={expandAll}
            title="Expandir todo el árbol"
          >
            <span className="hidden sm:inline">Expandir</span>
          </ActionButton>

          <ActionButton
            size="xs"
            variant="ghost"
            icon="boxicons:chevron-up-circle"
            onClick={collapseAll}
            title="Colapsar todo a raíz"
          >
            <span className="hidden sm:inline">Colapsar</span>
          </ActionButton>

          <div className="divider divider-horizontal my-1 mx-0.5" />

          {/* Zoom Join */}
          <div className="join border border-base-300 rounded-lg overflow-hidden bg-base-100">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(prev * 0.85, 0.15))}
              className="btn btn-xs btn-ghost join-item px-2"
              title="Alejar zoom (-)"
            >
              <Icon icon="boxicons:minus" width={14} height={14} />
            </button>
            <span className="btn btn-ghost btn-xs join-item font-mono text-[11px] px-2 min-w-12 pointer-events-none">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(prev * 1.15, 3.0))}
              className="btn btn-xs btn-ghost join-item px-2"
              title="Acercar zoom (+)"
            >
              <Icon icon="boxicons:plus" width={14} height={14} />
            </button>
          </div>

          <ActionButton
            size="xs"
            variant="ghost"
            icon="boxicons:target-lock"
            onClick={fitToScreen}
            title="Ajustar árbol completo a la pantalla"
          >
            Ajustar
          </ActionButton>

          <div className="divider divider-horizontal my-1 mx-0.5" />

          {/* Pantalla Completa */}
          <ActionButton
            size="xs"
            variant={isFullscreen ? "secondary" : "ghost"}
            icon={isFullscreen ? "boxicons:fullscreen-exit" : "boxicons:fullscreen"}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Salir de pantalla completa (Esc)" : "Pantalla completa"}
          >
            <span>{isFullscreen ? "Salir" : "Pantalla"}</span>
          </ActionButton>
        </div>
      </div>

      {/* 2. BOTÓN FLOTANTE (FAB) DE FILTROS & POPOVER CARD */}
      <div className="absolute bottom-4 right-4 z-40 flex flex-col items-end pointer-events-auto">
        {filterPopoverOpen && (
          <div className="card w-80 bg-base-100 border border-base-300 shadow-2xl p-4 mb-2 rounded-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-base-200 pb-2 mb-3">
              <div className="flex items-center gap-1.5 font-bold text-xs text-base-content">
                <Icon icon="boxicons:filter-alt" width={16} height={16} className="text-secondary" />
                <span>Filtros de Taxonomía</span>
              </div>
              <button
                type="button"
                onClick={() => setFilterPopoverOpen(false)}
                className="btn btn-ghost btn-circle btn-xs"
              >
                <Icon icon="boxicons:x" width={16} height={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Tramo de Tickets */}
              <div>
                <label className="block text-[11px] font-semibold text-base-content/70 uppercase tracking-wider mb-1.5">
                  Volumen de Tickets
                </label>
                <select
                  value={ticketTier}
                  onChange={(e) => setTicketTier(e.target.value as any)}
                  className="select select-bordered select-xs w-full text-xs"
                >
                  <option value="all">Todos los volúmenes</option>
                  <option value="zero">Sin tickets (0 tickets)</option>
                  <option value="low">Bajo volumen (1 a 49)</option>
                  <option value="medium">Medio volumen (50 a 199)</option>
                  <option value="high">Alto volumen (200 o más)</option>
                </select>
              </div>

              {/* Anomalías Taxonómicas */}
              <div>
                <label className="block text-[11px] font-semibold text-base-content/70 uppercase tracking-wider mb-1.5">
                  Filtro por Anomalías
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: "duplicate_parent", label: "Padres duplicados" },
                    { id: "zero_volume", label: "Hojas sin tickets" },
                    { id: "leaf_internal", label: "Uso interno en hoja" },
                  ].map((anom) => {
                    const isChecked = selectedAnomalies.includes(anom.id);
                    return (
                      <label key={anom.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAnomalies((prev) => [...prev, anom.id]);
                            } else {
                              setSelectedAnomalies((prev) => prev.filter((a) => a !== anom.id));
                            }
                          }}
                          className="checkbox checkbox-secondary checkbox-xs"
                        />
                        <span className="text-xs text-base-content/80">{anom.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-between pt-2 border-t border-base-200">
                <button
                  type="button"
                  onClick={() => {
                    setTicketTier("all");
                    setSelectedAnomalies([]);
                    setSelectedBranchId(null);
                  }}
                  className="btn btn-ghost btn-xs text-xs text-base-content/60 hover:text-base-content"
                >
                  Restablecer
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPopoverOpen(false)}
                  className="btn btn-secondary btn-xs text-xs"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FAB con indicador DaisyUI */}
        <div className="indicator">
          {activeFiltersCount > 0 && (
            <span className="indicator-item badge badge-secondary badge-xs font-mono font-bold">
              {activeFiltersCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => setFilterPopoverOpen((prev) => !prev)}
            className={`btn btn-circle shadow-lg border border-base-300 ${
              activeFiltersCount > 0 ? "btn-secondary" : "btn-neutral bg-base-100 text-base-content hover:bg-base-200"
            }`}
            title="Abrir filtros de taxonomía"
          >
            <Icon icon="boxicons:filter-alt" width={20} height={20} />
          </button>
        </div>
      </div>

      {/* 3. HUD INFERIOR CON CONTADORES Y LIMPIAR FILTROS */}
      <div className="absolute bottom-3 left-3 z-30 flex items-center gap-2 pointer-events-auto bg-base-100/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-base-300 shadow-md text-xs">
        <span className="font-mono text-base-content/70">
          <strong className="text-base-content font-bold">{visibleNodes.length}</strong>/{layoutResult.nodes.length} nodos
        </span>
        <span className="text-base-content/30">•</span>
        <span className="font-mono text-base-content/70">
          Total: <strong className="text-base-content font-bold">{(filteredTree?.totalTickets || 0).toLocaleString("es-AR")}</strong> tk
        </span>
        {activeFiltersCount > 0 && (
          <>
            <span className="text-base-content/30">•</span>
            <button
              type="button"
              onClick={() => {
                setTicketTier("all");
                setSelectedAnomalies([]);
                setSelectedBranchId(null);
              }}
              className="badge badge-sm badge-secondary badge-soft hover:badge-error cursor-pointer gap-1"
            >
              <span>{activeFiltersCount} activo{activeFiltersCount > 1 ? "s" : ""}</span>
              <Icon icon="boxicons:x" width={12} height={12} />
            </button>
          </>
        )}
      </div>

      {/* 4. LIENZO ESPACIAL DE NODOS Y CONEXIONES (SVG + CARDS) */}
      <div
        className="absolute origin-top-left will-change-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: layoutResult.totalWidth,
          height: layoutResult.totalHeight,
        }}
      >
        {/* Curvas Bézier de Conexión */}
        <svg
          className="absolute inset-0 pointer-events-none overflow-visible"
          style={{ width: "100%", height: "100%" }}
        >
          {layoutResult.connections.map((c) => {
            const dx = c.to.x - c.from.x;
            const cpx1 = c.from.x + dx * 0.5;
            const cpy1 = c.from.y;
            const cpx2 = c.to.x - dx * 0.5;
            const cpy2 = c.to.y;
            const pathData = `M ${c.from.x} ${c.from.y} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${c.to.x} ${c.to.y}`;

            return (
              <path
                key={c.id}
                d={pathData}
                fill="none"
                stroke="currentColor"
                className="text-base-content/25 transition-colors"
                strokeWidth={2}
              />
            );
          })}
        </svg>

        {/* Nodos Visibles (Viewport Culling 2D) */}
        {visibleNodes.map((item) => {
          const isHighlighted = searchMatches[currentMatchIdx]?.targetId === item.node.id;
          return (
            <CategoryCanvasNodeCard
              key={item.node.id}
              item={item}
              isHighlighted={isHighlighted}
              onNodeClick={handleNodeClick}
              onToggleCollapse={toggleCollapse}
            />
          );
        })}
      </div>

      {/* 5. DRAWER DE INSPECCIÓN INTEGRADO (Garantiza visibilidad en Fullscreen nativo) */}
      {inspectedNode && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={() => setInspectedNode(null)}
          />
          <aside
            className="fixed top-0 right-0 z-50 flex h-full w-96 flex-col justify-between border-l border-base-300 bg-base-100 p-6 shadow-2xl transition-transform"
            aria-label="Inspector de categoría"
          >
            <div className="space-y-5 overflow-y-auto pr-1">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-base-200 pb-3">
                <div className="flex items-center gap-2">
                  <Icon icon="boxicons:info-circle" width={22} height={22} className="text-secondary" />
                  <h3 className="text-base font-bold text-base-content">Detalle de Categoría</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedNode(null)}
                  className="btn btn-ghost btn-circle btn-sm"
                  aria-label="Cerrar inspector"
                >
                  <Icon icon="boxicons:x" width={20} height={20} />
                </button>
              </div>

              {/* Nombre y Ruta */}
              <div>
                <span className="text-[11px] font-semibold text-base-content/60 uppercase tracking-wider">
                  Nombre
                </span>
                <p className="font-bold text-base text-base-content mt-0.5 leading-snug">
                  {inspectedNode.name}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-base-content/60 uppercase tracking-wider">
                  Ruta Jerárquica
                </span>
                <p className="mt-1 p-2 bg-base-200 rounded-box font-mono text-xs text-base-content/80 break-words leading-relaxed">
                  {inspectedNode.path}
                </p>
              </div>

              {/* Métricas clave */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-base-200/50 rounded-box border border-base-200">
                  <span className="text-xs text-base-content/60">Tickets Nivel</span>
                  <p className="font-mono text-lg font-bold text-base-content mt-1">
                    {(inspectedNode.totalTickets || 0).toLocaleString("es-AR")} tk
                  </p>
                </div>
                <div className="p-3 bg-base-200/50 rounded-box border border-base-200">
                  <span className="text-xs text-base-content/60">Profundidad</span>
                  <p className="font-mono text-lg font-bold text-base-content mt-1">
                    Nivel {inspectedNode.depth}
                  </p>
                </div>
              </div>

              {/* Estado y Anomalías */}
              <div>
                <span className="text-[11px] font-semibold text-base-content/60 uppercase tracking-wider">
                  Estado & Taxonomía
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="badge badge-sm badge-outline font-mono">
                    {inspectedNode.isLeaf ? "Nodo Hoja" : `${inspectedNode.children?.length || 0} hijos directos`}
                  </span>
                  {inspectedNode.status && (
                    <span className={getAnomalyBadgeClass(inspectedNode.status)}>
                      {inspectedNode.status}
                    </span>
                  )}
                  {inspectedNode.anomalies?.map((anom) => (
                    <span key={anom} className="badge badge-xs badge-error">
                      {anom}
                    </span>
                  ))}
                </div>
              </div>

              {/* InvGate & KB */}
              <div className="p-3.5 bg-base-200/50 rounded-box border border-base-300 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-secondary uppercase tracking-wider">
                    <Icon icon="boxicons:network-chart" width={16} height={16} />
                    <span>Catálogo InvGate</span>
                  </div>
                  {invgateStatus ? (
                    <span
                      className={`badge badge-xs ${
                        invgateStatus.existsInCatalog
                          ? "badge-success text-success-content"
                          : "badge-ghost"
                      }`}
                    >
                      {invgateStatus.existsInCatalog
                        ? `ID: ${invgateStatus.catalogId ?? inspectedNode.id}`
                        : "Fuera de catálogo"}
                    </span>
                  ) : (
                    <span className="badge badge-xs badge-ghost text-base-content/60">
                      Consultando...
                    </span>
                  )}
                </div>

                <div className="pt-1 border-t border-base-300/60">
                  <span className="text-[11px] font-semibold text-base-content/60 block mb-1">
                    Artículos KB Vinculados:
                  </span>
                  {kbLoading ? (
                    <div className="flex items-center gap-2 text-xs text-base-content/60">
                      <span className="loading loading-spinner loading-xs text-secondary" />
                      <span>Buscando artículos...</span>
                    </div>
                  ) : kbArticles.length > 0 ? (
                    <ul className="space-y-1 text-xs">
                      {kbArticles.map((art) => (
                        <li key={art.id}>
                          <a
                            href={art.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-secondary hover:underline line-clamp-1"
                          >
                            <Icon icon="boxicons:link-external" width={12} height={12} />
                            <span>{art.title}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-base-content/60 italic">Sin guías vinculadas</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer drawer */}
            <div className="border-t border-base-200 pt-4 mt-4">
              <button
                type="button"
                onClick={() => setInspectedNode(null)}
                className="btn btn-block btn-secondary btn-sm"
              >
                Cerrar Inspector
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
