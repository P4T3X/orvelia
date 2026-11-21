import { env } from "./env";
import { supabase } from "./supabase";

/** Result shape of the web's server actions, returned by /api/mobile/*. */
export type ApiResult<T = undefined> = { ok: boolean; message?: string; fieldErrors?: Record<string, string>; data?: T };

/** Calls the web app's mobile endpoints with the current access token. */
export async function callApi<T>(path: string, init: { method?: "GET" | "POST"; json?: unknown; form?: FormData } = {}): Promise<ApiResult<T>> {
  if (!env.apiUrl) return { ok: false, message: "La app no está configurada (falta EXPO_PUBLIC_API_URL)." };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  } else if (init.form) body = init.form;
  try {
    const res = await fetch(`${env.apiUrl}${path}`, { method: init.method ?? "POST", headers, body });
    const parsed = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (parsed && typeof parsed.ok === "boolean") return parsed;
    return { ok: false, message: res.status === 401 ? "Tu sesión expiró. Vuelve a iniciar sesión." : "El servidor no respondió como esperábamos." };
  } catch {
    return { ok: false, message: "Sin conexión. Revisa tu internet e inténtalo de nuevo." };
  }
}
