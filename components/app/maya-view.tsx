"use client";

import { CheckCircleIcon, CircleIcon, EyeSlashIcon, LockSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toMin } from "@/lib/time";
import { useHelm } from "../helm-context";
import { EmptyState, Pill, SectionTitle, cx } from "../ui";

interface Ask {
  id: string;
  at: string;
  text: string;
}

export function MayaView() {
  const { view, user, checkpoints, url } = useHelm();
  const [done, setDone] = useState<Set<string>>(new Set());
  const now = toMin(view.now);
  const access = user.delegations["dlg-maya-cover"];

  if (url.path === "default" || !access || toMin(access.at) > now) {
    return (
      <div className="px-4">
        <EmptyState
          icon={LockSimpleIcon}
          title="No access yet"
          body="Maya sees the CEO's calendar only after the CEO asks her to cover. Helm drafts that ask in the 08:30 brief."
        />
      </div>
    );
  }

  const past = checkpoints.filter((c) => toMin(c.at) <= now);
  const asks: Ask[] = [];
  for (const c of past) {
    for (const d of c.output.delegations) {
      const sent = user.delegations[d.id];
      if (d.to === "maya" && sent && toMin(sent.at) <= now && !asks.some((a) => a.id === d.id)) {
        asks.push({ id: d.id, at: sent.at, text: d.body });
      }
    }
    for (const p of c.output.planChanges) {
      if (p.message?.to === "maya" && user.planChanges[p.id] === "accepted" && !asks.some((a) => a.id === p.id)) {
        asks.push({ id: p.id, at: c.at, text: p.message.body });
      }
    }
  }
  asks.sort((a, b) => toMin(b.at) - toMin(a.at));
  const changed = view.events.filter((e) => e.original || e.status !== "scheduled" || e.addedBy);

  const toggle = (id: string) =>
    setDone((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="px-4 pb-6">
      <header className="px-1 pt-2">
        <p className="text-[13px] text-muted">Maya, covering the CEO&apos;s calendar</p>
        <h1 className="mt-1.5 text-[23px] font-normal leading-[1.22] tracking-[-0.02em] text-ink text-balance">
          {asks.length - done.size > 0
            ? `${asks.length - done.size} ${asks.length - done.size === 1 ? "thing" : "things"} to do for the CEO.`
            : "All caught up."}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-body text-pretty">
          Access granted at <span className="tnum font-mono">{access.at}</span>: calendar and anything Helm routes to you.
        </p>
      </header>

      <SectionTitle count={asks.length}>Asks from the CEO</SectionTitle>
      <ul className="flex flex-col gap-2">
        {asks.map((a) => {
          const isDone = done.has(a.id);
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => toggle(a.id)}
                aria-pressed={isDone}
                className="flex w-full items-start gap-3 rounded-xl border border-hairline bg-card p-3.5 text-left"
              >
                {isDone ? (
                  <CheckCircleIcon size={20} weight="fill" className="shrink-0 text-success" aria-hidden="true" />
                ) : (
                  <CircleIcon size={20} weight="bold" className="shrink-0 text-hairline-strong" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={cx("block text-sm leading-relaxed text-pretty", isDone ? "text-muted line-through" : "text-ink")}>
                    {a.text}
                  </span>
                  <span className="tnum mt-1 block font-mono text-xs text-muted">{a.at}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <SectionTitle count={changed.length}>Calendar changes today</SectionTitle>
      <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-card">
        {changed.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-3.5 py-3">
            <span className="tnum w-11 shrink-0 font-mono text-xs text-ink">{e.start}</span>
            <span className="min-w-0 flex-1">
              <span className={cx("block text-[13px] font-medium leading-snug", e.status === "scheduled" ? "text-ink" : "text-muted line-through")}>
                {e.title}
              </span>
              <span className="mt-1 flex flex-wrap gap-1.5">
                {e.addedBy && <Pill tone="accent">New block</Pill>}
                {e.status === "delegated" && <Pill>Delegated</Pill>}
                {e.status === "deferred" && <Pill>Tomorrow</Pill>}
                {e.original && e.status === "scheduled" && !e.addedBy && (
                  <Pill>
                    Was {e.original.start}-{e.original.end}
                  </Pill>
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed border-hairline-strong p-3.5">
        <EyeSlashIcon size={18} weight="bold" className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
        <p className="text-[13px] leading-relaxed text-body text-pretty">
          Hidden from Maya: email bodies, the board one-pager, the press inquiry and the Davr Bank terms.
        </p>
      </div>
    </div>
  );
}
