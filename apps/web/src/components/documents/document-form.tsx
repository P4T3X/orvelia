"use client";

import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, UPLOAD_MAX_BYTES, UPLOAD_MIME_TYPES } from "@orvelia/domain";
import { documentUploadSchema } from "@orvelia/schemas";
import { FileUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { uploadDocument } from "@/app/app/documents/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { prepareImage } from "@/lib/resize-image";

type Errors = Partial<Record<"file" | "title" | "documentType" | "productId" | "expiresOn", string>>;

export function DocumentForm({
  products,
  defaultProductId,
}: {
  products: { id: string; name: string }[];
  defaultProductId: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<(typeof DOCUMENT_TYPES)[number]>("warranty");
  const [productId, setProductId] = React.useState(defaultProductId ?? "");
  const [expiresOn, setExpiresOn] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    setErrors((e) => ({ ...e, file: undefined }));
    let chosen: File | null = f;
    if (f.type.startsWith("image/")) {
      chosen = await prepareImage(f, 2400, 0.9);
      if (!chosen) return setErrors((e) => ({ ...e, file: "No pudimos leer esta imagen." }));
    }
    if (!(UPLOAD_MIME_TYPES as readonly string[]).includes(chosen.type)) {
      return setErrors((e) => ({ ...e, file: "Usa un PDF o una imagen JPG, PNG o WEBP." }));
    }
    if (chosen.size > UPLOAD_MAX_BYTES) return setErrors((e) => ({ ...e, file: "El archivo supera 10 MB." }));
    setFile(chosen);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 200));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const parsed = documentUploadSchema.safeParse({ title, documentType: type, productId, expiresOn });
    const next: Errors = {};
    if (!file) next.file = "Elige un archivo.";
    if (!parsed.success) for (const i of parsed.error.issues) next[i.path[0] as keyof Errors] ??= i.message;
    setErrors(next);
    if (Object.keys(next).length > 0 || !file) return;

    const fd = new FormData();
    fd.set("file", file);
    fd.set("title", title);
    fd.set("documentType", type);
    fd.set("productId", productId);
    fd.set("expiresOn", expiresOn);
    startTransition(async () => {
      const res = await uploadDocument(fd);
      if (!res.ok) {
        setErrors((res.fieldErrors ?? {}) as Errors);
        setMessage(res.message ?? null);
        return;
      }
      toast.success(res.message);
      router.push(res.data?.productId ? `/app/products/${res.data.productId}` : "/app/documents");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid max-w-2xl gap-6">
      {message && <Alert tone="error" title={message} />}

      <div className="grid gap-2">
        <span className="text-sm font-medium">Archivo</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-4 rounded-xl border border-dashed border-border-strong bg-surface px-5 py-5 text-left hover:border-foreground/40"
          aria-describedby={errors.file ? "file-error" : undefined}
        >
          <FileUp className="size-5 shrink-0 text-accent-ink" aria-hidden strokeWidth={1.5} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{file ? title || "Archivo elegido" : "Elegir PDF o imagen"}</span>
            <span className="block text-[13px] text-muted-foreground">
              {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · ${file.type === "application/pdf" ? "PDF" : "Imagen"}` : "Hasta 10 MB"}
            </span>
          </span>
        </button>
        {errors.file && (
          <p id="file-error" role="alert" className="text-[13px] text-danger">
            {errors.file}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD_MIME_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <Field id="title" label="Título" error={errors.title}>
        <Input {...fieldAria("title", errors.title)} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="documentType" label="Tipo" error={errors.documentType}>
          <Select
            {...fieldAria("documentType", errors.documentType)}
            value={type}
            onChange={(e) => setType(e.target.value as (typeof DOCUMENT_TYPES)[number])}
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="expiresOn" label="Vence el" error={errors.expiresOn} hint="Opcional. Ej. fin de una póliza.">
          <Input
            {...fieldAria("expiresOn", errors.expiresOn, true)}
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </Field>
      </div>

      <Field id="productId" label="Producto" error={errors.productId} hint="Opcional. Vincula el documento a algo de tu colección.">
        <Select {...fieldAria("productId", errors.productId, true)} value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Sin producto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
        <Button asChild variant="ghost">
          <Link href={defaultProductId ? `/app/products/${defaultProductId}` : "/app/documents"}>Cancelar</Link>
        </Button>
        <Button type="submit" loading={pending}>
          Guardar documento
        </Button>
      </div>
    </form>
  );
}
