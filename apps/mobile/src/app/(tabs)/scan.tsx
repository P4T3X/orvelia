import { Image } from "expo-image";
import { router } from "expo-router";
import * as React from "react";
import { Platform, View } from "react-native";
import { Button, Notice, Screen, Text, Title } from "@/components/ui";
import { callApi } from "@/lib/api";
import { filePart, pickImage, type PickedImage } from "@/lib/media";
import { radius, space, useColors } from "@/lib/theme";

type Phase = "idle" | "uploading" | "reading";
const OUTCOME_COPY: Record<string, string> = {
  manual: "La lectura automática no está activa. Completa los datos a mano.",
  limit: "Usaste tus lecturas de este mes. Completa los datos a mano o pasa a un plan mayor.",
  failed: "No pudimos leer el comprobante. Completa los datos a mano.",
};

export default function Scan() {
  const c = useColors();
  const [photo, setPhoto] = React.useState<PickedImage | null>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function choose(source: "camera" | "library") {
    setError(null);
    const res = await pickImage(source, 2000);
    if (res && "error" in res) setError(res.error);
    else if (res) setPhoto(res);
  }

  async function send() {
    if (!photo) return;
    setError(null);
    setPhase("uploading");
    const form = new FormData();
    form.append("file", (await filePart(photo.uri, "comprobante.jpg", "image/jpeg")) as Blob, "comprobante.jpg");
    const up = await callApi<{ id: string }>("/api/mobile/receipts", { form });
    if (!up.ok || !up.data) {
      setPhase("idle");
      setError(up.message ?? "No pudimos subir el comprobante.");
      return;
    }
    setPhase("reading");
    const read = await callApi<{ outcome: string }>(`/api/mobile/receipts/${up.data.id}/process`);
    setPhase("idle");
    setPhoto(null);
    const outcome = read.data?.outcome;
    router.push({ pathname: "/receipt/[id]", params: { id: up.data.id, note: outcome ? (OUTCOME_COPY[outcome] ?? "") : (read.message ?? "") } });
  }

  return (
    <Screen>
      <Title subtitle="Toma una foto de la boleta o factura. ORVELIA lee la tienda, la fecha, el total y los productos.">Escanear comprobante</Title>
      {error && <Notice tone="error" title={error} />}
      {photo ? (
        <View style={{ gap: space.md }}>
          <Image source={{ uri: photo.uri }} style={{ width: "100%", aspectRatio: photo.width / Math.max(1, photo.height), maxHeight: 460, borderRadius: radius.lg, backgroundColor: c.muted }} contentFit="contain" accessibilityLabel="Comprobante" />
          <Button
            label={phase === "uploading" ? "Subiendo…" : phase === "reading" ? "Leyendo comprobante…" : "Leer comprobante"}
            icon="zap"
            onPress={send}
            loading={phase !== "idle"}
            testID="read-receipt"
          />
          <Button variant="ghost" label="Elegir otra foto" onPress={() => setPhoto(null)} disabled={phase !== "idle"} />
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          {Platform.OS !== "web" && <Button label="Tomar foto" icon="camera" onPress={() => choose("camera")} />}
          <Button variant={Platform.OS === "web" ? "primary" : "secondary"} label="Elegir de la galería" icon="image" onPress={() => choose("library")} testID="pick-receipt" />
          <Text variant="small" muted>
            Consejo: apoya el comprobante sobre una superficie plana y con buena luz. Revisarás los datos antes de guardarlos.
          </Text>
        </View>
      )}
    </Screen>
  );
}
