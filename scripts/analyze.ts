/**
 * Regenerates every checkpoint with a live model, in order, and saves each to
 * data/checkpoints/<id>.json (which then replaces the bundled analysis).
 * Earlier recommendations are treated as accepted, matching the demo replay.
 *
 *   OPENAI_API_KEY=... pnpm analyze
 *   HELM_MODEL=anthropic:claude-sonnet-4-5 ANTHROPIC_API_KEY=... pnpm analyze 1316
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCheckpointPrompt } from "@/lib/ai/prompt";
import { analyze, chooseModel } from "@/lib/ai/provider";
import { loadDay } from "@/lib/data/day.server";
import { guardOutput } from "@/lib/engine/guard";
import { acceptEarlier, sourceLookup } from "@/lib/engine/view";
import { SEED_CHECKPOINTS } from "@/lib/seed/checkpoints";
import { EMPTY_USER_STATE, type Checkpoint } from "@/lib/types";

async function main() {
  const choice = chooseModel();
  if (!choice) {
    console.error("No model configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY (and optionally HELM_MODEL=provider:model).");
    process.exit(1);
  }

  const only = new Set(process.argv.slice(2));
  const day = await loadDay();
  const lookup = sourceLookup(day);
  const outDir = path.join(process.cwd(), "data", "checkpoints");
  await mkdir(outDir, { recursive: true });

  const done: Checkpoint[] = [];
  for (const seed of SEED_CHECKPOINTS) {
    if (only.size && !only.has(seed.id)) {
      done.push(seed);
      continue;
    }
    const user = acceptEarlier(EMPTY_USER_STATE, [...done, seed], seed.at);
    const prompt = buildCheckpointPrompt({
      day,
      now: seed.at,
      user,
      previous: done.at(-1)?.output ?? null,
      previousChanges: done.flatMap((c) => c.output.planChanges),
      acceptedChangeIds: Object.entries(user.planChanges)
        .filter(([, v]) => v === "accepted")
        .map(([k]) => k),
    });

    const started = Date.now();
    process.stdout.write(`${seed.at} ${seed.label}: `);
    const output = await analyze(prompt, choice);
    const generatedAt = new Date().toISOString();
    await writeFile(path.join(outDir, `${seed.id}.json`), JSON.stringify({ model: choice.label, generatedAt, output }, null, 2));

    const guard = guardOutput(output, lookup);
    console.log(
      `${output.decisions.length} decisions, ${output.planChanges.length} plan changes, ${output.facts.length} facts in ${Math.round((Date.now() - started) / 1000)}s` +
        (guard.length ? `. Unsupported figures: ${guard.map((g) => `${g.id} ${g.figures.join(" ")}`).join("; ")}` : ""),
    );
    done.push({ ...seed, output, generatedBy: "model", model: choice.label, generatedAt });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
