import { listNotifications, markNotificationsRead } from "@orvelia/api";
import { router } from "expo-router";
import * as React from "react";
import { RefreshControl } from "react-native";
import { Card, Empty, Notice, Row, Screen } from "@/components/ui";
import { useUserId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";

/** Web links (/app/products/<id>) → app routes. */
function openLink(link: string | null) {
  const m = link?.match(/^\/app\/products\/([0-9a-f-]{36})/);
  if (m) router.push(`/product/${m[1]}`);
  else if (link?.startsWith("/app/calendar")) router.push("/upcoming");
}

export default function Notifications() {
  const userId = useUserId();
  const c = useColors();
  const { data, error, refreshing, refresh } = useQuery(() => listNotifications(supabase, userId), [userId]);
  React.useEffect(() => {
    if (data?.some((n) => !n.readAt)) void markNotificationsRead(supabase, userId);
  }, [data, userId]);

  return (
    <Screen edges={["bottom"]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}>
      {error && <Notice tone="error" title="No pudimos cargar tus avisos.">{error}</Notice>}
      {data && data.length === 0 && <Empty icon="bell" title="Sin avisos por ahora.">Aquí verás tus recordatorios cuando llegue su fecha.</Empty>}
      {data && data.length > 0 && (
        <Card>
          {data.map((n) => (
            <Row
              key={n.id}
              icon={n.readAt ? "bell" : "bell"}
              title={n.readAt ? n.title : `● ${n.title}`}
              detail={[n.body, new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(n.createdAt))].filter(Boolean).join("\n")}
              onPress={n.link ? () => openLink(n.link) : undefined}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
