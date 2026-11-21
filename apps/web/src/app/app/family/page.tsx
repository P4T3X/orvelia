import { FAMILY_ROLE_LABELS, canChangeRoles, canInvite, canRemove, canUnshareAny, type FamilyRole } from "@orvelia/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import {
  CreateFamilyForm,
  InviteForm,
  LeaveOrDeleteFamily,
  MemberRoleSelect,
  RemoveMember,
  RenameFamily,
  RevokeInvitation,
  RoleHelp,
  UnshareButton,
} from "@/components/family/family-controls";
import { ProductThumb } from "@/components/products/product-thumb";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dashboard";
import { getFamilyOverview, listSharedProducts, type FamilyActivity } from "@/lib/family";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Familia" };

type Search = { joined?: string; left?: string; deleted?: string };

function Initial({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-medium"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function activityText(a: FamilyActivity): string {
  const actor = a.actor ?? "Alguien";
  const m = a.metadata as Record<string, string | undefined>;
  switch (a.action) {
    case "family_created":
      return `${actor} creó la familia`;
    case "family_renamed":
      return `${actor} cambió el nombre a «${m.name ?? ""}»`;
    case "member_invited":
      return m.email ? `${actor} invitó a ${m.email}` : `${actor} envió una invitación`;
    case "invitation_revoked":
      return m.email ? `${actor} canceló la invitación a ${m.email}` : `${actor} canceló una invitación`;
    case "member_joined":
      return `${a.target ?? actor} se unió a la familia`;
    case "member_removed":
      return `${actor} retiró a ${m.name ?? a.target ?? "un miembro"}`;
    case "member_left":
      return `${m.name ?? actor} salió de la familia`;
    case "role_changed":
      return `${actor} cambió el rol de ${a.target ?? "un miembro"} a ${FAMILY_ROLE_LABELS[(m.role as FamilyRole) ?? "member"]?.toLowerCase()}`;
    case "product_shared":
      return `${actor} compartió ${m.name ?? "un producto"}`;
    case "product_unshared":
      return `${actor} dejó de compartir ${m.name ?? "un producto"}`;
    default:
      return actor;
  }
}

function daysUntil(date: string, today: string) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export default async function FamilyPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser("/app/family");
  const [sp, profile, overview] = await Promise.all([searchParams, getProfile(user.id), getFamilyOverview()]);
  const tz = profile?.timezone ?? "America/Lima";

  const notice = sp.joined ? (
    <Alert tone="success" title="Te uniste a la familia." className="mb-6">
      Ya puedes ver lo que comparten. Para compartir algo tuyo, abre un producto de tu colección.
    </Alert>
  ) : sp.left ? (
    <Alert tone="success" title="Saliste de la familia." className="mb-6" />
  ) : sp.deleted ? (
    <Alert tone="success" title="Eliminaste la familia." className="mb-6" />
  ) : null;

  if (!overview.family) {
    const lastName = profile?.full_name?.trim().split(/\s+/).slice(1).join(" ");
    return (
      <>
        <PageHeader
          title="Familia"
          description="Comparte productos, garantías y documentos con las personas de tu casa. Cada uno decide qué comparte."
        />
        {notice}
        <section className="grid gap-8 rounded-xl border border-border bg-surface-raised p-6 sm:p-8 lg:grid-cols-[1fr_20rem]">
          <div>
            {overview.canCreate ? (
              <>
                <h2 className="text-lg font-medium">Crea tu familia</h2>
                <p className="mb-6 mt-1 text-muted-foreground">Tu plan Ultra incluye una familia de hasta 5 personas, contándote a ti.</p>
                <CreateFamilyForm suggestion={lastName ? `Familia ${lastName}` : "Mi familia"} />
              </>
            ) : (
              <>
                <h2 className="text-lg font-medium">La familia es parte del plan Ultra</h2>
                <p className="mt-1 max-w-xl text-muted-foreground">
                  Con Ultra creas una familia de hasta 5 personas. Los demás no necesitan pagar: basta con que tengan una
                  cuenta gratuita de ORVELIA.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/app/billing">Ver plan Ultra</Link>
                  </Button>
                </div>
                <p className="mt-6 text-sm text-muted-foreground">
                  ¿Alguien te invitó? Abre el enlace del correo de invitación con esta misma cuenta.
                </p>
              </>
            )}
          </div>
          <ul className="grid content-start gap-3 text-[15px] lg:border-l lg:border-border lg:pl-8">
            <li>Lo que no compartes sigue siendo solo tuyo.</li>
            <li>Los demás ven lo compartido, pero solo tú lo editas.</li>
            <li>Las fechas de garantías y devoluciones compartidas aparecen en el calendario de todos.</li>
          </ul>
        </section>
      </>
    );
  }

  const { family, myRole, members, invitations, activity } = overview;
  const shared = await listSharedProducts();
  const today = todayIn(tz);
  const seatsLeft = Math.max(0, family.seatLimit - members.length - invitations.length);
  const isOwner = myRole === "owner";

  return (
    <>
      <PageHeader
        title={family.name}
        description={`${family.active ? `${members.length} de ${family.seatLimit}` : members.length} ${members.length === 1 && !family.active ? "persona" : "personas"}. Titular: ${family.ownerName}.`}
        actions={canInvite(myRole) ? <RenameFamily name={family.name} /> : undefined}
      />
      {notice}
      {!family.active && (
        <Alert tone="info" title="La familia está en pausa." className="mb-6">
          {isOwner ? (
            <>
              Tu plan Ultra no está activo, así que nadie ve lo compartido por ahora. No se borró nada:{" "}
              <Link href="/app/billing" className="underline underline-offset-4">
                reactiva Ultra
              </Link>{" "}
              y todo vuelve a estar disponible.
            </>
          ) : (
            <>El plan Ultra de {family.ownerName} no está activo. Nada se borró; volverá a estar disponible cuando lo reactive.</>
          )}
        </Alert>
      )}

      <section aria-labelledby="shared" className="mb-10">
        <h2 id="shared" className="mb-3 font-medium">
          Compartido en la familia
        </h2>
        {shared.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong px-5 py-6 text-sm text-muted-foreground">
            {family.active
              ? "Aún no hay productos compartidos. Abre un producto de tu colección y elige «Compartir con la familia»."
              : "Nada visible mientras la familia está en pausa."}
          </p>
        ) : (
          <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
            {shared.map((p) => {
              const w = p.warrantyEnd ? daysUntil(p.warrantyEnd, today) : null;
              const r = p.returnDeadline ? daysUntil(p.returnDeadline, today) : null;
              const note =
                r !== null && r >= 0
                  ? `Devolución hasta el ${formatDate(p.returnDeadline, "short")}`
                  : w !== null
                    ? w >= 0
                      ? `Garantía hasta el ${formatDate(p.warrantyEnd, "short")}`
                      : "Garantía vencida"
                    : "Sin garantía registrada";
              return (
                <li key={p.productId} className="flex items-center gap-4 bg-surface-raised px-4 py-3 sm:px-5">
                  <ProductThumb url={p.imageUrl} name={p.name} className="size-12" />
                  <Link href={`/app/family/products/${p.productId}`} className="min-w-0 flex-1 rounded-md">
                    <span className="block truncate font-medium hover:underline hover:underline-offset-4">{p.name}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {p.isMine ? "Tuyo" : `De ${p.ownerName}`} · {note}
                    </span>
                  </Link>
                  {(p.isMine || canUnshareAny(myRole)) && <UnshareButton productId={p.productId} name={p.name} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-10">
          <section aria-labelledby="members">
            <h2 id="members" className="mb-3 font-medium">
              Miembros
            </h2>
            <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
              {members.map((m) => (
                <li key={m.userId} className="flex flex-wrap items-center gap-4 bg-surface-raised px-4 py-3 sm:px-5">
                  <Initial name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.name}
                      {m.isMe && <span className="font-normal text-muted-foreground"> (tú)</span>}
                    </p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {[m.email, `${m.sharedCount} compartido${m.sharedCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {canChangeRoles(myRole) && m.role !== "owner" ? (
                      <MemberRoleSelect userId={m.userId} role={m.role} name={m.name} />
                    ) : (
                      <span className="px-2 text-sm text-muted-foreground">{FAMILY_ROLE_LABELS[m.role]}</span>
                    )}
                    {!m.isMe && canRemove(myRole, m.role) && <RemoveMember userId={m.userId} name={m.name} />}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {canInvite(myRole) && (
            <section aria-labelledby="invite">
              <h2 id="invite" className="mb-3 font-medium">
                Invitar
              </h2>
              <div className="rounded-xl border border-border bg-surface-raised p-5 sm:p-6">
                {family.active ? (
                  <InviteForm myRole={myRole} seatsLeft={seatsLeft} />
                ) : (
                  <p className="text-sm text-muted-foreground">Las invitaciones se reanudan cuando el plan Ultra vuelva a estar activo.</p>
                )}
                {invitations.length > 0 && (
                  <div className="mt-6 border-t border-border pt-5">
                    <h3 className="mb-2 text-sm font-medium">Invitaciones pendientes</h3>
                    <ul className="grid gap-2">
                      {invitations.map((i) => (
                        <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="min-w-0">
                            <span className="font-medium">{i.email}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {FAMILY_ROLE_LABELS[i.role].toLowerCase()} · vence el {formatDateTime(i.expiresAt, tz)}
                            </span>
                          </span>
                          <RevokeInvitation id={i.id} email={i.email} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          <section aria-labelledby="roles" className="rounded-xl border border-border px-5 py-5">
            <h2 id="roles" className="mb-3 text-sm font-medium">
              Qué puede hacer cada rol
            </h2>
            <RoleHelp />
          </section>
        </div>

        <aside aria-labelledby="activity" className="grid content-start gap-8">
          <section>
            <h2 id="activity" className="mb-3 font-medium">
              Actividad reciente
            </h2>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>
            ) : (
              <ol className="grid gap-3 border-l border-border pl-4">
                {activity.map((a, idx) => (
                  <li key={`${a.createdAt}-${idx}`} className="text-sm">
                    <p>{activityText(a)}</p>
                    <p className="text-[12px] text-muted-foreground">{formatDateTime(a.createdAt, tz)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="border-t border-border pt-6">
            <p className="mb-3 text-sm text-muted-foreground">
              {isOwner ? "Eliminar la familia no borra los productos de nadie." : "Puedes salir cuando quieras; tus datos se quedan en tu cuenta."}
            </p>
            <LeaveOrDeleteFamily isOwner={isOwner} familyName={family.name} />
          </section>
        </aside>
      </div>
    </>
  );
}
