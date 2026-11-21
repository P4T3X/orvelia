import type { ExpoConfig } from "expo/config";

/**
 * App config. Public values come from EXPO_PUBLIC_* variables at build time
 * (see .env.example); EAS profiles set them per environment in eas.json.
 */
const config: ExpoConfig = {
  name: "ORVELIA",
  slug: "orvelia",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "orvelia",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.lucionienterprises.orvelia",
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: "ORVELIA usa la cámara para fotografiar tus comprobantes y productos.",
      NSPhotoLibraryUsageDescription: "ORVELIA usa tus fotos para guardar comprobantes y fotos de tus productos.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.lucionienterprises.orvelia",
    adaptiveIcon: {
      backgroundColor: "#111315",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    permissions: ["CAMERA", "POST_NOTIFICATIONS"],
    blockedPermissions: ["RECORD_AUDIO"],
    predictiveBackGestureEnabled: false,
  },
  web: { output: "single", favicon: "./assets/images/favicon.png" },
  plugins: [
    "expo-router",
    "expo-sqlite",
    ["expo-notifications", { color: "#C7A66A", defaultChannel: "reminders" }],
    ["expo-image-picker", { cameraPermission: "ORVELIA usa la cámara para fotografiar tus comprobantes y productos.", photosPermission: "ORVELIA usa tus fotos para guardar comprobantes y fotos de tus productos.", microphonePermission: false }],
    ["expo-splash-screen", { backgroundColor: "#F6F4EF", image: "./assets/images/splash-icon.png", imageWidth: 96, dark: { backgroundColor: "#111315" } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
