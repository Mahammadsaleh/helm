import type { CheckpointOutput } from "@/lib/ai/schema";

/**
 * Financial figures only: currency amounts, percentages and decimals with a
 * unit. Times and small counts are left alone; time math is the engine's job.
 */
const MATERIAL = /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:bn|[MmKkBb])?|\d+(?:\.\d+)?\s?%|\d+\.\d+\s?(?:bn|[MmKk])\b/g;

export function materialNumbers(text: string): string[] {
  return [...new Set(text.match(MATERIAL) ?? [])];
}

function core(figure: string): string {
  return figure.replace(/[$%\s,]/g, "").replace(/(bn|[MmKkBb])$/, "");
}

export function isGrounded(figure: string, sources: string[]): boolean {
  const n = core(figure).replace(".", "\\.");
  const re = new RegExp(`(?<![\\d.])${n}(?!\\.?\\d)`);
  return sources.some((s) => re.test(s));
}

export interface GuardIssue {
  where: string;
  id: string;
  figures: string[];
}

type Lookup = (id: string) => string | undefined;

function check(
  issues: GuardIssue[],
  where: string,
  id: string,
  texts: (string | null | undefined)[],
  sourceIds: string[],
  lookup: Lookup,
) {
  const sources = sourceIds.map(lookup).filter((s): s is string => Boolean(s));
  const figures = texts
    .filter((t): t is string => Boolean(t))
    .flatMap(materialNumbers)
    .filter((f) => !isGrounded(f, sources));
  if (figures.length) issues.push({ where, id, figures: [...new Set(figures)] });
}

/** Every material figure must appear in one of the sources the model cited. */
export function guardOutput(out: CheckpointOutput, lookup: Lookup): GuardIssue[] {
  const issues: GuardIssue[] = [];
  check(issues, "headline", "headline", [out.headline], out.alerts.flatMap((a) => a.sourceIds).concat(out.facts.flatMap((f) => f.sourceIds)), lookup);
  for (const d of out.decisions) {
    check(issues, "decision", d.id, [d.title, d.whyYou, ...d.options.flatMap((o) => [o.label, o.consequence])], d.sourceIds, lookup);
  }
  for (const d of out.delegations) check(issues, "delegation", d.id, [d.subject, d.body], d.sourceIds, lookup);
  for (const p of out.planChanges) check(issues, "plan change", p.id, [p.reason, p.message?.body], p.sourceIds, lookup);
  for (const b of out.briefs) check(issues, "brief", b.eventId, [b.summary, ...b.youDecide, ...b.watchOut], b.sourceIds, lookup);
  for (const f of out.facts) check(issues, "fact", f.key, [f.text, f.check], f.sourceIds, lookup);
  for (const a of out.alerts) check(issues, "alert", a.id, [a.title, a.detail], a.sourceIds, lookup);
  if (out.callKit) {
    check(issues, "call kit", out.callKit.eventId, [out.callKit.purpose, ...out.callKit.agenda.map((a) => a.en), ...out.callKit.doNotCommit], out.callKit.sourceIds, lookup);
  }
  if (out.digest) {
    for (const e of out.digest.episodes) check(issues, "digest", e.itemId, [e.script], [e.itemId], lookup);
  }
  return issues;
}
