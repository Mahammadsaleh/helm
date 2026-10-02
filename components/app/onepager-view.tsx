"use client";

import {
  CheckCircleIcon,
  CopySimpleIcon,
  FileDashedIcon,
  PaperPlaneTiltIcon,
  QuestionIcon,
  SealCheckIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { FactSection } from "@/lib/ai/schema";
import type { FactView } from "@/lib/engine/facts";
import { toMin } from "@/lib/time";
import { useHelm } from "../helm-context";
import { Avatar, Button, EmptyState, Pill, Sheet, SourceChips } from "../ui";

const SECTION_TITLE: Record<FactSection, string> = {
  highlights: "Q3 highlights",
  risks: "Risks and watch items",
  davr: "Davr Bank integration",
  press: "Press",
};

const ORDER: FactSection[] = ["highlights", "davr", "risks", "press"];

export function OnePagerView() {
  const { view, user, url, checkpoints, markOnePagerSeen, sendOnePager, toast, person } = useHelm();
  const cpId = view.checkpoint?.id;
  const [seen, setSeen] = useState({ cp: cpId, baseline: user.onePagerSeenCheckpoint });
  if (seen.cp !== cpId) setSeen({ cp: cpId, baseline: seen.cp });
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    markOnePagerSeen();
  }, [markOnePagerSeen]);

  const baselineAt = checkpoints.find((c) => c.id === seen.baseline)?.at;
  const facts = view.facts;

  if (url.path === "default") {
    return (
      <div className="px-4">
        <EmptyState
          icon={FileDashedIcon}
          title="Blank document"
          body="Richard asked for one page by 17:00. Without Helm, it starts at 16:30 from Sarah's deck v4, which still says $18M for Davr."
        />
      </div>
    );
  }

  if (!facts.length) {
    return (
      <div className="px-4">
        <EmptyState
          icon={FileDashedIcon}
          title="Not started yet"
          body="Richard's request arrived at 09:05. Helm drafts the one-pager in the 10:05 analysis, once the plan has room to check numbers."
        />
      </div>
    );
  }

  const needsCheck = facts.filter((f) => f.status === "needs-check");
  const lastChange = facts.reduce((max, f) => (toMin(f.since) > toMin(max) ? f.since : max), facts[0].since);
  const sent = user.onePagerSentAt && toMin(user.onePagerSentAt) <= toMin(view.now) ? user.onePagerSentAt : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText(facts));
      toast("Copied as plain text");
    } catch {
      toast("Copy is blocked in this browser");
    }
  };

  return (
    <div className="px-4 pb-6">
      <header className="px-1 pt-2">
        <p className="text-[13px] text-muted">
          For {person("richard").name}, due <span className="tnum font-mono">17:00</span>
        </p>
        <h1 className="mt-1.5 text-[23px] font-normal leading-[1.22] tracking-[-0.02em] text-ink text-balance">
          Board one-pager: Q3 results and Davr Bank status
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Pill tone="success">
            <CheckCircleIcon size={12} weight="bold" aria-hidden="true" />
            {facts.length - needsCheck.length} verified
          </Pill>
          {needsCheck.length > 0 && (
            <Pill tone="warn">
              <QuestionIcon size={12} weight="bold" aria-hidden="true" />
              {needsCheck.length} to check
            </Pill>
          )}
          <span className="text-xs text-muted">
            Last change at <span className="tnum font-mono">{lastChange}</span>
          </span>
        </div>
      </header>

      <article className="mt-5 overflow-hidden rounded-xl border border-hairline bg-card">
        {ORDER.map((section) => {
          const rows = facts.filter((f) => f.section === section);
          if (!rows.length) return null;
          return (
            <section key={section} aria-labelledby={`sec-${section}`} className="border-b border-hairline last:border-b-0">
              <h2 id={`sec-${section}`} className="px-4 pb-1 pt-4 text-[13px] font-semibold text-muted">
                {SECTION_TITLE[section]}
              </h2>
              <ul>
                {rows.map((f) => (
                  <FactRow key={f.key} fact={f} baselineAt={baselineAt} />
                ))}
              </ul>
            </section>
          );
        })}
      </article>

      <div className="mt-4 flex flex-col gap-2">
        {sent ? (
          <p className="flex items-center justify-center gap-1.5 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
            <SealCheckIcon size={18} weight="fill" aria-hidden="true" />
            Sent to {person("richard").name} at <span className="tnum font-mono">{sent}</span>
          </p>
        ) : (
          <Button variant="primary" size="lg" onClick={() => setConfirming(true)}>
            <PaperPlaneTiltIcon size={16} weight="bold" aria-hidden="true" />
            {needsCheck.length ? "Review and Send" : "Send to Richard"}
          </Button>
        )}
        <Button variant="ghost" onClick={copy}>
          <CopySimpleIcon size={16} weight="bold" aria-hidden="true" />
          Copy as Text
        </Button>
      </div>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Send the one-pager to Richard?"
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setConfirming(false)}>
              Keep Editing
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                sendOnePager();
                setConfirming(false);
              }}
            >
              {needsCheck.length ? "Send Anyway" : "Send"}
            </Button>
          </div>
        }
      >
        {needsCheck.length > 0 ? (
          <>
            <p className="text-sm leading-relaxed text-body text-pretty">
              {needsCheck.length === 1 ? "One line is" : `${needsCheck.length} lines are`} still waiting on a check. Richard will
              see them marked as unconfirmed.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {needsCheck.map((f) => (
                <li key={f.key} className="rounded-lg border border-warn/30 bg-warn-soft p-3 text-[13px] leading-relaxed text-ink">
                  {f.text}
                  {f.check && <span className="mt-1 block text-body">Check: {f.check}</span>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-body text-pretty">
            Every line traces to a source and has been checked. It goes to {person("richard").name} by email (simulated in this demo).
          </p>
        )}
      </Sheet>
    </div>
  );
}

function FactRow({ fact: f, baselineAt }: { fact: FactView; baselineAt?: string }) {
  const { person } = useHelm();
  const updated = baselineAt !== undefined && toMin(f.since) > toMin(baselineAt);
  const nowVerified = baselineAt !== undefined && !updated && f.status === "verified" && toMin(f.statusChangedAt) > toMin(baselineAt);
  const verified = f.status === "verified";

  return (
    <li className="flex gap-3 px-4 py-3">
      {verified ? (
        <CheckCircleIcon size={18} weight="fill" className="mt-0.5 shrink-0 text-success" aria-label="Verified" />
      ) : (
        <QuestionIcon size={18} weight="bold" className="mt-0.5 shrink-0 text-warn" aria-label="Needs a check" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-ink text-pretty">
          {f.text}
          {updated && (
            <Pill tone="accent" className="ml-1.5 align-[1px]">
              Updated {f.since}
            </Pill>
          )}
          {nowVerified && (
            <Pill tone="success" className="ml-1.5 align-[1px]">
              Verified {f.statusChangedAt}
            </Pill>
          )}
        </p>
        {f.superseded.map((s, i) => (
          <p key={s.checkpointId + s.text} className="mt-1 text-[13px] leading-relaxed text-muted">
            <span className="strike-old">{s.text}</span>
            <span className="tnum ml-1.5 whitespace-nowrap text-xs">Replaced at {i === 0 ? f.since : f.superseded[i - 1].at}</span>
          </p>
        ))}
        {!verified && f.check && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-warn">
            {f.owner && <Avatar id={f.owner} size={18} />}
            <span className="text-pretty">
              {f.owner ? `${person(f.owner).name}: ` : ""}
              {f.check}
            </span>
          </p>
        )}
        <SourceChips ids={f.sourceIds} className="mt-2" />
      </div>
    </li>
  );
}

function asText(facts: FactView[]): string {
  const lines = ["Board one-pager: Q3 results and Davr Bank status", ""];
  for (const section of ORDER) {
    const rows = facts.filter((f) => f.section === section);
    if (!rows.length) continue;
    lines.push(SECTION_TITLE[section]);
    for (const f of rows) lines.push(`- ${f.text}${f.status === "needs-check" ? " (unconfirmed)" : ""}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}
