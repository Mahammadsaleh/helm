import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCheckpointPrompt } from "@/lib/ai/prompt";
import { analyze, chooseModel } from "@/lib/ai/provider";
import { loadCheckpoints } from "@/lib/data/checkpoints.server";
import { loadDay } from "@/lib/data/day.server";
import { guardOutput } from "@/lib/engine/guard";
import { sourceLookup } from "@/lib/engine/view";
import { EMPTY_USER_STATE, type UserState } from "@/lib/types";

const Body = z.object({
  checkpointId: z.string(),
  user: z.unknown().optional(),
});

export async function POST(req: Request) {
  const choice = chooseModel();
  if (!choice) {
    return NextResponse.json(
      { error: "No model configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env.local, then restart the dev server." },
      { status: 412 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Send { checkpointId, user }." }, { status: 400 });
  }

  const [day, checkpoints] = await Promise.all([loadDay(), loadCheckpoints()]);
  const index = checkpoints.findIndex((c) => c.id === parsed.data.checkpointId);
  if (index === -1) {
    return NextResponse.json({ error: `Unknown checkpoint ${parsed.data.checkpointId}.` }, { status: 404 });
  }

  const cp = checkpoints[index];
  const user = (parsed.data.user as UserState | undefined) ?? EMPTY_USER_STATE;
  const earlier = checkpoints.slice(0, index);
  const prompt = buildCheckpointPrompt({
    day,
    now: cp.at,
    user,
    previous: earlier.at(-1)?.output ?? null,
    previousChanges: earlier.flatMap((c) => c.output.planChanges),
    acceptedChangeIds: Object.entries(user.planChanges ?? {})
      .filter(([, v]) => v === "accepted")
      .map(([k]) => k),
  });

  try {
    const output = await analyze(prompt, choice);
    const guard = guardOutput(output, sourceLookup(day));
    const generatedAt = new Date().toISOString();
    if (process.env.HELM_WRITE_CACHE === "1") {
      await writeFile(
        path.join(process.cwd(), "data", "checkpoints", `${cp.id}.json`),
        JSON.stringify({ model: choice.label, generatedAt, output }, null, 2),
      );
    }
    return NextResponse.json({ output, guard, model: choice.label, generatedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `The model call failed: ${message}` }, { status: 502 });
  }
}
