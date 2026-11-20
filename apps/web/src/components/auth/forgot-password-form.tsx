"use client";

import { forgotPasswordSchema } from "@orvelia/schemas";
import { requestPasswordReset } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/lib/use-action-form";

export function ForgotPasswordForm({ disabled }: { disabled?: boolean }) {
  const { form, onSubmit, pending, result } = useActionForm(
    forgotPasswordSchema,
    { email: "" },
    requestPasswordReset,
  );
  const { errors } = form.formState;

  if (result?.ok) return <Alert tone="success" title="Revisa tu correo">{result.message}</Alert>;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {result && !result.ok && <Alert tone="error" title={result.message} />}
      <Field id="email" label="Correo electrónico" error={errors.email?.message}>
        <Input
          {...fieldAria("email", errors.email?.message)}
          {...form.register("email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          disabled={disabled}
        />
      </Field>
      <Button type="submit" size="lg" loading={pending} disabled={disabled}>
        Enviar enlace
      </Button>
    </form>
  );
}
