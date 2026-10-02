"use client";

import {
  ArrowsLeftRightIcon,
  CalendarPlusIcon,
  CalendarXIcon,
  CaretDownIcon,
  ClockCounterClockwiseIcon,
  FlagIcon,
  HourglassIcon,
  LinkSimpleIcon,
  ScissorsIcon,
  TranslateIcon,
  UserSwitchIcon,
  WarningCircleIcon,
  WarningIcon,
  type Icon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Alert, Deadline, PlanChange } from "@/lib/ai/schema";
import type { PlannedEvent } from "@/lib/engine/plan";
import { duration, relative, toMin } from "@/lib/time";
import { useHelm } from "../helm-context";
import { AvatarStack, Button, Pill, SectionTitle, SourceChips, cx } from "../ui";

const ALERT_ICON: Record<Alert["kind"], Icon> = {
  conflict: CalendarXIcon,
  contradiction: WarningIcon,
  stale: ClockCounterClockwiseIcon,
  deadline: HourglassIcon,
  "hidden-dependency": LinkSimpleIcon,
  risk: WarningCircleIcon,
};

const ALERT_LABEL: Record<Alert["kind"], string> = {
  conflict: "Conflict",
  contradiction: "Contradiction",
  stale: "Out of date",
  deadline: "Deadline",
  "hidden-dependency": "Hidden dependency",
  risk: "Risk",
};

export function TodayView() {
  const { view, url } = useHelm();
  const helm = url.path === "helm";
  const futureOverlaps = view.overlaps.filter((o) => {
    const b = view.events.find((e) => e.id === o.b)!;
    const a = view.events.find((e) => e.id === o.a)!;
    return toMin(a.end) > toMin(view.now) && toMin(b.end) > toMin(view.now);
  });

  return (
    <div className="px-4 pb-6">
      <header className="px-1 pt-2">
        <p className="text-[13px] text-muted">
          {helm && view.checkpoint ? (
            <>
              {view.checkpoint.label}, analysed at <span className="tnum font-mono">{view.checkpoint.at}</span>
            </>
          ) : helm ? (
            "Before the first analysis"
          ) : (
            "Without Helm"
          )}
        </p>
        <h1 className="mt-1.5 text-[23px] font-normal leading-[1.22] tracking-[-0.02em] text-ink text-balance">
          {helm
            ? view.checkpoint?.output.headline ?? "Helm starts reading at 08:30."
            : `${view.items.length} messages and documents so far, ${view.overlaps.length} calendar overlaps, and nobody re-planning the day.`}
        </h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {helm && <Pill tone={view.decisionsOpen.length ? "accent" : "neutral"}>{view.decisionsOpen.length} need you</Pill>}
          {helm ? (
            <Pill tone={futureOverlaps.length ? "danger" : "success"}>
              {futureOverlaps.length ? `${futureOverlaps.length} overlaps ahead` : "No overlaps ahead"}
            </Pill>
          ) : (
            <Pill tone="danger">{view.overlaps.length} overlaps today</Pill>
          )}
          {helm && view.proposals.length > 0 && <Pill>{view.proposals.length} calendar suggestions</Pill>}
        </div>
      </header>

      {helm && <Alerts />}
      <NowNext />
      <Timeline futureOverlapIds={new Set(futureOverlaps.flatMap((o) => [o.a, o.b]))} />
    </div>
  );
}

