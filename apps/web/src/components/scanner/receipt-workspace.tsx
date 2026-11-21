"use client";

import type { ExtractionResult } from "@orvelia/ai";
import { WARNING_MESSAGES } from "@orvelia/ai/receipt";
import type { ProcessingStatus } from "@orvelia/domain";
import { SUPPORTED_CURRENCIES } from "@orvelia/domain";
import { parsePrice, receiptConfirmSchema, type ReceiptConfirmInput } from "@orvelia/schemas";
import { ExternalLink, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { confirmReceipt, deleteReceipt, processReceipt } from "@/app/app/scanner/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { useActionForm } from "@/lib/use-action-form";
import { cn } from "@/lib/utils";

export type WorkspaceReceipt = {
  id: string;
  status: ProcessingStatus;
  mimeType: string | null;
  merchant: string | null;
  receiptNumber: string | null;
  purchaseDate: string | null;
  total: number | null;
  tax: number | null;
  currency: string | null;
  extraction: ExtractionResult | null;
  processingError: string | null;
  processingErrorCode: string | null;
  attempts: number;
  retriesLeft: number;
  fieldSources: Record<string, "extracted" | "manual">;
  linkedProducts: { id: string; name: string }[];
};

type ProductOption = { id: string; name: string; receiptId: string | null };
type ItemRow = { key: string; include: boolean; name: string; price: string; error?: string };

const toAmount = (n: number | null | undefined) => (n == null ? "" : n.toFixed(2));

export function ReceiptWorkspace({
  receipt,
  products,
  fileUrl,
  autoReading,
  scansRemaining,
  productSlots,
  defaultCurrency,
}: {
  receipt: WorkspaceReceipt;
  products: ProductOption[];
  fileUrl: string;
  autoReading: boolean;
  scansRemaining: number;
  /** Products the user can still create on their plan; null = unlimited. */
  productSlots: number | null;
  defaultCurrency: string;
}) {
  const [manual, setManual] = React.useState(false);
  const reading = receipt.status === "uploaded" || receipt.status === "processing";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
      <DocumentPreview fileUrl={fileUrl} mimeType={receipt.mimeType} />
      <div className="min-w-0">
        {reading ? (
          <Processing receiptId={receipt.id} autoReading={autoReading} />
        ) : receipt.status === "failed" && !manual ? (
          <Failed
            receiptId={receipt.id}
            message={receipt.processingError}
            attempts={receipt.attempts}
            retriesLeft={receipt.processingErrorCode === "configuration" ? 0 : receipt.retriesLeft}
            onManual={() => setManual(true)}
          />
        ) : (
          <ReviewForm
            receipt={receipt}
            products={products}
            autoReading={autoReading}
            scansRemaining={scansRemaining}
            productSlots={productSlots}
            defaultCurrency={defaultCurrency}
          />
        )}
      </div>
    </div>
  );
}

function DocumentPreview({ fileUrl, mimeType }: { fileUrl: string; mimeType: string | null }) {
  const isPdf = mimeType === "application/pdf";
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-surface lg:sticky lg:top-8">
      {isPdf ? (
        <iframe src={fileUrl} title="Vista previa del comprobante" className="h-[60vh] w-full bg-white lg:h-[75vh]" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- private file behind an ownership-checked redirect
        <img src={fileUrl} alt="Comprobante subido" className="max-h-[75vh] w-full object-contain" />
      )}
      <figcaption className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[13px] text-muted-foreground">
        <span>{isPdf ? "PDF" : "Imagen"} privada</span>
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
          Abrir original
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </figcaption>
    </figure>
  );
}

function Processing({ receiptId, autoReading }: { receiptId: string; autoReading: boolean }) {
  const router = useRouter();
  const started = React.useRef(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    let poll: ReturnType<typeof setInterval> | undefined;
    void processReceipt(receiptId).then((res) => {
      if (!res.ok) setError(res.message ?? "No pudimos leer el comprobante.");
      else if (res.data?.outcome === "busy") poll = setInterval(() => router.refresh(), 3000);
      else router.refresh();
    });
    return () => clearInterval(poll);
  }, [receiptId, router]);

  if (error) return <Alert tone="error" title={error} />;
  return (
    <div role="status" className="rounded-xl border border-border bg-surface-raised px-6 py-14 text-center">
      <Loader2 className="mx-auto size-6 animate-spin text-accent-ink" aria-hidden />
      <p className="mt-5 text-lg font-medium">{autoReading ? "Leyendo tu comprobante…" : "Preparando tu comprobante…"}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
        {autoReading
          ? "Buscamos tienda, fecha, montos y productos. Suele tardar entre 5 y 20 segundos."
          : "En un momento podrás completar los datos."}
      </p>
    </div>
  );
}

