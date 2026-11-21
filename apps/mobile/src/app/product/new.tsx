import { createProduct, listCategories, STORAGE_BUCKET, todayIn, type Category } from "@orvelia/api";
import { productInputSchema, type ProductInput } from "@orvelia/schemas";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as React from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, Chips, Field, Notice, Screen, Section, Text } from "@/components/ui";
import { pickImage, readBytes, type PickedImage } from "@/lib/media";
import { useUserId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { radius, space, useColors } from "@/lib/theme";

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Lima";
const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

const EMPTY: ProductInput = {
  name: "",
  brand: "",
  model: "",
  categoryId: "",
  description: "",
  notes: "",
  purchaseDate: "",
  purchasePrice: "",
  currency: "PEN",
  seller: "",
  serialNumber: "",
  status: "active",
};

export default function NewProduct() {
  const userId = useUserId();
  const c = useColors();
  const [v, setV] = React.useState<ProductInput>(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [message, setMessage] = React.useState<string | null>(null);
  const [photo, setPhoto] = React.useState<PickedImage | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [saving, setSaving] = React.useState(false);
  const set = (k: keyof ProductInput) => (text: string) => setV((p) => ({ ...p, [k]: text }));

  React.useEffect(() => {
    listCategories(supabase, userId).then(setCategories).catch(() => setCategories([]));
  }, [userId]);

  async function choosePhoto(source: "camera" | "library") {
    const res = await pickImage(source, 1600);
    if (res && "error" in res) setMessage(res.error);
    else if (res) setPhoto(res);
  }

  async function save() {
    setMessage(null);
    const parsed = productInputSchema.safeParse(v);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await createProduct(supabase, userId, parsed.data);
      if ("error" in res) {
        setMessage(res.error);
        return;
      }
      if (photo) {
        // The product exists already; a failed photo upload shouldn't lose it.
        const path = `${userId}/products/${res.id}/${uuid()}.jpg`;
        const up = await supabase.storage.from(STORAGE_BUCKET).upload(path, await readBytes(photo.uri), { contentType: "image/jpeg" });
        if (!up.error) await supabase.from("products").update({ image_path: path }).eq("id", res.id).eq("user_id", userId);
      }
      router.replace(`/product/${res.id}`);
    } catch {
      setMessage("Sin conexión. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const topCategories = categories.slice(0, 12);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen edges={["bottom"]}>
        {message && <Notice tone="error" title={message} />}
        <Field label="Nombre del producto" value={v.name} onChangeText={set("name")} error={errors.name} placeholder="Ej. Refrigeradora No Frost" testID="name" />
        <View style={{ flexDirection: "row", gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field label="Marca" value={v.brand} onChangeText={set("brand")} error={errors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Modelo" value={v.model} onChangeText={set("model")} error={errors.model} />
          </View>
        </View>
        {topCategories.length > 0 && (
          <Chips
            label="Categoría"
            value={v.categoryId || null}
            onChange={(id) => setV((p) => ({ ...p, categoryId: p.categoryId === id ? "" : id }))}
            options={topCategories.map((cat) => ({ value: cat.id, label: cat.name }))}
          />
        )}
        <Section title="Compra">
          <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Field label="Precio" value={v.purchasePrice} onChangeText={set("purchasePrice")} error={errors.purchasePrice} keyboardType="decimal-pad" placeholder="0.00" testID="price" />
            </View>
            <View style={{ flex: 1 }}>
              <Chips label="Moneda" value={v.currency} onChange={(cur) => setV((p) => ({ ...p, currency: cur }))} options={[{ value: "PEN", label: "S/" }, { value: "USD", label: "US$" }]} />
            </View>
          </View>
          <Field
            label="Fecha de compra"
            value={v.purchaseDate}
            onChangeText={set("purchaseDate")}
            error={errors.purchaseDate}
            placeholder="AAAA-MM-DD"
            hint="Formato año-mes-día."
            testID="date"
          />
          <Button variant="ghost" label="Usar la fecha de hoy" icon="calendar" onPress={() => setV((p) => ({ ...p, purchaseDate: todayIn(TZ) }))} style={{ alignSelf: "flex-start", minHeight: 36 }} />
          <Field label="Tienda o vendedor" value={v.seller} onChangeText={set("seller")} error={errors.seller} />
        </Section>
        <Section title="Foto">
          {photo ? (
            <View style={{ gap: space.md }}>
              <Image source={{ uri: photo.uri }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg }} contentFit="cover" accessibilityLabel="Foto del producto" />
              <Button variant="ghost" label="Quitar foto" icon="x" onPress={() => setPhoto(null)} />
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: space.md }}>
              {Platform.OS !== "web" && <Button variant="secondary" label="Tomar foto" icon="camera" style={{ flex: 1 }} onPress={() => choosePhoto("camera")} />}
              <Button variant="secondary" label="Elegir de la galería" icon="image" style={{ flex: 1 }} onPress={() => choosePhoto("library")} />
            </View>
          )}
        </Section>
        <Button label="Guardar producto" onPress={save} loading={saving} testID="save" />
        <Text variant="small" muted>
          Las garantías, plazos de devolución y documentos se agregan desde la ficha del producto en la web.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
