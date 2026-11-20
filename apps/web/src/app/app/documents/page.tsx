import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from "@orvelia/domain";
import { FileText, FileUp, ScanLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { DocumentList } from "@/components/documents/document-list";
import { ReceiptList } from "@/components/scanner/receipt-list";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listDocuments } from "@/lib/documents";
import { listReceipts } from "@/lib/receipts";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Documentos" };

type Tab = "receipts" | DocumentType | "all";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser("/app/documents");
  const { tab: rawTab } = await searchParams;
  const tab: Tab =
    rawTab === "receipts" || (DOCUMENT_TYPES as readonly string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "all";

  const [documents, receipts] = await Promise.all([
    tab === "receipts" ? Promise.resolve([]) : listDocuments(user.id, { type: tab === "all" ? undefined : (tab as DocumentType) }),
    tab === "receipts" ? listReceipts(user.id, { status: ["confirmed"], limit: 100 }) : Promise.resolve([]),
  ]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "Todos los documentos" },
    ...DOCUMENT_TYPES.filter((t) => t !== "receipt").map((t) => ({ id: t as Tab, label: DOCUMENT_TYPE_LABELS[t] })),
    { id: "receipts", label: "Comprobantes escaneados" },
  ];

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Garantías, manuales, facturas y comprobantes, guardados en privado."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/scanner">
                <ScanLine aria-hidden />
                Escanear
              </Link>
            </Button>
            <Button asChild>
              <Link href="/app/documents/new">
                <FileUp aria-hidden />
                Subir documento
              </Link>
            </Button>
          </>
        }
      />

      <nav aria-label="Tipos de documento" className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.id === "all" ? "/app/documents" : `/app/documents?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              tab === t.id
                ? "border-foreground bg-foreground text-background"
                : "border-border-strong text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "receipts" ? (
        receipts.length > 0 ? (
          <ReceiptList receipts={receipts} />
        ) : (
          <Empty
            title="Aún no guardaste comprobantes"
            body="Escanea una boleta o factura: la revisas y queda vinculada a tus productos."
            href="/app/scanner"
            cta="Ir al escáner"
          />
        )
      ) : documents.length > 0 ? (
        <DocumentList documents={documents} />
      ) : (
        <Empty
          title={tab === "all" ? "Aún no tienes documentos" : `No tienes documentos de tipo ${DOCUMENT_TYPE_LABELS[tab as DocumentType].toLowerCase()}`}
          body="Sube certificados de garantía, manuales o pólizas para tenerlos a mano cuando los necesites."
          href="/app/documents/new"
          cta="Subir documento"
        />
      )}
    </>
  );
}

function Empty({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <section className="rounded-xl border border-dashed border-border-strong px-6 py-14 text-center">
      <FileText className="mx-auto size-6 text-muted-foreground" aria-hidden strokeWidth={1.5} />
      <h2 className="mt-4 font-medium">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p>
      <Button asChild variant="secondary" className="mt-6">
        <Link href={href}>{cta}</Link>
      </Button>
    </section>
  );
}
