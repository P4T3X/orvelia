"use client";

import { PRODUCT_STATUSES, PRODUCT_STATUS_LABELS, SUPPORTED_CURRENCIES } from "@orvelia/domain";
import { categoryInputSchema, productInputSchema, type ProductInput } from "@orvelia/schemas";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import {
  createCategory,
  createProduct,
  removeProductImage,
  updateProduct,
  uploadProductImage,
} from "@/app/app/products/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";
import { ImagePicker, type ImageChange } from "./image-picker";

type Category = { id: string; name: string };
const NEW_CATEGORY = "__new__";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-border py-8 first:border-t-0 first:pt-0 lg:grid-cols-[15rem_1fr] lg:gap-12">
      <div>
        <h2 className="font-medium">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="grid max-w-2xl gap-5">{children}</div>
    </section>
  );
}

export function ProductForm({
  mode,
  productId,
  defaults,
  categories: initialCategories,
  currentImageUrl = null,
}: {
  mode: "create" | "edit";
  productId?: string;
  defaults: ProductInput;
  categories: Category[];
  currentImageUrl?: string | null;
}) {
  const router = useRouter();
  const [categories, setCategories] = React.useState(initialCategories);
  const [image, setImage] = React.useState<ImageChange>({ file: null, remove: false });

  const save = React.useCallback(
    async (values: ProductInput): Promise<ActionState<unknown> | void> => {
      const res = mode === "create" ? await createProduct(values) : await updateProduct(productId, values);
      if (!res.ok || !res.data) return res;
      const id = res.data.id;

      // Image is uploaded after the record exists so its path is under the product folder.
      let imageMessage: string | null = null;
      if (image.file) {
        const fd = new FormData();
        fd.set("productId", id);
        fd.set("image", image.file);
        const up = await uploadProductImage(fd);
        if (!up.ok) imageMessage = up.message ?? "No pudimos subir la foto.";
      } else if (image.remove) {
        const rm = await removeProductImage(id);
        if (!rm.ok) imageMessage = rm.message ?? "No pudimos quitar la foto.";
      }

      if (imageMessage) toast.error(`${res.message} ${imageMessage}`);
      else toast.success(res.message);
      router.push(`/app/products/${id}`);
      router.refresh();
    },
    [image, mode, productId, router],
  );

  const { form, onSubmit, pending, result } = useActionForm(productInputSchema, defaults, save);
  const { errors } = form.formState;
  const categoryValue = form.watch("categoryId");
  const priceValue = form.watch("purchasePrice");

  return (
    <form onSubmit={onSubmit} noValidate className="grid">
      {result && !result.ok && <Alert tone="error" title={result.message} className="mb-8" />}

      <Section title="Lo esencial" description="Solo el nombre es obligatorio.">
        <ImagePicker currentUrl={currentImageUrl} value={image} onChange={setImage} disabled={pending} />

        <Field id="name" label="Nombre" error={errors.name?.message}>
          <Input
            {...fieldAria("name", errors.name?.message)}
            {...form.register("name")}
            placeholder="Ej. Laptop de trabajo"
            autoFocus={mode === "create"}
            maxLength={160}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="brand" label="Marca" error={errors.brand?.message}>
            <Input {...fieldAria("brand", errors.brand?.message)} {...form.register("brand")} maxLength={80} />
          </Field>
          <Field id="model" label="Modelo" error={errors.model?.message}>
            <Input {...fieldAria("model", errors.model?.message)} {...form.register("model")} maxLength={80} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="categoryId" label="Categoría" error={errors.categoryId?.message}>
            {/* Controlled so a category created inline can be selected in the same render. */}
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <Select {...fieldAria("categoryId", errors.categoryId?.message)} {...field} value={field.value ?? ""}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value={NEW_CATEGORY}>+ Nueva categoría…</option>
                </Select>
              )}
            />
          </Field>
          <Field id="status" label="Estado" error={errors.status?.message}>
            <Select {...fieldAria("status", errors.status?.message)} {...form.register("status")}>
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PRODUCT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {categoryValue === NEW_CATEGORY && (
          <NewCategory
            onCancel={() => form.setValue("categoryId", "")}
            onCreated={(c) => {
              setCategories((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name, "es")));
              form.setValue("categoryId", c.id, { shouldDirty: true, shouldValidate: true });
            }}
          />
        )}
      </Section>

      <Section title="Compra" description="Te ayuda a encontrar el comprobante y a calcular tus gastos.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="purchaseDate" label="Fecha de compra" error={errors.purchaseDate?.message}>
            <Input
              {...fieldAria("purchaseDate", errors.purchaseDate?.message)}
              {...form.register("purchaseDate")}
              type="date"
              max={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <div className="grid gap-2">
            <label htmlFor="purchasePrice" className="text-sm font-medium leading-none">
              Precio
            </label>
            <div className="flex">
              <Select
                aria-label="Moneda"
                {...form.register("currency")}
                className="w-24 rounded-r-none border-r-0"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Input
                {...fieldAria("purchasePrice", errors.purchasePrice?.message)}
                {...form.register("purchasePrice")}
                inputMode="decimal"
                placeholder="0.00"
                className="rounded-l-none tabular-nums"
              />
            </div>
            {errors.purchasePrice ? (
              <p id="purchasePrice-error" role="alert" className="text-[13px] text-danger">
                {errors.purchasePrice.message}
              </p>
            ) : !priceValue ? (
              <p className="text-[13px] text-muted-foreground">Opcional.</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="seller" label="Tienda o vendedor" error={errors.seller?.message}>
            <Input {...fieldAria("seller", errors.seller?.message)} {...form.register("seller")} maxLength={160} />
          </Field>
          <Field id="serialNumber" label="Número de serie" error={errors.serialNumber?.message}>
            <Input
              {...fieldAria("serialNumber", errors.serialNumber?.message)}
              {...form.register("serialNumber")}
              className="font-mono text-[14px]"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={120}
            />
          </Field>
        </div>
      </Section>

      <Section title="Detalles">
        <Field id="description" label="Descripción" error={errors.description?.message}>
          <Textarea
            {...fieldAria("description", errors.description?.message)}
            {...form.register("description")}
            rows={3}
            maxLength={4000}
          />
        </Field>
        <Field id="notes" label="Notas" error={errors.notes?.message} hint="Solo tú las ves.">
          <Textarea {...fieldAria("notes", errors.notes?.message, true)} {...form.register("notes")} rows={3} maxLength={4000} />
        </Field>
      </Section>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-8 sm:flex-row sm:justify-end">
        <Button asChild variant="ghost">
          <Link href={mode === "edit" && productId ? `/app/products/${productId}` : "/app/products"}>Cancelar</Link>
        </Button>
        <Button type="submit" loading={pending} disabled={categoryValue === NEW_CATEGORY}>
          {mode === "create" ? "Guardar producto" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

function NewCategory({ onCreated, onCancel }: { onCreated: (c: Category) => void; onCancel: () => void }) {
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit() {
    const parsed = categoryInputSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Nombre no válido.");
      return;
    }
    startTransition(async () => {
      const res = await createCategory(parsed.data);
      if (!res.ok || !res.data) setError(res.fieldErrors?.name ?? res.message ?? "No pudimos crear la categoría.");
      else onCreated(res.data);
    });
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-surface p-4">
      <Field id="newCategory" label="Nombre de la nueva categoría" error={error ?? undefined}>
        <Input
          {...fieldAria("newCategory", error ?? undefined)}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={60}
          autoFocus
        />
      </Field>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={submit} loading={pending}>
          Crear categoría
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
