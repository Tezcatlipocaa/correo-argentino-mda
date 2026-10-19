import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Drawer from "@/components/ui/Drawer";
import type { OfficeTreeNode } from "@/lib/offices/structure-tree";
import { officeTypeChipClassByType, officeTypeLabelByType } from "@/lib/officeHelpers";

interface Props {
  node: OfficeTreeNode | null;
  open: boolean;
  onClose: () => void;
  onSelectNode?: (node: OfficeTreeNode) => void;
}

export default function OfficeDetailDrawer({
  node,
  open,
  onClose,
  onSelectNode,
}: Props) {
  const [showMapPreview, setShowMapPreview] = useState(false);

  if (!node) return null;

  const isOffice = node.type === "office";
  const isBuilding = node.type === "building";

  const rawAddress =
    node.metadata?.address ||
    (isBuilding ? node.name : "") ||
    "";
  const locality = node.metadata?.locality || "";
  const province = node.metadata?.provinceName || "";
  const region = node.metadata?.regionName || "";

  const fullAddressQuery = [rawAddress, locality, province, "Argentina"]
    .filter(Boolean)
    .join(", ");

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    fullAddressQuery,
  )}`;

  const embedMapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(
    fullAddressQuery,
  )}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  const officeChipClass =
    (node.officeType && officeTypeChipClassByType[node.officeType]) ||
    "badge badge-neutral";
  const officeTypeLabel =
    (node.officeType && officeTypeLabelByType[node.officeType]) ||
    node.officeType ||
    "Oficina";

  return (
    <Drawer
      open={open}
      onClose={() => {
        setShowMapPreview(false);
        onClose();
      }}
      size="md"
      title={
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {node.code && (
              <span className="badge badge-info badge-sm font-mono font-bold">
                NIS {node.code}
              </span>
            )}
            {node.isHeadquarter && (
              <span className="badge badge-secondary badge-sm font-bold">
                CABECERA
              </span>
            )}
            {node.officeType && (
              <span className={`badge badge-sm font-medium ${officeChipClass}`}>
                {officeTypeLabel}
              </span>
            )}
            {isBuilding && (
              <span className="badge badge-secondary badge-sm font-bold">
                EDIFICIO / SEDE
              </span>
            )}
          </div>
          <h3 className="text-base-content text-base font-bold sm:text-lg">
            {node.name}
          </h3>
        </div>
      }
      subtitle={
        locality || province ? (
          <span>
            {locality ? `${locality}, ` : ""}
            {province} {region ? `(${region})` : ""}
          </span>
        ) : undefined
      }
      footer={
        isOffice && node.code ? (
          <div className="flex items-center justify-between gap-3">
            <a
              href={`/oficinas/estadisticas/${node.code}`}
              className="btn btn-secondary btn-sm flex-1 gap-2"
              target="_blank"
              rel="noreferrer"
            >
              <span>Estadísticas de la Oficina</span>
              <span>↗</span>
            </a>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Metric KPI cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="bg-base-200/60 border-base-300 rounded-xl border p-3">
            <div className="text-base-content/60 text-xs font-medium uppercase tracking-wider">
              Tickets Activos
            </div>
            <div
              className={`mt-1 font-mono text-xl font-bold ${
                node.totalTickets > 0 ? "text-base-content font-bold" : "text-base-content/70"
              }`}
            >
              {node.totalTickets}
            </div>
          </div>

          <div className="bg-base-200/60 border-base-300 rounded-xl border p-3">
            <div className="text-base-content/60 text-xs font-medium uppercase tracking-wider">
              Terminales
            </div>
            <div className="text-info mt-1 font-mono text-xl font-bold">
              {node.totalTerminals}
            </div>
          </div>

          {isBuilding && (
            <div className="bg-base-200/60 border-base-300 rounded-xl border p-3">
              <div className="text-base-content/60 text-xs font-medium uppercase tracking-wider">
                Oficinas
              </div>
              <div className="text-secondary mt-1 font-mono text-xl font-bold">
                {node.totalOffices}
              </div>
            </div>
          )}
        </div>

        {/* Location & Address */}
        <div className="bg-base-200/40 border-base-300 space-y-2 rounded-xl border p-4">
          <div className="text-base-content/70 text-xs font-semibold uppercase tracking-wider">
            Domicilio físico
          </div>
          <div className="text-base-content text-sm font-medium">
            {rawAddress || "Sin domicilio registrado"}
          </div>
          {(locality || province) && (
            <div className="text-base-content/60 text-xs">
              {locality ? `${locality}, ` : ""}
              {province} {region ? `· Región ${region}` : ""}
            </div>
          )}
          {node.metadata?.parentNis && (
            <div className="border-base-300 mt-2 border-t pt-2 text-xs">
              <span className="text-base-content/60">Depende de NIS: </span>
              <span className="badge badge-ghost badge-xs font-mono font-bold">
                {node.metadata.parentNis}
              </span>
            </div>
          )}
        </div>

        {/* Google Maps Integration (Zero Negative Impact) */}
        <div className="bg-base-200/40 border-base-300 space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="text-base-content/80 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Icon icon="boxicons:location-pin-filled" width={16} height={16} className="text-secondary" />
              <span>Ubicación geográfica</span>
            </div>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="link link-secondary flex items-center gap-1 text-xs font-semibold"
              title="Abrir en Google Maps externo"
            >
              <span>Abrir en Maps</span>
              <Icon icon="boxicons:link-alt" width={14} height={14} />
            </a>
          </div>

          {rawAddress ? (
            <div>
              {!showMapPreview ? (
                <div className="bg-base-300/40 border-base-300 flex flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center">
                  <p className="text-base-content/60 text-xs">
                    Previsualización bajo demanda sin consumo de recursos
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowMapPreview(true)}
                    className="btn btn-outline btn-xs mt-2.5 gap-1.5"
                  >
                    <Icon icon="boxicons:map-filled" width={14} height={14} />
                    <span>Cargar vista de mapa</span>
                  </button>
                </div>
              ) : (
                <div className="border-base-300 relative h-48 w-full overflow-hidden rounded-lg border">
                  <iframe
                    title={`Mapa de ${node.name}`}
                    src={embedMapUrl}
                    className="h-full w-full border-0"
                    loading="lazy"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-base-content/50 text-xs italic">
              Esta dependencia no cuenta con domicilio para geolocalización.
            </div>
          )}
        </div>

        {/* Co-located offices if it's a building with multiple units */}
        {isBuilding && node.children.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-base-content/70 text-xs font-semibold uppercase tracking-wider">
              Unidades en este inmueble ({node.children.length})
            </div>
            <div className="divide-base-300 border-base-300 divide-y rounded-xl border bg-base-100">
              {node.children.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center justify-between p-3 hover:bg-base-200/50 cursor-pointer transition-colors"
                  onClick={() => onSelectNode?.(child)}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-secondary">
                        {child.code}
                      </span>
                      <span className="text-xs font-medium text-base-content">
                        {child.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-base-content/60">
                      {child.officeType || "Sucursal"}
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <span className="text-base-content/80 font-semibold">
                      {child.totalTickets} tkt
                    </span>
                    <span className="text-base-content/40 mx-1">·</span>
                    <span className="text-info">
                      {child.totalTerminals} term
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
