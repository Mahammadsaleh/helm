import type {
  Alert,
  Brief,
  CallKit,
  Deadline,
  Decision,
  Delegation,
  Digest,
  PlanChange,
  Triage,
} from "@/lib/ai/schema";
import type { Checkpoint, Day, HHMM, Item, UserState } from "@/lib/types";
import { toMin } from "@/lib/time";
import { feasibility, findOverlaps, nowAndNext, type Feasibility, type Overlap } from "./calendar";
import { mergeFacts, type FactView } from "./facts";
import { guardOutput, type GuardIssue } from "./guard";
import { applyPlan, type PlannedEvent } from "./plan";

export type Path = "helm" | "default";

export interface DecisionView extends Decision {
  feasibility: Feasibility;
  /** Open proposals that, accepted together, make the deadline feasible. */
  fixChangeIds: string[] | null;
}

export interface View {
  now: HHMM;
  path: Path;
  checkpoint: Checkpoint | null;
  nextCheckpoint: Checkpoint | null;
  items: Item[];
  pendingItemIds: Set<string>;
  events: PlannedEvent[];
  overlaps: Overlap[];
  current: PlannedEvent[];
  next: PlannedEvent | null;
  proposals: PlanChange[];
  decisionsOpen: DecisionView[];
  delegations: Delegation[];
  facts: FactView[];
  alerts: Alert[];
  deadlines: Deadline[];
  briefs: Map<string, Brief>;
  callKit: CallKit | null;
  digest: Digest | null;
  triage: Map<string, Triage>;
  guard: GuardIssue[];
}

export function visibleItems(day: Day, now: HHMM, path: Path): Item[] {
  const t = toMin(now);
  return day.items.filter(
    (i) => toMin(i.at) <= t && (path === "default" || !i.defaultPathOnly),
  );
}

export function sourceLookup(day: Day) {
  const items = new Map(day.items.map((i) => [i.id, i]));
  const events = new Map(day.events.map((e) => [e.id, e]));
  return (id: string): string | undefined => {
    const i = items.get(id);
    if (i) return [i.subject, i.text].filter(Boolean).join("\n");
    const e = events.get(id);
    if (e) return `${e.title} ${e.start}-${e.end} ${e.notes ?? ""}`;
    return undefined;
  };
}

export function checkpointsUpTo(checkpoints: Checkpoint[], now: HHMM): Checkpoint[] {
  return checkpoints.filter((c) => toMin(c.at) <= toMin(now));
}

export function computeView(
  day: Day,
  checkpoints: Checkpoint[],
  now: HHMM,
  user: UserState,
  path: Path,
): View {
  const items = visibleItems(day, now, path);
  const past = path === "helm" ? checkpointsUpTo(checkpoints, now) : [];
  const checkpoint = past.at(-1) ?? null;
  const nextCheckpoint = checkpoints.find((c) => toMin(c.at) > toMin(now)) ?? null;
  const out = checkpoint?.output;

  const accepted = past.flatMap((c) =>
    c.output.planChanges.filter((p) => user.planChanges[p.id] === "accepted"),
  );
  const seen = new Set<string>();
  const uniqueAccepted = accepted.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  const events = applyPlan(day.events, uniqueAccepted);
  const { current, next } = nowAndNext(events, now);

  const proposals = (out?.planChanges ?? []).filter((p) => !user.planChanges[p.id]);

  const decisionsOpen: DecisionView[] = (out?.decisions ?? [])
    .filter((d) => !user.decisions[d.id])
    .map((d) => {
      const f = feasibility(d, events, now);
      const fixChangeIds = f.state === "infeasible" ? fixFor(d, proposals, uniqueAccepted, day, events, now) : null;
      return { ...d, feasibility: f, fixChangeIds };
    })
    .sort((a, b) => toMin(a.dueAt ?? "23:59") - toMin(b.dueAt ?? "23:59"));

  const pendingItemIds = new Set(
    checkpoint ? items.filter((i) => toMin(i.at) > toMin(checkpoint.at)).map((i) => i.id) : [],
  );

  const briefs = new Map<string, Brief>();
  const triage = new Map<string, Triage>();
  const deadlines = new Map<string, Deadline>();
  let callKit: CallKit | null = null;
  let digest: Digest | null = null;
  for (const c of past) {
    for (const b of c.output.briefs) briefs.set(b.eventId, b);
    for (const t of c.output.triage) triage.set(t.itemId, t);
    for (const d of c.output.deadlines) deadlines.set(d.id, d);
    if (c.output.callKit) callKit = c.output.callKit;
    if (c.output.digest) digest = c.output.digest;
  }

  return {
    now,
    path,
    checkpoint,
    nextCheckpoint,
    items,
    pendingItemIds,
    events: path === "helm" ? events : applyPlan(day.events, []),
    overlaps: findOverlaps(path === "helm" ? events : applyPlan(day.events, [])),
    current,
    next,
    proposals,
    decisionsOpen,
    delegations: out?.delegations ?? [],
    facts: mergeFacts(past),
    alerts: out?.alerts ?? [],
    deadlines: [...deadlines.values()].sort((a, b) => toMin(a.at) - toMin(b.at)),
    briefs,
    callKit,
    digest,
    triage,
    guard: out ? guardOutput(out, sourceLookup(day)) : [],
  };
}

