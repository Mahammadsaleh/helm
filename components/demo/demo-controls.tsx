"use client";

import {
  ArrowClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  LightningIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { DAY_END, DAY_START, fromMin, relative, toMin } from "@/lib/time";
import { useHelm } from "../helm-context";
import { Button, Segmented, Sheet, cx, useTriggerText } from "../ui";
import { Inspector } from "./inspector";

const MIN = toMin(DAY_START);
const MAX = toMin(DAY_END);

function useCheckpointNav() {
  const { checkpoints, view, setTime } = useHelm();
  const now = toMin(view.now);
  const prev = [...checkpoints].reverse().find((c) => toMin(c.at) < now) ?? null;
  const next = checkpoints.find((c) => toMin(c.at) > now) ?? null;
  return {
    prev,
    next,
    goPrev: () => setTime(prev ? prev.at : DAY_START),
    goNext: () => next && setTime(next.at),
  };
}

export function Clock() {
  const { view, setTime, checkpoints } = useHelm();
  const { prev, next, goPrev, goNext } = useCheckpointNav();
  const value = toMin(view.now);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted">Scenario clock</p>
          <p className="tnum mt-0.5 font-mono text-[40px] font-medium leading-none tracking-[-0.03em] text-ink">{view.now}</p>
        </div>
        <div className="flex gap-1.5 pb-1">
          <button
            type="button"
            onClick={goPrev}
            disabled={!prev && value <= MIN}
            aria-label={prev ? `Back to ${prev.at} ${prev.label}` : "Back to start of day"}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-hairline-strong bg-card text-ink transition-colors hover:bg-canvas-soft disabled:opacity-40"
          >
            <CaretLeftIcon size={16} weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!next}
            aria-label={next ? `Jump to ${next.at} ${next.label}` : "No later checkpoint"}
            className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-ink text-on-accent transition-[filter] hover:brightness-95 disabled:opacity-40"
          >
            <CaretRightIcon size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="relative mt-3">
        <input
          type="range"
          className="clock w-full"
          min={MIN}
          max={MAX}
          step={5}
          value={value}
          onChange={(e) => setTime(fromMin(Number(e.target.value)))}
          aria-label="Scenario time"
          aria-valuetext={view.now}
        />
        <div className="pointer-events-none relative -mt-1 h-4" aria-hidden="true">
          {checkpoints.map((c) => (
            <span
              key={c.id}
              className={cx(
                "absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded-full",
                toMin(c.at) <= value ? "bg-accent" : "bg-hairline-strong",
              )}
              style={{ left: `calc(9px + (100% - 18px) * ${(toMin(c.at) - MIN) / (MAX - MIN)})` }}
            />
          ))}
        </div>
        <div className="tnum flex justify-between font-mono text-[11px] text-muted" aria-hidden="true">
          <span>{DAY_START}</span>
          <span>{DAY_END}</span>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-body">
        {next ? (
          <>
            Next: <span className="font-medium text-ink">{next.label}</span> at{" "}
            <span className="tnum font-mono">{next.at}</span>, {relative(view.now, next.at)}
          </>
        ) : (
          "All five checkpoints have run."
        )}
      </p>
    </div>
  );
}

