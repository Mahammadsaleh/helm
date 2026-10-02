import type { Fact } from "@/lib/ai/schema";
import type { Checkpoint, HHMM } from "@/lib/types";

export interface FactVersion {
  text: string;
  status: Fact["status"];
  sourceIds: string[];
  checkpointId: string;
  at: HHMM;
}

export interface FactView extends Fact {
  checkpointId: string;
  /** When this text first appeared. */
  since: HHMM;
  sinceCheckpointId: string;
  /** Older wordings this one replaced, newest first. */
  superseded: FactVersion[];
  statusChangedAt: HHMM;
}

/**
 * Merges one-pager facts across checkpoints. Same key + different text means
 * the newer fact replaces the older one, which is kept for the strikethrough.
 */
export function mergeFacts(checkpoints: Checkpoint[]): FactView[] {
  const byKey = new Map<string, FactView>();
  const order: string[] = [];

  for (const cp of checkpoints) {
    for (const f of cp.output.facts) {
      const prev = byKey.get(f.key);
      if (!prev) {
        order.push(f.key);
        byKey.set(f.key, {
          ...f,
          checkpointId: cp.id,
          since: cp.at,
          sinceCheckpointId: cp.id,
          superseded: [],
          statusChangedAt: cp.at,
        });
        continue;
      }
      if (prev.text !== f.text) {
        byKey.set(f.key, {
          ...f,
          checkpointId: cp.id,
          since: cp.at,
          sinceCheckpointId: cp.id,
          superseded: [
            { text: prev.text, status: prev.status, sourceIds: prev.sourceIds, checkpointId: prev.sinceCheckpointId, at: prev.since },
            ...prev.superseded,
          ],
          statusChangedAt: cp.at,
        });
      } else {
        byKey.set(f.key, {
          ...prev,
          ...f,
          checkpointId: cp.id,
          statusChangedAt: prev.status !== f.status ? cp.at : prev.statusChangedAt,
        });
      }
    }
  }
  return order.map((k) => byKey.get(k)!);
}
