"use client";

import { categoryInputSchema } from "@orvelia/schemas";
import { Tag, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { createCategory, deleteCategory } from "@/app/app/products/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";

type Category = { id: string; name: string };

export function CategoriesManager({ own, systemCount }: { own: Category[]; systemCount: number }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [deleting, setDeleting] = React.useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = categoryInputSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Nombre no válido.");
      return;
    }
    startTransition(async () => {
      const res = await createCategory(parsed.data);
      if (!res.ok) setError(res.fieldErrors?.name ?? res.message ?? "No pudimos crear la categoría.");
      else {
        setName("");
        setError(null);
        toast.success(res.message);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setDeleting(id);
    startTransition(async () => {
      const res = await deleteCategory(id);
      setDeleting(null);
      if (!res.ok) toast.error(res.message);
      else {
        toast.success(res.message);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        Tienes {systemCount} categorías del sistema disponibles. Agrega las tuyas para organizar mejor.
      </p>

      {own.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {own.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-1.5 pl-4 pr-1.5">
              <span className="flex items-center gap-2.5 text-[15px]">
                <Tag className="size-4 text-muted-foreground" aria-hidden strokeWidth={1.75} />
                {c.name}
              </span>
              <ConfirmDialog
                title={`¿Eliminar "${c.name}"?`}
                description="Los productos de esta categoría se conservan y quedarán sin categoría."
                confirmLabel="Eliminar categoría"
                pending={deleting === c.id}
                onConfirm={() => remove(c.id)}
                trigger={(open) => (
                  <Button variant="ghost" size="icon" onClick={open} aria-label={`Eliminar categoría ${c.name}`}>
                    <Trash2 aria-hidden />
                  </Button>
                )}
              />
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} noValidate className="grid gap-2">
        <label htmlFor="category-name" className="text-sm font-medium">
          Nueva categoría
        </label>
        <div className="flex gap-2">
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Ej. Instrumentos musicales"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "category-name-error" : undefined}
          />
          <Button type="submit" variant="secondary" loading={pending && !deleting}>
            Agregar
          </Button>
        </div>
        {error && (
          <p id="category-name-error" role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
