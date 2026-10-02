"use client";

import { HeadphonesIcon, PauseIcon, PlayIcon, SkipForwardIcon, SpeakerHighIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { Triage } from "@/lib/ai/schema";
import { toMin } from "@/lib/time";
import type { Item } from "@/lib/types";
import { useHelm, type FeedFilter } from "../helm-context";
import { Avatar, KIND_ICON, Pill, cx, useHydrated } from "../ui";

const BUCKET_LABEL: Record<Triage["bucket"], string> = {
  you: "For you",
  delegate: "Delegate",
  fyi: "FYI",
  noise: "Noise",
};

const BUCKET_TONE = { you: "accent", delegate: "neutral", fyi: "neutral", noise: "neutral" } as const;

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "you", label: "For You" },
  { id: "delegate", label: "Delegate" },
  { id: "fyi", label: "FYI" },
  { id: "noise", label: "Noise" },
];

export function FeedView() {
  const { view, url, setUrl } = useHelm();
  const helm = url.path === "helm";
  const items = [...view.items].reverse();
  const bucketOf = (i: Item) => view.triage.get(i.id)?.bucket;
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.id, f.id === "all" ? items.length : items.filter((i) => bucketOf(i) === f.id).length]),
  ) as Record<FeedFilter, number>;
  const shown = helm && url.feed !== "all" ? items.filter((i) => bucketOf(i) === url.feed) : items;

  return (
    <div className="pb-6">
      <header className="px-5 pt-2">
        <p className="text-[13px] text-muted">Inbox, Slack and documents</p>
        <h1 className="mt-1.5 text-[23px] font-normal leading-[1.22] tracking-[-0.02em] text-ink text-balance">
          {helm
            ? `${items.length} arrived so far. ${counts.you} need you.`
            : `${items.length} arrived so far, unsorted.`}
        </h1>
      </header>

      {helm && view.digest && <Digest />}

      {helm && (
        <div className="sticky top-0 z-10 mt-4 bg-canvas/95 px-4 py-2 backdrop-blur-sm">
          <div role="group" aria-label="Filter by triage" className="scroll-area -mx-1 flex gap-1 overflow-x-auto px-1">
            {FILTERS.map((f) => {
              const active = url.feed === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setUrl({ feed: f.id })}
                  className={cx(
                    "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[13px] font-medium transition-colors",
                    active ? "border-ink bg-ink text-canvas" : "border-hairline-strong bg-card text-body hover:text-ink",
                  )}
                >
                  {f.label}
                  <span className={cx("tnum text-xs", active ? "text-canvas/70" : "text-muted")}>{counts[f.id]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ul className={cx("flex flex-col px-4", !helm && "mt-4")}>
        {shown.map((item) => (
          <FeedRow key={item.id} item={item} />
        ))}
      </ul>
      {shown.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">Nothing in this bucket yet.</p>}
    </div>
  );
}

function FeedRow({ item }: { item: Item }) {
  const { view, url, setUrl, person } = useHelm();
  const helm = url.path === "helm";
  const triage = helm ? view.triage.get(item.id) : undefined;
  const pending = helm && view.pendingItemIds.has(item.id);
  const Glyph = KIND_ICON[item.kind];
  const from = person(item.from);
  const title = item.subject ?? item.text.split("\n")[0];
  const preview = item.subject ? item.text : item.text.split("\n").slice(1).join(" ");

  return (
    <li className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        onClick={() => setUrl({ src: item.id })}
        className={cx(
          "flex w-full items-start gap-3 px-1 py-3.5 text-left transition-colors hover:bg-card/60",
          triage?.bucket === "noise" && "opacity-60",
        )}
      >
        <Avatar id={item.from} size={32} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{from.name}</span>
            <span className="tnum shrink-0 font-mono text-xs text-muted">{item.at}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <Glyph size={12} weight="bold" aria-hidden="true" />
            <span className="truncate">{item.channel ?? item.ref}</span>
          </span>
          <span className="mt-1 block line-clamp-1 text-sm font-medium text-ink">{title}</span>
          {preview && <span className="mt-0.5 block line-clamp-2 text-[13px] leading-relaxed text-body">{preview}</span>}
          {(triage || pending || item.defaultPathOnly) && (
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              {triage && <Pill tone={BUCKET_TONE[triage.bucket]}>{BUCKET_LABEL[triage.bucket]}</Pill>}
              {triage && <span className="min-w-0 truncate text-xs text-muted">{triage.reason}</span>}
              {pending && <Pill tone="warn">Arrived after {view.checkpoint?.at} analysis</Pill>}
              {item.defaultPathOnly && <Pill tone="danger">Only happens without Helm</Pill>}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function Digest() {
  const { view, day, setUrl } = useHelm();
  const digest = view.digest!;
  const hydrated = useHydrated();
  const canSpeak = hydrated && "speechSynthesis" in window;
  const [playing, setPlaying] = useState<number | null>(null);
  const queue = useRef<number>(0);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const play = (index: number) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const episode = digest.episodes[index];
    if (!episode) {
      setPlaying(null);
      return;
    }
    const u = new SpeechSynthesisUtterance(`${episode.title}. ${episode.script}`);
    u.lang = "en-US";
    u.rate = 1.05;
    queue.current = index;
    u.onend = () => {
      if (queue.current === index) play(index + 1);
    };
    setPlaying(index);
    synth.speak(u);
  };

  const stop = () => {
    queue.current = -1;
    window.speechSynthesis.cancel();
    setPlaying(null);
  };

  const total = digest.episodes.reduce((s, e) => s + e.minutes, 0);
  const item = (id: string) => day.items.find((i) => i.id === id);
  const event = (id: string) => view.events.find((e) => e.id === id);
  const pulledForward = digest.pulledForward.filter((p) => {
    const e = event(p.eventId);
    return !e || toMin(e.start) > toMin(view.now);
  });

  return (
    <section aria-labelledby="digest-title" className="mx-4 mt-4 rounded-xl border border-hairline bg-card">
      <div className="flex items-center gap-3 p-4">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-strong text-ink">
          <HeadphonesIcon size={20} weight="bold" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="digest-title" className="text-sm font-semibold text-ink">
            Reading backlog, as audio
          </h2>
          <p className="text-xs text-muted">
            <span className="tnum">{digest.episodes.length}</span> episodes, about <span className="tnum">{total}</span> min for the
            commute home
          </p>
        </div>
        {playing === null ? (
          <button
            type="button"
            onClick={() => play(0)}
            disabled={!canSpeak}
            aria-label="Play digest"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-ink text-on-accent transition-transform active:scale-95 disabled:opacity-40"
          >
            <PlayIcon size={18} weight="fill" aria-hidden="true" />
          </button>
        ) : (
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => play(playing + 1)}
              aria-label="Next episode"
              className="inline-flex size-10 items-center justify-center rounded-full border border-hairline-strong text-ink"
            >
              <SkipForwardIcon size={16} weight="fill" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={stop}
              aria-label="Pause digest"
              className="inline-flex size-10 items-center justify-center rounded-full bg-accent-ink text-on-accent"
            >
              <PauseIcon size={18} weight="fill" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <ol className="border-t border-hairline px-4 py-2">
        {digest.episodes.map((e, i) => (
          <li key={e.itemId} className="flex items-center gap-2.5 py-1.5">
            <span
              className={cx(
                "tnum w-5 shrink-0 text-center font-mono text-xs",
                playing === i ? "font-semibold text-accent-ink" : "text-muted",
              )}
            >
              {playing === i ? <SpeakerHighIcon size={14} weight="fill" aria-label="Playing" className="inline" /> : i + 1}
            </span>
            <span className={cx("min-w-0 flex-1 truncate text-[13px]", playing === i ? "font-medium text-ink" : "text-body")}>{e.title}</span>
            <span className="tnum shrink-0 text-xs text-muted">{e.minutes} min</span>
          </li>
        ))}
      </ol>
      {(pulledForward.length > 0 || digest.skipped.length > 0) && (
        <div className="border-t border-hairline px-4 py-3 text-[13px] leading-relaxed text-body">
          {pulledForward.map((p) => (
            <div key={p.itemId}>
              <p className="text-xs font-medium text-muted">
                Read before {event(p.eventId) ? `the ${event(p.eventId)!.start} call` : "your next meeting"}
              </p>
              <button
                type="button"
                onClick={() => setUrl({ src: p.itemId })}
                className="mt-0.5 text-left font-medium text-accent-ink text-pretty hover:underline"
              >
                {item(p.itemId)?.subject ?? p.itemId}
              </button>
              <p className="text-pretty">{p.reason}.</p>
            </div>
          ))}
          {digest.skipped.map((s) => (
            <p key={s.itemId} className="mt-2 text-muted text-pretty">
              Skipped “{item(s.itemId)?.subject ?? s.itemId}”. {s.reason}.
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
