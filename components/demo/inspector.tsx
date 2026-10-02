"use client";

import { CheckCircleIcon, WarningIcon } from "@phosphor-icons/react";
import { toMin } from "@/lib/time";
import { useHelm } from "../helm-context";
import { cx, useTriggerText } from "../ui";

const ACTIVITY = {
  read: { label: "Read", className: "bg-pill-read" },
  flag: { label: "Flagged", className: "bg-pill-think" },
  propose: { label: "Proposed", className: "bg-pill-grep" },
  draft: { label: "Drafted", className: "bg-pill-edit" },
  ask: { label: "Asks you", className: "bg-pill-done" },
} as const;

export function Inspector() {
  const { view, day, checkpoints, url, live } = useHelm();
  const triggerText = useTriggerText();
  const cp = view.checkpoint;

  if (url.path === "default") {
    return (
      <section aria-labelledby="inspector-title">
        <h2 id="inspector-title" className="text-xs font-medium text-muted">
          Under the hood
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-body text-pretty">
          Without Helm nothing reads ahead. Messages that only exist because nobody acted, like the 16:20 and 16:40 chasers, now
          show up in the feed.
        </p>
      </section>
    );
  }

  if (!cp) {
    return (
      <section aria-labelledby="inspector-title">
        <h2 id="inspector-title" className="text-xs font-medium text-muted">
          Under the hood
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-body">The first analysis runs at 08:30.</p>
      </section>
    );
  }

  const index = checkpoints.findIndex((c) => c.id === cp.id);
  const prevAt = index > 0 ? toMin(checkpoints[index - 1].at) : -1;
  const at = toMin(cp.at);
  const read = day.items.filter((i) => !i.defaultPathOnly && toMin(i.at) > prevAt && toMin(i.at) <= at);
  const inputs = day.items.filter((i) => !i.defaultPathOnly && toMin(i.at) <= at).length;
  const hidden = day.items.filter((i) => !i.defaultPathOnly && toMin(i.at) > at).length;
  const out = cp.output;
  const isLive = Boolean(live.overrides[cp.id]) || cp.generatedBy === "model";
  const model = live.overrides[cp.id]?.model ?? cp.model;
  const withDeadline = view.decisionsOpen.filter((d) => d.feasibility.state === "ok" || d.feasibility.state === "infeasible");
  const futureOverlaps = view.overlaps.filter((o) => {
    const a = view.events.find((e) => e.id === o.a)!;
    const b = view.events.find((e) => e.id === o.b)!;
    return toMin(a.end) > toMin(view.now) && toMin(b.end) > toMin(view.now);
  });

  const rows: { kind: keyof typeof ACTIVITY; text: string }[] = [
    { kind: "read", text: `${read.length} new ${read.length === 1 ? "item" : "items"} since ${index > 0 ? checkpoints[index - 1].at : "the night before"}` },
    { kind: "flag", text: `${out.alerts.length} ${out.alerts.length === 1 ? "issue" : "issues"}: ${out.alerts.map((a) => a.title).slice(0, 2).join("; ") || "none"}` },
    { kind: "propose", text: `${out.planChanges.length} calendar ${out.planChanges.length === 1 ? "change" : "changes"}` },
    { kind: "draft", text: `${out.delegations.length} ${out.delegations.length === 1 ? "message" : "messages"} for others` },
    { kind: "ask", text: `${out.decisions.length} ${out.decisions.length === 1 ? "decision" : "decisions"} only you can make` },
  ];

  return (
    <section aria-labelledby="inspector-title" className="flex flex-col gap-5">
      <div>
        <h2 id="inspector-title" className="text-xs font-medium text-muted">
          Under the hood at <span className="tnum font-mono">{cp.at}</span>
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-body text-pretty">
          <span className="font-medium text-ink">Trigger:</span> {triggerText(cp.trigger)}
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.kind} className="flex items-start gap-2.5">
              <span
                className={cx(
                  "mt-px inline-flex w-[74px] shrink-0 justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-[#1d1c18]",
                  ACTIVITY[r.kind].className,
                )}
              >
                {ACTIVITY[r.kind].label}
              </span>
              <span className="min-w-0 text-[13px] leading-relaxed text-body text-pretty">{r.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-medium text-muted">Checked by code, not the model</h3>
        <ul className="mt-2 flex flex-col gap-2 text-[13px] leading-relaxed text-body">
          <Check ok>
            Saw {inputs} items stamped at or before {cp.at}. {hidden} later items were withheld.
          </Check>
          <Check ok={futureOverlaps.length === 0}>
            {futureOverlaps.length === 0
              ? "No overlapping meetings left in the plan."
              : `${futureOverlaps.length} overlapping ${futureOverlaps.length === 1 ? "meeting" : "meetings"} still in the plan.`}
          </Check>
          {withDeadline.map((d) => (
            <Check key={d.id} ok={d.feasibility.state === "ok"}>
              {d.feasibility.state === "ok"
                ? `${d.feasibility.free} free min before ${d.dueAt} for "${d.title}", needs ${d.effortMin}.`
                : d.feasibility.state === "infeasible" && d.feasibility.free > 0
                  ? `Only ${d.feasibility.free} free min before ${d.dueAt} for "${d.title}", needs ${d.effortMin}.`
                  : `No free time before ${d.dueAt} for "${d.title}", needs ${d.effortMin} min.`}
            </Check>
          ))}
          <Check ok={view.guard.length === 0}>
            {view.guard.length === 0
              ? "Every money and percentage figure appears in a cited source."
              : `${view.guard.length} figures not found in their sources: ${view.guard.map((g) => g.figures.join(", ")).join("; ")}.`}
          </Check>
        </ul>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        {isLive ? (
          <>
            Analysis by <span className="font-mono">{model}</span>.
          </>
        ) : (
          "Bundled analysis for this checkpoint."
        )}
      </p>
    </section>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircleIcon size={16} weight="fill" className="mt-0.5 shrink-0 text-success" aria-label="Pass" />
      ) : (
        <WarningIcon size={16} weight="fill" className="mt-0.5 shrink-0 text-danger" aria-label="Attention" />
      )}
      <span className="min-w-0 text-pretty">{children}</span>
    </li>
  );
}
