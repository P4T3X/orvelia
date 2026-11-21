/** Public build-time configuration (EXPO_PUBLIC_* are inlined by Metro). */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, ""),
};

export const isConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);
