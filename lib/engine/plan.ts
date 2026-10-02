import type { PlanChange } from "@/lib/ai/schema";
import type { CalEvent, HHMM } from "@/lib/types";
import { toMin } from "@/lib/time";

export type EventStatus = "scheduled" | "delegated" | "deferred";

export interface PlannedEvent extends CalEvent {
  status: EventStatus;
  original?: { start: HHMM; end: HHMM; title: string };
  appliedChangeIds: string[];
  delegateTo?: string;
  addedBy?: "helm";
  forDecisionId?: string;
}

/** Applies accepted plan changes in order. Later changes to the same event win. */
export function applyPlan(events: CalEvent[], changes: PlanChange[]): PlannedEvent[] {
  const out = new Map<string, PlannedEvent>(
    events.map((e) => [e.id, { ...e, status: "scheduled", appliedChangeIds: [] }]),
  );

  for (const c of changes) {
    if (c.action === "add") {
      if (!c.start || !c.end) continue;
      out.set(c.id, {
        id: c.id,
        start: c.start,
        end: c.end,
        title: c.title ?? "Focus block",
        attendees: [],
        kind: "focus",
        provenance: { kind: "file", file: "Helm plan change" },
        status: "scheduled",
        appliedChangeIds: [c.id],
        addedBy: "helm",
        forDecisionId: c.forDecisionId ?? undefined,
      });
      continue;
    }
    const e = c.eventId ? out.get(c.eventId) : undefined;
    if (!e) continue;
    const original = e.original ?? { start: e.start, end: e.end, title: e.title };
    const next: PlannedEvent = { ...e, original, appliedChangeIds: [...e.appliedChangeIds, c.id] };
    switch (c.action) {
      case "move":
      case "shorten":
      case "extend":
        if (c.start) next.start = c.start;
        if (c.end) next.end = c.end;
        if (c.title) next.title = c.title;
        next.status = "scheduled";
        break;
      case "delegate":
        next.status = "delegated";
        next.delegateTo = c.delegateTo ?? undefined;
        break;
      case "defer":
        next.status = "deferred";
        break;
    }
    out.set(e.id, next);
  }

  return [...out.values()].sort(
    (a, b) => toMin(a.start) - toMin(b.start) || toMin(a.end) - toMin(b.end),
  );
}

export function isActive(e: PlannedEvent): boolean {
  return e.status === "scheduled";
}
