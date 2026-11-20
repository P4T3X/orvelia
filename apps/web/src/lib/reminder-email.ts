import "server-only";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plain, brand-consistent reminder email (inline styles for email clients). */
export function reminderEmail(r: { name: string | null; title: string; description: string | null; url: string }) {
  const greeting = r.name ? `Hola, ${r.name.split(" ")[0]}:` : "Hola:";
  const text = `${greeting}\n\n${r.title}\n${r.description ? `\n${r.description}\n` : ""}\nVer en ORVELIA: ${r.url}\n\nRecibes este aviso porque lo programaste en ORVELIA. Puedes cambiar tus avisos en Ajustes.`;
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F6F4EF;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111315">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E2DED5;border-radius:14px">
<tr><td style="padding:28px 32px 0;font-size:13px;letter-spacing:.28em;font-weight:600">ORVELIA <span style="color:#C7A66A">&#9679;</span></td></tr>
<tr><td style="padding:24px 32px 8px;font-size:15px;color:#63686E">${esc(greeting)}</td></tr>
<tr><td style="padding:0 32px;font-size:22px;line-height:1.3;font-weight:500">${esc(r.title)}</td></tr>
${r.description ? `<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#63686E">${esc(r.description)}</td></tr>` : ""}
<tr><td style="padding:28px 32px 32px"><a href="${esc(r.url)}" style="display:inline-block;background:#111315;color:#F6F4EF;text-decoration:none;font-size:14px;font-weight:500;padding:12px 20px;border-radius:10px">Ver en ORVELIA</a></td></tr>
</table>
<p style="max-width:520px;font-size:12px;line-height:1.6;color:#858B92;margin:20px auto 0">Recibes este aviso porque lo programaste en ORVELIA. Puedes cambiar tus avisos en Ajustes.</p>
</td></tr></table></body></html>`;
  return { subject: r.title, html, text };
}
