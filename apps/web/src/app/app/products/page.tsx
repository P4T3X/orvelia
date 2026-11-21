import { productFiltersSchema } from "@orvelia/schemas";
import { PackagePlus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { CollectionToolbar } from "@/components/products/collection-toolbar";
import { ProductCard, ProductRow } from "@/components/products/product-card";
import { UsageMeter } from "@/components/products/usage-meter";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dashboard";
import { getProductUsage, listBrands, listCategories, listProducts } from "@/lib/products";

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
  const profile = await getProfile(user.id);
  const today = todayIn(profile?.timezone ?? "America/Lima");

  const [result, categories, brands, usage] = await Promise.all([
    listProducts(user.id, filters, today),
    listCategories(user.id),
    listBrands(user.id),
    getProductUsage(),
  ]);

  const filtered = Boolean(filters.q || filters.category || filters.brand || filters.coverage || result.status !== "active");
  const view = filters.view ?? "grid";
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
          <CollectionToolbar categories={categories.map((c) => ({ id: c.id, name: c.name }))} brands={brands} />

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
                <Link href={`/app/products?status=all${view === "list" ? "&view=list" : ""}`}>Ver todos</Link>
              </Button>
            </div>
          ) : view === "grid" ? (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4" aria-label="Productos">
              {result.items.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} today={today} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised" aria-label="Productos">
              {result.items.map((p) => (
                <li key={p.id}>
                  <ProductRow product={p} today={today} />
                </li>
              ))}
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
