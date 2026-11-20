import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { SIGNED_URL_TTL_SECONDS, STORAGE_BUCKET } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

/**
 * Opens a private file: verifies ownership, then redirects to a short-lived
 * signed URL. Links in the UI point here so they never expire on screen.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!isUuid(id) || (kind !== "receipt" && kind !== "document")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const user = await getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const { data } =
    kind === "receipt"
      ? await supabase.from("receipts").select("storage_path").eq("id", id).eq("user_id", user.id).maybeSingle()
      : await supabase.from("documents").select("storage_path").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!data?.storage_path) return new NextResponse("Not found", { status: 404 });

  const { data: signed } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(data.storage_path, Math.min(SIGNED_URL_TTL_SECONDS, 120));
  if (!signed?.signedUrl) return new NextResponse("Not found", { status: 404 });

  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
