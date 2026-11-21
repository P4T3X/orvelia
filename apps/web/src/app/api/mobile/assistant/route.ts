import type { NextRequest } from "next/server";
import { askOrvelia } from "@/app/app/assistant/actions";
import { mobileJson, preflight, runForMobile } from "@/lib/mobile-api";

export const OPTIONS = preflight;
export const maxDuration = 60;

/** Ask ORVELIA AI (body: { question, history }). Same quota as the web. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileJson({ ok: false, message: "Cuerpo JSON no válido." }, 400);
  }
  return runForMobile(req, () => askOrvelia(body));
}