function Failed({
  receiptId,
  message,
  attempts,
  retriesLeft,
  onManual,
}: {
  receiptId: string;
  message: string | null;
  attempts: number;
  retriesLeft: number;
  onManual: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <div className="grid gap-5">
      <Alert tone="error" title="No pudimos leer este comprobante.">
        {message ?? "Ocurrió un error inesperado."} Las lecturas fallidas no cuentan para tu límite mensual.
        {attempts > 0 && (
          <span className="mt-1 block text-[13px]">
            {retriesLeft > 0
              ? `Intentos: ${attempts}. Puedes reintentar ${retriesLeft === 1 ? "una vez más" : `${retriesLeft} veces más`}.`
              : "Ya no quedan reintentos automáticos para este comprobante. Completa los datos a mano."}
          </span>
        )}
      </Alert>
      <div className="flex flex-wrap gap-2">
        {retriesLeft > 0 && (
          <Button
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await processReceipt(receiptId);
                if (!res.ok) toast.error(res.message);
                else if (res.data?.outcome === "retry_limit") toast.info("Ya no quedan reintentos para este comprobante.");
                router.refresh();
              })
            }
          >
            {!pending && <RotateCcw aria-hidden />}
            Reintentar lectura
          </Button>
        )}
        <Button variant={retriesLeft > 0 ? "secondary" : "primary"} onClick={onManual}>
          Completar a mano
        </Button>
      </div>
    </div>
  );
}

function SourceTag({ extracted, current }: { extracted: string | null | undefined; current: string }) {
  if (extracted == null || extracted === "") return null;
  const same = current.trim() === extracted;
  return (
    <span
      title={same ? "Leído del documento" : "Editado por ti"}
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-none",
        same ? "bg-accent/15 text-accent-ink" : "bg-muted text-muted-foreground",
      )}
    >
      {same ? "Leído" : "Editado"}
      <span className="sr-only">{same ? " del documento" : " por ti"}</span>
    </span>
  );
}

