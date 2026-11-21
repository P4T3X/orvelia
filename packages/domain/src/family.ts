/**
 * Family workspaces (Ultra). Permissions are enforced in Postgres; these
 * helpers only decide what the UI offers.
 */
export const FAMILY_ROLES = ["owner", "admin", "member"] as const;
export type FamilyRole = (typeof FAMILY_ROLES)[number];
export const INVITABLE_ROLES = ["member", "admin"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const FAMILY_ROLE_LABELS: Record<FamilyRole, string> = {
  owner: "Titular",
  admin: "Administrador",
  member: "Miembro",
};

export const FAMILY_ROLE_DESCRIPTIONS: Record<FamilyRole, string> = {
  owner: "Paga el plan Ultra, gestiona todo y puede eliminar la familia.",
  admin: "Invita y retira miembros, y puede dejar de compartir cualquier producto.",
  member: "Ve lo que la familia comparte y comparte sus propios productos.",
};

export const canInvite = (role: FamilyRole) => role === "owner" || role === "admin";
export const canInviteRole = (me: FamilyRole, role: InvitableRole) => role === "member" ? canInvite(me) : me === "owner";
export const canChangeRoles = (role: FamilyRole) => role === "owner";
export const canRemove = (me: FamilyRole, target: FamilyRole) =>
  target !== "owner" && (me === "owner" || (me === "admin" && target === "member"));
export const canUnshareAny = (role: FamilyRole) => role === "owner" || role === "admin";

/** Database error codes raised by the family functions → user-facing copy. */
export const FAMILY_ERRORS: Record<string, string> = {
  family_not_included: "Las familias son parte del plan Ultra.",
  already_in_family: "Ya perteneces a una familia. Sal de ella antes de crear o unirte a otra.",
  not_in_family: "No perteneces a ninguna familia.",
  family_inactive: "La familia está en pausa porque el plan Ultra del titular no está activo.",
  family_full: "La familia ya está completa (incluidas las invitaciones pendientes).",
  already_member: "Esa persona ya es parte de la familia.",
  forbidden: "Tu rol en la familia no permite hacer esto.",
  invalid_role: "Rol no válido.",
  invalid_email: "Ingresa un correo electrónico válido.",
  invalid_name: "Escribe un nombre para la familia.",
  rate_limited: "Enviaste demasiadas invitaciones hoy. Inténtalo mañana.",
  invitation_not_found: "Esta invitación no existe.",
  invitation_unavailable: "Esta invitación ya se usó, venció o fue cancelada.",
  invitation_email_mismatch: "Esta invitación es para otro correo. Inicia sesión con la cuenta invitada.",
  owner_cannot_leave: "El titular no puede salir. Puedes eliminar la familia.",
  not_found: "No encontramos ese elemento.",
  analytics_not_included: "El análisis avanzado es parte de los planes Plus y Ultra.",
};

export function familyErrorMessage(message: string | undefined, fallback = "No pudimos completar la acción. Inténtalo de nuevo.") {
  if (!message) return fallback;
  const code = Object.keys(FAMILY_ERRORS).find((k) => message.includes(k));
  return code ? FAMILY_ERRORS[code]! : fallback;
}
