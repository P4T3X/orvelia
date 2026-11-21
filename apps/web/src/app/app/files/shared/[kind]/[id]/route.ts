import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { SIGNED_URL_TTL_SECONDS, STORAGE_BUCKET } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

const KINDS = new Set(["document", "receipt", "product-image"]);

/**
 * Opens a file shared in the caller's family. Storage policies stay owner-only,
 * so authorization happens in `shared_file_path()` (membership, active family,
 * the product is shared) and only then is the path signed with the service role.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!isUuid(id) || !KINDS.has(kind)) return new NextResponse("Not found", { status: 404 });
  const user = await getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const { data: path } = await supabase.rpc("shared_file_path", { p_kind: kind, p_id: id });
  if (!path) return new NextResponse("Not found", { status: 404 });

  const admin = createAdminClient();
  if (!admin) return new NextResponse("Shared files are not configured", { status: 503 });
  const { data: signed } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(path, Math.min(SIGNED_URL_TTL_SECONDS, 120));
  if (!signed?.signedUrl) return new NextResponse("Not found", { status: 404 });

  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
