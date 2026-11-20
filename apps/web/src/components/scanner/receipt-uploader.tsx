"use client";

import { UPLOAD_MAX_BYTES, UPLOAD_MIME_TYPES } from "@orvelia/domain";
import { Camera, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { uploadReceipt } from "@/app/app/scanner/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { prepareImage } from "@/lib/resize-image";
import { cn } from "@/lib/utils";

/** Upload a receipt photo or PDF, then open its review screen. */
export function ReceiptUploader({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    let toSend: File | null = file;
    if (file.type.startsWith("image/")) {
      // Keep receipts legible: larger than product photos, still strips EXIF/GPS.
      toSend = await prepareImage(file, 2400, 0.9);
      if (!toSend) {
        setError("No pudimos leer esta imagen. Usa una foto JPG, PNG o WEBP, o un PDF.");
        return;
      }
    }
    if (!(UPLOAD_MIME_TYPES as readonly string[]).includes(toSend.type)) {
      setError("Usa una foto (JPG, PNG o WEBP) o un PDF.");
      return;
    }
    if (toSend.size > UPLOAD_MAX_BYTES) {
      setError("El archivo supera 10 MB.");
      return;
    }
    const fd = new FormData();
    fd.set("file", toSend);
    startTransition(async () => {
      const res = await uploadReceipt(fd);
      if (!res.ok || !res.data) setError(res.message ?? "No pudimos subir el archivo.");
      else router.push(`/app/scanner/${res.data.id}`);
    });
  }

  return (
    <div className="grid gap-4">
      {error && <Alert tone="error" title={error} />}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && !pending) void handle(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center transition-colors",
          dragging && "border-accent bg-accent/5",
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full border border-border-strong bg-surface-raised">
          <FileUp className="size-5 text-accent-ink" aria-hidden strokeWidth={1.5} />
        </div>
        <p className="mt-5 text-lg font-medium">{pending ? "Subiendo…" : "Sube tu boleta, factura o ticket"}</p>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Foto o PDF de hasta 10 MB. Se guarda en tu espacio privado y nada se registra sin que lo revises.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => cameraRef.current?.click()} disabled={disabled || pending} className="sm:hidden">
            <Camera aria-hidden />
            Tomar foto
          </Button>
          {/* Mobile: camera first, file second. Desktop: file only. */}
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={disabled || pending} className="sm:hidden">
            Elegir archivo
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={disabled} loading={pending} className="max-sm:hidden">
            {!pending && <FileUp aria-hidden />}
            Elegir archivo
          </Button>
        </div>
        <p className="mt-4 hidden text-[13px] text-muted-foreground sm:block">o arrástralo aquí</p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={UPLOAD_MIME_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