export function CheckpointList() {
  const { checkpoints, view, setTime, url, live } = useHelm();
  const triggerText = useTriggerText();
  const now = toMin(view.now);
  return (
    <ol className="flex flex-col gap-1">
      {checkpoints.map((c) => {
        const active = url.path === "helm" && view.checkpoint?.id === c.id;
        const future = toMin(c.at) > now;
        const isLive = Boolean(live.overrides[c.id]) || c.generatedBy === "model";
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setTime(c.at)}
              aria-current={active ? "step" : undefined}
              className={cx(
                "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                active ? "border-accent bg-card" : "border-transparent hover:bg-card/70",
              )}
            >
              <span className={cx("tnum mt-px font-mono text-[13px]", future ? "text-muted" : "text-ink")}>{c.at}</span>
              <span className="min-w-0 flex-1">
                <span className={cx("flex items-center gap-1.5 text-[13px] font-medium", future ? "text-body" : "text-ink")}>
                  {c.label}
                  {isLive && <span className="rounded-full bg-success-soft px-1.5 text-[10px] font-semibold text-success">Live</span>}
                </span>
                <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-muted">{triggerText(c.trigger)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function ModeControls() {
  const { url, setUrl } = useHelm();
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Replay the day</p>
        <Segmented
          label="Replay the day"
          value={url.path}
          onChange={(path) => setUrl({ path })}
          options={[
            { id: "helm", label: "With Helm" },
            { id: "default", label: "Without Helm" },
          ]}
        />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">View as</p>
        <Segmented
          label="View as"
          value={url.as}
          onChange={(as) => setUrl({ as })}
          options={[
            { id: "ceo", label: "CEO" },
            { id: "maya", label: "Maya, delegate" },
          ]}
        />
      </div>
    </div>
  );
}

export function LivePanel() {
  const { live, view, reset } = useHelm();
  const cp = view.checkpoint;
  return (
    <div className="flex flex-col gap-2">
      {live.model ? (
        <>
          <Button onClick={live.run} disabled={!cp || live.running} className="w-full">
            <LightningIcon size={16} weight="bold" aria-hidden="true" />
            {live.running ? "Analysing…" : cp ? `Re-run ${cp.at} Live` : "No checkpoint yet"}
          </Button>
          <p className="text-xs leading-relaxed text-muted">
            Uses <span className="font-mono">{live.model}</span> with the same schema and checks.
          </p>
        </>
      ) : (
        <p className="text-xs leading-relaxed text-muted text-pretty">
          Showing the bundled analysis, written against the same schema and held to the same source and number checks as live
          output. Add <span className="font-mono">OPENAI_API_KEY</span> or <span className="font-mono">ANTHROPIC_API_KEY</span> to
          re-run any checkpoint with a model.
        </p>
      )}
      {live.error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-2.5 text-xs text-danger">
          {live.error}
        </p>
      )}
      <Button variant="ghost" size="sm" onClick={reset} className="self-start">
        <ArrowClockwiseIcon size={14} weight="bold" aria-hidden="true" />
        Reset Demo
      </Button>
    </div>
  );
}

export function DataNote() {
  return (
    <p className="text-xs leading-relaxed text-muted text-pretty">
      The calendar and inbox spreadsheets were not in the brief, so those entries are rebuilt from the text files and marked as
      reconstructed in each source. Slack, the call brief, the reporter&apos;s email and the board notes are verbatim.
    </p>
  );
}

export function MobileDemoBar() {
  const { view } = useHelm();
  const { prev, next, goPrev, goNext } = useCheckpointNav();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-2 bg-ink px-2 pt-[env(safe-area-inset-top)] text-canvas lg:hidden">
        <button
          type="button"
          onClick={goPrev}
          disabled={!prev && toMin(view.now) <= MIN}
          aria-label={prev ? `Back to ${prev.at}` : "Back to start of day"}
          className="inline-flex size-9 items-center justify-center rounded-lg disabled:opacity-40"
        >
          <CaretLeftIcon size={16} weight="bold" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <span className="tnum font-mono text-[15px] font-medium">{view.now}</span>
          <span className="ml-2 text-xs text-canvas/70">{next ? `next ${next.at}` : "end of day"}</span>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={!next}
          aria-label={next ? `Jump to ${next.at} ${next.label}` : "No later checkpoint"}
          className="inline-flex size-9 items-center justify-center rounded-lg disabled:opacity-40"
        >
          <CaretRightIcon size={16} weight="bold" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Demo controls"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-canvas/15 px-2.5 text-xs font-medium"
        >
          <SlidersHorizontalIcon size={14} weight="bold" aria-hidden="true" />
          Demo
        </button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Demo controls">
        <div className="flex flex-col gap-6">
          <Clock />
          <ModeControls />
          <CheckpointList />
          <Inspector />
          <LivePanel />
          <DataNote />
        </div>
      </Sheet>
    </>
  );
}
