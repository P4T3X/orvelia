import { getHomeSummary, listSharedProducts, listUpcoming, relativeDays, todayIn, formatDate } from "@orvelia/api";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as React from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Button, Card, Empty, Notice, Row, Screen, Section, Stat, Text } from "@/components/ui";
import { greeting, KIND, PLAN_NAMES } from "@/lib/labels";
import { useSession, useUserId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { space, useColors } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Lima";

export default function Home() {
  const userId = useUserId();
  const { session } = useSession();
  const c = useColors();
  const { data, error, refreshing, refresh } = useQuery(async () => {
    const today = todayIn(TZ);
    const [summary, upcoming, shared, unread] = await Promise.all([
      getHomeSummary(supabase, userId, today),
      listUpcoming(supabase, userId, today, 30, TZ),
      listSharedProducts(supabase),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
    ]);
    return { today, summary, upcoming, shared: shared.filter((s) => !s.isMine), unread: unread.count ?? 0 };
  }, [userId]);

  const name = (session?.user.user_metadata?.full_name as string | undefined) ?? null;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text variant="title" accessibilityRole="header">
            {greeting(name)}
          </Text>
          <Text muted>Lo importante de tu colección, de un vistazo.</Text>
        </View>
        <Pressable
          onPress={() => router.push("/notifications")}
          accessibilityRole="button"
          accessibilityLabel={data?.unread ? `Avisos, ${data.unread} sin leer` : "Avisos"}
          hitSlop={12}
          style={{ padding: space.sm }}
        >
          <Feather name="bell" size={22} color={c.foreground} />
          {data?.unread ? <View style={{ position: "absolute", top: 6, right: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent }} /> : null}
        </Pressable>
      </View>

      {error && <Notice tone="error" title="No pudimos cargar tu inicio.">{error}</Notice>}

      <Card>
        <View style={{ flexDirection: "row" }}>
          <Stat label="Productos activos" value={data ? String(data.summary.activeProducts) : "–"} />
          <View style={{ width: 1, backgroundColor: c.border }} />
          <Stat label="Garantías vigentes" value={data ? String(data.summary.activeWarranties) : "–"} />
        </View>
        <Row icon="award" title={`Plan ${data ? PLAN_NAMES[data.summary.plan] : ""}`} />
      </Card>

      <View style={{ flexDirection: "row", gap: space.md }}>
        <Button label="Agregar" icon="plus" style={{ flex: 1 }} onPress={() => router.push("/product/new")} />
        <Button label="Escanear" icon="camera" variant="secondary" style={{ flex: 1 }} onPress={() => router.push("/scan")} />
      </View>

      <Section title="Próximos 30 días">
        {data && data.upcoming.length === 0 ? (
          <Empty icon="check-circle" title="Nada vence en los próximos 30 días.">Te avisaremos antes de que venza una garantía o un plazo de devolución.</Empty>
        ) : (
          <Card>
            {(data?.upcoming ?? []).slice(0, 6).map((u) => (
              <Row
                key={u.key}
                icon={KIND[u.kind].icon}
                title={u.productName ? `${u.title}: ${u.productName}` : u.title}
                detail={`${relativeDays(u.date, data!.today)} · ${formatDate(u.date, "short")}${u.sharedBy ? ` · de ${u.sharedBy}` : ""}`}
                onPress={u.productId ? () => router.push(u.sharedBy ? `/shared/${u.productId}` : `/product/${u.productId}`) : undefined}
              />
            ))}
          </Card>
        )}
      </Section>

      {data && data.shared.length > 0 && (
        <Section title="Compartido en tu familia">
          <Card>
            {data.shared.slice(0, 5).map((s) => (
              <Row
                key={s.productId}
                icon="users"
                title={s.name}
                detail={`De ${s.ownerName}${s.warrantyEnd ? ` · garantía hasta el ${formatDate(s.warrantyEnd, "short")}` : ""}`}
                onPress={() => router.push(`/shared/${s.productId}`)}
              />
            ))}
          </Card>
        </Section>
      )}

      <Card>
        <Row icon="message-circle" title="Pregúntale a ORVELIA AI" detail="¿Qué garantías vencen pronto? ¿Cuánto gasté en electrónica?" onPress={() => router.push("/assistant")} />
      </Card>
    </Screen>
  );
}
