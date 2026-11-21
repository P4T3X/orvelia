import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { Alert } from "@/components/ui/alert";
import { getAssistantModel } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ORVELIA AI" };

export default async function AssistantPage() {
  await requireUser("/app/assistant");
  const supabase = await createClient();
  const { data } = await supabase.rpc("assistant_usage");
  const usage = data?.[0];
  const limit = usage?.queries_per_month ?? 0;
  const used = usage?.used ?? 0;
  const configured = getAssistantModel() !== null;

  const disabledReason = !configured
    ? "ORVELIA AI aún no está activo"
    : limit === 0
      ? "No incluido en tu plan"
      : used >= limit
        ? "Usaste tus consultas de este mes"
        : undefined;

  return (
    <>
      <PageHeader
        title="ORVELIA AI"
        description={
          configured && limit > 0 ? (
            <span className="text-sm tabular-nums">
              {used} de {limit} consultas este mes
            </span>
          ) : (
            "Pregunta sobre lo que posees en lenguaje natural."
          )
        }
      />
      {!configured && (
        <Alert tone="info" title="ORVELIA AI aún no está activo en este entorno." className="mb-6">
          Cuando se active, podrás preguntar por tus garantías, vencimientos y gastos.
        </Alert>
      )}
      {configured && limit === 0 && (
        <Alert tone="info" title="ORVELIA AI no está incluido en el plan Free." className="mb-6">
          Está incluido en Plus (100 consultas al mes) y Ultra (500).{" "}
          <Link href="/app/billing" className="underline underline-offset-2">
            Ver planes
          </Link>
        </Alert>
      )}
      <AssistantChat disabledReason={disabledReason} />
    </>
  );
}
