"use client";

import { PRODUCT_STATUSES, PRODUCT_STATUS_LABELS } from "@orvelia/domain";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Input, Select } from "@/components/ui/input";

type Option = { id: string; name: string };

const SORTS = [
  { value: "recent", label: "Más recientes" },
  { value: "name", label: "Nombre A–Z" },
  { value: "purchase_date", label: "Fecha de compra" },
  { value: "price", label: "Precio más alto" },
];

/** Filters live in the URL so results are shareable, bookmarkable and server-rendered. */
export function CollectionToolbar({ categories }: { categories: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [q, setQ] = React.useState(params.get("q") ?? "");

  const update = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      next.delete("deleted");
      startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  // Debounced search.
  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (q.trim() === current) return;
    const t = setTimeout(() => update("q", q.trim() || null), 300);
    return () => clearTimeout(t);
  }, [q, params, update]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-[1fr_auto_auto_auto]" aria-busy={pending}>
      <div className="relative col-span-2 sm:col-span-3 md:col-span-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, marca, modelo, serie o tienda"
          aria-label="Buscar productos"
          className="pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
          maxLength={100}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <Select
        aria-label="Estado"
        value={params.get("status") ?? "active"}
        onChange={(e) => update("status", e.target.value === "active" ? null : e.target.value)}
        className="md:w-40"
      >
        {PRODUCT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {`${PRODUCT_STATUS_LABELS[s]}s`}
          </option>
        ))}
        <option value="all">Todos los estados</option>
      </Select>

      <Select
        aria-label="Categoría"
        value={params.get("category") ?? ""}
        onChange={(e) => update("category", e.target.value || null)}
        className="order-last col-span-2 sm:order-none sm:col-span-1 md:w-56"
      >
        <option value="">Todas las categorías</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Ordenar por"
        value={params.get("sort") ?? "recent"}
        onChange={(e) => update("sort", e.target.value === "recent" ? null : e.target.value)}
        className="md:w-48"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
