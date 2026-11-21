"use client";

import {
  USER_VERIFICATION_STATUSES,
  VERIFICATION_STATUS_LABELS,
  WARRANTY_KINDS,
  WARRANTY_KIND_LABELS,
  type VerificationStatus,
} from "@orvelia/domain";
import {
  returnDeadlineInputSchema,
  warrantyInputSchema,
  type ReturnDeadlineInput,
  type WarrantyInput,
} from "@orvelia/schemas";
import { BellRing, FileText, Pencil, Plus, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  deleteReturnDeadline,
  deleteWarranty,
  saveReturnDeadline,
  saveWarranty,
} from "@/app/app/products/protection-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useActionForm } from "@/lib/use-action-form";
import { cn } from "@/lib/utils";
import { VerificationBadge } from "./verification-badge";

type Warranty = {
  id: string;
  kind: (typeof WARRANTY_KINDS)[number];
  provider: string | null;
  startDate: string | null;
  endDate: string | null;
  coverage: string | null;
  sourceDocumentId: string | null;
  sourceDocumentTitle: string | null;
  verification: VerificationStatus;
  nextReminderAt: string | null;
};
type ReturnDeadline = {
  id: string;
  deadlineDate: string;
  policy: string | null;
  sourceDocumentId: string | null;
  sourceDocumentTitle: string | null;
  verification: VerificationStatus;
  nextReminderAt: string | null;
};
type Doc = { id: string; title: string };

const fmt = (iso: string | null, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  iso ? new Intl.DateTimeFormat("es-PE", { ...opts, timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)) : null;

const fmtReminder = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(iso));

function daysBetween(today: string, date: string) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

function remaining(days: number) {
  if (days < 0) return days === -1 ? "Venció ayer" : `Venció hace ${-days} días`;
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence mañana";
  if (days < 60) return `Quedan ${days} días`;
  const months = Math.round(days / 30.4);
  return months < 24 ? `Quedan ${months} meses` : `Quedan ${Math.round(months / 12)} años`;
}

