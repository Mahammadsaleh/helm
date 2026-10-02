import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CheckpointOutputSchema } from "@/lib/ai/schema";
import { SEED_CHECKPOINTS } from "@/lib/seed/checkpoints";
import type { Checkpoint } from "@/lib/types";

/**
 * Seeds are the hand-written analysis that ships with the repo. Live model
 * output saved to data/checkpoints/<id>.json replaces the seed for that id.
 */
export async function loadCheckpoints(): Promise<Checkpoint[]> {
  return Promise.all(
    SEED_CHECKPOINTS.map(async (seed) => {
      try {
        const raw = JSON.parse(
          await readFile(path.join(process.cwd(), "data", "checkpoints", `${seed.id}.json`), "utf8"),
        );
        return {
          ...seed,
          output: CheckpointOutputSchema.parse(raw.output),
          generatedBy: "model" as const,
          model: raw.model,
          generatedAt: raw.generatedAt,
        };
      } catch {
        return seed;
      }
    }),
  );
}
