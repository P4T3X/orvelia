import { FAMILY_ROLE_DESCRIPTIONS, FAMILY_ROLE_LABELS } from "@orvelia/domain";
import { invitationTokenSchema } from "@orvelia/schemas";
import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvitation } from "@/components/family/family-controls";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/auth";
import { getFamilyOverview } from "@/lib/family";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invitación a una familia", robots: { index: false } };

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-xl rounded-xl border border-border bg-surface-raised p-6 sm:p-8">
      <h1 className="text-[1.5rem] font-medium leading-tight tracking-[-0.02em] text-balance">{title}</h1>
      <div className="mt-3 grid gap-5 text-muted-foreground">{children}</div>
    </section>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireUser(`/app/invite/${token}`);
  const parsed = invitationTokenSchema.safeParse(token);
  const backHome = (
    <div>
      <Button asChild variant="secondary">
        <Link href="/app">Ir al inicio</Link>
      </Button>
    </div>
  );
  if (!parsed.success) return <Shell title="Este enlace no es válido.">{backHome}</Shell>;

  const supabase = await createClient();
  const [{ data }, profile, mine] = await Promise.all([
    supabase.rpc("invitation_preview", { p_token: parsed.data }),
    getProfile(user.id),
    getFamilyOverview(),
  ]);
  const inv = data?.[0];
  if (!inv) return <Shell title="No encontramos esta invitación.">{backHome}<p>Pide a quien te invitó que te envíe una nueva.</p></Shell>;

  if (inv.status === "accepted") {
    return (
      <Shell title="Esta invitación ya se usó.">
        {mine.family ? (
          <div>
            <Button asChild>
              <Link href="/app/family">Ver mi familia</Link>
            </Button>
          </div>
        ) : (
          backHome
        )}
      </Shell>
    );
  }
  if (inv.status !== "valid") {
    const why = inv.status === "expired" ? "venció" : inv.status === "revoked" ? "fue cancelada" : "está en pausa porque el plan Ultra del titular no está activo";
    return (
      <Shell title={`La invitación a ${inv.family_name} ${why}.`}>
        <p>Pide a {inv.inviter_name ?? "quien te invitó"} que te envíe una nueva.</p>
        {backHome}
      </Shell>
    );
  }

  const signedInEmail = (user.email ?? "").toLowerCase();
  const tz = profile?.timezone ?? "America/Lima";

  return (
    <Shell title={`${inv.inviter_name ?? "Alguien"} te invitó a la familia ${inv.family_name}`}>
      <p>
        Entrarás como <span className="font-medium text-foreground">{FAMILY_ROLE_LABELS[inv.role].toLowerCase()}</span>:{" "}
        {FAMILY_ROLE_DESCRIPTIONS[inv.role].charAt(0).toLowerCase() + FAMILY_ROLE_DESCRIPTIONS[inv.role].slice(1)}
      </p>
      <ul className="grid gap-2 text-[15px]">
        <li>Verás los productos, garantías y documentos que cada miembro comparta.</li>
        <li>Lo tuyo sigue siendo privado hasta que decidas compartirlo.</li>
        <li>No necesitas pagar: el plan Ultra lo tiene el titular.</li>
      </ul>
      {mine.family ? (
        <p className="rounded-md border border-border-strong bg-muted px-4 py-3 text-sm text-foreground">
          Ya perteneces a la familia {mine.family.name}. Sal de ella en{" "}
          <Link href="/app/family" className="underline underline-offset-4">
            Familia
          </Link>{" "}
          si quieres unirte a esta.
        </p>
      ) : signedInEmail !== inv.email ? (
        <p className="rounded-md border border-border-strong bg-muted px-4 py-3 text-sm text-foreground">
          La invitación es para <span className="font-medium">{inv.email}</span> y entraste como{" "}
          <span className="font-medium">{signedInEmail}</span>. Cierra sesión e inicia con la cuenta invitada.
        </p>
      ) : (
        <AcceptInvitation token={parsed.data} />
      )}
      <p className="text-[13px]">Vence el {formatDateTime(inv.expires_at, tz)}.</p>
    </Shell>
  );
}
