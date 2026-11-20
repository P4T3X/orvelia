"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/features", label: "Funciones" },
  { href: "/pricing", label: "Planes" },
  { href: "/about", label: "Nosotros" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [openFor, setOpenFor] = React.useState<string | null>(null);
  // Closing on navigation: the menu is only open for the path it was opened on.
  const open = openFor === pathname;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />

        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Button asChild size="sm">
              <Link href="/app">Ir a mi espacio</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Iniciar sesión</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Crear cuenta</Link>
              </Button>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpenFor(open ? null : pathname)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      <div
        id="mobile-nav"
        hidden={!open}
        className={cn("border-t border-border bg-background px-5 pb-6 pt-2 md:hidden")}
      >
        <nav aria-label="Principal móvil" className="grid">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="border-b border-border py-3.5 text-[15px]">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-5 grid gap-2">
          {signedIn ? (
            <Button asChild>
              <Link href="/app">Ir a mi espacio</Link>
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link href="/register">Crear cuenta</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/login">Iniciar sesión</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
