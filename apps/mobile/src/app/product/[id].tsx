import { addWarranty, daysUntil, formatDate, formatMoney, getProduct, todayIn, updateProductStatus } from "@orvelia/api";
import { DOCUMENT_TYPE_LABELS, PRODUCT_STATUS_LABELS, PRODUCT_STATUSES, type DocumentType, type ProductStatus } from "@orvelia/domain";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { Button, Card, Chips, Empty, Field, Loading, Notice, Row, Screen, Section, Text } from "@/components/ui";
import { useUserId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { radius, space, useColors } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Lima";
const DURATIONS = [
  { value: "6", label: "6 meses" },
  { value: "12", label: "1 año" },
  { value: "24", label: "2 años" },
  { value: "36", label: "3 años" },
] as const;

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const c = useColors();
  const today = todayIn(TZ);
  const { data, error, refreshing, refresh } = useQuery(() => getProduct(supabase, userId, id), [userId, id]);
  const [status, setStatus] = React.useState<ProductStatus | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [months, setMonths] = React.useState<(typeof DURATIONS)[number]["value"]>("12");
  const [provider, setProvider] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "error" | "success"; text: string } | null>(null);

  if (data === undefined) return error ? <Screen><Notice tone="error" title="No pudimos cargar el producto.">{error}</Notice></Screen> : <Loading />;
  if (data === null) return <Screen><Empty icon="package" title="Este producto ya no existe." /></Screen>;
  const p = data;
  const current = status ?? p.status;

  async function changeStatus(next: ProductStatus) {
    const prev = current;
    setStatus(next);
    const res = await updateProductStatus(supabase, userId, p.id, next);
    if ("error" in res) {
      setStatus(prev);
      setMessage({ tone: "error", text: res.error! });
    }
  }

  async function saveWarranty() {
    setBusy(true);
    setMessage(null);
    const res = await addWarranty(supabase, userId, p.id, { startDate: p.purchaseDate ?? today, months: Number(months), provider });
    setBusy(false);
    if ("error" in res) setMessage({ tone: "error", text: res.error! });
    else {
      setAdding(false);
      setProvider("");
      setMessage({ tone: "success", text: "Garantía guardada. Te avisaremos antes de que venza." });
      void refresh();
    }
  }

  const subtitle = [p.brand, p.model, p.categoryName].filter(Boolean).join(" · ");

  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <Screen edges={["bottom"]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}>
        {p.imageUrl ? (
          <Image source={{ uri: p.imageUrl }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: c.muted }} contentFit="cover" accessibilityLabel={p.name} />
        ) : null}
        <View style={{ gap: space.xs }}>
          <Text variant="title" accessibilityRole="header">
            {p.name}
          </Text>
          {subtitle ? <Text muted>{subtitle}</Text> : null}
        </View>
        {message && <Notice tone={message.tone} title={message.text} />}

        <Card>
          <Row icon="calendar" title="Fecha de compra" detail={formatDate(p.purchaseDate) ?? "Sin registrar"} />
          <Row icon="tag" title="Precio" detail={formatMoney(p.purchasePrice, p.currency) ?? "Sin registrar"} />
          <Row icon="shopping-bag" title="Tienda o vendedor" detail={p.seller ?? "Sin registrar"} />
          {p.serialNumber ? <Row icon="hash" title="Número de serie" detail={p.serialNumber} /> : null}
        </Card>

        <Section title="Garantías y devoluciones" action={!adding ? <Button variant="ghost" label="Agregar garantía" icon="plus" onPress={() => setAdding(true)} style={{ minHeight: 36, paddingHorizontal: 8 }} /> : undefined}>
          {adding && (
            <View style={{ gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.raised }}>
              <Chips label="Duración" value={months} onChange={setMonths} options={DURATIONS.map((d) => ({ value: d.value, label: d.label }))} />
              <Field label="Quién la da (opcional)" value={provider} onChangeText={setProvider} placeholder="Ej. Samsung, la tienda" />
              <Text variant="small" muted>
                Empieza el {formatDate(p.purchaseDate ?? today)}{p.purchaseDate ? ", fecha de compra." : " (hoy). Registra la fecha de compra para que sea exacta."}
              </Text>
              <View style={{ flexDirection: "row", gap: space.md }}>
                <Button variant="ghost" label="Cancelar" onPress={() => setAdding(false)} style={{ flex: 1 }} />
                <Button label="Guardar garantía" onPress={saveWarranty} loading={busy} style={{ flex: 1 }} />
              </View>
            </View>
          )}
          {p.warranties.length + p.returns.length === 0 && !adding ? (
            <Empty icon="shield" title="Sin garantías registradas.">Agrega la garantía y te avisaremos antes de que venza.</Empty>
          ) : (
            <Card>
              {p.warranties.map((w) => {
                const d = w.endDate ? daysUntil(w.endDate, today) : null;
                return (
                  <Row
                    key={w.id}
                    icon="shield"
                    title={w.endDate ? (d! >= 0 ? `Garantía hasta el ${formatDate(w.endDate)}` : `Garantía vencida el ${formatDate(w.endDate)}`) : "Garantía sin fecha de fin"}
                    detail={w.provider}
                  />
                );
              })}
              {p.returns.map((r) => (
                <Row key={r.id} icon="rotate-ccw" title={`Devolución hasta el ${formatDate(r.deadlineDate)}`} />
              ))}
            </Card>
          )}
        </Section>

        <Section title="Comprobante y documentos">
          {!p.receipt && p.documents.length === 0 ? (
            <Empty icon="file-text" title="Sin comprobante ni documentos.">Escanea el comprobante desde la pestaña Escanear.</Empty>
          ) : (
            <Card>
              {p.receipt ? (
                <Row
                  icon="file"
                  title="Comprobante de compra"
                  detail={[p.receipt.merchant, formatDate(p.receipt.purchaseDate, "short"), formatMoney(p.receipt.total, p.receipt.currency)].filter(Boolean).join(" · ")}
                />
              ) : null}
              {p.documents.map((d) => (
                <Row key={d.id} icon="file-text" title={d.title} detail={[DOCUMENT_TYPE_LABELS[d.documentType as DocumentType], d.expiresOn ? `vence el ${formatDate(d.expiresOn, "short")}` : null].filter(Boolean).join(" · ")} />
              ))}
            </Card>
          )}
        </Section>

        <Chips label="Estado" value={current} onChange={changeStatus} options={PRODUCT_STATUSES.map((s) => ({ value: s, label: PRODUCT_STATUS_LABELS[s] }))} />
        {p.description ? (
          <Section title="Descripción">
            <Text muted>{p.description}</Text>
          </Section>
        ) : null}
      </Screen>
    </>
  );
}
