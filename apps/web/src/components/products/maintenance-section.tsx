"use client";

import {
  describeInterval,
  MAINTENANCE_UNIT_LABELS,
  MAINTENANCE_UNITS,
  maintenanceNextDate,
  SUPPORTED_CURRENCIES,
  type MaintenanceUnit,
} from "@orvelia/domain";
import {
  maintenanceDoneSchema,
  maintenancePlanSchema,
  type MaintenanceDoneInput,
  type MaintenancePlanInput,
} from "@orvelia/schemas";
import { Check, History, Pause, Pencil, Play, Plus, Trash2, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  completeMaintenance,
  deleteMaintenanceLog,
  deleteMaintenancePlan,
  saveMaintenancePlan,
  setMaintenancePlanActive,
} from "@/app/app/products/maintenance-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useActionForm } from "@/lib/use-action-form";
import { cn } from "@/lib/utils";

export type MaintenancePlanItem = {
  id: string;
  title: string;
  notes: string | null;
  intervalCount: number;
  intervalUnit: MaintenanceUnit;
  nextDueDate: string;
  lastDoneDate: string | null;
  leadDays: number;
  active: boolean;
};
export type MaintenanceLogItem = {
  id: string;
  planId: string | null;
  title: string;
  performedOn: string;
  cost: number | null;
  currency: string | null;
  provider: string | null;
  notes: string | null;
};