function ReviewForm({
  receipt,
  products,
  autoReading,
  scansRemaining,
  productSlots,
  defaultCurrency,
}: {
  receipt: WorkspaceReceipt;
  products: ProductOption[];
  autoReading: boolean;
  scansRemaining: number;
  productSlots: number | null;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const confirmed = receipt.status === "confirmed";
  const ex = receipt.extraction?.data;
  const extractedValues = {
    merchant: ex?.merchant ?? null,
    receiptNumber: ex?.receiptNumber ?? null,
    purchaseDate: ex?.purchaseDate ?? null,
    total: ex?.total == null ? null : ex.total.toFixed(2),
    tax: ex?.tax == null ? null : ex.tax.toFixed(2),
  };

  const currency = (c: string | null | undefined) =>
    (SUPPORTED_CURRENCIES as readonly string[]).includes(c ?? "") ? (c as (typeof SUPPORTED_CURRENCIES)[number]) : null;

  const defaults: ReceiptConfirmInput = confirmed
    ? {
        merchant: receipt.merchant ?? "",
        receiptNumber: receipt.receiptNumber ?? "",
        purchaseDate: receipt.purchaseDate ?? "",
        total: toAmount(receipt.total),
        tax: toAmount(receipt.tax),
        currency: currency(receipt.currency) ?? currency(defaultCurrency) ?? "PEN",
        linkProductIds: [],
        newProducts: [],
      }
    : {
        merchant: ex?.merchant ?? "",
        receiptNumber: ex?.receiptNumber ?? "",
        purchaseDate: ex?.purchaseDate ?? "",
        total: toAmount(ex?.total),
        tax: toAmount(ex?.tax),
        currency: currency(ex?.currency) ?? currency(defaultCurrency) ?? "PEN",
        linkProductIds: [],
        newProducts: [],
      };

  const [rows, setRows] = React.useState<ItemRow[]>(() =>
    confirmed
      ? []
      : (ex?.items ?? []).map((item, i) => ({
          key: `x${i}`,
          include: (ex?.items.length ?? 0) <= 3,
          name: item.description,
          price: toAmount(item.amount),
        })),
  );
  const [linked, setLinked] = React.useState<string[]>([]);
  const linkable = products.filter((p) => p.receiptId !== receipt.id);

  const save = async (values: ReceiptConfirmInput) => {
    // Validate item rows locally so errors show next to each row.
    let invalid = false;
    const checked = rows.map((r) => {
      if (!r.include) return { ...r, error: undefined };
      const error = !r.name.trim()
        ? "Escribe el nombre."
        : parsePrice(r.price) === undefined
          ? "Monto no válido."
          : undefined;
      if (error) invalid = true;
      return { ...r, error };
    });
    setRows(checked);
    if (invalid) return { ok: false, message: "Revisa los productos marcados." };

    const res = await confirmReceipt(receipt.id, {
      ...values,
      linkProductIds: linked,
      newProducts: checked.filter((r) => r.include).map((r) => ({ name: r.name, price: r.price })),
    });
    if (!res.ok || !res.data) return res;

    const { created, limitReached } = res.data;
    if (limitReached) toast.warning(`Comprobante guardado. Se crearon ${created} productos: llegaste al límite de tu plan.`);
    else if (created > 0) toast.success(`Comprobante guardado y ${created === 1 ? "1 producto creado" : `${created} productos creados`}.`);
    else toast.success(confirmed ? "Cambios guardados." : "Comprobante guardado.");
    setRows([]);
    setLinked([]);
    router.refresh();
  };

  const { form, onSubmit, pending, result } = useActionForm(receiptConfirmSchema, defaults, save);
  const { errors } = form.formState;
  const watch = form.watch();
  const includedCount = rows.filter((r) => r.include).length;
  const overSlots = productSlots !== null && includedCount > productSlots;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8">
      <div className="grid gap-3">
        {receipt.extraction?.isTest && (
          <Alert tone="info" title="Datos de prueba">
            Esta lectura la hizo el lector de prueba del entorno de desarrollo: no leyó tu archivo.
          </Alert>
        )}
        {!confirmed && receipt.extraction && (
          <Alert tone="info" title="Revisa cada dato antes de guardar.">
            Lo marcado como “Leído” viene de tu archivo. Si un campo está vacío es porque no aparece o no
            se pudo leer: no completamos nada por nuestra cuenta.
          </Alert>
        )}
        {!confirmed && !receipt.extraction && (
          <Alert
            tone="info"
            title={
              autoReading && scansRemaining === 0
                ? "Usaste tus lecturas automáticas de este mes."
                : autoReading
                  ? "Completa los datos del comprobante."
                  : "La lectura automática no está activa."
            }
          >
            Completa los datos a mano mirando el comprobante.
          </Alert>
        )}
        {!confirmed && (receipt.extraction?.warnings.length ?? 0) > 0 && (
          <Alert tone="error" title="Puntos a revisar">
            <ul className="grid gap-1">
              {receipt.extraction!.warnings.map((w) => (
                <li key={w}>{WARNING_MESSAGES[w]}</li>
              ))}
            </ul>
          </Alert>
        )}
        {result && !result.ok && <Alert tone="error" title={result.message} />}
      </div>

      <section className="grid gap-5">
        <h2 className="font-medium">Datos del comprobante</h2>

        <Field
          id="merchant"
          label="Tienda o vendedor"
          error={errors.merchant?.message}
          action={<SourceTag extracted={extractedValues.merchant} current={watch.merchant} />}
        >
          <Input
            {...fieldAria("merchant", errors.merchant?.message)}
            {...form.register("merchant")}
            placeholder={ex && !ex.merchant ? "No aparece en el documento" : undefined}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="receiptNumber"
            label="N.º de comprobante"
            error={errors.receiptNumber?.message}
            action={<SourceTag extracted={extractedValues.receiptNumber} current={watch.receiptNumber} />}
          >
            <Input
              {...fieldAria("receiptNumber", errors.receiptNumber?.message)}
              {...form.register("receiptNumber")}
              className="font-mono text-[14px]"
              placeholder={ex && !ex.receiptNumber ? "No aparece" : undefined}
            />
          </Field>
          <Field
            id="purchaseDate"
            label="Fecha de compra"
            error={errors.purchaseDate?.message}
            action={<SourceTag extracted={extractedValues.purchaseDate} current={watch.purchaseDate} />}
          >
            <Input
              {...fieldAria("purchaseDate", errors.purchaseDate?.message)}
              {...form.register("purchaseDate")}
              type="date"
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-[7rem_1fr_1fr]">
          <Field id="currency" label="Moneda" error={errors.currency?.message}>
            <Select {...fieldAria("currency", errors.currency?.message)} {...form.register("currency")}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="total"
            label="Total"
            error={errors.total?.message}
            action={<SourceTag extracted={extractedValues.total} current={watch.total} />}
          >
            <Input
              {...fieldAria("total", errors.total?.message)}
              {...form.register("total")}
              inputMode="decimal"
              className="tabular-nums"
              placeholder={ex && ex.total === null ? "No aparece" : "0.00"}
            />
          </Field>
          <Field
            id="tax"
            label="IGV"
            error={errors.tax?.message}
            action={<SourceTag extracted={extractedValues.tax} current={watch.tax} />}
          >
            <Input
              {...fieldAria("tax", errors.tax?.message)}
              {...form.register("tax")}
              inputMode="decimal"
              className="tabular-nums"
              placeholder={ex && ex.tax === null ? "No aparece" : "0.00"}
            />
          </Field>
        </div>
      </section>

      {confirmed && receipt.linkedProducts.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-medium">Productos de este comprobante</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {receipt.linkedProducts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link href={`/app/products/${p.id}`} className="min-w-0 truncate hover:underline">
                  {p.name}
                </Link>
                <Link href={`/app/products/${p.id}#garantia`} className="shrink-0 text-sm text-muted-foreground hover:text-foreground">
                  Registrar garantía
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <div>
          <h2 className="font-medium">{confirmed ? "Agregar productos" : "Productos"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Marca lo que quieras registrar en tu colección. Se crearán con la fecha, tienda y moneda del comprobante.
          </p>
        </div>

        {rows.length > 0 && (
          <ul className="grid gap-2">
            {rows.map((row, i) => (
              <li key={row.key} className={cn("rounded-lg border border-border p-3", row.include && "border-accent/50 bg-accent/5")}>
                <div className="grid grid-cols-[auto_1fr_5.5rem] items-start gap-2 sm:grid-cols-[auto_1fr_7.5rem] sm:gap-3">
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, include: e.target.checked } : r)))}
                    aria-label={`Crear producto ${row.name || i + 1}`}
                    className="mt-3 size-4 accent-[#111315] dark:accent-[#C7A66A]"
                  />
                  <Input
                    value={row.name}
                    onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                    aria-label="Nombre del producto"
                    aria-invalid={row.error ? true : undefined}
                    maxLength={160}
                  />
                  <Input
                    value={row.price}
                    onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))}
                    aria-label="Precio"
                    inputMode="decimal"
                    placeholder="Precio"
                    className="tabular-nums"
                  />
                </div>
                {row.error && (
                  <p role="alert" className="mt-2 pl-7 text-[13px] text-danger">
                    {row.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRows((rs) => [...rs, { key: `m${Date.now()}`, include: true, name: "", price: "" }])}
          >
            <Plus aria-hidden />
            Agregar producto
          </Button>
        </div>
        {overSlots && (
          <p role="alert" className="text-[13px] text-danger">
            Tu plan permite {productSlots} {productSlots === 1 ? "producto más" : "productos más"}; se crearán solo los
            primeros.
          </p>
        )}
      </section>

      {linkable.length > 0 && (
        <section className="grid gap-3">
          <div>
            <h2 className="font-medium">¿Ya registraste lo que compraste?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Vincula este comprobante a productos de tu colección.</p>
          </div>
          <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-border p-2">
            {linkable.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={linked.includes(p.id)}
                    onChange={(e) =>
                      setLinked((l) => (e.target.checked ? [...l, p.id] : l.filter((x) => x !== p.id)))
                    }
                    className="size-4 accent-[#111315] dark:accent-[#C7A66A]"
                  />
                  <span className="text-[15px]">{p.name}</span>
                  {p.receiptId && <span className="text-[12px] text-muted-foreground">ya tiene otro comprobante</span>}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <DeleteReceipt id={receipt.id} />
        <Button type="submit" loading={pending}>
          {confirmed ? "Guardar cambios" : includedCount > 0 ? "Guardar y crear productos" : "Guardar comprobante"}
        </Button>
      </div>
    </form>
  );
}

function DeleteReceipt({ id }: { id: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <ConfirmDialog
      title="¿Eliminar este comprobante?"
      description="Se eliminarán el archivo y sus datos. Los productos vinculados se conservan, sin comprobante."
      confirmLabel="Eliminar comprobante"
      pending={pending}
      onConfirm={() =>
        startTransition(async () => {
          const res = await deleteReceipt(id);
          if (res && !res.ok) toast.error(res.message);
        })
      }
      trigger={(open) => (
        <Button type="button" variant="ghost" onClick={open}>
          <Trash2 aria-hidden />
          Eliminar comprobante
        </Button>
      )}
    />
  );
}

