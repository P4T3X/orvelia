import type { NextRequest } from "next/server";
import { uploadReceipt } from "@/app/app/scanner/actions";
import { mobileJson, preflight, runForMobile } from "@/lib/mobile-api";

export const OPTIONS = preflight;

/** Upload a receipt photo or PDF (multipart field `file`). Same validation as the web scanner. */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return mobileJson({ ok: false, message: "Envía el archivo como multipart/form-data." }, 400);
  }
  return runForMobile(req, () => uploadReceipt(form));
}
