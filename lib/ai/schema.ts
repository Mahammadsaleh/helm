import { z } from "zod";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");
const sourceIds = z.array(z.string()).min(1);

/**
 * Fixed vocabulary for one-pager facts. A stable key is what lets the engine
 * notice that a newer figure replaces an older one; free-form keys drift.
 */
export const FACT_KEYS = [
  "q3.nii",
  "q3.cost_income",
  "q3.ai_assistant",
  "q3.acme",
  "q3.techcorp",
  "q3.attrition",
  "q3.competition",
  "q3.tech_debt",
  "q3.it_headcount",
  "davr.capital",
  "davr.dsa",
  "davr.call",
  "davr.terms",
  "davr.cbu",
  "press.rumor",
  "press.statement",
] as const;

export const FACT_SECTIONS = ["highlights", "risks", "davr", "press"] as const;

export const DecisionSchema = z.object({
  id: z.string(),
  title: z.string(),
  dueAt: time.nullable(),
  dueLabel: z.string().nullable(),
  effortMin: z.number().int().min(1).max(120),
  whyYou: z.string(),
  options: z
    .array(z.object({ id: z.string(), label: z.string(), consequence: z.string() }))
    .min(2)
    .max(4),
  recommendedOptionId: z.string(),
  risk: z.enum(["high", "medium", "low"]),
  sourceIds,
});

export const DelegationSchema = z.object({
  id: z.string(),
  to: z.string(),
  channel: z.enum(["email", "slack"]),
  subject: z.string().nullable(),
  body: z.string(),
  reason: z.string(),
  sourceIds,
});

export const PlanChangeSchema = z.object({
  id: z.string(),
  eventId: z.string().nullable(),
  action: z.enum(["move", "shorten", "extend", "delegate", "defer", "add"]),
  start: time.nullable(),
  end: time.nullable(),
  title: z.string().nullable(),
  delegateTo: z.string().nullable(),
  forDecisionId: z.string().nullable(),
  reason: z.string(),
  message: z.object({ to: z.string(), body: z.string() }).nullable(),
  sourceIds,
});

export const BriefSchema = z.object({
  eventId: z.string(),
  summary: z.string(),
  youDecide: z.array(z.string()),
  watchOut: z.array(z.string()),
  sourceIds,
});

export const FactSchema = z.object({
  key: z.enum(FACT_KEYS),
  section: z.enum(FACT_SECTIONS),
  text: z.string(),
  status: z.enum(["verified", "needs-check"]),
  check: z.string().nullable(),
  owner: z.string().nullable(),
  sourceIds,
});

export const TriageSchema = z.object({
  itemId: z.string(),
  bucket: z.enum(["you", "delegate", "fyi", "noise"]),
  reason: z.string(),
  eventId: z.string().nullable(),
});

export const AlertSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "conflict",
    "contradiction",
    "stale",
    "deadline",
    "hidden-dependency",
    "risk",
  ]),
  title: z.string(),
  detail: z.string(),
  sourceIds,
});

export const DeadlineSchema = z.object({
  id: z.string(),
  at: time,
  label: z.string(),
  hard: z.boolean(),
  sourceIds,
});

const Trilingual = z.object({ en: z.string(), uz: z.string(), ru: z.string() });

export const CallKitSchema = z.object({
  eventId: z.string(),
  purpose: z.string(),
  opening: Trilingual,
  agenda: z.array(Trilingual),
  glossary: z.array(
    z.object({ term: z.string(), en: z.string(), uz: z.string(), ru: z.string() }),
  ),
  doNotCommit: z.array(z.string()),
  sourceIds,
});

export const DigestSchema = z.object({
  pulledForward: z.array(
    z.object({ itemId: z.string(), eventId: z.string(), reason: z.string() }),
  ),
  episodes: z.array(
    z.object({ itemId: z.string(), minutes: z.number(), title: z.string(), script: z.string() }),
  ),
  skipped: z.array(z.object({ itemId: z.string(), reason: z.string() })),
});

export const CheckpointOutputSchema = z.object({
  headline: z.string(),
  decisions: z.array(DecisionSchema),
  delegations: z.array(DelegationSchema),
  planChanges: z.array(PlanChangeSchema),
  briefs: z.array(BriefSchema),
  facts: z.array(FactSchema),
  triage: z.array(TriageSchema),
  alerts: z.array(AlertSchema),
  deadlines: z.array(DeadlineSchema),
  callKit: CallKitSchema.nullable(),
  digest: DigestSchema.nullable(),
});

export type Decision = z.infer<typeof DecisionSchema>;
export type Delegation = z.infer<typeof DelegationSchema>;
export type PlanChange = z.infer<typeof PlanChangeSchema>;
export type Brief = z.infer<typeof BriefSchema>;
export type Fact = z.infer<typeof FactSchema>;
export type FactKey = (typeof FACT_KEYS)[number];
export type FactSection = (typeof FACT_SECTIONS)[number];
export type Triage = z.infer<typeof TriageSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type Deadline = z.infer<typeof DeadlineSchema>;
export type CallKit = z.infer<typeof CallKitSchema>;
export type Digest = z.infer<typeof DigestSchema>;
export type CheckpointOutput = z.infer<typeof CheckpointOutputSchema>;
