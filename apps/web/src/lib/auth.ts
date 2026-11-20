import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Lightweight check for public pages (header state). Verifies the JWT
 * signature locally via getClaims; never use it to authorize data access.
 */
export async function isSignedIn(): Promise<boolean> {
  await connection(); // always per-request, even before Supabase is configured
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims?.sub);
}

/**
 * Authoritative user lookup for the authenticated area. getUser() validates
 * the session with the Supabase Auth server. Cached per request.
 */
export const getUser = cache(async () => {
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** Use at the top of every authenticated page, layout and server action. */
export async function requireUser(next?: string) {
  const user = await getUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_language, preferred_currency, timezone, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar el perfil: ${error.message}`);
  return data;
});
