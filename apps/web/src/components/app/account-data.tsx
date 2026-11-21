"use client";

import { Download, Trash2 } from "lucide-react";
import * as React from "react";
import { deleteAccount } from "@/app/app/settings/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ExportData() {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Un archivo JSON con tu perfil, productos, comprobantes, documentos, garantías, recordatorios, avisos y tu plan.
      </p>
      <div>
        <Button asChild variant="secondary">
          <a href="/app/settings/export" download>
            <Download aria-hidden />
            Descargar mis datos
          </a>
        </Button>
      </div>
    </div>
  );
}

export function DeleteAccount({ email, ownsFamily }: { email: string; ownsFamily: boolean }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="text-danger">
        <Trash2 aria-hidden />
        Eliminar mi cuenta
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onCancel={(e) => pending && e.preventDefault()}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface-raised p-0 text-foreground backdrop:bg-[#111315]/45 backdrop:backdrop-blur-[2px]"
      >
        <form
          className="grid gap-5 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setFieldError(null);
            start(async () => {
              const res = await deleteAccount({ email: typed });
              if (res && !res.ok) {
                if (res.fieldErrors?.email) setFieldError(res.fieldErrors.email);
                else setError(res.message ?? "No pudimos eliminar tu cuenta.");
              }
            });
          }}
        >
          <div>
            <h2 id={titleId} className="text-lg font-medium">
              ¿Eliminar tu cuenta?
            </h2>
            <div className="mt-2 grid gap-2 leading-relaxed text-muted-foreground">
              <p>
                Se borrarán para siempre tu perfil, productos, comprobantes, documentos, archivos y recordatorios. Si
                tienes una suscripción, se cancelará.
              </p>
              {ownsFamily && <p className="text-foreground">Eres titular de una familia: también se eliminará para todos sus miembros.</p>}
              <p>Si quieres guardar una copia, descarga tus datos antes.</p>
            </div>
          </div>
          {error && <Alert tone="error" title={error} />}
          <Field id="confirm-email" label={`Escribe ${email} para confirmar`} error={fieldError ?? undefined}>
            <Input
              {...fieldAria("confirm-email", fieldError ?? undefined)}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              inputMode="email"
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending} autoFocus>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" loading={pending} disabled={!matches}>
              Eliminar cuenta
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
