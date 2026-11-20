import { productFiltersSchema } from "@orvelia/schemas";
import { PackagePlus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { CollectionToolbar } from "@/components/products/collection-toolbar";
import { ProductThumb } from "@/components/products/product-thumb";
import { StatusBadge } from "@/components/products/status-badge";
import { UsageMeter } from "@/components/products/usage-meter";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { getProductUsage, listCategories, listProducts } from "@/lib/products";

export const metadata: Metadata = { title: "Mi colección" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pageHref(params: Record<string, string | string[] | undefined>, page: number) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && k !== "page" && k !== "deleted") next.set(k, v);
  }
  if (page > 1) next.set("page", String(page));
  return `/app/products${next.size ? `?${next}` : ""}`;
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/app/products");
  const raw = await searchParams;
  const filters = productFiltersSchema.parse(raw);

  const [result, categories, usage] = await Promise.all([
    listProducts(user.id, filters),
    listCategories(user.id),
    getProductUsage(),
  ]);

  const filtered = Boolean(filters.q || filters.category || result.status !== "active");
  const emptyCollection = usage.used === 0;

  return (
    <>
      <PageHeader
        title="Mi colección"
        description={<UsageMeter used={usage.used} max={usage.max} />}
        actions={
          usage.atLimit ? (
            <Button disabled title="Llegaste al límite de tu plan">
              <PackagePlus aria-hidden />
              Agregar producto
            </Button>
          ) : (
            <Button asChild>
              <Link href="/app/products/new">
                <PackagePlus aria-hidden />
                Agregar producto
              </Link>
            </Button>
          )
        }
      />

      {raw.deleted === "1" && <Alert tone="success" title="Producto eliminado." className="mb-6" />}

      {emptyCollection ? (
        <section className="rounded-xl border border-dashed border-border-strong px-6 py-16 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border-strong bg-surface">
            <PackagePlus className="size-5 text-accent-ink" aria-hidden strokeWidth={1.5} />
          </div>
          <h2 className="mt-5 text-lg font-medium">Tu colección está vacía</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Empieza por lo último que compraste: el nombre basta, el resto lo puedes completar después.
          </p>
          <Button asChild className="mt-7">
            <Link href="/app/products/new">Agregar mi primer producto</Link>
          </Button>
        </section>
      ) : (
        <>
          <CollectionToolbar categories={categories.map((c) => ({ id: c.id, name: c.name }))} />

          <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
            {result.total === 1 ? "1 producto" : `${result.total} productos`}
          </p>

          {result.items.length === 0 ? (
            <div className="mt-3 rounded-xl border border-border px-6 py-14 text-center">
              <SearchX className="mx-auto size-6 text-muted-foreground" aria-hidden strokeWidth={1.5} />
              <p className="mt-4 font-medium">No hay productos que coincidan</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {filtered ? "Prueba con otra búsqueda o cambia los filtros." : "Cambia el filtro de estado para ver más."}
              </p>
              <Button asChild variant="secondary" className="mt-6">
                <Link href="/app/products?status=all">Ver todos</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised">
              {result.items.map((p) => {
                const price = formatMoney(p.purchasePrice, p.currency);
                const date = formatDate(p.purchaseDate, "short");
                const subtitle = [p.brand, p.model].filter(Boolean).join(" ");
                return (
                  <li key={p.id}>
                    <Link
                      href={`/app/products/${p.id}`}
                      className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 px-4 py-3.5 hover:bg-muted sm:grid-cols-[3.5rem_1.6fr_1fr_1fr_auto] sm:px-5"
                    >
                      <ProductThumb url={p.imageUrl} name={p.name} className="size-14" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {subtitle || p.categoryName || "Sin marca"}
                          <span className="sm:hidden">{price ? ` · ${price}` : ""}</span>
                        </p>
                      </div>
                      <p className="hidden truncate text-sm text-muted-foreground sm:block">{p.categoryName ?? "—"}</p>
                      <div className="hidden text-sm sm:block">
                        <p className="tabular-nums">{price ?? "—"}</p>
                        <p className="text-[13px] text-muted-foreground">{date ?? "Sin fecha"}</p>
                      </div>
                      <StatusBadge status={p.status} className={p.status === "active" ? "hidden sm:inline-flex" : undefined} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {result.pageCount > 1 && (
            <nav aria-label="Paginación" className="mt-6 flex items-center justify-between text-sm">
              {result.page > 1 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(raw, result.page - 1)}>Anterior</Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground">
                Página {result.page} de {result.pageCount}
              </span>
              {result.page < result.pageCount ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(raw, result.page + 1)}>Siguiente</Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}
