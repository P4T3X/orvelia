import { formatMoney, listProducts, type ProductListItem } from "@orvelia/api";
import { PRODUCT_STATUS_LABELS } from "@orvelia/domain";
import { router } from "expo-router";
import * as React from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { Thumb } from "@/components/thumb";
import { Button, Empty, Notice, Screen, Text } from "@/components/ui";
import { useUserId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { radius, space, type, useColors } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";

type Filter = "active" | "all";

export default function Products() {
  const userId = useUserId();
  const c = useColors();
  const [search, setSearch] = React.useState("");
  const [term, setTerm] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("active");

  // Debounce typing so each keystroke doesn't hit the database.
  React.useEffect(() => {
    const t = setTimeout(() => setTerm(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, error, refreshing, refresh } = useQuery(
    () => listProducts(supabase, userId, { search: term, status: filter, limit: 100 }),
    [userId, term, filter],
  );

  const renderItem = ({ item }: { item: ProductListItem }) => (
    <Pressable
      onPress={() => router.push(`/product/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, backgroundColor: pressed ? c.muted : c.raised })}
    >
      <Thumb url={item.imageUrl} label={item.name} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={1}>
          {item.name}
        </Text>
        <Text variant="small" muted numberOfLines={1}>
          {[item.brand, item.categoryName, formatMoney(item.purchasePrice, item.currency)].filter(Boolean).join(" · ") || "Sin detalles"}
        </Text>
      </View>
      {item.status !== "active" && (
        <Text variant="small" muted>
          {PRODUCT_STATUS_LABELS[item.status]}
        </Text>
      )}
    </Pressable>
  );

  return (
    <Screen scroll={false}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="title" accessibilityRole="header">
            Mi colección
          </Text>
          <Button label="Agregar" icon="plus" onPress={() => router.push("/product/new")} style={{ minHeight: 40 }} />
        </View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre, marca o modelo"
          placeholderTextColor={c.mutedForeground}
          accessibilityLabel="Buscar productos"
          autoCorrect={false}
          returnKeyType="search"
          style={[type.body, { minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.raised, color: c.foreground }]}
        />
        <View style={{ flexDirection: "row", gap: space.sm }} accessibilityRole="tablist">
          {(["active", "all"] as const).map((f) => (
            <Pressable
              key={f}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === f }}
              onPress={() => setFilter(f)}
              style={{ paddingHorizontal: 14, minHeight: 34, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: filter === f ? c.foreground : c.borderStrong, backgroundColor: filter === f ? c.foreground : "transparent" }}
            >
              <Text variant="small" style={{ color: filter === f ? c.background : c.foreground, fontWeight: "500" }}>
                {f === "active" ? "Activos" : "Todos"}
              </Text>
            </Pressable>
          ))}
          {data && (
            <Text variant="small" muted style={{ alignSelf: "center", marginLeft: "auto" }}>
              {data.total} {data.total === 1 ? "producto" : "productos"}
            </Text>
          )}
        </View>
        {error && <Notice tone="error" title="No pudimos cargar tu colección.">{error}</Notice>}
      </View>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />}
        contentContainerStyle={{ paddingBottom: space.xxl }}
        ListEmptyComponent={
          data ? (
            <View style={{ paddingHorizontal: space.lg }}>
              <Empty icon="package" title={term ? "Nada coincide con tu búsqueda." : "Aún no tienes productos."}>
                {term ? "Prueba con otra palabra." : "Agrega tu primer producto o escanea un comprobante."}
              </Empty>
            </View>
          ) : undefined
        }
      />
    </Screen>
  );
}
