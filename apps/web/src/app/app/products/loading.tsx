import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando productos…</span>
      <div className="flex items-end justify-between">
        <div>
          <Skeleton className="h-9 w-52" />
          <Skeleton className="mt-3 h-4 w-44" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="mt-8 h-10 w-full" />
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      <div className="mt-9 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface-raised">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="grid gap-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="mt-3 h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
