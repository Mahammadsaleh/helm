import { describe, expect, it } from "vitest";
import { CheckpointOutputSchema } from "@/lib/ai/schema";
import { buildDay } from "@/lib/data/day";
import { guardOutput } from "@/lib/engine/guard";
import { sourceLookup } from "@/lib/engine/view";
import { SEED_CHECKPOINTS } from "@/lib/seed/checkpoints";
import { toMin } from "@/lib/time";

const day = buildDay();
const lookup = sourceLookup(day);
const itemAt = new Map(day.items.map((i) => [i.id, i.at]));
const eventIds = new Set(day.events.map((e) => e.id));

function allSourceIds(o: ReturnType<typeof CheckpointOutputSchema.parse>): string[] {
  return [
    ...o.decisions.flatMap((d) => d.sourceIds),
    ...o.delegations.flatMap((d) => d.sourceIds),
    ...o.planChanges.flatMap((d) => d.sourceIds),
    ...o.briefs.flatMap((d) => d.sourceIds),
    ...o.facts.flatMap((d) => d.sourceIds),
    ...o.alerts.flatMap((d) => d.sourceIds),
    ...o.deadlines.flatMap((d) => d.sourceIds),
    ...(o.callKit?.sourceIds ?? []),
  ];
}

/** Seeds stand in for model output, so they get the same checks live output gets. */
describe.each(SEED_CHECKPOINTS.map((c) => [c.id, c] as const))("checkpoint %s", (_, cp) => {
  it("matches the output schema", () => {
    expect(() => CheckpointOutputSchema.parse(cp.output)).not.toThrow();
  });

  it("cites only sources that exist", () => {
    const missing = allSourceIds(cp.output).filter((id) => !lookup(id));
    expect(missing).toEqual([]);
  });

  it("cites nothing from the future", () => {
    const future = allSourceIds(cp.output).filter(
      (id) => !eventIds.has(id) && toMin(itemAt.get(id)!) > toMin(cp.at),
    );
    expect(future).toEqual([]);
  });

  it("only uses figures found in its cited sources", () => {
    expect(guardOutput(cp.output, lookup)).toEqual([]);
  });

  it("triages only visible items", () => {
    const late = cp.output.triage.filter((t) => toMin(itemAt.get(t.itemId)!) > toMin(cp.at));
    expect(late).toEqual([]);
  });

  it("recommends one of its own options", () => {
    for (const d of cp.output.decisions) {
      expect(d.options.map((o) => o.id)).toContain(d.recommendedOptionId);
    }
  });

  it("uses no em dashes in generated copy", () => {
    const { callKit, ...rest } = cp.output;
    expect(JSON.stringify(rest)).not.toMatch(/\u2014/);
    expect(JSON.stringify(callKit)).not.toMatch(/\u2014/);
  });
});
