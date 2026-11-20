"use client";

import { SUPPORTED_CURRENCIES, type SupportedCurrency, type SupportedLanguage } from "@orvelia/domain";
import { profileUpdateSchema } from "@orvelia/schemas";
import * as React from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/app/settings/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { useActionForm } from "@/lib/use-action-form";

const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  PEN: "Sol peruano (S/)",
  USD: "Dólar estadounidense (US$)",
  EUR: "Euro (€)",
};

const COMMON_TIMEZONES = [
  "America/Lima",
  "America/Bogota",
  "America/Mexico_City",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/New_York",
  "Europe/Madrid",
];

export function ProfileForm({
  defaults,
}: {
  defaults: { fullName: string; preferredLanguage: SupportedLanguage; preferredCurrency: SupportedCurrency; timezone: string };
}) {
  const { form, onSubmit, pending, result } = useActionForm(profileUpdateSchema, defaults, updateProfile);
  const { errors, isDirty } = form.formState;

  React.useEffect(() => {
    if (result?.ok) {
      toast.success(result.message);
      form.reset(form.getValues());
    }
  }, [result, form]);

  const timezones = COMMON_TIMEZONES.includes(defaults.timezone)
    ? COMMON_TIMEZONES
    : [defaults.timezone, ...COMMON_TIMEZONES];

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      {result && !result.ok && <Alert tone="error" title={result.message} />}

      <Field id="fullName" label="Nombre completo" error={errors.fullName?.message}>
        <Input {...fieldAria("fullName", errors.fullName?.message)} {...form.register("fullName")} autoComplete="name" />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="preferredLanguage" label="Idioma" error={errors.preferredLanguage?.message}>
          <Select {...fieldAria("preferredLanguage", errors.preferredLanguage?.message)} {...form.register("preferredLanguage")}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field id="preferredCurrency" label="Moneda principal" error={errors.preferredCurrency?.message}>
          <Select {...fieldAria("preferredCurrency", errors.preferredCurrency?.message)} {...form.register("preferredCurrency")}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        id="timezone"
        label="Zona horaria"
        error={errors.timezone?.message}
        hint="Se usa para enviarte los recordatorios a la hora correcta."
      >
        <Select {...fieldAria("timezone", errors.timezone?.message, true)} {...form.register("timezone")}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <Button type="submit" loading={pending} disabled={!isDirty}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
