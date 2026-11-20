"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <Alert tone="error" title="No pudimos cargar esta sección.">
        Revisa tu conexión e inténtalo de nuevo. Si el problema continúa, comparte este código con soporte:{" "}
        <code className="font-mono text-[12px]">{error.digest ?? "sin código"}</code>
      </Alert>
      <Button className="mt-6" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
