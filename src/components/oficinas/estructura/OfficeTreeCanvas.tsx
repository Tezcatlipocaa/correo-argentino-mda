import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type MouseEvent,
} from "react";
import { Icon } from "@iconify/react";
import type { OfficeTreeNode } from "@/lib/offices/structure-tree";
import {
  computeTreeLayout,
  getInitialCollapsedIds,
  findPathToNode,
  filterTreeByHeadquarters,
  NODE_WIDTH,
  NODE_HEIGHT,
  type Point,
  type LayoutNode,
} from "./treeLayout";
import OfficeDetailDrawer from "./OfficeDetailDrawer";
import { officeTypeChipClassByType } from "@/lib/officeHelpers";

interface Props {
  rootNode: OfficeTreeNode;
}

export default function OfficeTreeCanvas({ rootNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // States
  const [onlyHeadquarters, setOnlyHeadquarters] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  // Initial collapsed state: root & regions expanded, deeper collapsed
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() =>
    getInitialCollapsedIds(rootNode),
  );

  // Pan & Zoom
  const [pan, setPan] = useState<Point>({ x: 60, y: 120 });
  const [zoom, setZoom] = useState<number>(0.9);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drawer / Selection
  const [selectedNode, setSelectedNode] = useState<OfficeTreeNode | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Filter root node if onlyHeadquarters or region focused
  const effectiveTree = useMemo(() => {
    let tree = rootNode;
    if (onlyHeadquarters) {
      tree = filterTreeByHeadquarters(tree) || tree;
    }
    if (selectedRegionId !== "all") {
      const regionMatch = tree.children.find((r) => r.id === selectedRegionId);
      if (regionMatch) {
        return regionMatch;
      }
    }
    return tree;
  }, [rootNode, onlyHeadquarters, selectedRegionId]);

  // Compute Layout
  const layout = useMemo(() => {
    return computeTreeLayout(effectiveTree, collapsedIds);
  }, [effectiveTree, collapsedIds]);

  // Toggle node collapse/expand
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

  // Expand all nodes
  const expandAll = useCallback(() => {
    setCollapsedIds(new Set());
  }, []);

  // Collapse back to regions (root + regions open, others closed)
  const collapseToRegions = useCallback(() => {
    setCollapsedIds(getInitialCollapsedIds(rootNode));
    setPan({ x: 60, y: 120 });
    setZoom(0.9);
  }, [rootNode]);

  // Search and navigate to node
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) {
        setSearchFeedback(null);
        return;
      }

      const path = findPathToNode(effectiveTree, q);
      if (!path) {
        setSearchFeedback(`No se encontró "${q}"`);
        return;
      }

      setSearchFeedback(null);

      // Expand all ancestors along the path
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        for (const id of path) {
          next.delete(id);
        }
        return next;
      });

      // Target node is the last in path
      const targetId = path[path.length - 1];
      const targetLayout = layout.nodes.find((n) => n.node.id === targetId);

      if (targetLayout && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const targetX = rect.width / 2 - (targetLayout.x + NODE_WIDTH / 2) * zoom;
        const targetY = rect.height / 2 - (targetLayout.y + NODE_HEIGHT / 2) * zoom;
        setPan({ x: targetX, y: targetY });

        // Select the node
        setSelectedNode(targetLayout.node);
        setIsDrawerOpen(true);
      }
    },
    [searchQuery, effectiveTree, layout.nodes, zoom],
  );

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Mouse wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((prev) => Math.min(Math.max(prev * factor, 0.25), 2.5));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Pan handlers
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

  const handleSelectNode = (node: OfficeTreeNode) => {
    setSelectedNode(node);
    setIsDrawerOpen(true);
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200 select-none shadow-sm transition-all ${
        isFullscreen ? "h-screen w-screen rounded-none border-none" : "h-[820px] w-full"
      }`}
    >
      {/* Top Toolbar */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-3 border-b border-base-300 bg-base-100/95 p-3 backdrop-blur-md shadow-xs">
        {/* Left filters: Region, Headquarters toggle, Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Region focus */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-base-content/70">Foco:</span>
            <select
              value={selectedRegionId}
              onChange={(e) => {
                setSelectedRegionId(e.target.value);
                setPan({ x: 60, y: 120 });
              }}
              className="select select-bordered select-xs text-xs bg-base-100 font-medium"
            >
              <option value="all">Todas las Regiones</option>
              {rootNode.children.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.name}
                </option>
              ))}
            </select>
          </div>

          {/* Solo Cabeceras toggle */}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-2.5 py-1 text-xs shadow-2xs hover:bg-base-200/50 transition-colors">
            <input
              id="toggle-cabeceras"
              type="checkbox"
              checked={onlyHeadquarters}
              onChange={(e) => setOnlyHeadquarters(e.target.checked)}
              className="toggle toggle-primary toggle-xs"
            />
            <span className="font-medium text-base-content/80">
              Solo Cabeceras (_0000)
            </span>
          </label>

          {/* Search box */}
          <form onSubmit={handleSearch} className="flex items-center gap-1">
            <div className="relative flex items-center">
              <input
                type="search"
                placeholder="Buscar NIS o nombre…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchFeedback(null);
                }}
                className="input input-bordered input-xs w-48 font-mono text-xs pr-7 bg-base-100"
              />
              <button
                type="submit"
                className="absolute right-1 btn btn-ghost btn-xs btn-square h-5 w-5 min-h-0 text-base-content/70 hover:text-primary"
                title="Buscar"
                aria-label="Buscar"
              >
                <Icon icon="boxicons:search" width={14} height={14} />
              </button>
            </div>
            {searchFeedback && (
              <span className="text-xs font-medium text-error">
                {searchFeedback}
              </span>
            )}
          </form>
        </div>

        {/* Right actions: Expand, Collapse, Zoom, Fullscreen */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={expandAll}
            className="btn btn-outline btn-neutral btn-xs gap-1 text-xs"
            title="Expandir todo el árbol"
          >
            <Icon icon="boxicons:chevron-down-circle" width={13} height={13} />
            <span>Expandir</span>
          </button>
          <button
            type="button"
            onClick={collapseToRegions}
            className="btn btn-outline btn-neutral btn-xs gap-1 text-xs"
            title="Volver a vista de 5 regiones"
          >
            <Icon icon="boxicons:chevron-up-circle" width={13} height={13} />
            <span>Colapsar a Regiones</span>
          </button>

          <div className="divider divider-horizontal my-1 mx-0.5" />

          {/* Zoom controls */}
          <div className="join border border-base-300 rounded-lg overflow-hidden bg-base-100">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z * 0.85, 0.25))}
              className="btn btn-ghost btn-xs join-item px-2 text-base-content/80 hover:text-base-content"
              title="Alejar zoom (-)"
              aria-label="Alejar"
            >
              <Icon icon="boxicons:minus" width={14} height={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(0.9);
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
              aria-label="Acercar"
            >
              <Icon icon="boxicons:plus" width={14} height={14} />
            </button>
          </div>

          <div className="divider divider-horizontal my-1 mx-0.5" />

          {/* Fullscreen button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="btn btn-primary btn-outline btn-xs gap-1.5 font-medium"
            title={isFullscreen ? "Salir de pantalla completa (Esc)" : "Pantalla completa"}
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

      {/* Canvas Viewport */}
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
          className="absolute inset-0 transition-transform duration-75 ease-out"
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

              return (
                <path
                  key={conn.id}
                  d={pathD}
                  fill="none"
                  stroke={conn.color || "#64748b"}
                  strokeWidth="2"
                  strokeOpacity="0.45"
                />
              );
            })}
          </svg>

          {/* Render Nodes */}
          {layout.nodes.map((item) => (
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

      {/* Drawer Inspector */}
      <OfficeDetailDrawer
        node={selectedNode}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectNode={(newNode) => setSelectedNode(newNode)}
      />
    </div>
  );
}

// Subcomponent: Individual Node Card rendered on Canvas
function CanvasNodeCard({
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
  const { node, x, y, width, height, hasChildren, isCollapsed, childrenCount } =
    layout;

  const isRoot = node.type === "root";
  const isRegion = node.type === "region";
  const isProvince = node.type === "province";
  const isBuilding = node.type === "building";
  const isOffice = node.type === "office";

  // Clean anti-slop border and styling
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
    (node.officeType && officeTypeChipClassByType[node.officeType]) ||
    "badge-ghost";

  return (
    <div
      data-node-id={node.id}
      data-node-type={node.type}
      style={containerStyle}
      onClick={onSelect}
      className={`card absolute flex flex-col justify-between overflow-hidden rounded-xl border border-base-300 bg-base-100 p-3 shadow-xs transition-all duration-150 cursor-pointer hover:border-primary/60 hover:shadow-sm ${
        isSelected ? "ring-2 ring-primary shadow-md" : ""
      }`}
    >
      {/* Node Header */}
      <div className="flex items-start justify-between gap-1.5">
        {/* Type / NIS badge */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          {isRoot && (
            <span className="badge badge-neutral badge-xs font-bold uppercase">
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
            <span className="badge badge-ghost badge-xs font-semibold">
              PROVINCIA
            </span>
          )}
          {isBuilding && (
            <span className="badge badge-secondary badge-xs font-bold">
              EDIFICIO
            </span>
          )}
          {isOffice && (
            <>
              <span className="font-mono text-xs font-bold text-primary">
                {node.code}
              </span>
              {node.isHeadquarter && (
                <span className="badge badge-primary badge-xs font-bold">
                  CABECERA
                </span>
              )}
            </>
          )}
        </div>

        {/* Expand / Collapse Button if has children */}
        {hasChildren && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="btn btn-xs btn-outline btn-neutral h-5 min-h-0 px-1.5 gap-0.5 text-[10px] font-mono leading-none"
            title={isCollapsed ? `Expandir rama (${childrenCount})` : "Colapsar rama"}
            aria-label={isCollapsed ? `Expandir rama (${childrenCount})` : "Colapsar rama"}
          >
            <Icon
              icon={isCollapsed ? "boxicons:plus" : "boxicons:minus"}
              width={10}
              height={10}
            />
            {isCollapsed && <span>{childrenCount}</span>}
          </button>
        )}
      </div>

      {/* Node Main Title */}
      <div
        className="my-1 line-clamp-2 text-xs font-bold text-base-content leading-snug"
        title={node.name}
      >
        {node.name}
      </div>

      {/* Node Footer: Metrics and info with subtle top border */}
      <div className="flex items-center justify-between border-t border-base-200 pt-1.5 text-[11px] font-mono text-base-content/70">
        {isOffice ? (
          <>
            <span className="text-info">{node.totalTerminals} term</span>
            <span
              className={
                node.totalTickets > 0
                  ? "badge badge-xs font-mono font-bold bg-warning/20 text-warning border-warning/35"
                  : "text-base-content/40"
              }
            >
              {node.totalTickets > 0 ? `${node.totalTickets} tk` : "0 tk"}
            </span>
          </>
        ) : (
          <>
            <span>{node.totalOffices} ofi</span>
            <span
              className={
                node.totalTickets > 0
                  ? "badge badge-xs font-mono font-bold bg-warning/20 text-warning border-warning/35"
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
}