function Alerts() {
  const { view, setChange, setUrl } = useHelm();
  const [expanded, setExpanded] = useState(false);
  const infeasible = view.decisionsOpen.filter((d) => d.feasibility.state === "infeasible");
  const alerts = view.alerts;
  if (!alerts.length && !infeasible.length) return null;
  const shown = expanded ? alerts : alerts.slice(0, 2);

  return (
    <section aria-labelledby="alerts-title">
      <SectionTitle>
        <span id="alerts-title">What changed</span>
      </SectionTitle>
      <ul className="flex flex-col gap-2">
        {infeasible.map((d) => (
          <li key={d.id} className="rounded-xl border border-danger/40 bg-danger-soft p-3.5">
            <div className="flex items-start gap-2.5">
              <HourglassIcon size={18} weight="bold" className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">No time before {d.dueAt}: {d.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-body">
                  Needs about {duration(d.effortMin)}. Your next free {duration(d.effortMin)} is{" "}
                  {d.feasibility.state === "infeasible" && d.feasibility.nextFree ? `at ${d.feasibility.nextFree}` : "not today"}.
                </p>
                <div className="mt-2.5 flex gap-2">
                  {d.fixChangeIds && (
                    <Button size="sm" variant="primary" onClick={() => setChange(d.fixChangeIds!, "accepted")}>
                      Make Time
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setUrl({ tab: "decide" })}>
                    Open Decision
                  </Button>
                </div>
              </div>
            </div>
          </li>
        ))}
        {shown.map((a) => {
          const Glyph = ALERT_ICON[a.kind];
          return (
            <li key={a.id} className="rounded-xl border border-hairline bg-card p-3.5">
              <div className="flex items-start gap-2.5">
                <Glyph size={18} weight="bold" className="mt-0.5 shrink-0 text-accent-ink" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{ALERT_LABEL[a.kind]}</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink text-pretty">{a.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-body text-pretty">{a.detail}</p>
                  <SourceChips ids={a.sourceIds} className="mt-2" />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {alerts.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 px-1 text-[13px] font-medium text-accent-ink hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? "Show fewer" : `Show ${alerts.length - 2} more`}
        </button>
      )}
    </section>
  );
}

function NowNext() {
  const { view } = useHelm();
  const cur = view.current[0];
  return (
    <section aria-label="Now and next" className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-hairline bg-card">
      <div className="min-w-0 border-r border-hairline p-3.5">
        <p className="text-xs font-medium text-muted">Now</p>
        {cur ? (
          <>
            <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-ink">{cur.title}</p>
            <p className="tnum mt-1 font-mono text-xs text-body">until {cur.end}</p>
          </>
        ) : (
          <p className="mt-1 text-sm font-semibold text-ink">{view.next ? `Free until ${view.next.start}` : "Free"}</p>
        )}
      </div>
      <div className="min-w-0 p-3.5">
        <p className="text-xs font-medium text-muted">Next</p>
        {view.next ? (
          <>
            <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-ink">{view.next.title}</p>
            <p className="tnum mt-1 font-mono text-xs text-body">
              {view.next.start}, {relative(view.now, view.next.start)}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm font-semibold text-ink">Nothing else booked</p>
        )}
      </div>
    </section>
  );
}

type Row =
  | { kind: "event"; at: number; event: PlannedEvent }
  | { kind: "deadline"; at: number; deadline: Deadline }
  | { kind: "add"; at: number; change: PlanChange };

function Timeline({ futureOverlapIds }: { futureOverlapIds: Set<string> }) {
  const { view, url } = useHelm();
  const rows: Row[] = [
    ...view.events.map((e) => ({ kind: "event" as const, at: toMin(e.start), event: e })),
    ...view.deadlines.map((d) => ({ kind: "deadline" as const, at: toMin(d.at), deadline: d })),
    ...(url.path === "helm" ? view.proposals.filter((p) => p.action === "add" && p.start).map((p) => ({ kind: "add" as const, at: toMin(p.start!), change: p })) : []),
  ].sort((a, b) => a.at - b.at || (a.kind === "deadline" ? 1 : -1));

  const now = toMin(view.now);
  const nowIndex = rows.findIndex((r) => r.at > now);

  return (
    <section aria-labelledby="day-title">
      <SectionTitle>
        <span id="day-title">Your day</span>
      </SectionTitle>
      <ol className="relative flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.kind === "event" ? r.event.id : r.kind === "deadline" ? r.deadline.id : r.change.id}>
            {i === nowIndex && <NowLine />}
            {r.kind === "event" && <EventRow event={r.event} overlapping={futureOverlapIds.has(r.event.id)} />}
            {r.kind === "deadline" && <DeadlineRow deadline={r.deadline} />}
            {r.kind === "add" && <AddProposal change={r.change} />}
          </li>
        ))}
        {nowIndex === -1 && (
          <li>
            <NowLine />
          </li>
        )}
      </ol>
    </section>
  );
}

