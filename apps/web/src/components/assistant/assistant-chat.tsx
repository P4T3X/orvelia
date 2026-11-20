"use client";

import type { AnswerSegment, RecordRef } from "@orvelia/ai/assistant-client";
import { ArrowUp, FileText, Package, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { askOrvelia } from "@/app/app/assistant/actions";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; segments: AnswerSegment[]; isTest: boolean }
  | { id: string; role: "error"; text: string };

const SUGGESTIONS = [
  "¿Qué garantías tengo activas?",
  "¿Qué vence en los próximos días?",
  "¿Cuánto gasté en electrónica?",
  "¿Qué productos no tienen comprobante?",
  "Muéstrame mis compras más recientes",
  "¿Qué mantenimientos tengo programados?",
];

const hrefFor = (r: RecordRef) =>
  r.type === "product" ? `/app/products/${r.id}` : r.type === "receipt" ? `/app/scanner/${r.id}` : `/app/files/document/${r.id}`;
const IconFor = { product: Package, receipt: Receipt, document: FileText } as const;

/** Inline **bold** only; everything else is plain text (no HTML from the model). */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-medium">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

function RefChip({ r }: { r: RecordRef }) {
  const Icon = IconFor[r.type];
  const external = r.type === "document";
  return (
    <Link
      href={hrefFor(r)}
      target={external ? "_blank" : undefined}
      className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border border-border-strong bg-surface px-1.5 py-px align-baseline text-[0.95em] font-medium hover:border-accent hover:bg-accent/5"
    >
      <Icon className="size-3.5 shrink-0 text-accent-ink" aria-hidden />
      <span className="truncate">{r.label}</span>
    </Link>
  );
}

/** Render segments as paragraphs and bullet lists, splitting on newlines. */
function AnswerBody({ segments }: { segments: AnswerSegment[] }) {
  const lines: AnswerSegment[][] = [[]];
  for (const s of segments) {
    if (s.kind === "ref") {
      lines[lines.length - 1]!.push(s);
      continue;
    }
    const chunks = s.text.split("\n");
    chunks.forEach((c, i) => {
      if (i > 0) lines.push([]);
      if (c) lines[lines.length - 1]!.push({ kind: "text", text: c });
    });
  }

  const blocks: { list: boolean; items: AnswerSegment[][] }[] = [];
  for (const line of lines) {
    if (line.length === 0) continue;
    const first = line[0]!;
    const isItem = first.kind === "text" && /^\s*[-•*]\s+/.test(first.text);
    const cleaned = isItem ? [{ kind: "text" as const, text: (first as { text: string }).text.replace(/^\s*[-•*]\s+/, "") }, ...line.slice(1)] : line;
    const lastBlock = blocks[blocks.length - 1];
    if (isItem && lastBlock?.list) lastBlock.items.push(cleaned);
    else blocks.push({ list: isItem, items: [cleaned] });
  }

  const render = (segs: AnswerSegment[]) =>
    segs.map((s, i) => (s.kind === "text" ? <Inline key={i} text={s.text} /> : <RefChip key={i} r={s.ref} />));

  return (
    <div className="grid gap-2.5 leading-relaxed">
      {blocks.map((b, i) =>
        b.list ? (
          <ul key={i} className="grid gap-1.5 pl-1">
            {b.items.map((item, j) => (
              <li key={j} className="flex gap-2.5">
                <span aria-hidden className="mt-[0.7em] size-1 shrink-0 rounded-full bg-muted-foreground" />
                <span>{render(item)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{render(b.items[0]!)}</p>
        ),
      )}
    </div>
  );
}

export function AssistantChat({ disabledReason }: { disabledReason?: string }) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [draft, setDraft] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const endRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  function send(question: string) {
    const q = question.trim();
    if (!q || pending || disabledReason) return;
    const history = messages.flatMap((m): { role: "user" | "assistant"; text: string }[] =>
      m.role === "user"
        ? [{ role: "user" as const, text: m.text }]
        : m.role === "assistant"
          ? [{ role: "assistant" as const, text: m.segments.map((s) => (s.kind === "text" ? s.text : s.ref.label)).join("") }]
          : [],
    );
    setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: "user", text: q }]);
    setDraft("");
    startTransition(async () => {
      const res = await askOrvelia({ question: q, history });
      setMessages((ms) => [
        ...ms,
        res.ok && res.data
          ? { id: crypto.randomUUID(), role: "assistant", segments: res.data.segments, isTest: res.data.isTest }
          : { id: crypto.randomUUID(), role: "error", text: res.message ?? "No pudimos responder ahora." },
      ]);
      inputRef.current?.focus();
      // Refresh the server-rendered usage counter; client state (the conversation) is kept.
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
      <div className="flex-1" aria-live="polite">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl py-8 text-center sm:py-14">
            <LogoMark className="mx-auto size-10" />
            <h2 className="mt-5 text-2xl font-medium tracking-[-0.02em]">¿Qué quieres saber de lo que posees?</h2>
            <p className="mt-2 text-muted-foreground">Respondo solo con lo que registraste en ORVELIA y te enlazo cada registro.</p>
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={Boolean(disabledReason) || pending}
                  onClick={() => send(s)}
                  className="rounded-xl border border-border bg-surface-raised px-4 py-3 text-left text-[15px] transition-colors hover:border-border-strong hover:bg-muted disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="mx-auto grid max-w-3xl gap-6 pb-6">
            {messages.map((m) => (
              <li key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "user" ? (
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground">{m.text}</p>
                ) : m.role === "assistant" ? (
                  <div className="flex max-w-[92%] gap-3">
                    <LogoMark className="mt-0.5 size-6 shrink-0" />
                    <div className="min-w-0">
                      <AnswerBody segments={m.segments} />
                      {m.isTest && <p className="mt-2 text-[12px] text-muted-foreground">Respuesta del asistente de prueba (entorno de desarrollo).</p>}
                    </div>
                  </div>
                ) : (
                  <p role="alert" className="max-w-[92%] rounded-xl border border-danger/30 bg-danger-surface px-4 py-3 text-sm">
                    {m.text}
                  </p>
                )}
              </li>
            ))}
            {pending && (
              <li className="flex gap-3" role="status">
                <LogoMark className="size-6 shrink-0 animate-pulse" />
                <span className="text-muted-foreground">Revisando tus registros…</span>
              </li>
            )}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="sticky bottom-0 mx-auto w-full max-w-3xl bg-background/90 pb-2 pt-3 backdrop-blur-md"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-border-strong bg-surface-raised p-2 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20">
          <label htmlFor="question" className="sr-only">
            Tu pregunta
          </label>
          <textarea
            ref={inputRef}
            id="question"
            rows={1}
            value={draft}
            maxLength={500}
            disabled={Boolean(disabledReason)}
            placeholder={disabledReason ?? "Escribe tu pregunta…"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!draft.trim() || pending || Boolean(disabledReason)}
            aria-label="Enviar pregunta"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-center text-[12px] text-muted-foreground">
          ORVELIA AI usa solo tus registros. Confirma fechas importantes en el documento original.
        </p>
      </form>
    </div>
  );
}
