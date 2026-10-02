import type {
  CheckpointOutput,
  Decision,
  Delegation,
  Fact,
  PlanChange,
} from "@/lib/ai/schema";

/** Wall-clock time on the scenario day, "HH:MM" (24h). */
export type HHMM = string;

export type Org =
  | "ABB Super Bank"
  | "Davr Bank"
  | "TechInsight"
  | "TechCorp"
  | "External";

export interface Person {
  id: string;
  name: string;
  role: string;
  org: Org;
}

export type Provenance =
  | { kind: "file"; file: string; note?: string }
  | { kind: "reconstructed"; missing: string; groundedIn: string[]; note?: string }
  | { kind: "imported"; file: string };

export type ItemKind = "email" | "slack" | "doc" | "article";

export interface Item {
  id: string;
  kind: ItemKind;
  at: HHMM;
  from: string;
  /** Human reference, e.g. "Email #25" or "#comms 13:16". */
  ref: string;
  channel?: string;
  subject?: string;
  text: string;
  provenance: Provenance;
  /**
   * Messages that only exist because nobody acted (e.g. "still haven't heard back").
   * Replaying the day with Helm excludes them; "Without Helm" mode shows them.
   */
  defaultPathOnly?: boolean;
}

export type EventKind = "meeting" | "call" | "interview" | "focus";

export interface CalEvent {
  id: string;
  start: HHMM;
  end: HHMM;
  title: string;
  attendees: string[];
  kind: EventKind;
  location?: string;
  notes?: string;
  provenance: Provenance;
}

export interface Day {
  date: string;
  people: Record<string, Person>;
  events: CalEvent[];
  items: Item[];
  sourcesNote: string[];
}

export interface Checkpoint {
  id: string;
  at: HHMM;
  label: string;
  trigger: string;
  output: CheckpointOutput;
  generatedBy: "seed" | "model";
  model?: string;
  generatedAt?: string;
}

export type { CheckpointOutput, Decision, Delegation, Fact, PlanChange };

export interface UserState {
  decisions: Record<
    string,
    { optionId: string; optionLabel: string; title: string; at: HHMM }
  >;
  planChanges: Record<string, "accepted" | "dismissed">;
  delegations: Record<string, { at: HHMM; to: string; summary: string }>;
  onePagerSentAt?: HHMM;
  kitSentAt?: HHMM;
  onePagerSeenCheckpoint?: string;
}

export const EMPTY_USER_STATE: UserState = {
  decisions: {},
  planChanges: {},
  delegations: {},
};
