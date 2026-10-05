import type { Title } from "@hooks/useTitlesHook";
import { Icon } from "@iconify/react";
import { kbArticleUrlFromBase } from "@lib/invgate/kb";
import { splitTitleName, serviceChipLabel } from "@lib/titles/titleParts";

import type { ModulePermission } from "@/lib/rbac";

interface Props {
  open: boolean;
  title: Title | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (title: Title) => void;
  onCopy: (title: string) => void;
  permissions: ModulePermission;
  /** Base del front de InvGate para links a artículos de KB. */
  invgateBase?: string;
  /** Filtra la vista principal por categoría y cierra el drawer. */
  onFilterCategory: (category: string) => void;
  /** Busca en el listado por servicio/CI y cierra el drawer. */
  onSearchService: (service: string) => void;
}

export default function TitleDrawer({
  open,
  title,
  onClose,
  onEdit,
  onDelete,
  onCopy,
  permissions,
  invgateBase = "",
  onFilterCategory,
  onSearchService,
}: Props) {
  const parts = title ? splitTitleName(title.name) : null;
  const service = title ? serviceChipLabel(title.name) : null;
  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[190] bg-black/80 transition-opacity duration-200 ${
          open ? "visible opacity-100" : "invisible opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      {/* Drawer */}
      <aside
        className={`bg-base-100 fixed inset-y-0 right-0 z-200 flex w-full max-w-105 flex-col justify-between overflow-y-auto pt-6 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
      >
        <section className="px-4">
          <header className="mb-4 flex flex-col gap-2">
<h3
              className="cursor-pointer font-bold transition-colors hover:text-primary"
              onClick={() => title && onCopy(title.name)}
              title="Copiar título completo"
            >
              {parts?.detail || title?.name || ""}
            </h3>

            <div className="flex flex-wrap items-center gap-1.5">
              {title?.category && (
                <button
                  type="button"
                  onClick={() => {
                    onFilterCategory(title.category!);
                    onClose();
                  }}
                  className={`badge badge-sm cursor-pointer border-none text-neutral-800 ${title.tone}`}
                  title={`Filtrar por ${title.category}`}
                >
                  {title.category}
                </button>
              )}
              {service && (
                <>
                  <span className="text-base-content/40 text-xs" aria-hidden="true">
                    &gt;
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onSearchService(service);
                      onClose();
                    }}
                    className={`badge badge-sm cursor-pointer border-none text-neutral-800 ${title?.tone ?? ""}`}
                    title={`Buscar "${service}"`}
                  >
                    {service}
                  </button>
                </>
              )}
            </div>

            
          </header>

          {title?.route ? (
            <div>
              <h4 className="bg-base-200/40 rounded-md px-3 py-2 text-xs">
                {title.route}
              </h4>
            </div>
          ) : (
            <p className="text-base-300 text-xs italic">
              Sin ruta en Invgate asignada
            </p>
          )}

          {title?.description && (
            <>
              <div className="divider mt-6 text-xs">Descripción</div>
              <div className="bg-base-200/40 rounded-md p-4 text-sm whitespace-pre-wrap">
                {title.description}
              </div>
            </>
          )}

          {!title?.description && (
            <div className="bg-base-200/40 mt-6 rounded-md p-4 text-sm">
              No hay información relacionada.
            </div>
          )}

          {title?.articleOnKdb && (
            <>
              <div className="divider mt-6 text-xs">
                Base de conocimientos
              </div>
              <a
                href={kbArticleUrlFromBase(invgateBase, title.articleOnKdb)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-base-200/40 hover:bg-base-200 flex items-start gap-2 rounded-md p-3 text-sm transition-colors group"
              >
                {/* Outline en reposo; filled + primary en hover (dos capas). */}
                <span className="relative mt-0.5 grid size-[18px] shrink-0 place-items-center">
                  <Icon
                    icon="boxicons:book-open"
                    style={{ fontSize: 18 }}
                    className="text-base-content/70 transition-opacity group-hover:opacity-0"
                  />
                  <Icon
                    icon="boxicons:book-open-filled"
                    style={{ fontSize: 18 }}
                    className="absolute inset-0 text-neutral-950 opacity-0 transition-opacity group-hover:opacity-100 dark:[&_path]:fill-primary"
                  />
                </span>
                <span className="min-w-0">
                  {title.articleOnKdbTitle ?? `Artículo #${title.articleOnKdb}`}
                </span>
              </a>
            </>
          )}
        </section>

        <section className="bg-base-200 sticky bottom-0 mt-8 min-h-20 px-4">
          <div className="flex h-full w-full items-center justify-center gap-x-2">
            <button
              className="btn bg-base-300 hover:bg-primary grow shadow-none hover:text-neutral-800"
              onClick={() => title && onCopy(title.name)}
              disabled={!title}
            >
              Copiar título
            </button>

            {permissions.canWrite && (
              <div className="flex">
                <div className="tooltip" data-tip="Editar">
                  <button
                    className="btn btn-ghost shadow-none"
                    onClick={onEdit}
                    disabled={!title}
                  >
                    <Icon icon="boxicons:edit" style={{ fontSize: 22 }} />
                  </button>
                </div>
                <div className="tooltip" data-tip="Eliminar">
                  <button
                    className="btn btn-ghost shadow-none"
                    onClick={() => title && onDelete(title)}
                    disabled={!title}
                  >
                    <Icon icon="boxicons:trash" style={{ fontSize: 22 }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </aside>
    </>
  );
}
