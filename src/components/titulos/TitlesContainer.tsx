"use client";

import { useState } from "react";
import { useTitles, type Title } from "@hooks/useTitlesHook";

import TitleCard from "./TitleCard";
import TitleDrawer from "./TitleDrawer";
import TitleModal from "./TitleModal";
import TitleConfirmModal from "./TitleConfirmModal";
import { TitleCardSkeleton } from "./TitleCardSkeleton";

import {
  MagnifyingGlassIcon,
  PlusCircleIcon,
  ArrowsUpDownIcon,
} from "@heroicons/react/24/outline";

import type { ModulePermission } from "@/lib/rbac";
import TitlesImportExportModal from "./TitlesImportExportModal";

/** Clases de hover/active por tono de categoría (mapa estático para Tailwind). */
const TONE_CHIP: Record<string, string> = {
  "bg-sky-300": "hover:bg-sky-300 hover:text-neutral-800",
  "bg-violet-300": "hover:bg-violet-300 hover:text-neutral-800",
  "bg-orange-300": "hover:bg-orange-300 hover:text-neutral-800",
  "bg-pink-300": "hover:bg-pink-300 hover:text-neutral-800",
  "bg-neutral-300": "hover:bg-neutral-300 hover:text-neutral-800",
  "bg-green-300": "hover:bg-green-300 hover:text-neutral-800",
  "bg-red-300": "hover:bg-red-300 hover:text-neutral-800",
};

const TONE_CHIP_ACTIVE: Record<string, string> = {
  "bg-sky-300": "bg-sky-300 text-neutral-800",
  "bg-violet-300": "bg-violet-300 text-neutral-800",
  "bg-orange-300": "bg-orange-300 text-neutral-800",
  "bg-pink-300": "bg-pink-300 text-neutral-800",
  "bg-neutral-300": "bg-neutral-300 text-neutral-800",
  "bg-green-300": "bg-green-300 text-neutral-800",
  "bg-red-300": "bg-red-300 text-neutral-800",
};

interface Props {
  permissions: ModulePermission;
  loggedIn: boolean;
  /** Base del front de InvGate para links a artículos de KB. */
  invgateBase?: string;
}

export default function TitlesContainer({
  permissions,
  loggedIn,
  invgateBase = "",
}: Props) {
  const {
    loading,
    filters,
    filteredTitles,
    searchQuery,
    activeFilter,
    favorites,
    pendingFavorites,
    setSearchQuery,
    setActiveFilter,
    toggleFavorite,
    copyToClipboard,
    createTitle,
    updateTitle,
    deleteTitle,
    refreshTitles,
    categories,
  } = useTitles({ permissions, loggedIn });

  const [selectedTitle, setSelectedTitle] = useState<Title | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);

  const [titleToDelete, setTitleToDelete] = useState<Title | null>(null);

  const handleOpenDrawer = (title: Title) => {
    setSelectedTitle(title);
    setDrawerOpen(true);
  };

  const handleCreate = () => {
    setSelectedTitle(null);
    setCreateModalOpen(true);
  };

  const handleEdit = () => {
    if (!selectedTitle) return;

    setDrawerOpen(false);

    setEditModalOpen(true);
  };

  const handleDelete = (title: Title) => {
    setTitleToDelete(title);
    console.log(titleToDelete?.name);

    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!titleToDelete) return;

    const ok = await deleteTitle(titleToDelete.id);

    if (ok) {
      setDeleteModalOpen(false);

      setTitleToDelete(null);
    }
  };

  return (
    <div className="flex flex-col">
      <header className="bg-base-100 border-base-300/40 sticky -top-6 z-10 flex h-28 w-full flex-row items-center border-b pt-3 pb-4">
        <article>
          <label className="input group w-full max-w-xl rounded-md">
            <MagnifyingGlassIcon className="group-hover:text-primary size-6 opacity-50 transition group-hover:opacity-100" />
            <input
              type="search"
              className="grow"
              placeholder="Buscar título"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <div className="mt-4 flex items-center gap-x-2">
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <button
                    key={index}
                    className="btn btn-xs skeleton h-6 w-16 shadow-none"
                  />
                ))
              : filters.map((filter) => {
                  const isActive = activeFilter === filter.label;
                  const toneClass = filter.tone
                    ? TONE_CHIP[filter.tone] ?? ""
                    : "hover:btn-primary";
                  const activeClass = filter.tone
                    ? isActive
                      ? TONE_CHIP_ACTIVE[filter.tone] ?? ""
                      : ""
                    : isActive
                      ? "btn-primary"
                      : "";
                  return (
                    <button
                      key={filter.label}
                      onClick={() => setActiveFilter(filter.label)}
                      className={`btn btn-xs shadow-none ${toneClass} ${activeClass}`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
          </div>
        </article>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="btn btn-sm btn-ghost shadow-none"
            onClick={() => setImportExportOpen(true)}
            title="Importar / Exportar"
          >
            <ArrowsUpDownIcon className="size-5" />
            Importar / Exportar
          </button>
          {permissions.canWrite && (
            <button
              className="btn btn-sm btn-primary shadow-none"
              onClick={handleCreate}
            >
              <PlusCircleIcon className="size-5" />
              Nuevo título
            </button>
          )}
        </div>
      </header>
      <section className="rounded-box min-h-128 pb-4">
        {loading ? (
          <TitleCardSkeleton count={30} />
        ) : (
          <>
            {filteredTitles.length === 0 ? (
              <div className="bg-base-200 rounded-box mt-4 flex h-48 w-full flex-col items-center justify-center gap-y-1">
                <h3 className="text-xl font-semibold">
                  No se encontraron coincidencias
                </h3>
                <p className="text-sm opacity-70">Intentá con otro término</p>
              </div>
            ) : (
              <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredTitles.map((title) => (
                  <TitleCard
                    key={title.id}
                    title={title}
                    onOpen={handleOpenDrawer}
                    isFavorite={favorites.has(title.id)}
                    canFavorite={loggedIn}
                    isFavoritePending={pendingFavorites.has(title.id)}
                    onToggleFavorite={toggleFavorite}
                    onCopy={copyToClipboard}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </section>
      <TitleDrawer
        open={drawerOpen}
        title={selectedTitle}
        onClose={() => setDrawerOpen(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCopy={copyToClipboard}
        permissions={permissions}
        invgateBase={invgateBase}
        onFilterCategory={(category) => setActiveFilter(category)}
        onSearchService={(service) => setSearchQuery(service)}
      />
      <TitleModal
        open={createModalOpen}
        mode="create"
        categories={categories}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={createTitle}
      />
      <TitleModal
        open={editModalOpen}
        mode="edit"
        title={selectedTitle}
        categories={categories}
        onClose={() => setEditModalOpen(false)}
        onSubmit={(data) => updateTitle(selectedTitle!.id, data)}
      />
      <TitleConfirmModal
        open={deleteModalOpen}
        title={`${titleToDelete?.name}`}
        message={`¿Seguro que deseas eliminar este título? Esta acción no se puede deshacer.`}
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
      />
      <TitlesImportExportModal
        open={importExportOpen}
        canImport={permissions.canWrite}
        onClose={() => setImportExportOpen(false)}
        onImported={refreshTitles}
      />
    </div>
  );
}