function NowLine() {
  const { view } = useHelm();
  return (
    <div className="my-1 flex items-center gap-2" aria-label={`Current time ${view.now}`}>
      <span className="tnum w-11 text-right font-mono text-xs font-semibold text-accent-ink">{view.now}</span>
      <span className="h-px flex-1 bg-accent" aria-hidden="true" />
    </div>
  );
}

function DeadlineRow({ deadline }: { deadline: Deadline }) {
  const { view } = useHelm();
  const passed = toMin(deadline.at) < toMin(view.now);
  return (
    <div className={cx("flex items-center gap-2", passed && "opacity-55")}>
      <span className="tnum w-11 text-right font-mono text-xs text-muted">{deadline.at}</span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-dashed border-hairline-strong px-2.5 py-1.5 text-[13px] text-body">
        <FlagIcon size={14} weight="bold" className={deadline.hard ? "text-danger" : "text-muted"} aria-hidden="true" />
        <span className="truncate">{deadline.label}</span>
      </span>
    </div>
  );
}

function changeLabel(c: PlanChange, e?: PlannedEvent, name?: (id: string) => string): string {
  switch (c.action) {
    case "move":
      return `Move to ${c.start}-${c.end}`;
    case "shorten":
      return `Shorten to ${c.start}-${c.end}`;
    case "extend":
      return `Extend to ${c.start ?? e?.start}-${c.end}`;
    case "delegate":
      return `Hand to ${c.delegateTo && name ? name(c.delegateTo) : "someone else"}`;
    case "defer":
      return "Move to tomorrow";
    case "add":
      return `Add ${c.start}-${c.end}: ${c.title}`;
  }
}

const CHANGE_ICON: Record<PlanChange["action"], Icon> = {
  move: ArrowsLeftRightIcon,
  shorten: ScissorsIcon,
  extend: ArrowsLeftRightIcon,
  delegate: UserSwitchIcon,
  defer: CalendarXIcon,
  add: CalendarPlusIcon,
};

function Proposal({ change, event }: { change: PlanChange; event?: PlannedEvent }) {
  const { setChange, person } = useHelm();
  const Glyph = CHANGE_ICON[change.action];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-xl border border-dashed border-accent/60 bg-accent-soft/50 p-3"
    >
      <div className="flex items-start gap-2">
        <Glyph size={16} weight="bold" className="mt-0.5 shrink-0 text-accent-ink" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">
            <span className="text-accent-ink">Suggested: </span>
            {changeLabel(change, event, (id) => person(id).name)}
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-body text-pretty">{change.reason}</p>
          {change.message && (
            <p className="mt-1.5 rounded-lg bg-card/80 px-2.5 py-1.5 text-[13px] leading-relaxed text-body">
              <span className="font-medium text-ink">Message to {person(change.message.to).name}: </span>
              {change.message.body}
            </p>
          )}
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => setChange(change.id, "accepted")}>
              Accept
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setChange(change.id, "dismissed")}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AddProposal({ change }: { change: PlanChange }) {
  return (
    <div className="flex gap-2">
      <span className="tnum w-11 shrink-0 pt-3 text-right font-mono text-xs text-muted">{change.start}</span>
      <div className="min-w-0 flex-1">
        <Proposal change={change} />
      </div>
    </div>
  );
}

