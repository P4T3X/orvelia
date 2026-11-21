"use client";

import { PRODUCT_STATUSES, PRODUCT_STATUS_LABELS, type ProductStatus } from "@orvelia/domain";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { deleteProduct, updateProductStatus } from "@/app/app/products/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/input";

export function ProductActions({ id, name, status }: { id: string; name: string; status: ProductStatus }) {
  const router = useRouter();
  const [statusPending, startStatus] = React.useTransition();
  const [deletePending, startDelete] = React.useTransition();
  const [current, setCurrent] = React.useState(status);

  function changeStatus(next: ProductStatus) {
    const previous = current;
    setCurrent(next);
    startStatus(async () => {
      const res = await updateProductStatus({ id, status: next });
      if (!res.ok) {
        setCurrent(previous);
        toast.error(res.message);
      } else {
        toast.success(
          next === "archived"
            ? "Producto archivado. Lo encuentras en el filtro Archivados."
            : previous === "archived" && next === "active"
              ? "Producto restaurado."
              : `Marcado como ${PRODUCT_STATUS_LABELS[next].toLowerCase()}.`,
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Cambiar estado"
        value={current}
        disabled={statusPending}
        onChange={(e) => changeStatus(e.target.value as ProductStatus)}
        className="h-10 w-40"
      >
        {PRODUCT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PRODUCT_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      {current === "archived" ? (
        <Button variant="secondary" onClick={() => changeStatus("active")} disabled={statusPending}>
          <ArchiveRestore aria-hidden />
          Restaurar
        </Button>
      ) : (
        <Button variant="ghost" onClick={() => changeStatus("archived")} disabled={statusPending}>
          <Archive aria-hidden />
          Archivar
        </Button>
      )}
      <Button asChild variant="secondary">
        <Link href={`/app/products/${id}/edit`}>
          <Pencil aria-hidden />
          Editar
        </Link>
      </Button>
      <ConfirmDialog
        title="¿Eliminar este producto?"
        description={
          <>
            Se eliminarán <span className="font-medium text-foreground">{name}</span>, su foto, sus garantías y sus
            plazos de devolución. Los comprobantes y documentos se conservan. Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Eliminar producto"
        pending={deletePending}
        onConfirm={() =>
          startDelete(async () => {
            const res = await deleteProduct(id);
            if (res && !res.ok) toast.error(res.message);
          })
        }
        trigger={(open) => (
          <Button variant="ghost" onClick={open} aria-label="Eliminar producto">
            <Trash2 aria-hidden />
            <span className="sm:hidden lg:inline">Eliminar</span>
          </Button>
        )}
      />
    </div>
  );
}
