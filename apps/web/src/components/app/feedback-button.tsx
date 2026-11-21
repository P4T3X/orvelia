"use client";

import { feedbackSchema } from "@orvelia/schemas";
import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { sendFeedback } from "@/app/app/feedback-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { useActionForm } from "@/lib/use-action-form";
import { cn } from "@/lib/utils";

const KINDS = [
  { value: "problem", label: "Algo no funciona" },
  { value: "idea", label: "Una idea" },
  { value: "other", label: "Otro" },
] as const;

export function FeedbackButton({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { form, onSubmit, pending, result } = useActionForm(
    feedbackSchema,
    { kind: "problem", message: "" },
    async (v) => {
      const res = await sendFeedback({ ...v, page: pathname });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
      }
      return res;
    },
  );
  const { errors } = form.formState;
  const kind = form.watch("kind");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          form.reset({ kind: "problem", message: "" });
          setOpen(true);
        }}
        className={cn(
          "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          className,
        )}
      >
        <MessageSquare className="size-4 text-muted-foreground group-hover:text-foreground" aria-hidden strokeWidth={1.75} />
        Enviar comentarios
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Enviar comentarios"
        description="ORVELIA está en beta. Cuéntanos qué falla o qué te gustaría tener."
      >
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          {result && !result.ok && !result.fieldErrors && <Alert tone="error" title={result.message} />}
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Tipo</legend>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <label
                  key={k.value}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                    kind === k.value ? "border-foreground bg-foreground text-background" : "border-border-strong hover:bg-muted",
                  )}
                >
                  <input type="radio" value={k.value} className="sr-only" {...form.register("kind")} />
                  {k.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Field id="feedback-message" label="Mensaje" error={errors.message?.message}>
            <Textarea
              {...fieldAria("feedback-message", errors.message?.message)}
              {...form.register("message")}
              rows={5}
              maxLength={2000}
              placeholder={kind === "problem" ? "Qué hiciste, qué esperabas y qué pasó." : "Cuéntanos tu idea."}
            />
          </Field>
          <p className="-mt-2 text-[13px] text-muted-foreground">Incluimos la página en la que estás para ubicar el problema.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Enviar
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
