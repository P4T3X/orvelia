import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ReceiptList } from "@/components/scanner/receipt-list";
import { ReceiptUploader } from "@/components/scanner/receipt-uploader";
import { Alert } from "@/components/ui/alert";
import { getReceiptExtractor } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { getScanUsage, listReceipts } from "@/lib/receipts";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Escáner" };

export default async function ScannerPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await requireUser("/app/scanner");
  const [usage, receipts, { deleted }] = await Promise.all([
    getScanUsage(),
    listReceipts(user.id, { limit: 20 }),
    searchParams,
  ]);
  const autoReading = getReceiptExtractor() !== null;
  const pending = receipts.filter((r) => r.status !== "confirmed");
  const done = receipts.filter((r) => r.status === "confirmed");

  return (
    <>
      <PageHeader
        title="Escáner"
        description={
          autoReading ? (
            <div className="flex items-center gap-3 text-sm">
              <div
                className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-label="Escaneos usados este mes"
                aria-valuemin={0}
                aria-valuemax={usage.limit}
                aria-valuenow={usage.used}
              >
                <div
                  className={cn("h-full rounded-full", usage.remaining === 0 ? "bg-danger" : "bg-accent")}
                  style={{ width: `${Math.min(100, (usage.used / Math.max(1, usage.limit)) * 100)}%` }}
                />
              </div>
              <span className="tabular-nums">
                {usage.used} de {usage.limit} lecturas automáticas este mes
              </span>
            </div>
          ) : (
            "Convierte tus comprobantes en registros ordenados."
          )
        }
      />

      {deleted === "1" && <Alert tone="success" title="Comprobante eliminado." className="mb-6" />}
      {!autoReading && (
        <Alert tone="info" title="La lectura automática aún no está activa." className="mb-6">
          Puedes subir tus comprobantes igual: se guardan en privado y completas los datos a mano.
        </Alert>
      )}
      {autoReading && usage.remaining === 0 && (
        <Alert tone="info" title={`Usaste tus ${usage.limit} lecturas automáticas de este mes.`} className="mb-6">
          Puedes seguir subiendo comprobantes y completar los datos a mano. El contador se reinicia el primer día de
          cada mes.
        </Alert>
      )}

      <ReceiptUploader />

      {pending.length > 0 && (
        <section aria-labelledby="pending" className="mt-10">
          <h2 id="pending" className="mb-3 font-medium">
            Por terminar
          </h2>
          <ReceiptList receipts={pending} />
        </section>
      )}

      {done.length > 0 && (
        <section aria-labelledby="recent" className="mt-10">
          <h2 id="recent" className="mb-3 font-medium">
            Guardados recientemente
          </h2>
          <ReceiptList receipts={done} />
        </section>
      )}
    </>
  );
}