const fmt = (iso: string, long = false) =>
  new Intl.DateTimeFormat("es-PE", { day: "numeric", month: long ? "long" : "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
const money = (n: number, c: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: c, minimumFractionDigits: 2 }).format(n);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function dueText(days: number) {
  if (days < 0) return days === -1 ? "Atrasado 1 día" : `Atrasado ${-days} días`;
  if (days === 0) return "Toca hoy";
  if (days === 1) return "Toca mañana";
  return `En ${days} días`;
}

export function MaintenanceSection({
  productId,
  plans,
  logs,
  today,
  defaultCurrency,
}: {
  productId: string;
  plans: MaintenancePlanItem[];
  logs: MaintenanceLogItem[];
  today: string;
  defaultCurrency: string;
}) {
  const [planDialog, setPlanDialog] = React.useState<MaintenancePlanItem | "new" | null>(null);
  const [doneDialog, setDoneDialog] = React.useState<MaintenancePlanItem | null>(null);
  const totals = React.useMemo(() => {
    const t = new Map<string, number>();
    for (const l of logs) if (l.cost !== null && l.currency) t.set(l.currency, (t.get(l.currency) ?? 0) + l.cost);
    return [...t.entries()];
  }, [logs]);

  return (
    <section aria-labelledby="maintenance" id="mantenimiento" className="mt-10 scroll-mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="maintenance" className="font-medium">
          Mantenimiento
        </h2>
        <Button variant="secondary" size="sm" onClick={() => setPlanDialog("new")}>
          <Plus aria-hidden />
          Programar mantenimiento
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="flex gap-4 rounded-xl border border-dashed border-border-strong p-5">
          <Wrench className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden strokeWidth={1.5} />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Programa cuidados periódicos, como cambio de filtros, revisión técnica o limpieza. Te avisamos antes de cada
            fecha y guardamos el historial de lo que se hizo y cuánto costó.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3" aria-label="Mantenimientos programados">
          {plans.map((p) => {
            const days = daysBetween(today, p.nextDueDate);
            return (
              <li key={p.id} className={cn("rounded-xl border border-border bg-surface-raised p-5", !p.active && "opacity-70")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{p.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {describeInterval(p.intervalCount, p.intervalUnit)}
                      {p.lastDoneDate ? ` · última vez ${fmt(p.lastDoneDate)}` : " · aún sin registros"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Editar ${p.title}`} onClick={() => setPlanDialog(p)}>
                      <Pencil aria-hidden />
                    </Button>
                    <PauseButton productId={productId} plan={p} />
                    <DeletePlanButton productId={productId} plan={p} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-sm">
                    {p.active ? (
                      <>
                        Próximo: <span className="tabular-nums">{fmt(p.nextDueDate, true)}</span> ·{" "}
                        <span className={cn(days < 0 ? "font-medium text-danger" : days <= p.leadDays ? "font-medium text-accent-ink" : "text-muted-foreground")}>
                          {dueText(days)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">En pausa: no recibirás avisos.</span>
                    )}
                  </p>
                  {p.active && (
                    <Button size="sm" onClick={() => setDoneDialog(p)}>
                      <Check aria-hidden />
                      Marcar como hecho
                    </Button>
                  )}
                </div>
                {p.notes && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{p.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {logs.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 text-sm font-medium">
              <History className="size-4 text-muted-foreground" aria-hidden />
              Historial
            </h3>
            {totals.length > 0 && (
              <p className="text-[13px] tabular-nums text-muted-foreground">
                Gastado: {totals.map(([c, n]) => money(n, c)).join(" + ")}
              </p>
            )}
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border" aria-label="Historial de mantenimiento">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[15px]">
                    {l.title}
                    <span className="text-muted-foreground"> · {fmt(l.performedOn)}</span>
                  </p>
                  {(l.provider || l.notes) && (
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">
                      {[l.provider, l.notes].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {l.cost !== null && l.currency && <span className="text-sm tabular-nums">{money(l.cost, l.currency)}</span>}
                  <DeleteLogButton productId={productId} log={l} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={planDialog !== null}
        onOpenChange={(o) => !o && setPlanDialog(null)}
        title={planDialog === "new" ? "Programar mantenimiento" : "Editar mantenimiento"}
        description="Qué hay que hacer, cada cuánto y cuándo toca la próxima vez."
        wide
      >
        {planDialog !== null && (
          <PlanForm productId={productId} plan={planDialog === "new" ? null : planDialog} today={today} onDone={() => setPlanDialog(null)} />
        )}
      </Dialog>

      <Dialog
        open={doneDialog !== null}
        onOpenChange={(o) => !o && setDoneDialog(null)}
        title={doneDialog ? `Registrar: ${doneDialog.title}` : ""}
        description="Guardamos lo que se hizo y programamos la siguiente fecha."
      >
        {doneDialog && (
          <DoneForm productId={productId} plan={doneDialog} today={today} defaultCurrency={defaultCurrency} onDone={() => setDoneDialog(null)} />
        )}
      </Dialog>
    </section>
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

function PlanForm({ productId, plan, today, onDone }: { productId: string; plan: MaintenancePlanItem | null; today: string; onDone: () => void }) {
  const saved = useSaved(onDone);
  const defaults: MaintenancePlanInput = {
    title: plan?.title ?? "",
    intervalCount: String(plan?.intervalCount ?? 6),
    intervalUnit: plan?.intervalUnit ?? "months",
    nextDueDate: plan?.nextDueDate ?? maintenanceNextDate(today, 6, "months"),
    leadDays: String(plan?.leadDays ?? 7),
    notes: plan?.notes ?? "",
  };
  const { form, onSubmit, pending, result } = useActionForm(maintenancePlanSchema, defaults, async (v) =>
    saved(await saveMaintenancePlan(productId, plan?.id ?? null, v)),
  );
  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {result && !result.ok && <Alert tone="error" title={result.message} />}
      <Field id="mtTitle" label="Qué hay que hacer" error={errors.title?.message}>
        <Input {...fieldAria("mtTitle", errors.title?.message, true)} {...form.register("title")} placeholder="Ej. Cambio de filtros" maxLength={160} autoFocus />
      </Field>
      <div className="grid gap-5 sm:grid-cols-[1fr_1fr_1.2fr]">
        <Field id="mtCount" label="Cada" error={errors.intervalCount?.message}>
          <Input {...fieldAria("mtCount", errors.intervalCount?.message, true)} {...form.register("intervalCount")} inputMode="numeric" className="tabular-nums" />
        </Field>
        <Field id="mtUnit" label="Unidad" error={errors.intervalUnit?.message}>
          <Select {...fieldAria("mtUnit", errors.intervalUnit?.message)} {...form.register("intervalUnit")}>
            {MAINTENANCE_UNITS.map((u) => (
              <option key={u} value={u}>
                {MAINTENANCE_UNIT_LABELS[u]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="mtNext" label="Próxima vez" error={errors.nextDueDate?.message}>
          <Input {...fieldAria("mtNext", errors.nextDueDate?.message, true)} {...form.register("nextDueDate")} type="date" />
        </Field>
      </div>
      <Field id="mtLead" label="Avisarme con" error={errors.leadDays?.message} hint="Días de anticipación. También te avisamos el mismo día.">
        <Input {...fieldAria("mtLead", errors.leadDays?.message)} {...form.register("leadDays")} inputMode="numeric" className="max-w-28 tabular-nums" />
      </Field>
      <Field id="mtNotes" label="Notas" error={errors.notes?.message}>
        <Textarea {...fieldAria("mtNotes", errors.notes?.message)} {...form.register("notes")} rows={2} maxLength={2000} placeholder="Repuestos, técnico de confianza, indicaciones del manual…" />
      </Field>
      <div className="flex justify-end gap-2 border-t border-border pt-5">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {plan ? "Guardar cambios" : "Programar"}
        </Button>
      </div>
    </form>
  );
}

function DoneForm({
  productId,
  plan,
  today,
  defaultCurrency,
  onDone,
}: {
  productId: string;
  plan: MaintenancePlanItem;
  today: string;
  defaultCurrency: string;
  onDone: () => void;
}) {
  const saved = useSaved(onDone);
  const currency = (SUPPORTED_CURRENCIES as readonly string[]).includes(defaultCurrency)
    ? (defaultCurrency as (typeof SUPPORTED_CURRENCIES)[number])
    : "PEN";
  const defaults: MaintenanceDoneInput = { performedOn: today, cost: "", currency, provider: "", notes: "" };
  const { form, onSubmit, pending, result } = useActionForm(maintenanceDoneSchema, defaults, async (v) =>
    saved(await completeMaintenance(productId, plan.id, v)),
  );
  const { errors } = form.formState;
  const performedOn = form.watch("performedOn");
  const next =
    /^\d{4}-\d{2}-\d{2}$/.test(performedOn ?? "") && performedOn
      ? maintenanceNextDate(performedOn, plan.intervalCount, plan.intervalUnit)
      : null;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {result && !result.ok && <Alert tone="error" title={result.message} />}
      <Field
        id="doneOn"
        label="¿Cuándo se hizo?"
        error={errors.performedOn?.message}
        hint={next && next > plan.nextDueDate ? `La próxima vez quedará para el ${fmt(next, true)}.` : undefined}
      >
        <Input {...fieldAria("doneOn", errors.performedOn?.message, true)} {...form.register("performedOn")} type="date" max={today} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-[7rem_1fr]">
        <Field id="doneCurrency" label="Moneda" error={errors.currency?.message}>
          <Select {...fieldAria("doneCurrency", errors.currency?.message)} {...form.register("currency")}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="doneCost" label="Costo" error={errors.cost?.message} hint="Opcional.">
          <Input {...fieldAria("doneCost", errors.cost?.message)} {...form.register("cost")} inputMode="decimal" className="tabular-nums" placeholder="0.00" />
        </Field>
      </div>
      <Field id="doneProvider" label="Quién lo hizo" error={errors.provider?.message}>
        <Input {...fieldAria("doneProvider", errors.provider?.message)} {...form.register("provider")} placeholder="Ej. Servicio técnico autorizado" maxLength={160} />
      </Field>
      <Field id="doneNotes" label="Notas" error={errors.notes?.message}>
        <Textarea {...fieldAria("doneNotes", errors.notes?.message)} {...form.register("notes")} rows={2} maxLength={2000} />
      </Field>
      <div className="flex justify-end gap-2 border-t border-border pt-5">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          Registrar
        </Button>
      </div>
    </form>
  );
}

function PauseButton({ productId, plan }: { productId: string; plan: MaintenancePlanItem }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={plan.active ? `Pausar ${plan.title}` : `Reactivar ${plan.title}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setMaintenancePlanActive(productId, plan.id, !plan.active);
          if (res.ok) toast.success(res.message);
          else toast.error(res.message);
          router.refresh();
        })
      }
    >
      {plan.active ? <Pause aria-hidden /> : <Play aria-hidden />}
    </Button>
  );
}

function DeletePlanButton({ productId, plan }: { productId: string; plan: MaintenancePlanItem }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <ConfirmDialog
      title={`¿Eliminar “${plan.title}”?`}
      description="Se cancelan sus avisos pendientes. El historial de lo que ya se hizo se conserva."
      confirmLabel="Eliminar"
      pending={pending}
      onConfirm={() =>
        startTransition(async () => {
          const res = await deleteMaintenancePlan(productId, plan.id);
          if (res.ok) toast.success(res.message);
          else toast.error(res.message);
          router.refresh();
        })
      }
      trigger={(open) => (
        <Button variant="ghost" size="icon" onClick={open} aria-label={`Eliminar ${plan.title}`}>
          <Trash2 aria-hidden />
        </Button>
      )}
    />
  );
}

function DeleteLogButton({ productId, log }: { productId: string; log: MaintenanceLogItem }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <ConfirmDialog
      title="¿Eliminar este registro del historial?"
      description="La próxima fecha programada no cambia."
      confirmLabel="Eliminar"
      pending={pending}
      onConfirm={() =>
        startTransition(async () => {
          const res = await deleteMaintenanceLog(productId, log.id);
          if (res.ok) toast.success(res.message);
          else toast.error(res.message);
          router.refresh();
        })
      }
      trigger={(open) => (
        <Button variant="ghost" size="icon" onClick={open} aria-label={`Eliminar registro del ${fmt(log.performedOn)}`}>
          <Trash2 aria-hidden />
        </Button>
      )}
    />
  );
}
