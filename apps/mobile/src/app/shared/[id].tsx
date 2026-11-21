import { formatDate, formatMoney } from "@orvelia/api";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Card, Empty, Loading, Notice, Row, Screen, Section, Text } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { space } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";

type Shared = {
  product: { name: string; brand: string | null; model: string | null; purchase_date: string | null; purchase_price: number | null; currency: string | null; seller: string | null };
  owner_name: string;
  warranties: { id: string; provider: string | null; end_date: string | null }[];
  returns: { id: string; deadline_date: string }[];
  documents: { id: string; title: string }[];
};

/** A product a family member shares: read-only. */
export default function SharedProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useQuery(async () => {
    const { data, error } = await supabase.rpc("family_shared_product", { p_product: id });
    if (error) throw new Error(error.message);
    return (data as Shared | null) ?? null;
  }, [id]);

  if (data === undefined) return error ? <Screen><Notice tone="error" title="No pudimos cargarlo.">{error}</Notice></Screen> : <Loading />;
  if (data === null) return <Screen><Empty icon="users" title="Ya no se comparte contigo." /></Screen>;
  const p = data.product;

  return (
    <Screen edges={["bottom"]}>
      <View style={{ gap: space.xs }}>
        <Text variant="title" accessibilityRole="header">
          {p.name}
        </Text>
        <Text muted>Compartido por {data.owner_name}. Solo esa persona puede editarlo.</Text>
      </View>
      <Card>
        <Row icon="calendar" title="Fecha de compra" detail={formatDate(p.purchase_date) ?? "Sin registrar"} />
        <Row icon="tag" title="Precio" detail={formatMoney(p.purchase_price === null ? null : Number(p.purchase_price), p.currency) ?? "Sin registrar"} />
        <Row icon="shopping-bag" title="Tienda o vendedor" detail={p.seller ?? "Sin registrar"} />
      </Card>
      <Section title="Garantías y devoluciones">
        {data.warranties.length + data.returns.length === 0 ? (
          <Empty icon="shield" title="Sin garantías registradas." />
        ) : (
          <Card>
            {data.warranties.map((w) => (
              <Row key={w.id} icon="shield" title={w.end_date ? `Garantía hasta el ${formatDate(w.end_date)}` : "Garantía sin fecha de fin"} detail={w.provider} />
            ))}
            {data.returns.map((r) => (
              <Row key={r.id} icon="rotate-ccw" title={`Devolución hasta el ${formatDate(r.deadline_date)}`} />
            ))}
          </Card>
        )}
      </Section>
      {data.documents.length > 0 && (
        <Section title="Documentos">
          <Card>
            {data.documents.map((d) => (
              <Row key={d.id} icon="file-text" title={d.title} />
            ))}
          </Card>
        </Section>
      )}
    </Screen>
  );
}
