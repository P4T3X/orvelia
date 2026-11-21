"use client";

import { Bell, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { FeedbackButton } from "@/components/app/feedback-button";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { primaryNav, secondaryNav, type NavItem } from "./nav-items";

type ShellUser = { name: string; email: string };

function BellLink({ unread, pathname }: { unread: number; pathname: string }) {
  return (
    <Link
      href="/app/notifications"
      aria-label={unread > 0 ? `Avisos, ${unread} sin leer` : "Avisos"}
      aria-current={pathname === "/app/notifications" ? "page" : undefined}
      className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:text-foreground"
    >
      <Bell className="size-[18px]" aria-hidden strokeWidth={1.75} />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-[#111315]">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <ul className="grid gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-surface-raised font-medium text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon
                className={cn("size-4", active ? "text-accent-ink" : "text-muted-foreground group-hover:text-foreground")}
                aria-hidden
                strokeWidth={1.75}
              />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarContent({ user, pathname }: { user: ShellUser; pathname: string }) {
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Aplicación" className="flex-1 overflow-y-auto px-3">
        <NavList items={primaryNav} pathname={pathname} />
        <div className="my-4 h-px bg-border" />
        <NavList items={secondaryNav} pathname={pathname} />
        <FeedbackButton className="mt-0.5" />
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-[13px] font-medium"
          >
            {initials || "·"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-[12px] text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 px-2">
          <ThemeToggle />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
              <LogOut aria-hidden />
              Salir
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ user, unread, children }: { user: ShellUser; unread: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerFor, setDrawerFor] = React.useState<string | null>(null);
  const drawerOpen = drawerFor === pathname;

  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerFor(null);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center justify-between pl-6 pr-3">
          <Logo href="/app" />
          <BellLink unread={unread} pathname={pathname} />
        </div>
        <SidebarContent user={user} pathname={pathname} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
        <Logo href="/app" />
        <div className="flex items-center gap-1">
          <BellLink unread={unread} pathname={pathname} />
          <Button
          variant="ghost"
          size="icon"
          aria-label="Abrir menú"
          aria-expanded={drawerOpen}
          aria-controls="app-drawer"
          onClick={() => setDrawerFor(pathname)}
          >
            <Menu />
          </Button>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú" id="app-drawer">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-[#111315]/40 backdrop-blur-[2px]"
            onClick={() => setDrawerFor(null)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(20rem,86vw)] flex-col border-l border-border bg-surface">
            <div className="flex h-14 items-center justify-between px-4">
              <span className="text-sm text-muted-foreground">Menú</span>
              <Button variant="ghost" size="icon" aria-label="Cerrar menú" onClick={() => setDrawerFor(null)} autoFocus>
                <X />
              </Button>
            </div>
            <SidebarContent user={user} pathname={pathname} />
          </div>
        </div>
      )}

      <main id="main" className="min-w-0">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
