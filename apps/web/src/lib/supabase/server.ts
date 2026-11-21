import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Per-request server client (Server Components, Server Actions, Route
 * Handlers). Create a new one for every request — never share it.
 */
export async function createClient() {
  // The mobile app calls /api/mobile/* with its Supabase access token instead of cookies.
  const bearer = await bearerToken();
  if (bearer) {
    return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      cookies: { getAll: () => [], setAll: () => {} },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/** Access token sent by the mobile app (`Authorization: Bearer <jwt>`), if any. */
export async function bearerToken(): Promise<string | null> {
  try {
    const h = (await headers()).get("authorization") ?? "";
    const m = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(h);
    return m ? m[1]! : null;
  } catch {
    return null; // outside a request (build time)
  }
}
