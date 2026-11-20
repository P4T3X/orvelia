"use client";

import { loginSchema } from "@orvelia/schemas";
import Link from "next/link";
import { signIn } from "@/app/(auth)/actions";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/lib/use-action-form";

export function LoginForm({ next, disabled }: { next?: string; disabled?: boolean }) {
  const { form, onSubmit, pending, result } = useActionForm(
    loginSchema,
    { email: "", password: "" },
    (values) => signIn(values, next),
  );
  const { errors } = form.formState;

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

      <Field
        id="password"
        label="Contraseña"
        error={errors.password?.message}
        action={
          <Link href="/forgot-password" className="text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            ¿La olvidaste?
          </Link>
        }
      >
        <PasswordInput
          {...fieldAria("password", errors.password?.message)}
          {...form.register("password")}
          autoComplete="current-password"
          disabled={disabled}
        />
      </Field>

      <Button type="submit" size="lg" loading={pending} disabled={disabled} className="mt-1">
        Iniciar sesión
      </Button>
    </form>
  );
}
