"use client";

import { RECURRENCES, RECURRENCE_LABELS, REMINDER_SOURCE_LABELS } from "@orvelia/domain";
import { reminderInputSchema, type ReminderInput } from "@orvelia/schemas";
import { BellPlus, Mail, Repeat, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { createReminder, removeReminder } from "@/app/app/calendar/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { ReminderRow } from "@/lib/calendar";
import { useActionForm } from "@/lib/use-action-form";

export function NewReminderButton({ products, tomorrow }: { products: { id: string; name: string }[]; tomorrow: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <BellPlus aria-hidden />
        Nuevo recordatorio
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Nuevo recordatorio"
        description="Para mantenimientos, renovaciones o cualquier fecha que quieras recordar."
        wide
      >
        {open && <ReminderForm products={products} tomorrow={tomorrow} onDone={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}

function ReminderForm({ products, tomorrow, onDone }: { products: { id: string; name: string }[]; tomorrow: string; onDone: () => void }) {
  const router = useRouter();
  const defaults: ReminderInput = {
    title: "",
    description: "",
    date: tomorrow,
    time: "09:00",
    productId: "",
    recurrence: "none",
    email: true,
  };
  const { form, onSubmit, pending, result } = useActionForm(reminderInputSchema, defaults, async (v) => {
    const res = await createReminder(v);
    if (res.ok) {
      toast.success(res.message);
      onDone();
      router.refresh();
    }
    return res;
  });
  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {result && !result.ok && <Alert tone="error" title={result.message} />}
      <Field id="title" label="Qué quieres recordar" error={errors.title?.message}>
        <Input {...fieldAria("title", errors.title?.message)} {...form.register("title")} placeholder="Ej. Mantenimiento del aire acondicionado" maxLength={160} autoFocus />
      </Field>
      <div className="grid gap-5 sm:grid-cols-[1fr_8rem_1fr]">
        <Field id="date" label="Fecha" error={errors.date?.message}>
          <Input {...fieldAria("date", errors.date?.message)} {...form.register("date")} type="date" min={tomorrow} />
        </Field>
        <Field id="time" label="Hora" error={errors.time?.message}>
          <Input {...fieldAria("time", errors.time?.message)} {...form.register("time")} type="time" step={300} />
        </Field>
        <Field id="recurrence" label="Repetir" error={errors.recurrence?.message}>
          <Select {...fieldAria("recurrence", errors.recurrence?.message)} {...form.register("recurrence")}>
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {RECURRENCE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id="productId" label="Producto" error={errors.productId?.message} hint="Opcional.">
        <Select {...fieldAria("productId", errors.productId?.message, true)} {...form.register("productId")}>
          <option value="">Sin producto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="description" label="Notas" error={errors.description?.message}>
        <Textarea {...fieldAria("description", errors.description?.message)} {...form.register("description")} rows={2} maxLength={2000} />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" {...form.register("email")} className="size-4 accent-[#111315] dark:accent-[#C7A66A]" />
        Avisarme también por correo
      </label>
      <div className="flex justify-end gap-2 border-t border-border pt-5">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          Crear recordatorio
        </Button>
      </div>
    </form>
  );
}

export function ReminderList({ reminders, timeZone }: { reminders: ReminderRow[]; timeZone: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();
  const fmt = new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone });

  if (reminders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border-strong px-5 py-6 text-sm text-muted-foreground">
        No hay avisos programados. Se crean solos cuando registras garantías, plazos de devolución o documentos con
        vencimiento.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised">
      {reminders.map((r) => (
        <li key={r.id} className="flex items-start gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] tabular-nums text-muted-foreground">{fmt.format(new Date(r.scheduledAt))}</p>
            <p className="mt-0.5 font-medium leading-snug">
              {r.productId ? (
                <Link href={`/app/products/${r.productId}`} className="hover:underline">
                  {r.title}
                </Link>
              ) : (
                r.title
              )}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              <span>{r.source === "custom" ? "Manual" : `Automático · ${REMINDER_SOURCE_LABELS[r.source]}`}</span>
              {r.recurrence !== "none" && (
                <span className="inline-flex items-center gap-1">
                  <Repeat className="size-3" aria-hidden />
                  {RECURRENCE_LABELS[r.recurrence]}
                </span>
              )}
              {r.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3" aria-hidden />
                  Correo
                </span>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            loading={busy === r.id}
            aria-label={r.source === "custom" ? `Eliminar recordatorio ${r.title}` : `Descartar aviso ${r.title}`}
            title={r.source === "custom" ? "Eliminar" : "Descartar este aviso"}
            onClick={() => {
              setBusy(r.id);
              startTransition(async () => {
                const res = await removeReminder(r.id);
                setBusy(null);
                if (!res.ok) toast.error(res.message);
                else {
                  toast.success(res.message);
                  router.refresh();
                }
              });
            }}
          >
            {busy !== r.id && <X aria-hidden />}
          </Button>
        </li>
      ))}
    </ul>
  );
}
