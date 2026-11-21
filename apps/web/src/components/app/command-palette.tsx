"use client";

import {
  ArrowRight,
  Bot,
  CalendarPlus,
  FilePlus2,
  FileText,
  Moon,
  Package,
  PackagePlus,
  Receipt,
  ScanLine,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { searchRecords, type SearchHit } from "@/app/app/search-actions";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { primaryNav, secondaryNav } from "./nav-items";

type Command = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
};

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const HIT_ICON: Record<SearchHit["type"], LucideIcon> = { product: Package, document: FileText, receipt: Receipt };
const HIT_GROUP: Record<SearchHit["type"], string> = { product: "Productos", document: "Documentos", receipt: "Comprobantes" };

const noopSubscribe = () => () => {};
const paletteEl = () => document.querySelector<HTMLDialogElement>("dialog.palette");

/** Open the palette. The native <dialog> is the single source of truth for open/closed. */
export function openCommandPalette() {
  const d = paletteEl();
  if (!d || d.open) return;
  d.showModal();
  d.querySelector("input")?.focus();
}

export function closeCommandPalette() {
  paletteEl()?.close();
}

/** ⌘K / Ctrl+K toggles the palette anywhere in the app; "/" opens it when not typing. */
export function useCommandPaletteShortcuts() {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        !e.target.closest("dialog:not([open])") &&
        (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const d = paletteEl();
        if (d?.open) d.close();
        else openCommandPalette();
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openCommandPalette();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

export function CommandPalette() {
  const router = useRouter();
  const { resolvedTheme: theme, setTheme } = useTheme();
  // The theme is unknown on the server; pick the label after hydration.
  const hydrated = React.useSyncExternalStore(noopSubscribe, () => true, () => false);
  const resolvedTheme = hydrated ? theme : undefined;
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<{ for: string; hits: SearchHit[] }>({ for: "", hits: [] });
  const [activeRaw, setActive] = React.useState(0);
  const q = query.trim();
  const hits = React.useMemo(() => (q.length >= 2 && results.for === q ? results.hits : []), [q, results]);
  const searching = q.length >= 2 && results.for !== q;
  const listId = React.useId();

  const close = closeCommandPalette;
  // Runs for every way of closing (Esc, backdrop, action, shortcut).
  const onClosed = () => {
    setQuery("");
    setActive(0);
  };

  // Debounced server search for records.
  React.useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await searchRecords(q).catch(() => []);
      if (!cancelled) setResults({ for: q, hits: res });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const go = React.useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const commands = React.useMemo<Command[]>(() => {
    const actions: Command[] = [
      { id: "new-product", group: "Acciones", label: "Agregar producto", icon: PackagePlus, keywords: "nuevo crear", run: () => go("/app/products/new") },
      { id: "scan", group: "Acciones", label: "Escanear comprobante", icon: ScanLine, keywords: "boleta factura subir", run: () => go("/app/scanner") },
      { id: "new-doc", group: "Acciones", label: "Subir documento", icon: FilePlus2, keywords: "manual certificado poliza", run: () => go("/app/documents/new") },
      { id: "reminder", group: "Acciones", label: "Ver calendario y recordatorios", icon: CalendarPlus, keywords: "fecha aviso", run: () => go("/app/calendar") },
      {
        id: "theme",
        group: "Acciones",
        label: resolvedTheme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro",
        icon: Moon,
        keywords: "modo oscuro claro tema apariencia",
        run: () => {
          setTheme(resolvedTheme === "dark" ? "light" : "dark");
          close();
        },
      },
    ];
    const nav: Command[] = [...primaryNav, ...secondaryNav].map((n) => ({
      id: `nav-${n.href}`,
      group: "Ir a",
      label: n.label,
      icon: n.icon,
      run: () => go(n.href),
    }));
    const f = fold(q);
    const matches = (c: Command) => !f || fold(`${c.label} ${c.keywords ?? ""}`).includes(f);
    const records: Command[] = hits.map((h) => ({
      id: `${h.type}-${h.id}`,
      group: HIT_GROUP[h.type],
      label: h.title,
      hint: h.detail ?? undefined,
      icon: HIT_ICON[h.type],
      run: () => go(h.href),
    }));
    const ask: Command[] =
      q.length >= 3
        ? [{ id: "ask", group: "ORVELIA AI", label: `Preguntar: “${q}”`, icon: Bot, run: () => go(`/app/assistant?q=${encodeURIComponent(q)}`) }]
        : [];
    return [...records, ...actions.filter(matches), ...nav.filter(matches), ...ask];
  }, [q, hits, go, resolvedTheme, setTheme, close]);
  const active = Math.min(activeRaw, Math.max(0, commands.length - 1));
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(commands.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commands[active]?.run();
    }
  };

  let lastGroup = "";
  return (
    <dialog
      ref={dialogRef}
      aria-label="Buscar y ejecutar acciones"
      onClose={onClosed}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="palette m-0 mx-auto mt-[12vh] w-[min(36rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-xl border border-border-strong bg-surface-raised p-0 text-foreground shadow-[0_24px_64px_-24px_rgba(17,19,21,0.45)] backdrop:bg-[#111315]/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={commands[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          aria-label="Buscar productos, documentos, comprobantes o acciones"
          placeholder="Busca o escribe una acción…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          maxLength={80}
          className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
        {searching && <span className="size-3.5 animate-spin rounded-full border-2 border-border-strong border-t-accent" aria-hidden />}
        <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground sm:inline">Esc</kbd>
      </div>
      <ul ref={listRef} id={listId} role="listbox" aria-label="Resultados" className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
        {commands.length === 0 && !searching && (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">Sin resultados para “{query}”.</li>
        )}
        {commands.map((c, i) => {
          const header = c.group !== lastGroup ? c.group : null;
          lastGroup = c.group;
          const Icon = c.icon;
          return (
            <React.Fragment key={c.id}>
              {header && (
                <li role="presentation" className="px-3 pb-1 pt-3 text-[12px] text-muted-foreground first:pt-1">
                  {header}
                </li>
              )}
              <li
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                data-index={i}
                onMouseMove={() => setActive(i)}
                onClick={() => c.run()}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-[15px]",
                  i === active ? "bg-muted text-foreground" : "text-foreground/90",
                )}
              >
                <Icon className={cn("size-4 shrink-0", i === active ? "text-accent-ink" : "text-muted-foreground")} aria-hidden strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate">
                  {c.label}
                  {c.hint && <span className="ml-2 text-[13px] text-muted-foreground">{c.hint}</span>}
                </span>
                {i === active && <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              </li>
            </React.Fragment>
          );
        })}
      </ul>
      <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
        <span>
          <kbd className="font-sans">↑↓</kbd> moverse
        </span>
        <span>
          <kbd className="font-sans">Enter</kbd> abrir
        </span>
        <span className="ml-auto hidden sm:inline">Solo busca en tus registros</span>
      </div>
    </dialog>
  );
}
