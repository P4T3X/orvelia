import { Feather } from "@expo/vector-icons";
import { receiptConfirmSchema, type ReceiptConfirmInput } from "@orvelia/schemas";
import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { Button, Card, Chips, Field, Loading, Notice, Screen, Section, Text } from "@/components/ui";
import { callApi } from "@/lib/api";
import { useUserId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { radius, space, type, useColors } from "@/lib/theme";

type Extraction = {
  data?: {
    merchant: string | null;
    receiptNumber: string | null;
    purchaseDate: string | null;
    currency: string | null;
    total: number | null;
    tax: number | null;
    items: { description: string; amount: number | null }[];
  };
  warnings?: string[];
};
type Item = { name: string; price: string; create: boolean };

const money = (n: number | null | undefined) => (n === null || n === undefined ? "" : n.toFixed(2));

export default function ReviewReceipt() {
  const { id, note } = useLocalSearchParams<{ id: string; note?: string }>();
  const userId = useUserId();
  const c = useColors();
  const [loaded, setLoaded] = React.useState(false);
  const [form, setForm] = React.useState({ merchant: "", receiptNumber: "", purchaseDate: "", total: "", tax: "", currency: "PEN" as "PEN" | "USD" });
  const [items, setItems] = React.useState<Item[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [message, setMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    supabase
      .from("receipts")
      .select("extraction")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const x = (data?.extraction as Extraction | null)?.data;
        if (x) {
          setForm({
            merchant: x.merchant ?? "",
            receiptNumber: x.receiptNumber ?? "",
            purchaseDate: x.purchaseDate ?? "",
            total: money(x.total),
            tax: money(x.tax),
            currency: x.currency === "USD" ? "USD" : "PEN",
          });
          setItems(x.items.slice(0, 20).map((i) => ({ name: i.description.slice(0, 160), price: money(i.amount), create: true })));
        }
        setLoaded(true);
      });
  }, [id, userId]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function confirm() {
    setMessage(null);
    const input: ReceiptConfirmInput = {
      ...form,
      linkProductIds: [],
      newProducts: items.filter((i) => i.create && i.name.trim()).map((i) => ({ name: i.name, price: i.price })),
    };
    const parsed = receiptConfirmSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[i.path.join(".")] ??= i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    const res = await callApi<{ created: number; limitReached: boolean; firstProductId: string | null }>(`/api/mobile/receipts/${id}/confirm`, { json: input });
    setSaving(false);
    if (!res.ok || !res.data) {
      setMessage(res.message ?? "No pudimos guardar el comprobante.");
      if (res.fieldErrors) setErrors(res.fieldErrors);
      return;
    }
    if (res.data.firstProductId) router.replace(`/product/${res.data.firstProductId}`);
    else router.replace("/products");
  }

  if (!loaded) return <Loading />;
  const toCreate = items.filter((i) => i.create).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen edges={["bottom"]}>
        {note ? <Notice title={note} /> : <Notice tone="success" title="Revisa lo que leímos.">Corrige lo que haga falta antes de guardar.</Notice>}
        {message && <Notice tone="error" title={message} />}
        <Field label="Tienda" value={form.merchant} onChangeText={set("merchant")} error={errors.merchant} testID="merchant" />
        <View style={{ flexDirection: "row", gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field label="Fecha" value={form.purchaseDate} onChangeText={set("purchaseDate")} placeholder="AAAA-MM-DD" error={errors.purchaseDate} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="N.º de comprobante" value={form.receiptNumber} onChangeText={set("receiptNumber")} error={errors.receiptNumber} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Field label="Total" value={form.total} onChangeText={set("total")} keyboardType="decimal-pad" error={errors.total} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="IGV" value={form.tax} onChangeText={set("tax")} keyboardType="decimal-pad" error={errors.tax} />
          </View>
        </View>
        <Chips label="Moneda" value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: v }))} options={[{ value: "PEN", label: "S/" }, { value: "USD", label: "US$" }]} />

        <Section title="Productos del comprobante">
          <Text variant="small" muted>
            Marca los que quieras agregar a tu colección. Puedes cambiar el nombre.
          </Text>
          <Card>
            {items.map((it, idx) => (
              <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm }}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: it.create }}
                  accessibilityLabel={`Agregar ${it.name}`}
                  onPress={() => setItems((all) => all.map((x, i) => (i === idx ? { ...x, create: !x.create } : x)))}
                  hitSlop={10}
                  style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: it.create ? c.foreground : c.borderStrong, backgroundColor: it.create ? c.foreground : "transparent", alignItems: "center", justifyContent: "center" }}
                >
                  {it.create ? <Feather name="check" size={16} color={c.background} /> : null}
                </Pressable>
                <TextInput
                  value={it.name}
                  onChangeText={(t) => setItems((all) => all.map((x, i) => (i === idx ? { ...x, name: t } : x)))}
                  accessibilityLabel={`Nombre del producto ${idx + 1}`}
                  style={[type.body, { flex: 1, minWidth: 0, color: c.foreground, minHeight: 40 }]}
                />
                <TextInput
                  value={it.price}
                  onChangeText={(t) => setItems((all) => all.map((x, i) => (i === idx ? { ...x, price: t } : x)))}
                  keyboardType="decimal-pad"
                  accessibilityLabel={`Precio del producto ${idx + 1}`}
                  style={[type.body, { width: 88, flexShrink: 0, textAlign: "right", color: c.foreground, minHeight: 40, paddingHorizontal: 6, borderRadius: radius.sm, backgroundColor: c.muted }]}
                />
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setItems((all) => [...all, { name: "", price: "", create: true }])}
              style={{ flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.lg }}
            >
              <Feather name="plus" size={18} color={c.accentInk} />
              <Text variant="label">Agregar otro producto</Text>
            </Pressable>
          </Card>
          {errors.newProducts ? <Text variant="small" style={{ color: c.danger }}>{errors.newProducts}</Text> : null}
        </Section>

        <Button label={toCreate ? `Guardar y agregar ${toCreate} ${toCreate === 1 ? "producto" : "productos"}` : "Guardar comprobante"} onPress={confirm} loading={saving} testID="confirm" />
      </Screen>
    </KeyboardAvoidingView>
  );
}
