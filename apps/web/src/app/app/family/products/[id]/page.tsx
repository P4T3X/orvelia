import {
  DOCUMENT_TYPE_LABELS,
  PRODUCT_STATUS_LABELS,
  RECURRENCE_LABELS,
  VERIFICATION_STATUS_LABELS,
  type DocumentType,
  type ProductStatus,
  type Recurrence,
  type VerificationStatus,
} from "@orvelia/domain";
import { BellRing, ChevronLeft, FileText, Lock, Receipt, RotateCcw, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductThumb } from "@/components/products/product-thumb";
import { getProfile, requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dashboard";
import { getSharedProduct, sharedFileUrl } from "@/lib/family";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { isUuid } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Producto compartido" };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-raised px-5 py-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{children ?? <span className="font-normal text-muted-foreground">Sin registrar</span>}</dd>
    </div>
  );
}

function Row({ icon: Icon, title, detail, href }: { icon: typeof FileText; title: string; detail?: string | null; href?: string }) {
  const body = (
    <>
      <Icon className="size-5 shrink-0 text-accent-ink" aria-hidden strokeWidth={1.5} />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {detail && <span className="block truncate text-[13px] text-muted-foreground">{detail}</span>}
      </span>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener" className="flex items-center gap-4 bg-surface-raised px-5 py-4 hover:bg-muted">
      {body}
    </a>
  ) : (
    <div className="flex items-center gap-4 bg-surface-raised px-5 py-4">{body}</div>
  );
}

const daysUntil = (date: string, today: string) =>
  Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);

export default async function SharedProductPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser(`/app/family/products/${id}`);
  const [detail, profile] = await Promise.all([getSharedProduct(id), getProfile(user.id)]);
  if (!detail) notFound();
  const { product: p } = detail;
  const tz = profile?.timezone ?? "America/Lima";
  const today = todayIn(tz);
  const subtitle = [p.brand, p.model].filter(Boolean).join(" ");

  return (
    <>
      <Link
        href="/app/family"
        className="-ml-1 mb-6 inline-flex items-center gap-1 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Familia
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <ProductThumb url={p.imageUrl} name={p.name} className="size-28 rounded-xl sm:size-36" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="rounded-full border border-border px-2.5 py-0.5">{PRODUCT_STATUS_LABELS[p.status as ProductStatus] ?? p.status}</span>
            {p.category && <span>{p.category}</span>}
          </div>
          <h1 className="mt-3 text-[1.75rem] font-medium leading-tight tracking-[-0.025em] text-balance sm:text-[2rem]">{p.name}</h1>
          {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" aria-hidden />
            {detail.isMine ? (
              <>
                Tuyo, compartido con la familia.{" "}
                <Link href={`/app/products/${p.id}`} className="text-foreground underline underline-offset-4">
                  Editar en tu colección
                </Link>
              </>
            ) : (
              `Compartido por ${detail.ownerName}. Solo esa persona puede editarlo.`
            )}
          </p>
        </div>
      </div>

      <section aria-labelledby="purchase" className="mt-10">
        <h2 id="purchase" className="mb-3 font-medium">
          Compra
        </h2>
        <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Fecha de compra">{formatDate(p.purchaseDate)}</Fact>
          <Fact label="Precio">{formatMoney(p.purchasePrice, p.currency)}</Fact>
          <Fact label="Tienda o vendedor">{p.seller}</Fact>
          <Fact label="Número de serie">{p.serialNumber}</Fact>
        </dl>
        {p.description && <p className="mt-6 max-w-3xl whitespace-pre-line leading-relaxed text-muted-foreground">{p.description}</p>}
      </section>

      <section aria-labelledby="protection" className="mt-10">
        <h2 id="protection" className="mb-3 font-medium">
          Garantías y devoluciones
        </h2>
        {detail.warranties.length + detail.returns.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong px-5 py-4 text-sm text-muted-foreground">Sin garantías ni plazos registrados.</p>
        ) : (
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
            {detail.warranties.map((w) => {
              const d = w.endDate ? daysUntil(w.endDate, today) : null;
              return (
                <Row
                  key={w.id}
                  icon={ShieldCheck}
                  title={w.endDate ? (d! >= 0 ? `Garantía hasta el ${formatDate(w.endDate)}` : `Garantía vencida el ${formatDate(w.endDate)}`) : "Garantía sin fecha de fin"}
                  detail={[w.provider, w.coverage, VERIFICATION_STATUS_LABELS[w.verification as VerificationStatus]].filter(Boolean).join(" · ")}
                />
              );
            })}
            {detail.returns.map((r) => (
              <Row
                key={r.id}
                icon={RotateCcw}
                title={`Devolución hasta el ${formatDate(r.deadlineDate)}`}
                detail={[r.policy, VERIFICATION_STATUS_LABELS[r.verification as VerificationStatus]].filter(Boolean).join(" · ")}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="papers" className="mt-10">
        <h2 id="papers" className="mb-3 font-medium">
          Comprobante y documentos
        </h2>
        {detail.receipts.length + detail.documents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong px-5 py-4 text-sm text-muted-foreground">Sin comprobante ni documentos.</p>
        ) : (
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
            {detail.receipts.map((r) => (
              <Row
                key={r.id}
                icon={Receipt}
                title="Comprobante de compra"
                detail={[r.merchant, formatDate(r.purchaseDate, "short"), formatMoney(r.total, r.currency)].filter(Boolean).join(" · ")}
                href={r.hasFile ? sharedFileUrl("receipt", r.id) : undefined}
              />
            ))}
            {detail.documents.map((d) => (
              <Row
                key={d.id}
                icon={FileText}
                title={d.title}
                detail={[DOCUMENT_TYPE_LABELS[d.documentType as DocumentType], d.expiresOn ? `vence el ${formatDate(d.expiresOn, "short")}` : null]
                  .filter(Boolean)
                  .join(" · ")}
                href={sharedFileUrl("document", d.id)}
              />
            ))}
          </div>
        )}
      </section>

      {detail.reminders.length > 0 && (
        <section aria-labelledby="reminders" className="mt-10">
          <h2 id="reminders" className="mb-3 font-medium">
            Recordatorios
          </h2>
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
            {detail.reminders.map((m) => (
              <Row
                key={m.id}
                icon={BellRing}
                title={m.title}
                detail={[formatDateTime(m.scheduledAt, tz), m.recurrence !== "none" ? RECURRENCE_LABELS[m.recurrence as Recurrence] : null].filter(Boolean).join(" · ")}
              />
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-[13px] text-muted-foreground">Compartido el {formatDateTime(detail.sharedAt, tz)}</p>
    </>
  );
}
