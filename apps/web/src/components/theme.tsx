"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import * as React from "react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <ThemedToaster />
    </NextThemesProvider>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-md !border-border !bg-surface-raised !text-foreground !font-sans",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}

const options = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

const subscribe = () => () => {};

/** Segmented control: light / dark / system. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // Theme is unknown during SSR; render neutral until hydrated.
  const mounted = React.useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn("inline-flex rounded-md border border-border p-0.5", className)}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-[5px] text-muted-foreground transition-colors",
              active ? "bg-muted text-foreground" : "hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
