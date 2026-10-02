import { describe, expect, it } from "vitest";
import type { PlanChange } from "@/lib/ai/schema";
import { buildDay } from "@/lib/data/day";
import { feasibility, findOverlaps, freeMinutes, nextFreeSlot } from "@/lib/engine/calendar";
import { isGrounded, materialNumbers } from "@/lib/engine/guard";
import { applyPlan } from "@/lib/engine/plan";
import { acceptEarlier, computeView, visibleItems } from "@/lib/engine/view";
import { SEED_CHECKPOINTS } from "@/lib/seed/checkpoints";
import { EMPTY_USER_STATE } from "@/lib/types";

const day = buildDay();
const base = applyPlan(day.events, []);

const change = (p: Partial<PlanChange> & Pick<PlanChange, "id" | "action">): PlanChange => ({
  eventId: null, start: null, end: null, title: null, delegateTo: null, forDecisionId: null,
  reason: "", message: null, sourceIds: ["x"], ...p,
});

describe("calendar", () => {
  it("finds the late-morning overlaps from the brief", () => {
    const pairs = findOverlaps(base).map((o) => `${o.a}/${o.b}/${o.minutes}`);
    expect(pairs).toContain("ev-davr/ev-q3close/15");
    expect(pairs).toContain("ev-q3close/ev-reorg/25");
    expect(pairs).toContain("ev-reorg/ev-sme/20");
  });

  it("shows the press decision does not fit without a change", () => {
    const d = SEED_CHECKPOINTS.find((c) => c.id === "1316")!.output.decisions.find((x) => x.id === "dec-press")!;
    expect(feasibility(d, base, "13:16").state).toBe("infeasible");
    expect(nextFreeSlot(base, "13:16", 10)).toBe("16:30");
  });

  it("treats a decision as past due once its deadline is reached", () => {
    const d = SEED_CHECKPOINTS.find((c) => c.id === "1512")!.output.decisions.find((x) => x.id === "dec-onepager-send")!;
    expect(feasibility(d, base, "16:59").state).toBe("infeasible");
    expect(feasibility(d, base, "17:00").state).toBe("overdue");
  });

  it("makes the press decision feasible once Helm's two changes are accepted", () => {
    const cp = SEED_CHECKPOINTS.find((c) => c.id === "1316")!;
    const planned = applyPlan(day.events, cp.output.planChanges);
    const d = cp.output.decisions.find((x) => x.id === "dec-press")!;
    expect(feasibility(d, planned, "13:16")).toMatchObject({ state: "ok" });
    expect(freeMinutes(planned, "13:16", "15:00", "dec-press")).toBe(14);
  });

  it("offers a one-tap fix that includes moving the overlapping roundtable", () => {
    const user = acceptEarlier(EMPTY_USER_STATE, SEED_CHECKPOINTS, "13:16");
    const before = computeView(day, SEED_CHECKPOINTS, "13:16", user, "helm");
    const press = before.decisionsOpen.find((d) => d.id === "dec-press")!;
    expect(press.feasibility.state).toBe("infeasible");
    expect(press.fixChangeIds).toEqual(expect.arrayContaining(["pc-press-block", "pc-roundtable-late"]));

    const planChanges = { ...user.planChanges };
    for (const id of press.fixChangeIds!) planChanges[id] = "accepted" as const;
    const after = computeView(day, SEED_CHECKPOINTS, "13:16", { ...user, planChanges }, "helm");
    expect(after.decisionsOpen.find((d) => d.id === "dec-press")!.feasibility.state).toBe("ok");
  });

  it("delegated and deferred events stop counting as busy", () => {
    const planned = applyPlan(day.events, [
      change({ id: "a", action: "delegate", eventId: "ev-q3close", delegateTo: "sarah" }),
      change({ id: "b", action: "defer", eventId: "ev-sme" }),
    ]);
    const pairs = findOverlaps(planned).map((o) => `${o.a}/${o.b}`);
    expect(pairs).not.toContain("ev-davr/ev-q3close");
    expect(pairs).not.toContain("ev-reorg/ev-sme");
  });
});

describe("timeline replay", () => {
  it("never shows an item before its timestamp", () => {
    const at = visibleItems(day, "10:05", "helm").map((i) => i.id);
    expect(at).toContain("em-16");
    expect(at).not.toContain("em-18");
    expect(at).not.toContain("sl-1205");
  });

  it("hides messages that only exist when nobody acts", () => {
    const helm = visibleItems(day, "17:00", "helm").map((i) => i.id);
    const def = visibleItems(day, "17:00", "default").map((i) => i.id);
    expect(helm).not.toContain("sl-1620");
    expect(helm).not.toContain("em-32");
    expect(def).toContain("sl-1640");
  });
});

describe("fact supersession", () => {
  it("strikes the $18M figure after the 15:12 correction", () => {
    const view = computeView(day, SEED_CHECKPOINTS, "15:20", EMPTY_USER_STATE, "helm");
    const capital = view.facts.find((f) => f.key === "davr.capital")!;
    expect(capital.text).toContain("$18.6M");
    expect(capital.superseded[0].text).toContain("$18M");
    expect(capital.since).toBe("15:12");
  });

  it("keeps the morning figure before the correction", () => {
    const view = computeView(day, SEED_CHECKPOINTS, "15:00", EMPTY_USER_STATE, "helm");
    expect(view.facts.find((f) => f.key === "davr.capital")!.superseded).toHaveLength(0);
  });
});

describe("number guardrail", () => {
  it("extracts financial figures only", () => {
    expect(materialNumbers("Up ~22% QoQ, $18.6M total, call at 10:30 for 15 min")).toEqual(["22%", "$18.6M"]);
  });

  it("does not let $18M match a source that only says $18.6M", () => {
    expect(isGrounded("$18M", ["The total is $18.6M."])).toBe(false);
    expect(isGrounded("$18.6M", ["The total is $18.6M."])).toBe(true);
    expect(isGrounded("22%", ["NII up ~22% QoQ"])).toBe(true);
  });
});

describe("accepting earlier recommendations", () => {
  it("applies earlier plan changes and decisions when jumping ahead", () => {
    const user = acceptEarlier(EMPTY_USER_STATE, SEED_CHECKPOINTS, "13:16");
    expect(user.planChanges["pc-davr-extend"]).toBe("accepted");
    expect(user.planChanges["pc-press-block"]).toBeUndefined();
    expect(user.decisions["dec-davr-mode"].optionId).toBe("align");
    const view = computeView(day, SEED_CHECKPOINTS, "13:16", user, "helm");
    expect(view.events.find((e) => e.id === "ev-davr")!.end).toBe("11:30");
    expect(view.decisionsOpen.map((d) => d.id)).toContain("dec-press");
  });
});