function EventRow({ event, overlapping }: { event: PlannedEvent; overlapping: boolean }) {
  const { view, person, setUrl, url } = useHelm();
  const [open, setOpen] = useState(false);
  const brief = url.path === "helm" ? view.briefs.get(event.id) : undefined;
  const proposals = url.path === "helm" ? view.proposals.filter((p) => p.eventId === event.id) : [];
  const now = toMin(view.now);
  const past = toMin(event.end) <= now;
  const current = toMin(event.start) <= now && now < toMin(event.end) && event.status === "scheduled";
  const inactive = event.status !== "scheduled";
  const overlaps = view.overlaps
    .filter((o) => o.b === event.id)
    .map((o) => ({ ...o, other: view.events.find((e) => e.id === o.a)! }));
  const hasKit = url.path === "helm" && view.callKit?.eventId === event.id;
  const expandable = Boolean(brief) || event.attendees.length > 0 || hasKit;

  return (
    <div className={cx("flex gap-2", past && !current && "opacity-60")}>
      <div className="w-11 shrink-0 pt-3 text-right">
        <p className={cx("tnum font-mono text-xs", inactive ? "text-muted line-through" : "text-ink")}>{event.start}</p>
        <p className="tnum font-mono text-[11px] text-muted">{event.end}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div
          className={cx(
            "rounded-xl border bg-card transition-colors",
            current ? "border-accent" : "border-hairline",
            event.addedBy && "border-accent/50 bg-accent-soft/40",
            overlapping && !inactive && "border-l-[3px] border-l-danger",
          )}
        >
          <button
            type="button"
            onClick={() => expandable && setOpen((v) => !v)}
            aria-expanded={expandable ? open : undefined}
            disabled={!expandable}
            className="flex w-full items-start gap-2 p-3 text-left disabled:cursor-default"
          >
            <div className="min-w-0 flex-1">
              <p className={cx("text-sm font-semibold leading-snug text-pretty", inactive ? "text-muted line-through" : "text-ink")}>
                {event.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {event.attendees.length > 0 && <AvatarStack ids={event.attendees} size={20} />}
                {event.location && <span className="text-xs text-muted">{event.location}</span>}
                {current && <Pill tone="accent">Now</Pill>}
                {event.addedBy && <Pill tone="accent">Added by Helm</Pill>}
                {event.status === "delegated" && <Pill>Handed to {person(event.delegateTo ?? "").name}</Pill>}
                {event.status === "deferred" && <Pill>Moved to tomorrow</Pill>}
                {event.original && event.status === "scheduled" && !event.addedBy && (
                  <Pill>
                    Was {event.original.start}-{event.original.end}
                  </Pill>
                )}
                {!inactive &&
                  overlaps.map((o) => (
                    <Pill key={o.a} tone="danger">
                      Overlaps the {o.other.start} by {o.minutes} min
                    </Pill>
                  ))}
                {hasKit && (
                  <Pill tone="neutral">
                    <TranslateIcon size={12} weight="bold" aria-hidden="true" /> Call kit
                  </Pill>
                )}
              </div>
            </div>
            {expandable && (
              <CaretDownIcon
                size={16}
                weight="bold"
                aria-hidden="true"
                className={cx("mt-0.5 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")}
              />
            )}
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="border-t border-hairline px-3 pb-3 pt-2.5">
                  {event.attendees.length > 0 && (
                    <p className="text-xs text-muted">
                      With {event.attendees.map((id) => `${person(id).name} (${person(id).role})`).join(", ")}
                    </p>
                  )}
                  {brief && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-muted">60-second brief</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-body text-pretty">{brief.summary}</p>
                      {brief.youDecide.length > 0 && (
                        <BriefList title="You decide" items={brief.youDecide} />
                      )}
                      {brief.watchOut.length > 0 && <BriefList title="Watch out" items={brief.watchOut} />}
                      <SourceChips ids={brief.sourceIds} className="mt-2" />
                    </div>
                  )}
                  {hasKit && (
                    <Button size="sm" className="mt-3" onClick={() => setUrl({ kit: true })}>
                      <TranslateIcon size={14} weight="bold" aria-hidden="true" />
                      Open Call Kit
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence initial={false}>
          {proposals.map((p) => (
            <Proposal key={p.id} change={p} event={event} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BriefList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold text-muted">{title}</p>
      <ul className="mt-0.5 list-disc pl-4 text-[13px] leading-relaxed text-body marker:text-muted">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
