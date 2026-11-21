import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { ActionState } from "@/lib/action-state";
import { getUser } from "@/lib/auth";
import { bearerToken } from "@/lib/supabase/server";

/**
 * Helpers for /api/mobile/*: the Expo app authenticates with its Supabase
 * access token (`Authorization: Bearer`), never cookies, so CORS can allow any
 * origin without exposing cookie-authenticated endpoints.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function mobileJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
}

/** Runs a server action for the mobile app: requires a valid bearer token, maps ActionState to HTTP. */
export async function runForMobile<T>(_req: NextRequest, action: () => Promise<ActionState<T> | void>) {
  if (!(await bearerToken())) return mobileJson({ ok: false, message: "Falta el token de acceso." }, 401);
  if (!(await getUser())) return mobileJson({ ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." }, 401);
  const res = await action();
  if (!res) return mobileJson({ ok: true });
  return mobileJson(res, res.ok ? 200 : 422);
}
