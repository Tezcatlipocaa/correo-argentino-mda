interface Props {
  count?: number;
}

export const TitleCardSkeleton = ({ count = 8 }: Props) => {
  return (
    <section className="skeleton-debounced mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={index}
          className="card bg-base-200/30 border-base-300 flex h-32 flex-col overflow-hidden border"
        >
          <header className="card-header flex items-center gap-x-2 p-3">
            <article className="skeleton rounded-md p-2">
              <div className="size-4.5" />
            </article>
            <div className="skeleton h-3 w-28"></div>
          </header>
          <article className="card-body flex flex-1 flex-row items-end justify-between gap-x-1 px-3 pt-0 pb-3">
            <div className="skeleton ml-2 size-4 rounded-md" />
            <div className="flex">
              <span className="skeleton mr-3 size-4 rounded-md" />
              <span className="skeleton h-4 w-18 rounded-sm pr-0.5" />
            </div>
          </article>
          <footer className="bg-base-200/60 flex items-center gap-x-2 px-3 py-1.5">
            <span className="skeleton size-2 shrink-0 rounded-full" />
            <span className="skeleton h-2.5 w-20 rounded-sm" />
          </footer>
        </article>
      ))}
    </section>
  );
};
