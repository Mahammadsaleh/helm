"use client";

import {
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  HourglassIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  SealCheckIcon,
  SlackLogoIcon,
  TrayIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import type { Delegation } from "@/lib/ai/schema";
import type { DecisionView } from "@/lib/engine/view";
import { duration, toMin } from "@/lib/time";
import { useHelm } from "../helm-context";
import { Avatar, Button, EmptyState, Pill, SectionTitle, SourceChips, cx } from "../ui";

const RISK_LABEL = { high: "High stakes", medium: "Medium stakes", low: "Low stakes" } as const;
const RISK_TONE = { high: "danger", medium: "warn", low: "neutral" } as const;

export function DecideView() {
  const { view, user, url, checkpoints } = useHelm();

  if (url.path === "default") {
    return (
      <div className="px-4">
        <EmptyState
          icon={TrayIcon}
          title="No decision queue without Helm"
          body="Every decision is still buried in an email or a Slack thread. Open the Feed to see what you would have to dig through."
        />
      </div>
    );
  }

  const unsent = view.delegations.filter((d) => !user.delegations[d.id]);
  const decided = Object.entries(user.decisions)
    .filter(([, d]) => toMin(d.at) <= toMin(view.now))
    .sort((a, b) => toMin(b[1].at) - toMin(a[1].at));
  const sent = Object.entries(user.delegations)
    .filter(([, d]) => toMin(d.at) <= toMin(view.now))
    .sort((a, b) => toMin(b[1].at) - toMin(a[1].at));
  const currentDecisionIds = new Set(view.checkpoint?.output.decisions.map((d) => d.id));

  return (
    <div className="px-4 pb-6">
      <header className="px-1 pt-2">
        <p className="text-[13px] text-muted">Decisions</p>
        <h1 className="mt-1.5 text-[23px] font-normal leading-[1.22] tracking-[-0.02em] text-ink text-balance">
          {view.decisionsOpen.length === 0
            ? "Nothing needs you right now."
            : view.decisionsOpen.length === 1
              ? "One call only you can make."
              : `${view.decisionsOpen.length} calls only you can make.`}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-body text-pretty">
          {unsent.length > 0
            ? `${unsent.length} more ${unsent.length === 1 ? "item is" : "items are"} drafted for other people. Check and send.`
            : checkpoints.length && view.checkpoint
              ? "Everything else has an owner."
              : "Helm's first analysis runs at 08:30."}
        </p>
      </header>

      {view.decisionsOpen.length > 0 && (
        <section aria-labelledby="open-title">
          <SectionTitle count={view.decisionsOpen.length}>
            <span id="open-title">Needs you</span>
          </SectionTitle>
          <ul className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {view.decisionsOpen.map((d) => (
                <motion.li
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <DecisionCard decision={d} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {unsent.length > 0 && (
        <section aria-labelledby="drafts-title">
          <SectionTitle count={unsent.length}>
            <span id="drafts-title">Drafted for others</span>
          </SectionTitle>
          <ul className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {unsent.map((d) => (
                <motion.li
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <DelegationCard delegation={d} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {decided.length > 0 && (
        <section aria-labelledby="decided-title">
          <SectionTitle count={decided.length}>
            <span id="decided-title">Decided today</span>
          </SectionTitle>
          <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-card">
            {decided.map(([id, d]) => (
              <DecidedRow key={id} id={id} title={d.title} choice={d.optionLabel} at={d.at} canUndo={currentDecisionIds.has(id)} />
            ))}
          </ul>
        </section>
      )}

      {sent.length > 0 && (
        <section aria-labelledby="sent-title">
          <SectionTitle count={sent.length}>
            <span id="sent-title">Sent today</span>
          </SectionTitle>
          <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-card">
            {sent.map(([id, d]) => (
              <SentRow key={id} to={d.to} summary={d.summary} at={d.at} />
            ))}
          </ul>
        </section>
      )}

      {view.decisionsOpen.length === 0 && unsent.length === 0 && decided.length === 0 && (
        <EmptyState icon={SealCheckIcon} title="Clear" body="Helm will put decisions here as messages arrive." />
      )}
    </div>
  );
}

function Feasibility({ d }: { d: DecisionView }) {
  const { setChange } = useHelm();
  const f = d.feasibility;
  if (f.state === "no-deadline") return null;
  if (f.state === "overdue") {
    return (
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-danger">
        <HourglassIcon size={14} weight="bold" aria-hidden="true" /> Past {d.dueAt}
      </p>
    );
  }
  if (f.state === "ok") {
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-success">
        <CheckCircleIcon size={14} weight="bold" aria-hidden="true" />
        <span>
          <span className="tnum">{duration(f.free)}</span> free before {d.dueAt}, needs {duration(d.effortMin)}
        </span>
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-danger-soft px-2.5 py-2">
      <p className="flex flex-1 items-center gap-1.5 text-[13px] font-medium text-danger">
        <HourglassIcon size={14} weight="bold" aria-hidden="true" />
        <span>
          {f.free === 0 ? (
            `No free time before ${d.dueAt}`
          ) : (
            <>
              Only <span className="tnum">{duration(f.free)}</span> free before {d.dueAt}
            </>
          )}
        </span>
      </p>
      {d.fixChangeIds && (
        <Button size="sm" variant="primary" onClick={() => setChange(d.fixChangeIds!, "accepted")}>
          Make Time
        </Button>
      )}
    </div>
  );
}

function DecisionCard({ decision: d }: { decision: DecisionView }) {
  const { decide } = useHelm();
  const [choice, setChoice] = useState(d.recommendedOptionId);
  const name = useId();
  const due = d.dueAt ? `Due ${d.dueAt}` : d.dueLabel;

  return (
    <article className="rounded-xl border border-hairline bg-card">
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={RISK_TONE[d.risk]}>{RISK_LABEL[d.risk]}</Pill>
          {due && <Pill tone="neutral">{due}</Pill>}
          <span className="text-xs text-muted">about {duration(d.effortMin)}</span>
        </div>
        <h3 className="mt-2.5 text-base font-semibold leading-snug text-ink text-pretty">{d.title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-body text-pretty">{d.whyYou}</p>
        <div className="mt-3">
          <Feasibility d={d} />
        </div>
      </div>
      <fieldset className="border-t border-hairline px-2 py-2">
        <legend className="sr-only">Options for {d.title}</legend>
        {d.options.map((o) => {
          const selected = choice === o.id;
          return (
            <label
              key={o.id}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5 transition-colors",
                selected ? "bg-accent-soft/60" : "hover:bg-canvas-soft",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.id}
                checked={selected}
                onChange={() => setChoice(o.id)}
                className="mt-1 size-4 shrink-0 accent-[var(--accent-ink)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-ink">{o.label}</span>
                  {o.id === d.recommendedOptionId && <Pill tone="accent">Recommended</Pill>}
                </span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-body text-pretty">{o.consequence}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3">
        <SourceChips ids={d.sourceIds} className="min-w-0" />
        <Button variant="primary" onClick={() => decide(d, choice)} className="shrink-0">
          Confirm
        </Button>
      </div>
    </article>
  );
}

function DelegationCard({ delegation: d }: { delegation: Delegation }) {
  const { person, sendDelegation } = useHelm();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(d.body);
  const to = person(d.to);
  const ChannelIcon = d.channel === "slack" ? SlackLogoIcon : EnvelopeSimpleIcon;
  const fieldId = useId();

  return (
    <article className="rounded-xl border border-hairline bg-card p-4">
      <div className="flex items-center gap-2.5">
        <Avatar id={d.to} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{to.name}</p>
          <p className="truncate text-xs text-muted">{to.role}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <ChannelIcon size={14} weight="bold" aria-hidden="true" />
          {d.channel === "slack" ? "Slack" : "Email"}
        </span>
      </div>
      {d.subject && <p className="mt-3 text-sm font-medium text-ink text-pretty">{d.subject}</p>}
      {editing ? (
        <div className="mt-2">
          <label htmlFor={fieldId} className="sr-only">
            Message to {to.name}
          </label>
          <textarea
            id={fieldId}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full resize-y rounded-lg border border-hairline-strong bg-canvas-soft p-2.5 text-[13px] leading-relaxed text-ink focus:border-accent focus:outline-none"
          />
        </div>
      ) : (
        <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-body text-pretty">{body}</p>
      )}
      <p className="mt-2.5 text-xs leading-relaxed text-muted text-pretty">
        <span className="font-medium text-body">Why: </span>
        {d.reason}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <SourceChips ids={d.sourceIds} className="min-w-0" />
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
            <PencilSimpleIcon size={14} weight="bold" aria-hidden="true" />
            {editing ? "Done" : "Edit"}
          </Button>
          <Button size="sm" variant="primary" onClick={() => sendDelegation({ ...d, body })}>
            <PaperPlaneTiltIcon size={14} weight="bold" aria-hidden="true" />
            Send
          </Button>
        </div>
      </div>
    </article>
  );
}

function DecidedRow({ id, title, choice, at, canUndo }: { id: string; title: string; choice: string; at: string; canUndo: boolean }) {
  const { undoDecision } = useHelm();
  return (
    <li className="flex items-start gap-3 px-3.5 py-3">
      <CheckCircleIcon size={18} weight="fill" className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-ink text-pretty">{title}</p>
        <p className="mt-0.5 text-[13px] text-body text-pretty">{choice}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="tnum font-mono text-xs text-muted">{at}</span>
        {canUndo && (
          <button
            type="button"
            onClick={() => undoDecision(id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline"
            aria-label={`Undo decision: ${title}`}
          >
            <ArrowCounterClockwiseIcon size={12} weight="bold" aria-hidden="true" />
            Undo
          </button>
        )}
      </div>
    </li>
  );
}

function SentRow({ to, summary, at }: { to: string; summary: string; at: string }) {
  const { person } = useHelm();
  return (
    <li className="flex items-start gap-3 px-3.5 py-3">
      <Avatar id={to} size={24} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">{person(to).name}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-body">{summary}</p>
      </div>
      <span className="tnum shrink-0 font-mono text-xs text-muted">{at}</span>
    </li>
  );
}
