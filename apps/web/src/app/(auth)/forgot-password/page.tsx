import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Recupera tu acceso">
        Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.
      </AuthHeading>
      <ForgotPasswordForm disabled={!isSupabaseConfigured()} />
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </>
  );
}
