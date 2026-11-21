import type { NextRequest } from "next/server";
import { confirmReceipt } from "@/app/app/scanner/actions";
import { mobileJson, preflight, runForMobile } from "@/lib/mobile-api";

export const OPTIONS = preflight;

/** Confirms the reviewed receipt and creates its products (body: receiptConfirmSchema). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return mobileJson({ ok: false, message: "Cuerpo JSON no válido." }, 400);
  }
  return runForMobile(req, () => confirmReceipt(id, body));
}
