import type { Database } from "@orvelia/api";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { env } from "./env";
import { sessionStorage } from "./session-storage";

/** One client for the app. RLS limits every query to the signed-in person's data. */
export const supabase = createClient<Database>(env.supabaseUrl || "http://localhost", env.supabaseAnonKey || "missing", {
  auth: {
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
