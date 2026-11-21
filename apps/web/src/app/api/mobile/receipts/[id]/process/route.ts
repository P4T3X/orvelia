import type { NextRequest } from "next/server";
import { processReceipt } from "@/app/app/scanner/actions";
import { preflight, runForMobile } from "@/lib/mobile-api";

export const OPTIONS = preflight;
export const maxDuration = 180;

/** Reads the receipt with AI (counts toward the monthly scan quota). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runForMobile(req, () => processReceipt(id));
}
