import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { View } from "react-native";
import { radius, useColors } from "@/lib/theme";

/** Product photo from a short-lived signed URL, or a neutral placeholder. */
export function Thumb({ url, size = 48, label }: { url: string | null; size?: number; label: string }) {
  const c = useColors();
  return (
    <View
      style={{ width: size, height: size, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.muted, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" accessibilityLabel={label} transition={150} />
      ) : (
        <Feather name="package" size={size / 2.6} color={c.mutedForeground} />
      )}
    </View>
  );
}
