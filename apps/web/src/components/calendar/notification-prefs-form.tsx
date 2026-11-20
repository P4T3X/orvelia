"use client";

import { LEAD_DAY_OPTIONS } from "@orvelia/domain";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { saveNotificationPrefs } from "@/app/app/calendar/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Prefs = { emailEnabled: boolean; warrantyLeadDays: number[]; returnLeadDays: number[]; documentLeadDays: number[] };

const label = (d: number) => (d === 0 ? "El mismo día" : d === 1 ? "1 día antes" : `${d} días antes`);

function LeadPicker({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly number[];
  value: number[];
  onChange: (v: number[]) => void;
}) {
  return (
    <fieldset className="grid gap-2.5">
      <legend className="mb-2.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((d) => {
          const on = value.includes(d);
          return (
            <label
              key={d}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                on ? "border-foreground bg-foreground text-background" : "border-border-strong text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={(e) => onChange(e.target.checked ? [...value, d] : value.filter((x) => x !== d))}
              />
              {label(d)}
            </label>
          );
        })}
      </div>
      {value.length === 0 && <p className="text-[13px] text-muted-foreground">Sin avisos para este tipo de fecha.</p>}
    </fieldset>
  );
}

export function NotificationPrefsForm({ initial, emailConfigured }: { initial: Prefs; emailConfigured: boolean }) {
  const router = useRouter();
  const [prefs, setPrefs] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);

  return (
    <form
      className="grid gap-7"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveNotificationPrefs(prefs);
          if (!res.ok) toast.error(res.message);
          else {
            toast.success(res.message);
            router.refresh();
          }
        });
      }}
    >
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={prefs.emailEnabled}
          onChange={(e) => setPrefs({ ...prefs, emailEnabled: e.target.checked })}
          className="mt-1 size-4 accent-[#111315] dark:accent-[#C7A66A]"
        />
        <span>
          <span className="block text-[15px]">Enviarme los avisos también por correo</span>
          <span className="block text-[13px] text-muted-foreground">
            {emailConfigured
              ? "Siempre los verás en la campana de avisos."
              : "El envío de correos aún no está activo en este entorno; los verás en la campana de avisos."}
          </span>
        </span>
      </label>

      <LeadPicker
        legend="Garantías"
        options={LEAD_DAY_OPTIONS.warranty}
        value={prefs.warrantyLeadDays}
        onChange={(v) => setPrefs({ ...prefs, warrantyLeadDays: v })}
      />
      <LeadPicker
        legend="Plazos de devolución"
        options={LEAD_DAY_OPTIONS.return}
        value={prefs.returnLeadDays}
        onChange={(v) => setPrefs({ ...prefs, returnLeadDays: v })}
      />
      <LeadPicker
        legend="Documentos con vencimiento"
        options={LEAD_DAY_OPTIONS.document}
        value={prefs.documentLeadDays}
        onChange={(v) => setPrefs({ ...prefs, documentLeadDays: v })}
      />

      <div>
        <Button type="submit" loading={pending} disabled={!dirty}>
          Guardar avisos
        </Button>
      </div>
    </form>
  );
}
