import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { RegisterForm } from "@/components/auth/register-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <>
      <AuthHeading title="Crea tu cuenta">Empieza gratis con hasta 10 productos.</AuthHeading>
      <RegisterForm disabled={!isSupabaseConfigured()} />
      <p className="mt-8 text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
