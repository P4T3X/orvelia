"use client";

import { resetPasswordSchema } from "@orvelia/schemas";
import { updatePassword } from "@/app/(auth)/actions";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { useActionForm } from "@/lib/use-action-form";

export function ResetPasswordForm() {
  const { form, onSubmit, pending, result } = useActionForm(
    resetPasswordSchema,
    { password: "", confirmPassword: "" },
    updatePassword,
  );
  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {result && !result.ok && <Alert tone="error" title={result.message} />}
      <Field
        id="password"
        label="Nueva contraseña"
        error={errors.password?.message}
        hint="Mínimo 8 caracteres, con letras y números."
      >
        <PasswordInput
          {...fieldAria("password", errors.password?.message, true)}
          {...form.register("password")}
          autoComplete="new-password"
          autoFocus
        />
      </Field>
      <Field id="confirmPassword" label="Repite la contraseña" error={errors.confirmPassword?.message}>
        <PasswordInput
          {...fieldAria("confirmPassword", errors.confirmPassword?.message)}
          {...form.register("confirmPassword")}
          autoComplete="new-password"
        />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        Guardar contraseña
      </Button>
    </form>
  );
}
