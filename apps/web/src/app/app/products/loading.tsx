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
      <Skeleton className="mt-8 h-11 w-full" />
      <div className="mt-9 grid gap-px overflow-hidden rounded-xl border border-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 bg-surface-raised px-5 py-3.5">
            <Skeleton className="size-14 rounded-lg" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
