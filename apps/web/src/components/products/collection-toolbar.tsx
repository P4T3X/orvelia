"use client";

import { PRODUCT_STATUSES, PRODUCT_STATUS_LABELS } from "@orvelia/domain";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Input, Select } from "@/components/ui/input";

type Option = { id: string; name: string };

const SORTS = [
  { value: "recent", label: "Más recientes" },
  { value: "name", label: "Nombre A–Z" },
  { value: "purchase_date", label: "Compra más reciente" },
  { value: "purchase_date_asc", label: "Compra más antigua" },
  { value: "price", label: "Precio más alto" },
  { value: "price_asc", label: "Precio más bajo" },
  { value: "warranty_end", label: "Garantía que vence antes" },
];

const COVERAGES = [
  { value: "", label: "Cualquier garantía" },
  { value: "active", label: "Con garantía vigente" },
  { value: "expired", label: "Garantía vencida" },
  { value: "none", label: "Sin garantía" },
];

const FILTER_KEYS = ["q", "status", "category", "brand", "coverage"] as const;

/** Filters live in the URL so results are shareable, bookmarkable and server-rendered. */
export function CollectionToolbar({ categories, brands }: { categories: Option[]; brands: string[] }) {
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

  const view = params.get("view") === "list" ? "list" : "grid";
  const activeFilters = FILTER_KEYS.filter((k) => (k === "status" ? params.has("status") : Boolean(params.get(k)))).length;

  return (
    <div className="grid gap-3" aria-busy={pending}>
      <div className="flex gap-3">
        <div className="relative flex-1">
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
        <div role="radiogroup" aria-label="Vista" className="flex shrink-0 rounded-md border border-border-strong p-0.5">
          {(["grid", "list"] as const).map((v) => {
            const Icon = v === "grid" ? LayoutGrid : List;
            const on = view === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={v === "grid" ? "Tarjetas" : "Lista"}
                title={v === "grid" ? "Tarjetas" : "Lista"}
                onClick={() => update("view", v === "grid" ? null : "list")}
                className={`flex size-9 items-center justify-center rounded-[5px] transition-colors ${on ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Select
          aria-label="Estado"
          value={params.get("status") ?? "active"}
          onChange={(e) => update("status", e.target.value === "active" ? null : e.target.value)}
        >
          {PRODUCT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {`${PRODUCT_STATUS_LABELS[s]}s`}
            </option>
          ))}
          <option value="all">Todos los estados</option>
        </Select>

        <Select aria-label="Categoría" value={params.get("category") ?? ""} onChange={(e) => update("category", e.target.value || null)}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <Select aria-label="Marca" value={params.get("brand") ?? ""} onChange={(e) => update("brand", e.target.value || null)} disabled={brands.length === 0}>
          <option value="">Todas las marcas</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>

        <Select aria-label="Garantía" value={params.get("coverage") ?? ""} onChange={(e) => update("coverage", e.target.value || null)}>
          {COVERAGES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Ordenar por"
          value={params.get("sort") ?? "recent"}
          onChange={(e) => update("sort", e.target.value === "recent" ? null : e.target.value)}
          className="col-span-2 md:col-span-1"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {activeFilters > 0 && (
        <div>
          <button
            type="button"
            onClick={() => {
              setQ("");
              const next = new URLSearchParams();
              for (const k of ["sort", "view"]) if (params.get(k)) next.set(k, params.get(k)!);
              startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
            }}
            className="text-sm text-muted-foreground underline decoration-border-strong underline-offset-4 hover:text-foreground"
          >
            Quitar filtros ({activeFilters})
          </button>
        </div>
      )}
    </div>
  );
}
