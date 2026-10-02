import type { Decision } from "@/lib/ai/schema";
import type { HHMM } from "@/lib/types";
import { fromMin, toMin } from "@/lib/time";
import { isActive, type PlannedEvent } from "./plan";

export interface Overlap {
  a: string;
  b: string;
  minutes: number;
  start: HHMM;
}

export function findOverlaps(events: PlannedEvent[]): Overlap[] {
  const active = events.filter(isActive);
  const out: Overlap[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const start = Math.max(toMin(a.start), toMin(b.start));
      const end = Math.min(toMin(a.end), toMin(b.end));
      if (end > start) out.push({ a: a.id, b: b.id, minutes: end - start, start: fromMin(start) });
    }
  }
  return out;
}

/**
 * Minutes in [from, to) not covered by an active event. Blocks reserved for a
 * specific decision count as free time for that decision.
 */
export function freeMinutes(
  events: PlannedEvent[],
  from: HHMM,
  to: HHMM,
  forDecisionId?: string,
): number {
  const start = toMin(from);
  const end = toMin(to);
  if (end <= start) return 0;
  const busy = events.filter((e) => isActive(e) && !(forDecisionId && e.forDecisionId === forDecisionId));
  let free = 0;
  for (let m = start; m < end; m++) {
    if (!busy.some((e) => toMin(e.start) <= m && m < toMin(e.end))) free++;
  }
  return free;
}

export function nextFreeSlot(events: PlannedEvent[], from: HHMM, length: number): HHMM | null {
  const active = events.filter(isActive);
  let run = 0;
  for (let m = toMin(from); m < 24 * 60; m++) {
    const busy = active.some((e) => toMin(e.start) <= m && m < toMin(e.end));
    run = busy ? 0 : run + 1;
    if (run >= length) return fromMin(m - length + 1);
  }
  return null;
}

export type Feasibility =
  | { state: "no-deadline" }
  | { state: "overdue" }
  | { state: "ok"; free: number }
  | { state: "infeasible"; free: number; nextFree: HHMM | null };

export function feasibility(d: Decision, events: PlannedEvent[], now: HHMM): Feasibility {
  if (!d.dueAt) return { state: "no-deadline" };
  if (toMin(d.dueAt) < toMin(now)) return { state: "overdue" };
  const free = freeMinutes(events, now, d.dueAt, d.id);
  if (free >= d.effortMin) return { state: "ok", free };
  return { state: "infeasible", free, nextFree: nextFreeSlot(events, now, d.effortMin) };
}

export function nowAndNext(events: PlannedEvent[], now: HHMM) {
  const t = toMin(now);
  const active = events.filter(isActive);
  const current = active.filter((e) => toMin(e.start) <= t && t < toMin(e.end));
  const next = active.find((e) => toMin(e.start) > t) ?? null;
  return { current, next };
}
