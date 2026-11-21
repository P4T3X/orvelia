import { useColorScheme } from "react-native";

/** ORVELIA brand tokens (mirrors the web's globals.css). Gold is an accent only. */
const light = {
  background: "#F6F4EF",
  surface: "#FBFAF7",
  raised: "#FFFFFF",
  foreground: "#111315",
  muted: "#EEEBE4",
  mutedForeground: "#63686E",
  border: "#E2DED5",
  borderStrong: "#CFCAC0",
  primary: "#111315",
  primaryForeground: "#F6F4EF",
  accent: "#C7A66A",
  accentInk: "#7A5F2C",
  danger: "#A33A32",
  success: "#3F6B4F",
};

const dark: typeof light = {
  background: "#111315",
  surface: "#1A1D20",
  raised: "#212529",
  foreground: "#F6F4EF",
  muted: "#202327",
  mutedForeground: "#9A9FA6",
  border: "#2A2E33",
  borderStrong: "#3A3F45",
  primary: "#F6F4EF",
  primaryForeground: "#111315",
  accent: "#C7A66A",
  accentInk: "#C7A66A",
  danger: "#E08A80",
  success: "#8FBF9F",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 10, lg: 14, pill: 999 } as const;
export const type = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: "500" as const, letterSpacing: -0.6 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: "500" as const },
};
