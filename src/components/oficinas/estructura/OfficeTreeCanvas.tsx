import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  memo,
  type MouseEvent,
} from "react";
import { Icon } from "@iconify/react";
import type { OfficeTreeNode } from "@/lib/offices/structure-tree";
import {
  computeTreeLayout,
  getInitialCollapsedIds,
  findAllMatchingNodes,
  filterOfficeTree,
  extractAvailableOfficeTypes,
  computeFitToScreen,
  filterVisibleViewport,
  NODE_WIDTH,
  NODE_HEIGHT,
  type Point,
  type LayoutNode,
  type OfficeFilterOptions,
  type NodeMatchResult,
} from "./treeLayout";
import OfficeDetailDrawer from "./OfficeDetailDrawer";
import ActionButton from "@/components/ui/ActionButton";
import { officeTypeChipClassByType, officeTypeLabelByType } from "@/lib/officeHelpers";

interface Props {
  rootNode: OfficeTreeNode;
}

export default function OfficeTreeCanvas({ rootNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtros avanzados
  const [filters, setFilters] = useState<OfficeFilterOptions>({
    headquartersMode: "all",
    ticketTier: "all",
    officeTypes: [],
    regionId: "all",
    terminalsMode: "all",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Tipos de oficina disponibles con conteo dinámico
  const availableOfficeTypes = useMemo(() => {
    return extractAvailableOfficeTypes(rootNode);
  }, [rootNode]);

  // Búsqueda interactiva con navegación 1/N
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NodeMatchResult[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  // Estado colapsado inicial
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() =>
    getInitialCollapsedIds(rootNode),
  );

  // Pan & Zoom
  const [pan, setPan] = useState<Point>({ x: 60, y: 120 });
  const [zoom, setZoom] = useState<number>(0.85);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drawer / Selección
  const [selectedNode, setSelectedNode] = useState<OfficeTreeNode | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Dimensiones del contenedor para Culling y Fit
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 860 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height),
        });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Árbol efectivo con filtros avanzados aplicados
  const effectiveTree = useMemo(() => {
    const filtered = filterOfficeTree(rootNode, filters);
    return filtered || rootNode;
  }, [rootNode, filters]);

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.headquartersMode && filters.headquartersMode !== "all") count++;
    if (filters.ticketTier && filters.ticketTier !== "all") count++;
    if (filters.minTickets && filters.minTickets > 0) count++;
    if (filters.officeTypes && filters.officeTypes.length > 0) count += filters.officeTypes.length;
    if (filters.regionId && filters.regionId !== "all") count++;
    if (filters.terminalsMode && filters.terminalsMode !== "all") count++;
    return count;
  }, [filters]);

  // Layout completo de nodos y conexiones
  const layout = useMemo(() => {
    return computeTreeLayout(effectiveTree, collapsedIds);
  }, [effectiveTree, collapsedIds]);

  // Viewport Culling 2D: Solo renderizar nodos dentro del viewport visible
  const visibleNodes = useMemo(() => {
    return filterVisibleViewport(layout.nodes, {
      pan,
      zoom,
      viewportWidth: containerSize.width,
      viewportHeight: containerSize.height,
      overscan: 350,
    });
  }, [layout.nodes, pan, zoom, containerSize]);

  // Ruta activa para resaltado visual en las conexiones SVG
  const activePathSet = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const matches = findAllMatchingNodes(effectiveTree, selectedNode.code || selectedNode.name);
    const target = matches.find((m) => m.targetId === selectedNode.id);
    return new Set(target ? target.path : [selectedNode.id]);
  }, [selectedNode, effectiveTree]);

  // Toggle colapsar/expandir
  const toggleCollapse = useCallback((id: string, e?: MouseEvent) => {
    if (e) e.stopPropagation();
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

  const expandAll = useCallback(() => {
    setCollapsedIds(new Set());
  }, []);

  const collapseToRegions = useCallback(() => {
    setCollapsedIds(getInitialCollapsedIds(rootNode));
    setPan({ x: 60, y: 120 });
    setZoom(0.85);
  }, [rootNode]);

  // Ajustar a pantalla inteligente
  const handleFitToScreen = useCallback(() => {
    const fit = computeFitToScreen({
      totalWidth: layout.totalWidth,
      totalHeight: layout.totalHeight,
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
      padding: 48,
    });
    setPan(fit.pan);
    setZoom(fit.zoom);
  }, [layout.totalWidth, layout.totalHeight, containerSize]);

  // Búsqueda con navegación 1/N
  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) {
        setSearchResults([]);
        setSearchFeedback(null);
        return;
      }

      const matches = findAllMatchingNodes(effectiveTree, q);
      if (matches.length === 0) {
        setSearchResults([]);
        setSearchFeedback(`Sin resultados para "${q}"`);
        return;
      }

      setSearchResults(matches);
      setCurrentMatchIndex(0);
      setSearchFeedback(null);

      // Enfocar el primer resultado
      focusMatch(matches[0]);
    },
    [searchQuery, effectiveTree],
  );

  const focusMatch = useCallback(
    (match: NodeMatchResult) => {
      // Expandir ancestros
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        for (const id of match.path) {
          next.delete(id);
        }
        return next;
      });

      const targetLayout = layout.nodes.find((n) => n.node.id === match.targetId);
      if (targetLayout) {
        const targetX = containerSize.width / 2 - (targetLayout.x + NODE_WIDTH / 2) * zoom;
        const targetY = containerSize.height / 2 - (targetLayout.y + NODE_HEIGHT / 2) * zoom;
        setPan({ x: targetX, y: targetY });
        setSelectedNode(match.node);
      }
    },
    [layout.nodes, containerSize, zoom],
  );

  const nextMatch = useCallback(() => {
    if (searchResults.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchResults.length;
    setCurrentMatchIndex(nextIdx);
    focusMatch(searchResults[nextIdx]);
  }, [searchResults, currentMatchIndex, focusMatch]);

  const prevMatch = useCallback(() => {
    if (searchResults.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentMatchIndex(prevIdx);
    focusMatch(searchResults[prevIdx]);
  }, [searchResults, currentMatchIndex, focusMatch]);

  // Alternar pantalla completa nativa + fallback CSS
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen((prev) => !prev));
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Zoom anclado al puntero (Zoom-to-Pointer)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: globalThis.WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          "[data-floating-control], [data-drawer-root], aside, [role='dialog'], .overflow-y-auto"
        )
      ) {
        return;
      }
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.12 : 0.88;

      setZoom((prevZoom) => {
        const newZoom = Math.min(Math.max(prevZoom * factor, 0.2), 2.5);
        setPan((prevPan) => {
          const treeX = (cursorX - prevPan.x) / prevZoom;
          const treeY = (cursorY - prevPan.y) / prevZoom;
          return {
            x: Math.round(cursorX - treeX * newZoom),
            y: Math.round(cursorY - treeY * newZoom),
          };
        });
        return newZoom;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Handlers de Pan sin lag de transición
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isDrawerOpen) return;
    if (
      (e.target as HTMLElement)?.closest(
        "[data-floating-control], aside, [role='dialog'], button, input, select"
      )
    ) {
      return;
    }
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

  const handleSelectNode = useCallback((node: OfficeTreeNode) => {
    setSelectedNode(node);
    setIsDrawerOpen(true);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({
      headquartersMode: "all",
      ticketTier: "all",
      officeTypes: [],
      regionId: "all",
      terminalsMode: "all",
    });
    setIsFilterOpen(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200 select-none shadow-sm transition-all ${
        isFullscreen
          ? "fixed inset-0 z-[200] h-dvh w-dvw rounded-none border-none bg-base-100"
          : "h-[calc(100dvh-9rem)] min-h-[780px] lg:min-h-[860px] w-full"
      }`}
    >
      {/* Top Toolbar Estandarizada con DaisyUI v5 y ActionButton */}
      <div
        data-floating-control
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="z-20 flex flex-wrap items-center justify-between gap-3 border-b border-base-300 bg-base-100/95 p-3 backdrop-blur-md shadow-xs"
      >
        {/* Izquierda: Foco regional, Buscador 1/N */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Foco de Región */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-base-content/70">Foco:</span>
            <select
              value={filters.regionId || "all"}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, regionId: e.target.value }));
                setPan({ x: 60, y: 120 });
              }}
              className="select select-xs text-xs bg-base-100 font-medium rounded-lg"
              aria-label="Filtrar por región"
            >
              <option value="all">Todas las Regiones</option>
              {rootNode.children.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.name}
                </option>
              ))}
            </select>
          </div>

          <div className="divider divider-horizontal my-1 mx-0.5" />

          {/* Buscador interactivo 1/N */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
            <div className="relative flex items-center">
              <input
                type="search"
                placeholder="Buscar NIS o nombre…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchFeedback(null);
                  if (!e.target.value.trim()) setSearchResults([]);
                }}
                className="input input-xs w-44 sm:w-56 font-mono text-xs pr-7 bg-base-100 rounded-lg"
                aria-label="Buscar oficina o dependencia"
              />
              <button
                type="submit"
                className="btn btn-ghost btn-xs btn-square absolute right-1 h-5 w-5 min-h-0 text-base-content/70 hover:text-secondary"
                title="Buscar"
                aria-label="Ejecutar búsqueda"
              >
                <Icon icon="boxicons:search" width={14} height={14} />
              </button>
            </div>

            {/* Navegación 1/N si hay coincidencias */}
            {searchResults.length > 0 && (
              <div className="join border border-base-300 rounded-lg overflow-hidden bg-base-100 shadow-2xs">
                <span className="join-item px-2 py-0.5 text-[11px] font-mono text-base-content/80 flex items-center">
                  {currentMatchIndex + 1}/{searchResults.length}
                </span>
                <button
                  type="button"
                  onClick={prevMatch}
                  className="btn btn-ghost btn-xs join-item px-1.5 text-base-content/70 hover:text-base-content"
                  title="Coincidencia anterior"
                  aria-label="Anterior coincidencia"
                >
                  <Icon icon="boxicons:chevron-up" width={13} height={13} />
                </button>
                <button
                  type="button"
                  onClick={nextMatch}
                  className="btn btn-ghost btn-xs join-item px-1.5 text-base-content/70 hover:text-base-content"
                  title="Siguiente coincidencia"
                  aria-label="Siguiente coincidencia"
                >
                  <Icon icon="boxicons:chevron-down" width={13} height={13} />
                </button>
              </div>
            )}

            {searchFeedback && (
              <span className="text-xs font-medium text-error">{searchFeedback}</span>
            )}
          </form>
        </div>

        {/* Derecha: Expandir, Colapsar, Fit-to-screen, Zoom join, Fullscreen */}
        <div className="flex items-center gap-1.5">
          <ActionButton
            size="xs"
            color="btn-neutral"
            ghost
            icon="boxicons:chevron-down-circle"
            label="Expandir"
            title="Expandir todo el árbol postal"
            onClick={expandAll}
          />

          <ActionButton
            size="xs"
            color="btn-neutral"
            ghost
            icon="boxicons:chevron-up-circle"
            label="Regiones"
            title="Colapsar a vista de regiones"
            onClick={collapseToRegions}
          />

          <ActionButton
            size="xs"
            color="btn-neutral"
            ghost
            icon="boxicons:scan"
            label="Encuadrar"
            title="Ajustar árbol a la pantalla (Fit-to-Screen)"
            onClick={handleFitToScreen}
          />

          <div className="divider divider-horizontal my-1 mx-0.5" />

          {/* Zoom controls */}
          <div className="join border border-base-300 rounded-lg overflow-hidden bg-base-100">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z * 0.85, 0.2))}
              className="btn btn-ghost btn-xs join-item px-2 text-base-content/80 hover:text-base-content"
              title="Alejar zoom (-)"
              aria-label="Alejar zoom"
            >
              <Icon icon="boxicons:minus" width={14} height={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(0.85);
                setPan({ x: 60, y: 120 });
              }}
              className="btn btn-ghost btn-xs join-item font-mono text-[11px] px-2 min-w-[3.25rem] text-center"
              title="Restablecer zoom y posición"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z * 1.15, 2.5))}
              className="btn btn-ghost btn-xs join-item px-2 text-base-content/80 hover:text-base-content"
              title="Acercar zoom (+)"
              aria-label="Acercar zoom"
            >
              <Icon icon="boxicons:plus" width={14} height={14} />
            </button>
          </div>

          <div className="divider divider-horizontal my-1 mx-0.5" />

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="btn btn-xs btn-outline btn-secondary gap-1.5 font-medium rounded-lg"
            title={isFullscreen ? "Salir de pantalla completa (Esc)" : "Pantalla completa"}
            aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            <Icon
              icon={isFullscreen ? "boxicons:fullscreen-exit" : "boxicons:fullscreen"}
              width={14}
              height={14}
            />
            <span>{isFullscreen ? "Salir" : "Pantalla completa"}</span>
          </button>
        </div>
      </div>

      {/* Canvas Viewport Interactivo */}
      <div
        className="relative flex-1 cursor-grab overflow-hidden active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: layout.totalWidth + 400,
            height: layout.totalHeight + 400,
          }}
          className={`absolute inset-0 ${isDragging ? "" : "transition-transform duration-75 ease-out"}`}
        >
          {/* SVG Connection Lines */}
          <svg
            data-tree-canvas
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ width: "100%", height: "100%" }}
          >
            {layout.connections.map((conn) => {
              const deltaX = conn.to.x - conn.from.x;
              const cp1X = conn.from.x + deltaX * 0.5;
              const cp2X = conn.to.x - deltaX * 0.5;
              const pathD = `M ${conn.from.x} ${conn.from.y} C ${cp1X} ${conn.from.y}, ${cp2X} ${conn.to.y}, ${conn.to.x} ${conn.to.y}`;

              const isHighlighted =
                activePathSet.has(conn.fromId) && activePathSet.has(conn.toId);

              return (
                <path
                  key={conn.id}
                  d={pathD}
                  fill="none"
                  stroke="currentColor"
                  className={`transition-colors ${
                    isHighlighted ? "text-secondary stroke-[2.5]" : "text-base-content/25 stroke-[1.5]"
                  }`}
                />
              );
            })}
          </svg>

          {/* Nodos Visibles vía Viewport Culling */}
          {visibleNodes.map((item) => (
            <CanvasNodeCard
              key={item.node.id}
              layout={item}
              isSelected={selectedNode?.id === item.node.id}
              onToggleCollapse={(e) => toggleCollapse(item.node.id, e)}
              onSelect={() => handleSelectNode(item.node)}
            />
          ))}
        </div>
      </div>

      {/* HUD Inferior Izquierdo: Resumen y Chips de Filtros Activos */}
      <div
        data-floating-control
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute bottom-4 left-4 z-20 flex flex-col gap-2 max-w-md pointer-events-none"
      >
        <div
          data-floating-control
          className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-base-100/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-base-300 shadow-sm text-xs font-mono"
        >
          <span className="font-semibold text-base-content/80">
            {effectiveTree.totalOffices.toLocaleString("es-AR")} oficinas
          </span>
          <span className="text-base-content/30">·</span>
          <span className="text-info font-medium">
            {effectiveTree.totalTerminals.toLocaleString("es-AR")} term
          </span>
          <span className="text-base-content/30">·</span>
          <span className="text-base-content font-bold">
            {effectiveTree.totalTickets.toLocaleString("es-AR")} tickets
          </span>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="badge badge-soft badge-error badge-xs ml-1 cursor-pointer font-sans hover:opacity-80"
              title="Limpiar todos los filtros"
            >
              Limpiar ({activeFiltersCount}) ×
            </button>
          )}
        </div>
      </div>

      {/* Botón Flotante (FAB con Indicator) en Esquina Inferior Derecha */}
      <div
        data-floating-control
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-3"
      >
        {/* Panel de Filtros Flotante Popover Card */}
        {isFilterOpen && (
          <div
            data-floating-control
            onWheel={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="card bg-base-100/98 backdrop-blur-lg border border-base-300 shadow-2xl w-80 sm:w-96 p-4 text-xs space-y-4 rounded-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-base-200 pb-2.5">
              <div className="flex items-center gap-2">
                <Icon icon="boxicons:filter" width={18} height={18} className="text-secondary" />
                <h4 className="font-bold text-sm text-base-content">Filtros de Red Postal</h4>
              </div>
              <div className="flex items-center gap-1">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="btn btn-ghost btn-xs text-error font-medium"
                  >
                    Restablecer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="btn btn-ghost btn-xs btn-circle"
                  aria-label="Cerrar panel de filtros"
                >
                  <Icon icon="boxicons:x" width={16} height={16} />
                </button>
              </div>
            </div>

            {/* 1. Jerarquía / Cabeceras */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-base-content/70">
                Jerarquía Edilicia
              </label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, headquartersMode: "all" }))
                  }
                  className={`btn btn-xs ${filters.headquartersMode === "all" ? "btn-secondary" : "btn-outline btn-neutral"}`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, headquartersMode: "hq_only" }))
                  }
                  className={`btn btn-xs ${filters.headquartersMode === "hq_only" ? "btn-secondary" : "btn-outline btn-neutral"}`}
                >
                  Cabeceras
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, headquartersMode: "dependent_only" }))
                  }
                  className={`btn btn-xs ${filters.headquartersMode === "dependent_only" ? "btn-secondary" : "btn-outline btn-neutral"}`}
                >
                  Dependientes
                </button>
              </div>
            </div>

            {/* 2. Tickets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-base-content/70">
                Tickets Activos
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: "all", label: "Todos" },
                  { id: "with_tickets", label: "> 0 tk" },
                  { id: "high_tickets", label: "≥ 50 tk" },
                  { id: "zero_tickets", label: "0 tk" },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        ticketTier: tier.id as OfficeFilterOptions["ticketTier"],
                      }))
                    }
                    className={`btn btn-xs ${filters.ticketTier === tier.id ? "btn-secondary" : "btn-outline btn-neutral"}`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Tipos de Sucursal dinámicos de la base de datos */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-base-content/70">
                  Tipo de Sucursal ({availableOfficeTypes.length})
                </label>
                {filters.officeTypes && filters.officeTypes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, officeTypes: [] }))}
                    className="text-[10px] text-secondary hover:underline"
                  >
                    Todos
                  </button>
                )}
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-base-200 rounded-lg p-2 bg-base-200/30">
                {availableOfficeTypes.map((t) => {
                  const isChecked = filters.officeTypes?.includes(t.type);
                  return (
                    <label
                      key={t.type}
                      className="flex items-center justify-between gap-2 p-1 rounded hover:bg-base-200/60 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(isChecked)}
                          onChange={() => {
                            setFilters((prev) => {
                              const curr = prev.officeTypes || [];
                              const next = curr.includes(t.type)
                                ? curr.filter((x) => x !== t.type)
                                : [...curr, t.type];
                              return { ...prev, officeTypes: next };
                            });
                          }}
                          className="checkbox checkbox-xs checkbox-secondary"
                        />
                        <span className="text-xs font-medium text-base-content">
                          {officeTypeLabelByType[t.type] || t.label}
                        </span>
                      </div>
                      <span className="badge badge-ghost badge-xs font-mono">{t.count}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 4. Terminales */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-base-content/70">
                Equipamiento Terminales
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: "all", label: "Todas" },
                  { id: "with_terminals", label: "Con Puestos" },
                  { id: "zero_terminals", label: "Sin Puestos" },
                ].map((term) => (
                  <button
                    key={term.id}
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        terminalsMode: term.id as OfficeFilterOptions["terminalsMode"],
                      }))
                    }
                    className={`btn btn-xs ${filters.terminalsMode === term.id ? "btn-secondary" : "btn-outline btn-neutral"}`}
                  >
                    {term.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FAB Trigger Button */}
        <div
          data-floating-control
          onWheel={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="indicator"
        >
          {activeFiltersCount > 0 && (
            <span className="indicator-item badge badge-secondary badge-xs font-mono font-bold">
              {activeFiltersCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            className={`btn btn-circle shadow-lg transition-transform ${
              isFilterOpen ? "btn-secondary rotate-90" : "btn-neutral hover:scale-105"
            }`}
            title="Abrir filtros de oficinas"
            aria-label="Abrir filtros de oficinas"
            aria-expanded={isFilterOpen}
          >
            <Icon icon="boxicons:filter" width={22} height={22} />
          </button>
        </div>
      </div>

      {/* Drawer Inspector de Detalle */}
      <OfficeDetailDrawer
        node={selectedNode}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectNode={(newNode) => setSelectedNode(newNode)}
      />
    </div>
  );
}

// Subcomponente memoizado: Tarjeta individual de nodo (280x108px con anti-clipping)
const CanvasNodeCard = memo(function CanvasNodeCard({
  layout,
  isSelected,
  onToggleCollapse,
  onSelect,
}: {
  layout: LayoutNode;
  isSelected: boolean;
  onToggleCollapse: (e: MouseEvent) => void;
  onSelect: () => void;
}) {
  const { node, x, y, width, height, hasChildren, isCollapsed, childrenCount } = layout;

  const isRoot = node.type === "root";
  const isRegion = node.type === "region";
  const isProvince = node.type === "province";
  const isBuilding = node.type === "building";
  const isOffice = node.type === "office";

  let containerStyle: React.CSSProperties = {
    left: x,
    top: y,
    width,
    height,
  };

  if (isRegion && node.color) {
    containerStyle.boxShadow = isSelected
      ? `0 0 0 2px ${node.color}, 0 4px 12px rgba(0,0,0,0.2)`
      : `0 0 0 1px ${node.color}55`;
  }

  const officeChipClass =
    (node.officeType && officeTypeChipClassByType[node.officeType]) || "badge-ghost";
  const officeTypeLabel =
    (node.officeType && officeTypeLabelByType[node.officeType]) || node.officeType || "Oficina";

  return (
    <div
      data-node-id={node.id}
      data-node-type={node.type}
      style={containerStyle}
      onClick={onSelect}
      className={`card absolute flex flex-col justify-between overflow-hidden rounded-xl border border-base-300 bg-base-100 p-3 shadow-xs transition-all duration-150 cursor-pointer hover:border-secondary hover:shadow-sm ${
        isSelected ? "ring-2 ring-secondary shadow-md" : ""
      }`}
    >
      {/* Encabezado: Badges e ícono de expandir */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-1.5 overflow-hidden flex-wrap max-h-5">
          {isRoot && (
            <span className="badge badge-neutral badge-xs font-bold uppercase tracking-wide">
              RED
            </span>
          )}
          {isRegion && (
            <span
              style={{ backgroundColor: `${node.color}22`, color: node.color }}
              className="badge badge-xs font-bold"
            >
              {node.id.replace("reg-", "")}
            </span>
          )}
          {isProvince && (
            <span className="badge badge-ghost badge-xs font-semibold uppercase">PROVINCIA</span>
          )}
          {isBuilding && (
            <span className="badge badge-secondary badge-soft badge-xs font-bold">EDIFICIO</span>
          )}
          {isOffice && (
            <>
              <span className="font-mono text-xs font-bold text-secondary">{node.code}</span>
              {node.isHeadquarter && (
                <span className="badge badge-secondary badge-xs font-bold">CABECERA</span>
              )}
              {node.officeType && (
                <span className={`badge badge-xs font-medium truncate max-w-[6.5rem] ${officeChipClass}`}>
                  {officeTypeLabel}
                </span>
              )}
            </>
          )}
        </div>

        {/* Botón Plegar / Expandir */}
        {hasChildren && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="btn btn-xs btn-outline btn-neutral h-5 min-h-0 px-1.5 gap-0.5 text-[10px] font-mono leading-none rounded-md shrink-0"
            title={isCollapsed ? `Expandir rama (${childrenCount})` : "Colapsar rama"}
            aria-label={isCollapsed ? `Expandir rama (${childrenCount})` : "Colapsar rama"}
          >
            <Icon icon={isCollapsed ? "boxicons:plus" : "boxicons:minus"} width={10} height={10} />
            {isCollapsed && <span>{childrenCount}</span>}
          </button>
        )}
      </div>

      {/* Título de 2 líneas */}
      <div className="w-full text-left my-1 line-clamp-2 text-xs font-bold text-base-content leading-snug">
        {node.name}
      </div>

      {/* Pie: Métricas numéricas con borde superior sutil */}
      <div className="flex items-center justify-between border-t border-base-200 pt-1.5 text-[11px] font-mono text-base-content/70">
        {isOffice ? (
          <>
            <span className="text-info font-medium">{node.totalTerminals} term</span>
            <span
              className={
                node.totalTickets > 0
                  ? "badge badge-xs font-mono font-medium badge-soft badge-neutral text-base-content"
                  : "text-base-content/40"
              }
            >
              {node.totalTickets > 0 ? `${node.totalTickets} tk` : "0 tk"}
            </span>
          </>
        ) : (
          <>
            <span className="font-medium">{node.totalOffices} ofi</span>
            <span
              className={
                node.totalTickets > 0
                  ? "badge badge-xs font-mono font-medium badge-soft badge-neutral text-base-content"
                  : "text-base-content/40"
              }
            >
              {node.totalTickets > 0 ? `${node.totalTickets} tk` : "0 tk"}
            </span>
          </>
        )}
      </div>
    </div>
  );
});
