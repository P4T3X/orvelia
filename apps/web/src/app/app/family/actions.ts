"use server";

import { familyErrorMessage, type FamilyRole } from "@orvelia/domain";
import { familyInviteSchema, familyNameSchema, invitationTokenSchema } from "@orvelia/schemas";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { getProfile, getUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { publicEnv } from "@/lib/env";
import { invitationEmail } from "@/lib/invitation-email";
import { createClient } from "@/lib/supabase/server";

const SESSION_EXPIRED: ActionState<never> = { ok: false, message: "Tu sesión expiró. Vuelve a iniciar sesión." };
const uuid = z.uuid();

function fail(message: string | undefined): ActionState<never> {
  return { ok: false, message: familyErrorMessage(message) };
}

function refresh() {
  revalidatePath("/app/family");
  revalidatePath("/app/calendar");
}

export async function createFamily(input: unknown): Promise<ActionState> {
  const parsed = familyNameSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await getUser())) return SESSION_EXPIRED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_family", { p_name: parsed.data.name });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "Familia creada. Ahora invita a quienes quieras." };
}

export async function renameFamily(input: unknown): Promise<ActionState> {
  const parsed = familyNameSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await getUser())) return SESSION_EXPIRED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_family", { p_name: parsed.data.name });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "Nombre actualizado." };
}

export type InviteResult = { link: string; emailStatus: "sent" | "skipped" | "failed"; email: string };

/** Creates a one-time invitation, e-mails it, and returns the link once so it can also be shared by hand. */
export async function inviteMember(input: unknown): Promise<ActionState<InviteResult>> {
  const parsed = familyInviteSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const user = await getUser();
  if (!user) return SESSION_EXPIRED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_family_invitation", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  const inv = data?.[0];
  if (error || !inv) return fail(error?.message);

  const link = `${publicEnv.siteUrl}/app/invite/${inv.token}`;
  const profile = await getProfile(user.id);
  const inviter = profile?.full_name?.trim() || user.email?.split("@")[0] || "Un miembro de tu familia";
  const msg = invitationEmail({ inviter, family: inv.family_name, role: parsed.data.role, email: parsed.data.email, url: link });
  const sent = await sendEmail({ to: parsed.data.email, ...msg, idempotencyKey: `family-invite-${inv.invitation_id}` });
  if (sent.status === "failed") console.error("[family] invitation email failed", sent.error);

  refresh();
  return {
    ok: true,
    message: sent.status === "sent" ? `Invitación enviada a ${parsed.data.email}.` : `Invitación creada para ${parsed.data.email}.`,
    data: { link, emailStatus: sent.status, email: parsed.data.email },
  };
}

export async function revokeInvitation(id: unknown): Promise<ActionState> {
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return { ok: false, message: "Invitación no válida." };
  if (!(await getUser())) return SESSION_EXPIRED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_family_invitation", { p_invitation: parsed.data });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "Invitación cancelada. El enlace ya no funciona." };
}

export async function changeMemberRole(input: unknown): Promise<ActionState> {
  const parsed = z.object({ userId: uuid, role: z.enum(["admin", "member"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Datos no válidos." };
  if (!(await getUser())) return SESSION_EXPIRED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_family_member_role", {
    p_user: parsed.data.userId,
    p_role: parsed.data.role as FamilyRole,
  });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "Rol actualizado." };
}

export async function removeMember(userId: unknown): Promise<ActionState> {
  const parsed = uuid.safeParse(userId);
  if (!parsed.success) return { ok: false, message: "Miembro no válido." };
  if (!(await getUser())) return SESSION_EXPIRED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_family_member", { p_user: parsed.data });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "Miembro retirado. Sus productos dejaron de compartirse." };
}

export async function leaveFamily(): Promise<ActionState | void> {
  if (!(await getUser())) return SESSION_EXPIRED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_family");
  if (error) return fail(error.message);
  refresh();
  redirect("/app/family?left=1");
}

export async function deleteFamily(): Promise<ActionState | void> {
  if (!(await getUser())) return SESSION_EXPIRED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_family");
  if (error) return fail(error.message);
  refresh();
  redirect("/app/family?deleted=1");
}

export async function acceptInvitation(token: unknown): Promise<ActionState | void> {
  const parsed = invitationTokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, message: "Enlace de invitación no válido." };
  if (!(await getUser())) return SESSION_EXPIRED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_family_invitation", { p_token: parsed.data });
  if (error) return fail(error.message);
  refresh();
  redirect("/app/family?joined=1");
}

export async function setProductShared(input: unknown): Promise<ActionState<{ shared: boolean }>> {
  const parsed = z.object({ productId: uuid, shared: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Producto no válido." };
  if (!(await getUser())) return SESSION_EXPIRED;
  const supabase = await createClient();
  const { error } = parsed.data.shared
    ? await supabase.rpc("share_product", { p_product: parsed.data.productId })
    : await supabase.rpc("unshare_product", { p_product: parsed.data.productId });
  if (error) return fail(error.message);
  refresh();
  revalidatePath(`/app/products/${parsed.data.productId}`);
  return {
    ok: true,
    message: parsed.data.shared ? "Compartido con tu familia." : "Ya no se comparte con tu familia.",
    data: { shared: parsed.data.shared },
  };
}
