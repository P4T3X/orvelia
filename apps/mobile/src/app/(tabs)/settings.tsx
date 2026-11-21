import { getPushEnabled, setPushEnabled } from "@orvelia/api";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as React from "react";
import { Platform, Switch, View } from "react-native";
import { Button, Card, Notice, Row, Screen, Section, Text, Title } from "@/components/ui";
import { env } from "@/lib/env";
import { registerForPush, unregisterPush } from "@/lib/push";
import { useSession, useUserId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { space, useColors } from "@/lib/theme";

export default function Settings() {
  const userId = useUserId();
  const { email } = useSession();
  const c = useColors();
  const [push, setPush] = React.useState<boolean | null>(null);
  const [note, setNote] = React.useState<{ tone: "error" | "info" | "success"; text: string } | null>(null);

  React.useEffect(() => {
    getPushEnabled(supabase, userId).then(setPush).catch(() => setPush(true));
  }, [userId]);

  async function togglePush(next: boolean) {
    setPush(next);
    setNote(null);
    try {
      await setPushEnabled(supabase, userId, next);
      if (next) {
        const r = await registerForPush();
        setNote(r.status === "registered" ? { tone: "success", text: "Este teléfono recibirá tus recordatorios." } : { tone: "info", text: r.reason });
      }
    } catch {
      setPush(!next);
      setNote({ tone: "error", text: "No pudimos guardar el cambio." });
    }
  }

  const web = (path: string) => () => env.apiUrl && Linking.openURL(`${env.apiUrl}${path}`);

  return (
    <Screen>
      <Title>Ajustes</Title>
      {note && <Notice tone={note.tone} title={note.text} />}
      <Section title="Avisos">
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">Notificaciones en este teléfono</Text>
              <Text variant="small" muted>
                Garantías y devoluciones por vencer, y tus recordatorios.
              </Text>
            </View>
            <Switch
              value={push ?? false}
              disabled={push === null}
              onValueChange={togglePush}
              accessibilityLabel="Notificaciones en este teléfono"
              trackColor={{ true: c.accent, false: c.borderStrong }}
            />
          </View>
          <Row icon="sliders" title="Cuándo avisarte" detail="Días de anticipación y correo, en la web." onPress={web("/app/settings#avisos")} />
        </Card>
      </Section>
      <Section title="Cuenta">
        <Card>
          <Row icon="user" title="Correo" detail={email} />
          <Row icon="users" title="Familia" detail="Invita y gestiona a tu familia en la web." onPress={web("/app/family")} />
          <Row icon="download" title="Descargar mis datos" detail="Se descargan desde la web." onPress={web("/app/settings#datos")} />
          <Row icon="lock" title="Privacidad" onPress={web("/privacy")} />
        </Card>
      </Section>
      <Card>
        <Row icon="trash-2" title="Eliminar mi cuenta" detail="Borra tu cuenta y todos tus datos." onPress={() => router.push("/delete-account")} testID="open-delete" />
      </Card>
      <Button
        variant="secondary"
        label="Cerrar sesión"
        icon="log-out"
        onPress={async () => {
          await unregisterPush();
          await supabase.auth.signOut();
        }}
        testID="sign-out"
      />
      <Text variant="small" muted style={{ textAlign: "center" }}>
        ORVELIA {Constants.expoConfig?.version ?? ""} · {Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web"}
        {"\n"}Made by: Lucioni Enterprises
      </Text>
    </Screen>
  );
}
