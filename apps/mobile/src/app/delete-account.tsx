import * as React from "react";
import { Button, Field, Notice, Screen, Text } from "@/components/ui";
import { callApi } from "@/lib/api";
import { unregisterPush } from "@/lib/push";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** In-app account deletion (App Store guideline 5.1.1(v), Google Play account deletion policy). */
export default function DeleteAccount() {
  const { email } = useSession();
  const [typed, setTyped] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const matches = typed.trim().toLowerCase() === (email ?? "").toLowerCase();

  async function remove() {
    setError(null);
    setPending(true);
    await unregisterPush();
    const res = await callApi("/api/mobile/account", { json: { email: typed } });
    setPending(false);
    if (!res.ok) {
      setError(res.fieldErrors?.email ?? res.message ?? "No pudimos eliminar tu cuenta.");
      return;
    }
    // The account no longer exists; clear the local session.
    await supabase.auth.signOut({ scope: "local" });
  }

  return (
    <Screen edges={["bottom"]}>
      <Text muted>
        Se borrarán para siempre tu perfil, productos, comprobantes, documentos, archivos y recordatorios. Si tienes una
        suscripción, se cancelará. Si eres titular de una familia, también se eliminará para sus miembros.
      </Text>
      <Text muted>Si quieres una copia, descarga tus datos desde la web antes de continuar.</Text>
      {error && <Notice tone="error" title={error} />}
      <Field label={`Escribe ${email ?? "tu correo"} para confirmar`} value={typed} onChangeText={setTyped} autoCapitalize="none" keyboardType="email-address" testID="confirm-email" />
      <Button variant="danger" label="Eliminar mi cuenta" onPress={remove} disabled={!matches} loading={pending} testID="delete-account" />
    </Screen>
  );
}
