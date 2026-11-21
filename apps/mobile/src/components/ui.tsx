import { Feather } from "@expo/vector-icons";
import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { radius, space, type, useColors } from "@/lib/theme";

export type IconName = React.ComponentProps<typeof Feather>["name"];

type Variant = keyof typeof type;

export function Text({ variant = "body", muted, style, ...props }: TextProps & { variant?: Variant; muted?: boolean }) {
  const c = useColors();
  return <RNText {...props} style={[type[variant], { color: muted ? c.mutedForeground : c.foreground }, style]} />;
}

/** Scrollable page with safe-area padding and pull-to-refresh support via props. */
export function Screen({ children, scroll = true, edges = ["top"], style, ...props }: ScrollViewProps & { scroll?: boolean; edges?: ("top" | "bottom")[] }) {
  const c = useColors();
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[{ padding: space.lg, paddingBottom: space.xxl * 2, gap: space.xl }, style as StyleProp<ViewStyle>]}
      keyboardShouldPersistTaps="handled"
      {...props}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, style as StyleProp<ViewStyle>]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.background }}>
      {inner}
    </SafeAreaView>
  );
}

export function Title({ children, subtitle }: { children: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="title" accessibilityRole="header">
        {children}
      </Text>
      {subtitle ? <Text muted>{subtitle}</Text> : null}
    </View>
  );
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** Grouped rows with hairline separators (the web's "gap-px" lists). */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.raised, overflow: "hidden" }, style]}>
      {items.map((child, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border } : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function Row({
  icon,
  title,
  detail,
  right,
  onPress,
  accessibilityLabel,
  testID,
}: {
  icon?: IconName;
  title: string;
  detail?: string | null;
  right?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const c = useColors();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 }}>
      {icon ? <Feather name={icon} size={20} color={c.accentInk} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={2}>
          {title}
        </Text>
        {detail ? (
          <Text variant="small" muted numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Feather name="chevron-right" size={18} color={c.mutedForeground} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      testID={testID}
      style={({ pressed }) => ({ backgroundColor: pressed ? c.muted : "transparent" })}
    >
      {body}
    </Pressable>
  );
}

export function Button({
  label,
  icon,
  variant = "primary",
  loading,
  disabled,
  style,
  ...props
}: Omit<PressableProps, "style"> & { label: string; icon?: IconName; variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const bg = variant === "primary" ? c.primary : variant === "danger" ? c.danger : "transparent";
  const fg = variant === "primary" ? c.primaryForeground : variant === "danger" ? "#FFFFFF" : variant === "ghost" ? c.mutedForeground : c.foreground;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      {...props}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: space.lg,
          borderRadius: radius.md,
          backgroundColor: bg,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: c.borderStrong,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Feather name={icon} size={18} color={fg} /> : null}
      <RNText style={[type.label, { color: fg, fontSize: 15 }]}>{label}</RNText>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  style,
  ...props
}: TextInputProps & { label: string; error?: string | null; hint?: string; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.mutedForeground}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
        style={[
          type.body,
          {
            minHeight: 48,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? c.danger : focused ? c.accent : c.borderStrong,
            backgroundColor: c.raised,
            color: c.foreground,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="small" style={{ color: c.danger }} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Single-choice pills (status, currency, category). */
export function Chips<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; label: string }) {
  const c = useColors();
  return (
    <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(o.value)}
              style={{
                paddingHorizontal: 14,
                minHeight: 36,
                justifyContent: "center",
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: on ? c.foreground : c.borderStrong,
                backgroundColor: on ? c.foreground : "transparent",
              }}
            >
              <RNText style={[type.small, { color: on ? c.background : c.foreground, fontWeight: "500" }]}>{o.label}</RNText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "error" | "success"; title: string; children?: React.ReactNode }) {
  const c = useColors();
  const color = tone === "error" ? c.danger : tone === "success" ? c.success : c.mutedForeground;
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : "summary"}
      style={{ flexDirection: "row", gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: tone === "info" ? c.borderStrong : color, backgroundColor: c.muted }}
    >
      <Feather name={tone === "error" ? "alert-circle" : tone === "success" ? "check-circle" : "info"} size={18} color={color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{title}</Text>
        {children ? (
          <Text variant="small" muted>
            {children}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: c.borderStrong }}>
      <Feather name={icon} size={28} color={c.mutedForeground} />
      <Text variant="label" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {children ? (
        <Text variant="small" muted style={{ textAlign: "center" }}>
          {children}
        </Text>
      ) : null}
    </View>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl, backgroundColor: c.background }}>
      <ActivityIndicator color={c.accent} accessibilityLabel="Cargando" />
    </View>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, padding: space.lg, gap: 4, backgroundColor: c.raised }}>
      <Text variant="small" muted>
        {label}
      </Text>
      <Text style={{ fontSize: 24, fontWeight: "500", letterSpacing: -0.3, fontVariant: ["tabular-nums"] }}>{value}</Text>
      {note ? (
        <Text variant="small" muted>
          {note}
        </Text>
      ) : null}
    </View>
  );
}
