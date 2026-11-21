import { WARRANTY_KIND_LABELS, VERIFICATION_STATUS_LABELS } from "@orvelia/domain";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dashboard";
import { listDocuments } from "@/lib/documents";
import { formatDate, formatMoney } from "@/lib/format";
import { getProductMaintenance } from "@/lib/maintenance";
import { getProduct } from "@/lib/products";
import { getProductProtection } from "@/lib/protection";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Ficha del producto" };

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * One printable page with everything a store or service center asks for when
 * you make a warranty claim. Only recorded data; empty fields say so.
 */
export default async function ProductSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser(`/app/products/${id}/ficha`);
  const [product, profile, protection, maintenance, documents] = await Promise.all([
    getProduct(user.id, id),
    getProfile(user.id),
    getProductProtection(user.id, id),
    getProductMaintenance(user.id, id),
    listDocuments(user.id, { limit: 200 }),
  ]);
  if (!product) notFound();

  const supabase = await createClient();
  const { data: receipt } = product.receiptId
    ? await supabase
        .from("receipts")
        .select("merchant, receipt_number, purchase_date, total_amount, currency")
        .eq("id", product.receiptId)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const today = todayIn(profile?.timezone ?? "America/Lima");
  const docs = documents.filter((d) => d.productId === id);
  const none = <span className="text-muted-foreground">No registrado</span>;

  return (
    <article className="sheet mx-auto max-w-3xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/app/products/${id}`} className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden />
          Volver al producto
        </Link>
        <PrintButton />
      </div>

      <header className="border-b border-border pb-6">
        <p className="text-sm text-muted-foreground">Ficha para reclamo de garantía · ORVELIA</p>
        <h1 className="mt-2 text-[1.9rem] font-medium leading-tight tracking-[-0.025em]">{product.name}</h1>
        <p className="mt-1 text-muted-foreground">
          Propietario: {profile?.full_name ?? user.email} · Generada el {formatDate(today)}
        </p>
      </header>

      <Section title="Producto">
        <Row label="Marca">{product.brand ?? none}</Row>
        <Row label="Modelo">{product.model ?? none}</Row>
        <Row label="Número de serie">{product.serialNumber ? <span className="font-mono">{product.serialNumber}</span> : none}</Row>
        <Row label="Categoría">{product.categoryName ?? none}</Row>
      </Section>

      <Section title="Compra">
        <Row label="Fecha">{formatDate(product.purchaseDate) ?? none}</Row>
        <Row label="Tienda o vendedor">{product.seller ?? receipt?.merchant ?? none}</Row>
        <Row label="Precio">{formatMoney(product.purchasePrice, product.currency) ?? none}</Row>
        <Row label="Comprobante">
          {receipt
            ? [receipt.merchant, receipt.receipt_number, formatDate(receipt.purchase_date), formatMoney(receipt.total_amount === null ? null : Number(receipt.total_amount), receipt.currency)]
                .filter(Boolean)
                .join(" · ")
            : none}
        </Row>
      </Section>

      <Section title="Garantías">
        {protection.warranties.length === 0 ? (
          <p className="text-muted-foreground">Sin garantía registrada.</p>
        ) : (
          protection.warranties.map((w) => (
            <div key={w.id} className="sheet-block border-b border-border py-3 last:border-0">
              <p className="font-medium">
                Garantía {WARRANTY_KIND_LABELS[w.kind].toLowerCase()}
                {w.provider ? ` · ${w.provider}` : ""}
              </p>
              <p className="mt-1 text-sm">
                {formatDate(w.startDate) ?? "Inicio no registrado"} → {formatDate(w.endDate) ?? "fin no registrado"}
                {w.endDate && (w.endDate >= today ? " (vigente)" : " (vencida)")}
              </p>
              {w.coverage && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{w.coverage}</p>}
              <p className="mt-1 text-[13px] text-muted-foreground">
                Origen del dato: {VERIFICATION_STATUS_LABELS[w.verification]}
                {w.sourceDocumentTitle ? ` · Respaldo: ${w.sourceDocumentTitle}` : ""}
              </p>
            </div>
          ))
        )}
        {protection.returns.length > 0 && (
          <p className="mt-3 text-sm">
            Plazo de devolución: {protection.returns.map((r) => formatDate(r.deadlineDate)).join(", ")}
          </p>
        )}
      </Section>

      <Section title="Documentos guardados">
        {docs.length === 0 ? <p className="text-muted-foreground">Ninguno.</p> : (
          <ul className="list-disc pl-5">
            {docs.map((d) => (
              <li key={d.id}>{d.title}</li>
            ))}
          </ul>
        )}
      </Section>

      {maintenance.logs.length > 0 && (
        <Section title="Historial de mantenimiento">
          <ul className="grid gap-1">
            {maintenance.logs.map((l) => (
              <li key={l.id} className="text-sm">
                {formatDate(l.performedOn)}: {l.title}
                {l.provider ? ` · ${l.provider}` : ""}
                {l.cost !== null && l.currency ? ` · ${formatMoney(l.cost, l.currency)}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {product.notes && (
        <Section title="Notas">
          <p className="whitespace-pre-line">{product.notes}</p>
        </Section>
      )}

      <p className="mt-10 border-t border-border pt-4 text-[12px] text-muted-foreground">
        Datos registrados por el propietario en ORVELIA. Lleva también el comprobante original o su copia.
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sheet-block mt-8">
      <h2 className="mb-3 font-medium">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[11rem_1fr] gap-4 border-b border-border py-2.5 text-[15px] last:border-0 max-sm:grid-cols-1 max-sm:gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
