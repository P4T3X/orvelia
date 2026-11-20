"use client";

import { DOCUMENT_TYPE_LABELS } from "@orvelia/domain";
import { ExternalLink, FileText, ImageIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { deleteDocument } from "@/app/app/documents/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { DocumentItem } from "@/lib/documents";

function formatSize(bytes: number | null) {
  if (!bytes) return null;
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatShortDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso.slice(0, 10)}T12:00:00Z`),
  );
}

export function DocumentList({ documents, showProduct = true }: { documents: DocumentItem[]; showProduct?: boolean }) {
  const router = useRouter();
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  function remove(id: string) {
    setDeleting(id);
    startTransition(async () => {
      const res = await deleteDocument(id);
      setDeleting(null);
      if (!res.ok) toast.error(res.message);
      else {
        toast.success(res.message);
        router.refresh();
      }
    });
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised">
      {documents.map((d) => {
        const Icon = d.mimeType === "application/pdf" ? FileText : ImageIcon;
        const meta = [
          DOCUMENT_TYPE_LABELS[d.type],
          showProduct ? d.productName : null,
          d.expiresOn ? `Vence ${formatShortDate(d.expiresOn)}` : null,
          formatSize(d.sizeBytes),
        ].filter(Boolean);
        return (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
              <Icon className="size-4 text-muted-foreground" aria-hidden strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <a
                href={`/app/files/document/${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 font-medium hover:underline"
              >
                <span className="truncate">{d.title}</span>
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </a>
              <p className="truncate text-[13px] text-muted-foreground">
                {meta.join(" · ")}
              </p>
            </div>
            {showProduct && d.productId && (
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href={`/app/products/${d.productId}`}>Ver producto</Link>
              </Button>
            )}
            <ConfirmDialog
              title={`¿Eliminar "${d.title}"?`}
              description="Se eliminará el archivo de forma permanente."
              confirmLabel="Eliminar documento"
              pending={deleting === d.id}
              onConfirm={() => remove(d.id)}
              trigger={(open) => (
                <Button variant="ghost" size="icon" onClick={open} aria-label={`Eliminar ${d.title}`}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            />
          </li>
        );
      })}
    </ul>
  );
}
