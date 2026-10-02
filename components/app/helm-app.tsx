"use client";

import {
  BatteryFullIcon,
  CellSignalFullIcon,
  CheckSquareOffsetIcon,
  FileTextIcon,
  SunHorizonIcon,
  TrayIcon,
  WifiHighIcon,
  type Icon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { toMin } from "@/lib/time";
import { useHelm, type Tab } from "../helm-context";
import { Avatar, SheetRoot, cx } from "../ui";
import { DecideView } from "./decide-view";
import { FeedView } from "./feed-view";
import { MayaView } from "./maya-view";
import { OnePagerView } from "./onepager-view";
import { CallKitSheet, SourceSheet } from "./sheets";
import { TodayView } from "./today-view";

const TABS: { id: Tab; label: string; icon: Icon }[] = [
  { id: "today", label: "Today", icon: SunHorizonIcon },
  { id: "decide", label: "Decide", icon: CheckSquareOffsetIcon },
  { id: "onepager", label: "One-pager", icon: FileTextIcon },
  { id: "feed", label: "Feed", icon: TrayIcon },
];

export function HelmApp() {
  const { url, view } = useHelm();
  const scroller = useRef<HTMLElement>(null);
  const maya = url.as === "maya";
  const checkpointId = view.checkpoint?.id;

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [url.tab, url.as, url.path, checkpointId]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-canvas">
      <StatusBar />
      <TopBar />
      <main ref={scroller} id="helm-main" className="scroll-area relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={maya ? "maya" : url.tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {maya ? (
              <MayaView />
            ) : url.tab === "today" ? (
              <TodayView />
            ) : url.tab === "decide" ? (
              <DecideView />
            ) : url.tab === "onepager" ? (
              <OnePagerView />
            ) : (
              <FeedView />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      {!maya && <TabBar />}
      <Toasts />
      <SheetRoot />
      <SourceSheet />
      <CallKitSheet />
    </div>
  );
}

function StatusBar() {
  const { view } = useHelm();
  return (
    <div className="hidden h-11 shrink-0 items-center justify-between px-7 pt-1 text-ink lg:flex" aria-hidden="true">
      <span className="tnum text-[15px] font-semibold">{view.now}</span>
      <span className="flex items-center gap-1.5">
        <CellSignalFullIcon size={16} weight="fill" />
        <WifiHighIcon size={16} weight="bold" />
        <BatteryFullIcon size={22} weight="fill" />
      </span>
    </div>
  );
}

function TopBar() {
  const { view, url, live } = useHelm();
  const maya = url.as === "maya";
  const cp = view.checkpoint;
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-hairline px-4">
      <div className="flex items-center gap-2">
        <HelmMark />
        <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Helm</span>
        {maya && <span className="rounded-full bg-surface-strong px-2 py-0.5 text-xs font-medium text-ink">Delegate</span>}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {url.path === "default" ? (
          <span className="truncate rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Without Helm</span>
        ) : cp ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <span
              className={cx("size-1.5 shrink-0 rounded-full", live.overrides[cp.id] || cp.generatedBy === "model" ? "bg-success" : "bg-pill-done")}
              aria-hidden="true"
            />
            <span className="truncate">
              Analysed <span className="tnum font-mono">{cp.at}</span>
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted">Waiting for 08:30</span>
        )}
        <Avatar id={maya ? "maya" : "ceo"} size={26} />
      </div>
    </div>
  );
}

export function HelmMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <rect width="24" height="24" rx="6" className="fill-ink" />
      <circle cx="12" cy="12" r="6" fill="none" strokeWidth="2" className="stroke-canvas" />
      <circle cx="12" cy="12" r="2.25" className="fill-accent" />
    </svg>
  );
}

function TabBar() {
  const { view, url, setUrl, user, checkpoints } = useHelm();
  const helm = url.path === "helm";
  const seenAt = checkpoints.find((c) => c.id === user.onePagerSeenCheckpoint)?.at;
  const lastFactChange = view.facts.reduce(
    (max, f) => Math.max(max, toMin(f.since), toMin(f.statusChangedAt)),
    -1,
  );
  const onePagerDot = helm && lastFactChange >= 0 && (!seenAt || lastFactChange > toMin(seenAt));
  const badges: Partial<Record<Tab, string | null>> = {
    decide: helm && view.decisionsOpen.length ? String(view.decisionsOpen.length) : null,
    feed: helm && view.pendingItemIds.size ? String(view.pendingItemIds.size) : null,
  };

  return (
    <nav aria-label="Sections" className="shrink-0 border-t border-hairline bg-canvas/95 pb-[max(6px,env(safe-area-inset-bottom))] backdrop-blur-sm">
      <ul className="grid grid-cols-4">
        {TABS.map((t) => {
          const active = url.tab === t.id;
          const badge = badges[t.id];
          const Glyph = t.icon;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setUrl({ tab: t.id })}
                aria-current={active ? "page" : undefined}
                aria-label={[
                  t.label,
                  badge && (t.id === "decide" ? `${badge} need you` : `${badge} new since analysis`),
                  t.id === "onepager" && onePagerDot && "updated",
                ]
                  .filter(Boolean)
                  .join(", ")}
                className={cx(
                  "relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-ink" : "text-muted hover:text-body",
                )}
              >
                <span className="relative">
                  <Glyph size={22} weight={active ? "fill" : "regular"} aria-hidden="true" />
                  {badge && (
                    <span
                      aria-hidden="true"
                      className="tnum absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-ink px-1 text-[10px] font-semibold text-on-accent"
                    >
                      {badge}
                    </span>
                  )}
                  {t.id === "onepager" && onePagerDot && (
                    <span aria-hidden="true" className="absolute -right-1 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-canvas" />
                  )}
                </span>
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Toasts() {
  const { toasts } = useHelm();
  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-20 z-40 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-canvas shadow-[0_8px_24px_-12px_rgb(0_0_0/0.5)]"
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
