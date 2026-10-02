import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { generateText, Output, type LanguageModel } from "ai";
import { CheckpointOutputSchema, type CheckpointOutput } from "./schema";
import { SYSTEM_PROMPT } from "./prompt";

export interface ModelChoice {
  model: LanguageModel;
  label: string;
}

/**
 * HELM_MODEL picks the model as "provider:model-id", e.g. "openai:gpt-4.1" or
 * "anthropic:claude-sonnet-4-5". Without it, the first provider with a key wins.
 */
export function chooseModel(): ModelChoice | null {
  const configured = process.env.HELM_MODEL;
  if (configured) {
    const [provider, ...rest] = configured.split(":");
    const id = rest.join(":");
    if (provider === "openai" && process.env.OPENAI_API_KEY) return { model: openai(id), label: configured };
    if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) return { model: anthropic(id), label: configured };
    return null;
  }
  if (process.env.OPENAI_API_KEY) return { model: openai("gpt-4.1"), label: "openai:gpt-4.1" };
  if (process.env.ANTHROPIC_API_KEY) return { model: anthropic("claude-sonnet-4-5"), label: "anthropic:claude-sonnet-4-5" };
  return null;
}

export async function analyze(prompt: string, choice: ModelChoice): Promise<CheckpointOutput> {
  const { output } = await generateText({
    model: choice.model,
    system: SYSTEM_PROMPT,
    prompt,
    output: Output.object({ schema: CheckpointOutputSchema }),
    temperature: 0.2,
    maxRetries: 1,
  });
  return CheckpointOutputSchema.parse(output);
}
