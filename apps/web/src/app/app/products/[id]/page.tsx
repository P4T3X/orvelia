import { ChevronLeft, FileText, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductActions } from "@/components/products/product-actions";
import { ProductThumb } from "@/components/products/product-thumb";
import { StatusBadge } from "@/components/products/status-badge";
import { getProfile, requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getProduct } from "@/lib/products";
import { isUuid } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Producto" };
  const user = await requireUser(`/app/products/${id}`);
  const product = await getProduct(user.id, id);
  return { title: product?.name ?? "Producto" };
}

function Fact({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="bg-surface-raised px-5 py-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-1 break-all font-mono text-[14px]" : "mt-1 font-medium"}>
        {children ?? <span className="font-normal text-muted-foreground">Sin registrar</span>}
      </dd>
    </div>
  );
}

function Upcoming({ icon: Icon, title, body }: { icon: typeof FileText; title: string; body: string }) {
  return (
    <div className="flex gap-4 rounded-xl border border-dashed border-border-strong p-5">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden strokeWidth={1.5} />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser(`/app/products/${id}`);
  const [product, profile] = await Promise.all([getProduct(user.id, id), getProfile(user.id)]);
  if (!product) notFound();

  const subtitle = [product.brand, product.model].filter(Boolean).join(" ");

  return (
    <>
      <Link
        href="/app/products"
        className="-ml-1 mb-6 inline-flex items-center gap-1 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Mi colección
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <ProductThumb url={product.imageUrl} name={product.name} className="size-28 rounded-xl sm:size-36" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={product.status} />
            {product.categoryName && <span className="text-sm text-muted-foreground">{product.categoryName}</span>}
          </div>
          <h1 className="mt-3 text-[1.75rem] font-medium leading-tight tracking-[-0.025em] text-balance sm:text-[2rem]">
            {product.name}
          </h1>
          {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
          <div className="mt-5">
            <ProductActions id={product.id} name={product.name} status={product.status} />
          </div>
        </div>
      </div>

      <section aria-labelledby="purchase" className="mt-10">
        <h2 id="purchase" className="mb-3 font-medium">
          Compra
        </h2>
        <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Fecha de compra">{formatDate(product.purchaseDate)}</Fact>
          <Fact label="Precio">{formatMoney(product.purchasePrice, product.currency)}</Fact>
          <Fact label="Tienda o vendedor">{product.seller}</Fact>
          <Fact label="Número de serie" mono={Boolean(product.serialNumber)}>
            {product.serialNumber}
          </Fact>
        </dl>
      </section>

      {(product.description || product.notes) && (
        <section className="mt-10 grid gap-8 lg:grid-cols-2">
          {product.description && (
            <div>
              <h2 className="mb-2 font-medium">Descripción</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{product.description}</p>
            </div>
          )}
          {product.notes && (
            <div>
              <h2 className="mb-2 font-medium">Notas</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{product.notes}</p>
            </div>
          )}
        </section>
      )}

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <Upcoming
          icon={FileText}
          title="Comprobantes y documentos"
          body="Pronto podrás escanear la boleta o factura y adjuntar manuales y certificados a este producto."
        />
        <Upcoming
          icon={ShieldCheck}
          title="Garantía y devolución"
          body="Pronto podrás registrar la garantía y el plazo de devolución, y recibir avisos antes de que venzan."
        />
      </section>

      <p className="mt-10 text-[13px] text-muted-foreground">
        Registrado el {formatDateTime(product.createdAt, profile?.timezone)} · Última edición{" "}
        {formatDateTime(product.updatedAt, profile?.timezone)}
      </p>
    </>
  );
}
