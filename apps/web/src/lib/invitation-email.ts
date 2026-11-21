import "server-only";

import { FAMILY_ROLE_LABELS, type FamilyRole } from "@orvelia/domain";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Family invitation e-mail. The link carries the one-time token. */
export function invitationEmail(r: { inviter: string; family: string; role: FamilyRole; email: string; url: string }) {
  const subject = `${r.inviter} te invitó a la familia ${r.family} en ORVELIA`;
  const note = `La invitación es para ${r.email} y vence en 7 días. Si aún no tienes cuenta, créala con ese correo y vuelve a abrir el enlace.`;
  const text = `Hola:\n\n${r.inviter} te invitó a unirte a la familia "${r.family}" en ORVELIA como ${FAMILY_ROLE_LABELS[r.role].toLowerCase()}. Podrán ver juntos los productos, garantías y documentos que cada uno decida compartir.\n\nAceptar invitación: ${r.url}\n\n${note}\n\nSi no esperabas este correo, puedes ignorarlo.`;
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F6F4EF;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111315">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E2DED5;border-radius:14px">
<tr><td style="padding:28px 32px 0;font-size:13px;letter-spacing:.28em;font-weight:600">ORVELIA <span style="color:#C7A66A">&#9679;</span></td></tr>
<tr><td style="padding:24px 32px 0;font-size:22px;line-height:1.3;font-weight:500">${esc(r.inviter)} te invitó a la familia ${esc(r.family)}</td></tr>
<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#63686E">Entrarás como ${esc(FAMILY_ROLE_LABELS[r.role].toLowerCase())}. Podrán ver juntos los productos, garantías y documentos que cada uno decida compartir. Lo que no compartas sigue siendo solo tuyo.</td></tr>
<tr><td style="padding:28px 32px 0"><a href="${esc(r.url)}" style="display:inline-block;background:#111315;color:#F6F4EF;text-decoration:none;font-size:14px;font-weight:500;padding:12px 20px;border-radius:10px">Aceptar invitación</a></td></tr>
<tr><td style="padding:20px 32px 32px;font-size:13px;line-height:1.6;color:#858B92">${esc(note)}</td></tr>
</table>
<p style="max-width:520px;font-size:12px;line-height:1.6;color:#858B92;margin:20px auto 0">Si no esperabas este correo, puedes ignorarlo.</p>
</td></tr></table></body></html>`;
  return { subject, html, text };
}
