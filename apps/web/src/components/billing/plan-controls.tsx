"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { cancelSubscription, startCheckout, syncCheckout } from "@/app/app/billing/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function SubscribeButton({
  plan,
  label,
  variant = "primary",
  disabled,
}: {
  plan: "plus" | "ultra";
  label: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      size="lg"
      variant={variant}
      className="w-full"
      loading={pending}
      disabled={disabled}
      onClick={() =>
        startTransition(async () => {
          const res = await startCheckout(plan);
          if (!res.ok || !res.data) toast.error(res.message);
          // Mercado Pago's hosted checkout (card, Yape or Mercado Pago balance).
          else window.location.assign(res.data.url);
        })
      }
    >
      {label}
    </Button>
  );
}

export function CancelSubscription({ until }: { until: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <ConfirmDialog
      title="¿Cancelar tu suscripción?"
      description={
        <>
          No se te volverá a cobrar. Conservas todos los beneficios{until ? ` hasta el ${until}` : " hasta el fin del periodo pagado"};
          después tu cuenta pasa al plan Free. Tus datos se conservan.
        </>
      }
      confirmLabel="Cancelar suscripción"
      pending={pending}
      onConfirm={() =>
        startTransition(async () => {
          const res = await cancelSubscription();
          if (!res.ok) toast.error(res.message);
          else {
            toast.success(res.message);
            router.refresh();
          }
        })
      }
      trigger={(open) => (
        <Button variant="ghost" onClick={open}>
          Cancelar suscripción
        </Button>
      )}
    />
  );
}

/** Shown after returning from Mercado Pago: confirms the result with the API, then refreshes. */
export function CheckoutReturn({ checkoutId }: { checkoutId: string }) {
  const router = useRouter();
  const started = React.useRef(false);
  const [state, setState] = React.useState<{ kind: "checking" | "ok" | "pending" | "error"; text?: string }>({ kind: "checking" });

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    let tries = 0;
    const check = async () => {
      tries++;
      const res = await syncCheckout(checkoutId);
      if (!res.ok) return setState({ kind: "error", text: res.message });
      if (res.data?.status === "authorized") {
        setState({ kind: "ok", text: `Tu plan ${res.data.plan === "ultra" ? "Ultra" : "Plus"} está activo.` });
        // Refresh server data in place; the URL keeps ?checkout so this message stays (re-checking is idempotent).
        router.refresh();
      } else if (res.data?.status === "cancelled") {
        setState({ kind: "error", text: "El pago no se completó. No se realizó ningún cobro." });
      } else if (tries < 10) {
        setState({ kind: "pending" });
        setTimeout(check, 3000);
      } else {
        setState({ kind: "pending", text: "Mercado Pago aún está procesando tu pago. Te avisaremos cuando se confirme." });
      }
    };
    void check();
  }, [checkoutId, router]);

  if (state.kind === "ok") {
    return (
      <div role="status" className="mb-6 flex items-center gap-3 rounded-xl border border-success/30 bg-success/8 px-5 py-4">
        <CheckCircle2 className="size-5 text-success" aria-hidden />
        <p className="font-medium">¡Listo! {state.text}</p>
      </div>
    );
  }
  if (state.kind === "error") return <Alert tone="error" title={state.text} className="mb-6" />;
  return (
    <div role="status" className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-4">
      <Loader2 className="size-5 animate-spin text-accent-ink" aria-hidden />
      <p>{state.text ?? "Confirmando tu pago con Mercado Pago…"}</p>
    </div>
  );
}
