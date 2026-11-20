import { collectRefs, toSegments, type AnswerSegment } from "./answer";
import type { AssistantDataSource, RecordRef, ToolName } from "./contract";

export type ChatTurn = { role: "user" | "assistant"; text: string };

export type AskInput = {
  question: string;
  history: ChatTurn[];
  /** YYYY-MM-DD in the user's time zone. */
  today: string;
  timeZone: string;
  data: AssistantDataSource;
  signal?: AbortSignal;
};

/** What a provider returns: raw text plus every tool output it received. */
export type RawAnswer = { text: string; toolOutputs: unknown[]; toolsUsed: ToolName[] };

export interface AssistantModel {
  readonly id: string;
  readonly isTest: boolean;
  ask(input: AskInput): Promise<RawAnswer>;
}

export type AssistantAnswer = {
  segments: AnswerSegment[];
  refs: RecordRef[];
  toolsUsed: ToolName[];
  /** References the model wrote that were not backed by a tool result (removed). */
  droppedRefs: number;
  provider: string;
  isTest: boolean;
};

export class AssistantError extends Error {
  constructor(message: string, readonly reason: "provider_error" | "timeout" | "empty") {
    super(message);
    this.name = "AssistantError";
  }
}

/** Ask, then keep only links to records the tools actually returned. */
export async function askAssistant(model: AssistantModel, input: AskInput): Promise<AssistantAnswer> {
  let raw: RawAnswer;
  try {
    raw = await model.ask(input);
  } catch (e) {
    const aborted = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
    throw new AssistantError(e instanceof Error ? e.message : "provider error", aborted ? "timeout" : "provider_error");
  }
  const text = raw.text.trim();
  if (!text) throw new AssistantError("Empty answer", "empty");

  const allowed = collectRefs(raw.toolOutputs);
  const { segments, dropped } = toSegments(text, allowed);
  const used = new Set(segments.flatMap((s) => (s.kind === "ref" ? [`${s.ref.type}:${s.ref.id}`] : [])));
  return {
    segments,
    refs: [...allowed.values()].filter((r) => used.has(`${r.type}:${r.id}`)),
    toolsUsed: [...new Set(raw.toolsUsed)],
    droppedRefs: dropped,
    provider: model.id,
    isTest: model.isTest,
  };
}
