import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function ResetPasswordPage() {
  // A recovery link creates a short-lived session before landing here.
  const user = await getUser();

  if (!user) {
    return (
      <>
        <AuthHeading title="Enlace no válido" />
        <Alert tone="error" title="El enlace expiró o ya fue usado.">
          Solicita uno nuevo para cambiar tu contraseña.
        </Alert>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/forgot-password">Solicitar nuevo enlace</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Crea una nueva contraseña">Para {user.email}</AuthHeading>
      <ResetPasswordForm />
    </>
  );
}
