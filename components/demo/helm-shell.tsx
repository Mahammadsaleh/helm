"use client";

import { HelmApp, HelmMark } from "../app/helm-app";
import { CheckpointList, Clock, DataNote, LivePanel, MobileDemoBar, ModeControls } from "./demo-controls";
import { useHydrated } from "../ui";
import { Inspector } from "./inspector";

export function HelmShell() {
  const hydrated = useHydrated();
  return (
    <div
      data-hydrated={hydrated || undefined}
      className="flex h-[100dvh] flex-col lg:h-auto lg:min-h-[100dvh] lg:flex-row lg:items-center lg:justify-center lg:gap-10 lg:px-8 lg:py-8 xl:gap-14"
    >
      <aside
        aria-label="Demo controls"
        className="scroll-area hidden w-[300px] shrink-0 flex-col gap-7 lg:flex lg:max-h-[calc(100dvh-64px)] lg:overflow-y-auto lg:pr-1"
      >
        <div>
          <div className="flex items-center gap-2">
            <HelmMark size={26} />
            <span className="text-lg font-semibold tracking-[-0.02em] text-ink">Helm</span>
          </div>
          <p className="mt-4 text-[28px] font-normal leading-[1.15] tracking-[-0.03em] text-ink text-balance">
            The CEO&apos;s impossible day, re-planned as it happens.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-body text-pretty">
            Move the clock. Helm only knows what has arrived by then, and re-plans at the five moments the day changes.
          </p>
        </div>
        <Clock />
        <ModeControls />
        <CheckpointList />
        <div className="xl:hidden">
          <Inspector />
        </div>
        <LivePanel />
        <DataNote />
      </aside>

      <MobileDemoBar />

      <div className="relative min-h-0 flex-1 lg:h-[min(844px,calc(100dvh-64px))] lg:w-[390px] lg:flex-none lg:rounded-[54px] lg:border-[10px] lg:border-bezel lg:shadow-[0_30px_80px_-30px_rgb(38_37_30/0.45)]">
        <div className="h-full overflow-hidden lg:rounded-[44px]">
          <HelmApp />
        </div>
      </div>

      <aside aria-label="What Helm did" className="scroll-area hidden w-[300px] shrink-0 xl:block xl:max-h-[calc(100dvh-64px)] xl:overflow-y-auto">
        <Inspector />
      </aside>
    </div>
  );
}
