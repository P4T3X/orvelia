"use client";

import { registerSchema } from "@orvelia/schemas";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { resendConfirmation, signUp } from "@/app/(auth)/actions";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

export function RegisterForm({ disabled }: { disabled?: boolean }) {
  const { form, onSubmit, pending, result } = useActionForm(
    registerSchema,
    { fullName: "", email: "", password: "", confirmPassword: "", acceptTerms: false as unknown as true },
    signUp,
  );
  const { errors } = form.formState;

  if (result?.ok && result.message) return <CheckEmail email={result.message} />;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {result && !result.ok && <Alert tone="error" title={result.message} />}

      <Field id="fullName" label="Nombre completo" error={errors.fullName?.message}>
        <Input
          {...fieldAria("fullName", errors.fullName?.message)}
          {...form.register("fullName")}
          autoComplete="name"
          autoFocus
          disabled={disabled}
        />
      </Field>

      <Field id="email" label="Correo electrónico" error={errors.email?.message}>
        <Input
          {...fieldAria("email", errors.email?.message)}
          {...form.register("email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          disabled={disabled}
        />
      </Field>

      <Field
        id="password"
        label="Contraseña"
        error={errors.password?.message}
        hint="Mínimo 8 caracteres, con letras y números."
      >
        <PasswordInput
          {...fieldAria("password", errors.password?.message, true)}
          {...form.register("password")}
          autoComplete="new-password"
          disabled={disabled}
        />
      </Field>

      <Field id="confirmPassword" label="Repite la contraseña" error={errors.confirmPassword?.message}>
        <PasswordInput
          {...fieldAria("confirmPassword", errors.confirmPassword?.message)}
          {...form.register("confirmPassword")}
          autoComplete="new-password"
          disabled={disabled}
        />
      </Field>

      <div className="grid gap-2">
        <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            {...form.register("acceptTerms")}
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined}
            disabled={disabled}
            className="mt-1 size-4 shrink-0 rounded-[4px] accent-[#111315] dark:accent-[#C7A66A]"
          />
          <span>
            Acepto los{" "}
            <Link href="/terms" target="_blank" className="text-foreground underline underline-offset-2">
              Términos
            </Link>{" "}
            y la{" "}
            <Link href="/privacy" target="_blank" className="text-foreground underline underline-offset-2">
              Política de privacidad
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms && (
          <p id="acceptTerms-error" role="alert" className="text-[13px] text-danger">
            {errors.acceptTerms.message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" loading={pending} disabled={disabled} className="mt-1">
        Crear cuenta
      </Button>
    </form>
  );
}

function CheckEmail({ email }: { email: string }) {
  const [pending, startTransition] = React.useTransition();
  const [resend, setResend] = React.useState<ActionState | null>(null);

  return (
    <div role="status" className="grid gap-5">
      <div className="flex size-11 items-center justify-center rounded-full border border-border-strong">
        <MailCheck className="size-5 text-accent-ink" aria-hidden />
      </div>
      <div>
        <h2 className="text-xl font-medium">Revisa tu correo</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          Enviamos un enlace de confirmación a <span className="font-medium text-foreground">{email}</span>. Ábrelo
          para activar tu cuenta.
        </p>
      </div>
      {resend && <Alert tone={resend.ok ? "success" : "error"} title={resend.message} />}
      <Button
        variant="secondary"
        loading={pending}
        onClick={() => startTransition(async () => setResend(await resendConfirmation(email)))}
      >
        Reenviar correo
      </Button>
    </div>
  );
}
