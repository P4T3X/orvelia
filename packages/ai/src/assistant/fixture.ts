import type { AskInput, AssistantModel, RawAnswer } from "./assistant";
import type { Deadline, ProductSummary, ToolName, WarrantySummary } from "./contract";

/**
 * Deterministic assistant for local development and automated tests. It
 * routes by keywords and calls the same data-source tools as the real model,
 * so it exercises every query and every link. The app labels it as a test
 * assistant and refuses it in production.
 */
export function createFixtureAssistant(): AssistantModel {
  return { id: "fixture", isTest: true, ask };
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso.slice(0, 10)}T12:00:00Z`),
  );

const fmtMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);

const left = (d: number) => (d === 0 ? "hoy" : d === 1 ? "mañana" : `en ${d} días`);

async function ask({ question, data }: AskInput): Promise<RawAnswer> {
  const q = norm(question);
  const toolOutputs: unknown[] = [];
  const toolsUsed: ToolName[] = [];
  const call = async <K extends ToolName>(name: K, input: Parameters<(typeof data)[K]>[0]) => {
    const out = await (data[name] as (i: unknown) => Promise<Awaited<ReturnType<(typeof data)[K]>>>)(input);
    toolOutputs.push(out);
    toolsUsed.push(name);
    return out;
  };
  const done = (text: string): RawAnswer => ({ text, toolOutputs, toolsUsed });

  if (q.includes("garantia") && /(activ|vigent)/.test(q)) {
    const { warranties } = await call("list_warranties", { state: "active" });
    if (warranties.length === 0) return done("No encontré garantías vigentes en tus registros.");
    return done(
      `Tienes ${warranties.length === 1 ? "1 garantía vigente" : `${warranties.length} garantías vigentes`}:\n` +
        warranties.map((w: WarrantySummary) => `- [[product:${w.product.id}]]: hasta el ${fmtDate(w.endDate!)} (${left(w.daysLeft!)})`).join("\n"),
    );
  }

  if (/(vence|vencen|vencimiento|plazo|proxim)/.test(q)) {
    const { deadlines } = await call("upcoming_deadlines", { days: 60 });
    if (deadlines.length === 0) return done("No tienes vencimientos en los próximos 60 días.");
    const label = { warranty: "fin de garantía", return: "último día de devolución", document: "vence el documento" } as const;
    return done(
      "En los próximos 60 días:\n" +
        deadlines
          .map((d: Deadline) => `- ${fmtDate(d.date)} (${left(d.daysLeft)}): ${label[d.kind]} de [[${d.ref.type}:${d.ref.id}]]`)
          .join("\n"),
    );
  }

  if (/(gast|cuanto)/.test(q)) {
    const m = q.match(/en ([a-z ]+?)(\?|$| este| el | en )/);
    const category = m?.[1]?.trim();
    const s = await call("spending_summary", { category, groupBy: "none" });
    if (s.totals.length === 0) {
      return done(category ? `No encontré compras con precio en la categoría ${category}.` : "No encontré compras con precio registrado.");
    }
    const totals = s.totals.map((t) => `${fmtMoney(t.amount, t.currency)} en ${t.count} ${t.count === 1 ? "producto" : "productos"}`).join(" y ");
    const note = s.productsWithoutPrice > 0 ? `\n${s.productsWithoutPrice} sin precio registrado no están incluidos.` : "";
    return done(`${category ? `En ${s.category ?? category} gastaste` : "Gastaste"} **${totals}**, según los precios que registraste.${note}`);
  }

  if (/(comprobante|boleta|recibo|factura)/.test(q) && /(sin|falt|no tienen)/.test(q)) {
    const { products, total } = await call("products_missing_receipts", { limit: 20 });
    if (total === 0) return done("Todos tus productos tienen un comprobante vinculado.");
    return done(`${total === 1 ? "1 producto no tiene" : `${total} productos no tienen`} comprobante:\n` + products.map((p: ProductSummary) => `- [[product:${p.ref.id}]]`).join("\n"));
  }

  if (/(recient|ultim)/.test(q) && q.includes("compr")) {
    const { products } = await call("recent_purchases", { limit: 5 });
    if (products.length === 0) return done("Aún no registraste compras con fecha.");
    return done("Tus compras más recientes:\n" + products.map((p: ProductSummary) => `- [[product:${p.ref.id}]]${p.purchaseDate ? `, ${fmtDate(p.purchaseDate)}` : ""}`).join("\n"));
  }

  if (q.includes("mantenimiento")) {
    const { plans } = await call("list_maintenance", {});
    if (plans.length === 0) {
      // Maintenance may also live in plain reminders the user created.
      const { reminders } = await call("list_reminders", { days: 365 });
      if (reminders.length === 0) return done("No tienes mantenimientos ni recordatorios programados.");
      return done("No tienes planes de mantenimiento, pero sí estos recordatorios:\n" + reminders.slice(0, 10).map((r) => `- ${fmtDate(r.localDate)}: ${r.title}`).join("\n"));
    }
    return done(
      "Mantenimientos programados:\n" +
        plans
          .slice(0, 10)
          .map((m) => `- ${m.title} de [[product:${m.product.id}]]: ${m.daysLeft < 0 ? `atrasado desde el ${fmtDate(m.nextDueDate)}` : fmtDate(m.nextDueDate)} (${m.every.toLowerCase()})`)
          .join("\n"),
    );
  }

  if (/(recordatorio|programad)/.test(q)) {
    const { reminders } = await call("list_reminders", { days: 365 });
    if (reminders.length === 0) return done("No tienes recordatorios programados.");
    return done("Tienes programado:\n" + reminders.slice(0, 10).map((r) => `- ${fmtDate(r.localDate)}: ${r.title}`).join("\n"));
  }

  const { products } = await call("search_products", { query: question.slice(0, 100), status: "all", limit: 5 });
  if (products.length === 0) return done("No encontré nada relacionado en tus registros.");
  return done("Encontré esto en tu colección:\n" + products.map((p: ProductSummary) => `- [[product:${p.ref.id}]]`).join("\n"));
}
