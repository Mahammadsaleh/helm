import { Suspense } from "react";
import { HelmShell } from "@/components/demo/helm-shell";
import { HelmProvider } from "@/components/helm-context";
import { chooseModel } from "@/lib/ai/provider";
import { loadCheckpoints } from "@/lib/data/checkpoints.server";
import { loadDay } from "@/lib/data/day.server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [day, checkpoints] = await Promise.all([loadDay(), loadCheckpoints()]);
  const model = chooseModel()?.label ?? null;

  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-canvas" />}>
      <HelmProvider day={day} checkpoints={checkpoints} liveModel={model}>
        <HelmShell />
      </HelmProvider>
    </Suspense>
  );
}
