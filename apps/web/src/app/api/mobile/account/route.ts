import type { NextRequest } from "next/server";
import { deleteAccountCore } from "@/app/app/settings/actions";
import { mobileJson, preflight, runForMobile } from "@/lib/mobile-api";

export const OPTIONS = preflight;

/** In-app account deletion (required by the App Store and Google Play). Body: { email } typed to confirm. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileJson({ ok: false, message: "Cuerpo JSON no válido." }, 400);
  }
  return runForMobile(req, () => deleteAccountCore(body));
}
