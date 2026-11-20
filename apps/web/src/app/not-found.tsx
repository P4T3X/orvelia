import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-5 py-8 sm:px-10">
      <Logo />
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center py-16">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.025em]">Esta página no existe.</h1>
        <p className="mt-3 text-muted-foreground">Puede que el enlace esté mal escrito o que la página se haya movido.</p>
        <div className="mt-8 flex gap-3">
          <Button asChild>
            <Link href="/">Ir al inicio</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/app">Mi espacio</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