/**
 * A time block reserved for the decision, plus any proposed change that moves a
 * meeting out of that block. Returned only if the result actually fits.
 */
function fixFor(
  d: Decision,
  proposals: PlanChange[],
  accepted: PlanChange[],
  day: Day,
  events: PlannedEvent[],
  now: HHMM,
): string[] | null {
  const blocks = proposals.filter((p) => p.forDecisionId === d.id && p.start && p.end);
  if (!blocks.length) return null;
  const clearing = proposals.filter((p) => {
    if (p.action === "add" || !p.eventId) return false;
    const e = events.find((x) => x.id === p.eventId);
    return Boolean(e) && blocks.some((b) => toMin(e!.start) < toMin(b.end!) && toMin(b.start!) < toMin(e!.end));
  });
  const fix = [...blocks, ...clearing];
  const trial = applyPlan(day.events, [...accepted, ...fix]);
  return feasibility(d, trial, now).state === "ok" ? fix.map((p) => p.id) : null;
}

/**
 * Jumping ahead in the demo assumes Helm's earlier recommendations were taken,
 * because the cached analysis for later checkpoints was written on that basis.
 */
export function acceptEarlier(
  user: UserState,
  checkpoints: Checkpoint[],
  now: HHMM,
): UserState {
  const past = checkpointsUpTo(checkpoints, now).slice(0, -1);
  const next: UserState = {
    ...user,
    decisions: { ...user.decisions },
    planChanges: { ...user.planChanges },
    delegations: { ...user.delegations },
  };
  for (const c of past) {
    for (const p of c.output.planChanges) {
      if (!next.planChanges[p.id]) next.planChanges[p.id] = "accepted";
    }
    for (const d of c.output.decisions) {
      if (next.decisions[d.id]) continue;
      if (later(checkpoints, c, (o) => o.decisions.some((x) => x.id === d.id), now)) continue;
      const opt = d.options.find((o) => o.id === d.recommendedOptionId) ?? d.options[0];
      next.decisions[d.id] = { optionId: opt.id, optionLabel: opt.label, title: d.title, at: c.at };
    }
    for (const d of c.output.delegations) {
      if (!next.delegations[d.id]) {
        next.delegations[d.id] = { at: c.at, to: d.to, summary: d.subject ?? d.body.slice(0, 80) };
      }
    }
  }
  return next;
}

function later(
  checkpoints: Checkpoint[],
  cp: Checkpoint,
  has: (o: Checkpoint["output"]) => boolean,
  now: HHMM,
): boolean {
  return checkpointsUpTo(checkpoints, now)
    .filter((c) => toMin(c.at) > toMin(cp.at))
    .some((c) => has(c.output));
}
