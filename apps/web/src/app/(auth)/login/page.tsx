import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Iniciar sesión" };

const errorCopy: Record<string, string> = {
  link_invalid: "El enlace no es válido o ya expiró. Solicita uno nuevo.",
  not_configured: "La autenticación aún no está configurada en este entorno.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const errorMessage = error ? errorCopy[error] : undefined;

  return (
    <>
      <AuthHeading title="Bienvenido de vuelta">Ingresa a tu espacio ORVELIA.</AuthHeading>
      {errorMessage && <Alert tone="error" title={errorMessage} className="mb-6" />}
      <LoginForm next={next} disabled={!isSupabaseConfigured()} />
      <p className="mt-8 text-sm text-muted-foreground">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Crear cuenta
        </Link>
      </p>
    </>
  );
}
