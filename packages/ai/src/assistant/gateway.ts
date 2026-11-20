import { generateText, isStepCount, tool, type ModelMessage } from "ai";
import { ASSISTANT_INSTRUCTIONS } from "./answer";
import type { AskInput, AssistantModel, RawAnswer } from "./assistant";
import { toolDescriptions, toolInputs, type ToolName } from "./contract";

/**
 * Assistant backed by the AI SDK with tool calling. A "provider/model" string
 * resolves through the Vercel AI Gateway, so the provider is configuration.
 */
export function createGatewayAssistant(modelId: string, timeoutMs = 45_000): AssistantModel {
  return {
    id: `gateway:${modelId}`,
    isTest: false,
    async ask({ question, history, today, timeZone, data, signal }: AskInput): Promise<RawAnswer> {
      const toolOutputs: unknown[] = [];
      const toolsUsed: ToolName[] = [];

      const make = <K extends ToolName>(name: K) =>
        tool({
          description: toolDescriptions[name],
          inputSchema: toolInputs[name],
          execute: async (input: unknown) => {
            const parsed = toolInputs[name].parse(input);
            const out = await (data[name] as (i: unknown) => Promise<unknown>)(parsed);
            toolOutputs.push(out);
            toolsUsed.push(name);
            return out;
          },
        });

      const tools = Object.fromEntries((Object.keys(toolInputs) as ToolName[]).map((n) => [n, make(n)]));

      const messages: ModelMessage[] = [
        ...history.map((t) => ({ role: t.role, content: t.text }) as ModelMessage),
        { role: "user", content: question },
      ];

      const { text } = await generateText({
        model: modelId,
        instructions: `${ASSISTANT_INSTRUCTIONS}\n\nToday is ${today} (time zone ${timeZone}).`,
        messages,
        tools,
        stopWhen: isStepCount(6),
        temperature: 0,
        timeout: timeoutMs,
        abortSignal: signal,
      });

      return { text, toolOutputs, toolsUsed };
    },
  };
}