export function ProtectionSection({
  productId,
  warranties,
  returns,
  documents,
  today,
  timeZone,
}: {
  productId: string;
  warranties: Warranty[];
  returns: ReturnDeadline[];
  documents: Doc[];
  today: string;
  timeZone: string;
}) {
  const [warrantyDialog, setWarrantyDialog] = React.useState<Warranty | "new" | null>(null);
  const [returnDialog, setReturnDialog] = React.useState<ReturnDeadline | "new" | null>(null);

  return (
    <section aria-labelledby="protection" id="garantia" className="mt-10 scroll-mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="protection" className="font-medium">
          Garantía y devolución
        </h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setReturnDialog("new")}>
            <RotateCcw aria-hidden />
            Plazo de devolución
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWarrantyDialog("new")}>
            <Plus aria-hidden />
            Agregar garantía
          </Button>
        </div>
      </div>

      {warranties.length === 0 && returns.length === 0 ? (
        <div className="flex gap-4 rounded-xl border border-dashed border-border-strong p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden strokeWidth={1.5} />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Registra la garantía o el plazo de devolución que figure en tu comprobante o certificado. No asumimos plazos
            estándar: solo usamos las fechas que tú registras, y te avisamos antes de que venzan.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {warranties.map((w) => {
            const days = w.endDate ? daysBetween(today, w.endDate) : null;
            return (
              <li key={w.id} className="rounded-xl border border-border bg-surface-raised p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      Garantía {WARRANTY_KIND_LABELS[w.kind].toLowerCase()}
                      {w.provider && <span className="font-normal text-muted-foreground"> · {w.provider}</span>}
                    </p>
                    <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                      {w.startDate || w.endDate
                        ? `${fmt(w.startDate) ?? "Inicio sin registrar"} → ${fmt(w.endDate) ?? "fin sin registrar"}`
                        : "Fechas sin registrar"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <VerificationBadge status={w.verification} />
                    <Button variant="ghost" size="icon" aria-label="Editar garantía" onClick={() => setWarrantyDialog(w)}>
                      <Pencil aria-hidden />
                    </Button>
                    <DeleteButton
                      label="garantía"
                      onDelete={() => deleteWarranty(productId, w.id)}
                    />
                  </div>
                </div>
                {days !== null && (
                  <ProgressLine start={w.startDate} end={w.endDate!} today={today} days={days} />
                )}
                <Meta coverage={w.coverage} doc={w.sourceDocumentTitle ? { id: w.sourceDocumentId!, title: w.sourceDocumentTitle } : null} next={w.nextReminderAt ? fmtReminder(w.nextReminderAt, timeZone) : null} />
              </li>
            );
          })}
          {returns.map((r) => {
            const days = daysBetween(today, r.deadlineDate);
            return (
              <li key={r.id} className="rounded-xl border border-border bg-surface-raised p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Plazo de devolución</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Hasta el {fmt(r.deadlineDate, { day: "numeric", month: "long", year: "numeric" })} ·{" "}
                      <span className={cn(days < 0 ? "" : days <= 3 ? "font-medium text-danger" : "")}>{remaining(days)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <VerificationBadge status={r.verification} />
                    <Button variant="ghost" size="icon" aria-label="Editar plazo de devolución" onClick={() => setReturnDialog(r)}>
                      <Pencil aria-hidden />
                    </Button>
                    <DeleteButton label="plazo de devolución" onDelete={() => deleteReturnDeadline(productId, r.id)} />
                  </div>
                </div>
                <Meta coverage={r.policy} doc={r.sourceDocumentTitle ? { id: r.sourceDocumentId!, title: r.sourceDocumentTitle } : null} next={r.nextReminderAt ? fmtReminder(r.nextReminderAt, timeZone) : null} />
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={warrantyDialog !== null}
        onOpenChange={(o) => !o && setWarrantyDialog(null)}
        title={warrantyDialog === "new" ? "Agregar garantía" : "Editar garantía"}
        description="Usa los datos de tu comprobante o certificado. Deja vacío lo que no sepas."
        wide
      >
        {warrantyDialog !== null && (
          <WarrantyForm
            productId={productId}
            warranty={warrantyDialog === "new" ? null : warrantyDialog}
            documents={documents}
            onDone={() => setWarrantyDialog(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={returnDialog !== null}
        onOpenChange={(o) => !o && setReturnDialog(null)}
        title={returnDialog === "new" ? "Plazo de devolución" : "Editar plazo de devolución"}
        description="La fecha límite que indica la tienda para devolver o cambiar el producto."
        wide
      >
        {returnDialog !== null && (
          <ReturnForm
            productId={productId}
            item={returnDialog === "new" ? null : returnDialog}
            documents={documents}
            onDone={() => setReturnDialog(null)}
          />
        )}
      </Dialog>
    </section>
  );
}

function ProgressLine({ start, end, today, days }: { start: string | null; end: string; today: string; days: number }) {
  const total = start ? daysBetween(start, end) : null;
  const ratio = total && total > 0 ? Math.min(1, Math.max(0, daysBetween(start!, today) / total)) : null;
  return (
    <div className="mt-4">
      {ratio !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className={cn("h-full rounded-full", days < 0 ? "bg-muted-foreground/40" : "bg-accent")} style={{ width: `${ratio * 100}%` }} />
        </div>
      )}
      <p className={cn("mt-2 text-sm", days < 0 ? "text-muted-foreground" : days <= 30 ? "font-medium text-danger" : "")}>
        {days < 0 ? "Vencida" : "Vigente"} · {remaining(days)}
      </p>
    </div>
  );
}

function Meta({ coverage, doc, next }: { coverage: string | null; doc: Doc | null; next: string | null }) {
  if (!coverage && !doc && !next) return null;
  return (
    <div className="mt-4 grid gap-2 border-t border-border pt-4 text-sm">
      {coverage && <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{coverage}</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
        {doc && (
          <a href={`/app/files/document/${doc.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <FileText className="size-3.5" aria-hidden />
            Respaldo: {doc.title}
          </a>
        )}
        {next && (
          <span className="inline-flex items-center gap-1.5">
            <BellRing className="size-3.5" aria-hidden />
            Próximo aviso: {next}
          </span>
        )}
      </div>
    </div>
  );
}

function DeleteButton({ label, onDelete }: { label: string; onDelete: () => Promise<{ ok: boolean; message?: string }> }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <ConfirmDialog
      title={`¿Eliminar este ${label === "garantía" ? "registro de garantía" : label}?`}
      description="También se cancelarán sus avisos pendientes."
      confirmLabel="Eliminar"
      pending={pending}
      onConfirm={() =>
        startTransition(async () => {
          const res = await onDelete();
          if (!res.ok) toast.error(res.message);
          else {
            toast.success(res.message);
            router.refresh();
          }
        })
      }
      trigger={(open) => (
        <Button variant="ghost" size="icon" onClick={open} aria-label={`Eliminar ${label}`}>
          <Trash2 aria-hidden />
        </Button>
      )}
    />
  );
}

function VerificationSelect({ id, register, error }: { id: string; register: object; error?: string }) {
  return (
    <Field id={id} label="Estado de la información" error={error} hint="“Confirmado” si lo verificaste en el documento.">
      <Select {...fieldAria(id, error, true)} {...register}>
        {USER_VERIFICATION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {VERIFICATION_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function useSaved(onDone: () => void) {
  const router = useRouter();
  return (res: { ok: boolean; message?: string }) => {
    if (res.ok) {
      toast.success(res.message);
      onDone();
      router.refresh();
    }
    return res;
  };
}

function WarrantyForm({ productId, warranty, documents, onDone }: { productId: string; warranty: Warranty | null; documents: Doc[]; onDone: () => void }) {
  const saved = useSaved(onDone);
  const defaults: WarrantyInput = {
    kind: warranty?.kind ?? "manufacturer",
    provider: warranty?.provider ?? "",
    startDate: warranty?.startDate ?? "",
    endDate: warranty?.endDate ?? "",
    coverage: warranty?.coverage ?? "",
    sourceDocumentId: warranty?.sourceDocumentId ?? "",
    verification: warranty?.verification === "extracted" ? "manual" : (warranty?.verification ?? "manual"),
  };
  const { form, onSubmit, pending, result } = useActionForm(warrantyInputSchema, defaults, async (v) =>
    saved(await saveWarranty(productId, warranty?.id ?? null, v)),
  );
  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {result && !result.ok && <Alert tone="error" title={result.message} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="kind" label="Tipo" error={errors.kind?.message}>
          <Select {...fieldAria("kind", errors.kind?.message)} {...form.register("kind")}>
            {WARRANTY_KINDS.map((k) => (
              <option key={k} value={k}>
                {WARRANTY_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="provider" label="Quién la cubre" error={errors.provider?.message}>
          <Input {...fieldAria("provider", errors.provider?.message)} {...form.register("provider")} placeholder="Ej. Servicio técnico oficial" maxLength={160} />
        </Field>
        <Field id="startDate" label="Inicio" error={errors.startDate?.message}>
          <Input {...fieldAria("startDate", errors.startDate?.message)} {...form.register("startDate")} type="date" />
        </Field>
        <Field id="endDate" label="Fin" error={errors.endDate?.message} hint="Te avisaremos antes de esta fecha.">
          <Input {...fieldAria("endDate", errors.endDate?.message, true)} {...form.register("endDate")} type="date" />
        </Field>
      </div>
      <Field id="coverage" label="Cobertura" error={errors.coverage?.message}>
        <Textarea {...fieldAria("coverage", errors.coverage?.message)} {...form.register("coverage")} rows={3} maxLength={4000} placeholder="Qué cubre y qué no, según el documento." />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="sourceDocumentId" label="Documento de respaldo" error={errors.sourceDocumentId?.message}>
          <Select {...fieldAria("sourceDocumentId", errors.sourceDocumentId?.message)} {...form.register("sourceDocumentId")}>
            <option value="">Ninguno</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </Select>
        </Field>
        <VerificationSelect id="verification" register={form.register("verification")} error={errors.verification?.message} />
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-5">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {warranty ? "Guardar cambios" : "Guardar garantía"}
        </Button>
      </div>
    </form>
  );
}

function ReturnForm({ productId, item, documents, onDone }: { productId: string; item: ReturnDeadline | null; documents: Doc[]; onDone: () => void }) {
  const saved = useSaved(onDone);
  const defaults: ReturnDeadlineInput = {
    deadlineDate: item?.deadlineDate ?? "",
    policy: item?.policy ?? "",
    sourceDocumentId: item?.sourceDocumentId ?? "",
    verification: item?.verification === "extracted" ? "manual" : (item?.verification ?? "manual"),
  };
  const { form, onSubmit, pending, result } = useActionForm(returnDeadlineInputSchema, defaults, async (v) =>
    saved(await saveReturnDeadline(productId, item?.id ?? null, v)),
  );
  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {result && !result.ok && <Alert tone="error" title={result.message} />}
      <Field id="deadlineDate" label="Fecha límite" error={errors.deadlineDate?.message}>
        <Input {...fieldAria("deadlineDate", errors.deadlineDate?.message)} {...form.register("deadlineDate")} type="date" />
      </Field>
      <Field id="policy" label="Condiciones" error={errors.policy?.message}>
        <Textarea {...fieldAria("policy", errors.policy?.message)} {...form.register("policy")} rows={3} maxLength={4000} placeholder="Ej. Producto sin uso, con empaque y boleta." />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="returnSourceDocumentId" label="Documento de respaldo" error={errors.sourceDocumentId?.message}>
          <Select {...fieldAria("returnSourceDocumentId", errors.sourceDocumentId?.message)} {...form.register("sourceDocumentId")}>
            <option value="">Ninguno</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </Select>
        </Field>
        <VerificationSelect id="returnVerification" register={form.register("verification")} error={errors.verification?.message} />
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-5">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {item ? "Guardar cambios" : "Guardar plazo"}
        </Button>
      </div>
    </form>
  );
}
