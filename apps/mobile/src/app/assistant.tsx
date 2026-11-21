import { router } from "expo-router";
import * as React from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Notice, Text } from "@/components/ui";
import { callApi } from "@/lib/api";
import { radius, space, type, useColors } from "@/lib/theme";

type Ref = { type: "product" | "document" | "receipt"; id: string; label: string };
type Segment = { kind: "text"; text: string } | { kind: "ref"; ref: Ref };
type Turn = { role: "user" | "assistant"; text: string; segments?: Segment[]; isTest?: boolean };

const SUGGESTIONS = ["¿Qué garantías vencen pronto?", "¿Cuánto gasté en electrónica este año?", "¿Qué productos no tienen comprobante?"];

export default function Assistant() {
  const c = useColors();
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [question, setQuestion] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const list = React.useRef<FlatList<Turn>>(null);

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 2 || pending) return;
    setError(null);
    setQuestion("");
    const history = turns.map((t) => ({ role: t.role, text: t.text }));
    setTurns((t) => [...t, { role: "user", text }]);
    setPending(true);
    const res = await callApi<{ segments: Segment[]; refs: Ref[]; isTest: boolean }>("/api/mobile/assistant", { json: { question: text, history } });
    setPending(false);
    if (!res.ok || !res.data) {
      setError(res.message ?? "No pudimos responder ahora.");
      return;
    }
    const plain = res.data.segments.map((s) => (s.kind === "text" ? s.text : s.ref.label)).join("");
    setTurns((t) => [...t, { role: "assistant", text: plain, segments: res.data!.segments, isTest: res.data!.isTest }]);
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
  }

  const renderTurn = ({ item }: { item: Turn }) => {
    const mine = item.role === "user";
    return (
      <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "88%", padding: space.md, borderRadius: radius.lg, backgroundColor: mine ? c.primary : c.raised, borderWidth: mine ? 0 : 1, borderColor: c.border }}>
        {mine ? (
          <Text style={{ color: c.primaryForeground }}>{item.text}</Text>
        ) : (
          <Text>
            {(item.segments ?? [{ kind: "text", text: item.text }]).map((s, i) =>
              s.kind === "text" ? (
                <Text key={i}>{s.text}</Text>
              ) : (
                <Text
                  key={i}
                  accessibilityRole="link"
                  style={{ color: c.accentInk, textDecorationLine: "underline" }}
                  onPress={s.ref.type === "product" ? () => router.push(`/product/${s.ref.id}`) : undefined}
                >
                  {s.ref.label}
                </Text>
              ),
            )}
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <FlatList
          ref={list}
          data={turns}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderTurn}
          contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ gap: space.md }}>
              <Text muted>Pregunta sobre tus productos, garantías y gastos. ORVELIA AI responde solo con tus registros.</Text>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => ask(s)} accessibilityRole="button" style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong }}>
                  <Text>{s}</Text>
                </Pressable>
              ))}
            </View>
          }
          ListFooterComponent={
            <View style={{ gap: space.md, marginTop: space.md }}>
              {pending && <Text muted>Buscando en tus registros…</Text>}
              {error && <Notice tone="error" title={error} />}
            </View>
          }
        />
        <View style={{ flexDirection: "row", gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Escribe tu pregunta"
            placeholderTextColor={c.mutedForeground}
            accessibilityLabel="Tu pregunta"
            maxLength={500}
            onSubmitEditing={() => ask(question)}
            returnKeyType="send"
            style={[type.body, { flex: 1, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.raised, color: c.foreground }]}
          />
          <Button label="Enviar" onPress={() => ask(question)} loading={pending} disabled={question.trim().length < 2} style={{ minHeight: 44 }} />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
