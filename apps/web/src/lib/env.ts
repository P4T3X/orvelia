/**
 * Public environment. `NEXT_PUBLIC_*` values are inlined at build time, so they
 * must be referenced with literal property access.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};

/**
 * True when Supabase credentials are present. Lets the public site render
 * during local setup while auth surfaces show a clear configuration notice
 * instead of crashing.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
