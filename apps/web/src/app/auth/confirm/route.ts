import { safeRedirectPath } from "@orvelia/schemas";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Landing point for links in auth emails (signup confirmation, password
 * recovery, email change). Supports both:
 *   - PKCE:        /auth/confirm?code=...&next=/app
 *   - token hash:  /auth/confirm?token_hash=...&type=signup&next=/app
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, origin));

  if (!isSupabaseConfigured()) return fail("not_configured");

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("link_invalid");
    return NextResponse.redirect(new URL(next, origin));
  }

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail("link_invalid");
    const destination = type === "recovery" ? "/reset-password" : next;
    return NextResponse.redirect(new URL(destination, origin));
  }

  return fail("link_invalid");
}
