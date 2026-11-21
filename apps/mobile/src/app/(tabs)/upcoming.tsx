import { formatDate, listUpcoming, relativeDays, todayIn, type UpcomingItem } from "@orvelia/api";
import { router } from "expo-router";
import { RefreshControl } from "react-native";
import { Card, Empty, Notice, Row, Screen, Section, Title } from "@/components/ui";
import { KIND } from "@/lib/labels";
import { useUserId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Lima";

function monthLabel(date: string) {
  const s = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Upcoming() {
  const userId = useUserId();
  const c = useColors();
  const { data, error, refreshing, refresh } = useQuery(async () => {
    const today = todayIn(TZ);
    return { today, items: await listUpcoming(supabase, userId, today, 180, TZ) };
  }, [userId]);

  const groups = new Map<string, UpcomingItem[]>();
  for (const it of data?.items ?? []) {
    const k = it.date.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}>
      <Title subtitle="Garantías, devoluciones, documentos y tus recordatorios de los próximos 6 meses.">Próximos</Title>
      {error && <Notice tone="error" title="No pudimos cargar tus fechas.">{error}</Notice>}
      {data && data.items.length === 0 && <Empty icon="calendar" title="Nada programado.">Registra garantías en tus productos y aparecerán aquí.</Empty>}
      {[...groups.entries()].map(([month, items]) => (
        <Section key={month} title={monthLabel(`${month}-01`)}>
          <Card>
            {items.map((u) => (
              <Row
                key={u.key}
                icon={KIND[u.kind].icon}
                title={u.productName ? `${u.title}: ${u.productName}` : u.title}
                detail={`${formatDate(u.date)} · ${relativeDays(u.date, data!.today)}${u.sharedBy ? ` · de ${u.sharedBy}` : ""}`}
                onPress={u.productId ? () => router.push(u.sharedBy ? `/shared/${u.productId}` : `/product/${u.productId}`) : undefined}
              />
            ))}
          </Card>
        </Section>
      ))}
    </Screen>
  );
}
