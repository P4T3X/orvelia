import "server-only";

import type { VerificationStatus, WarrantyKind } from "@orvelia/domain";
import { createClient } from "@/lib/supabase/server";

export type WarrantyItem = {
  id: string;
  kind: WarrantyKind;
  provider: string | null;
  startDate: string | null;
  endDate: string | null;
  coverage: string | null;
  sourceDocumentId: string | null;
  sourceDocumentTitle: string | null;
  verification: VerificationStatus;
  nextReminderAt: string | null;
};

export type ReturnItem = {
  id: string;
  deadlineDate: string;
  policy: string | null;
  sourceDocumentId: string | null;
  sourceDocumentTitle: string | null;
  verification: VerificationStatus;
  nextReminderAt: string | null;
};

type DocRef = { title: string } | { title: string }[] | null;
const titleOf = (d: DocRef) => (Array.isArray(d) ? d[0]?.title : d?.title) ?? null;

export async function getProductProtection(userId: string, productId: string) {
  const supabase = await createClient();
  const [w, r] = await Promise.all([
    supabase
      .from("warranties")
      .select(
        "id, kind, provider, start_date, end_date, coverage_description, source_document_id, verification_status, documents!warranties_document_fk(title)",
      )
      .eq("user_id", userId)
      .eq("product_id", productId)
      .order("end_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("return_deadlines")
      .select("id, deadline_date, policy_details, source_document_id, verification_status, documents!return_deadlines_document_fk(title)")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .order("deadline_date"),
  ]);
  if (w.error || r.error) throw new Error(`No se pudieron cargar garantías y devoluciones: ${(w.error ?? r.error)?.message}`);

  const ids = [...(w.data ?? []).map((x) => x.id), ...(r.data ?? []).map((x) => x.id)];
  const next = new Map<string, string>();
  if (ids.length > 0) {
    const { data: reminders } = await supabase
      .from("reminders")
      .select("source_id, scheduled_at")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .in("source_id", ids)
      .order("scheduled_at");
    for (const rem of reminders ?? []) if (rem.source_id && !next.has(rem.source_id)) next.set(rem.source_id, rem.scheduled_at);
  }

  const warranties: WarrantyItem[] = (w.data ?? []).map((x) => ({
    id: x.id,
    kind: x.kind,
    provider: x.provider,
    startDate: x.start_date,
    endDate: x.end_date,
    coverage: x.coverage_description,
    sourceDocumentId: x.source_document_id,
    sourceDocumentTitle: titleOf(x.documents as DocRef),
    verification: x.verification_status,
    nextReminderAt: next.get(x.id) ?? null,
  }));
  const returns: ReturnItem[] = (r.data ?? []).map((x) => ({
    id: x.id,
    deadlineDate: x.deadline_date,
    policy: x.policy_details,
    sourceDocumentId: x.source_document_id,
    sourceDocumentTitle: titleOf(x.documents as DocRef),
    verification: x.verification_status,
    nextReminderAt: next.get(x.id) ?? null,
  }));
  return { warranties, returns };
}
