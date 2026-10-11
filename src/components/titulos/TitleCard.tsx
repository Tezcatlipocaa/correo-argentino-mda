import { memo } from "react";
import type { Title } from "@hooks/useTitlesHook";
import {
  ClipboardIcon,
  ChevronRightIcon,
  BookmarkIcon,
} from "@heroicons/react/24/outline";

/**
 * Hover de la banda por tono de categoría. Mapa estático (no compuesto) para
 * que Tailwind genere las clases `group-hover:*` correspondientes.
 */
const TONE_HOVER: Record<string, string> = {
  "bg-sky-300": "group-hover:bg-sky-300 hover:border-sky-300",
  "bg-violet-300": "group-hover:bg-violet-300 hover:border-violet-300",
  "bg-orange-300": "group-hover:bg-orange-300 hover:border-orange-300",
  "bg-pink-300": "group-hover:bg-pink-300 hover:border-pink-300",
  "bg-neutral-300": "group-hover:bg-neutral-300 hover:border-neutral-300",
  "bg-green-300": "group-hover:bg-green-300 hover:border-green-300",
  "bg-red-300": "group-hover:bg-red-300 hover:border-red-300",
};

interface Props {
  title: Title;
  isFavorite: boolean;
  /** Sólo con sesión activa se muestra el botón de favoritos. */
  canFavorite: boolean;
  /** Toggle en vuelo: deshabilita el botón para evitar dobles clics. */
  isFavoritePending: boolean;
  onOpen: (title: Title) => void;
  onToggleFavorite: (titleId: number) => void;
  onCopy: (title: string) => void;
}

function TitleCard({
  title,
  isFavorite,
  canFavorite,
  isFavoritePending,
  onOpen,
  onToggleFavorite,
  onCopy,
}: Props) {
  const toneHover = TONE_HOVER[title.tone] ?? "";
  return (
    <article
      className={`group card bg-base-100 dark:bg-base-200 border-base-300 flex h-32 cursor-pointer flex-col border transition-colors select-none ${toneHover}`}
      onClick={() => onOpen(title)}
    >
      <header className="min-h-0 flex-1 p-3">
        <h3 className="line-clamp-2 text-xs font-semibold text-base-content/90 wrap-break-word">
          {title.name}
        </h3>
      </header>

      <article className="card-body flex shrink-0 flex-row items-end justify-between gap-x-1 px-1 pb-1">
        {canFavorite && (
          <label className="tooltip" data-tip="Favoritos">
            <button
              className="btn btn-ghost btn-xs shadow-none"
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite(title.id);
              }}
              disabled={isFavoritePending}
              aria-busy={isFavoritePending}
            >
              {isFavorite ? (
                <BookmarkIcon className="dark:text-primary size-4 fill-amber-300" />
              ) : (
                <BookmarkIcon className="size-4" />
              )}
            </button>
          </label>
        )}
        <div>
          <label className="tooltip" data-tip="Copiar título">
            <button
              className="btn btn-ghost btn-xs shadow-none"
              onClick={(event) => {
                event.stopPropagation();
                onCopy(title.name);
              }}
            >
              <ClipboardIcon className="size-4" />
            </button>
          </label>
          <button
            className="btn btn-ghost btn-xs pr-0.5 shadow-none"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(title);
            }}
          >
            Ver más
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      </article>

      <footer
        className={`bg-base-200/60  rounded-b-md flex shrink-0 items-center gap-x-2 px-3 py-1.5 transition-colors ${toneHover}`}
      >
        <span
          className={`size-2 shrink-0 rounded-full transition-colors ${title.tone} group-hover:bg-neutral-800`}
          aria-hidden="true"
        />
        <span className="select-none truncate text-xs text-base-content/70 transition-colors group-hover:text-neutral-800">
          {title.category}
        </span>
      </footer>
    </article>
  );
}

export default memo(TitleCard);
