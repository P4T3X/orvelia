import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,0.85fr)]">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Logo />
        <main className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-12">
          {!configured && (
            <Alert tone="info" title="Supabase no está configurado" className="mb-8">
              Copia <code className="font-mono text-[12px]">.env.example</code> a{" "}
              <code className="font-mono text-[12px]">apps/web/.env.local</code> y agrega las claves de tu proyecto para
              activar el acceso.
            </Alert>
          )}
          {children}
        </main>
        <p className="text-[13px] text-muted-foreground">
          Al continuar aceptas los <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">Términos</Link> y la{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">Política de privacidad</Link>.
        </p>
      </div>

      <aside
        aria-hidden
        className="relative hidden overflow-hidden bg-[#111315] text-[#F6F4EF] lg:flex lg:flex-col lg:justify-end lg:p-14"
      >
        <LogoMark className="absolute -right-24 -top-24 size-[34rem] text-[#F6F4EF] opacity-[0.07]" />
        <p className="relative max-w-sm text-[2rem] font-medium leading-[1.12] tracking-[-0.03em]">
          Todo lo que posees. Un solo espacio inteligente.
        </p>
        <p className="relative mt-4 max-w-xs text-[#B7BBC0]">
          Comprobantes, garantías y plazos, siempre a la mano.
        </p>
      </aside>
    </div>
  );
}
