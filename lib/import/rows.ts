import type { CalEvent, EventKind, HHMM, Item, Person } from "@/lib/types";
import { fromMin } from "@/lib/time";

export type Row = Record<string, unknown>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9#]/g, "");

/** Finds the first column whose normalised header matches one of the aliases. */
export function pick(row: Row, aliases: string[]): unknown {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const key = keys.find((k) => norm(k) === alias);
    if (key !== undefined && row[key] !== "" && row[key] != null) return row[key];
  }
  return undefined;
}

/** Accepts Excel day fractions, Date objects, "9:05", "09:05:00", "2:30 PM" and "2026-10-02 14:30". */
export function parseTime(value: unknown): HHMM | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return fromMin(value.getHours() * 60 + value.getMinutes());
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const fraction = value - Math.floor(value);
    return fromMin(Math.round(fraction * 24 * 60));
  }
  const m = String(value).match(/(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = m[3]?.toLowerCase().replace(/\./g, "");
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return fromMin(h * 60 + min);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** Maps "Sarah Chen <sarah@bank.com>" or "Sarah" onto a known person id when the name matches. */
export function personId(raw: string, people: Record<string, Person>): string {
  const name = raw.replace(/<[^>]*>/g, "").replace(/["']/g, "").trim();
  const lower = name.toLowerCase();
  const exact = Object.values(people).find((p) => p.name.toLowerCase() === lower);
  if (exact) return exact.id;
  const first = lower.split(/\s+/)[0];
  const partial = Object.values(people).find((p) => p.name.toLowerCase().split(/\s+/)[0] === first && first.length > 2);
  return partial?.id ?? (name || raw);
}

const splitList = (v: unknown) =>
  String(v ?? "")
    .split(/[;,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

function kindOf(title: string): EventKind {
  const t = title.toLowerCase();
  if (/interview|candidate/.test(t)) return "interview";
  if (/call|zoom|teams|dial/.test(t)) return "call";
  if (/focus|block|hold/.test(t)) return "focus";
  return "meeting";
}

export function rowsToEvents(
  rows: Row[],
  file: string,
  people: Record<string, Person>,
  known: CalEvent[] = [],
): { events: CalEvent[]; skipped: number } {
  const events: CalEvent[] = [];
  let skipped = 0;
  for (const row of rows) {
    const start = parseTime(pick(row, ["start", "starttime", "from", "begin", "time"]));
    const end = parseTime(pick(row, ["end", "endtime", "to", "finish", "until"]));
    const title = String(pick(row, ["title", "subject", "event", "meeting", "name", "summary"]) ?? "").trim();
    if (!start || !end || !title) {
      skipped++;
      continue;
    }
    const match = known.find((k) => k.start === start && !events.some((e) => e.id === k.id));
    const location = pick(row, ["location", "where", "room"]);
    const notes = pick(row, ["notes", "description", "details", "agenda"]);
    events.push({
      id: match?.id ?? `ev-${start.replace(":", "")}-${slug(title)}`,
      start,
      end,
      title,
      attendees: splitList(pick(row, ["attendees", "participants", "with", "guests", "invitees"])).map((a) => personId(a, people)),
      kind: match?.kind ?? kindOf(title),
      location: location ? String(location) : undefined,
      notes: notes ? String(notes) : undefined,
      provenance: { kind: "imported", file },
    });
  }
  return { events, skipped };
}

export function rowsToInbox(rows: Row[], file: string, people: Record<string, Person>): { inbox: Item[]; skipped: number } {
  const inbox: Item[] = [];
  let skipped = 0;
  rows.forEach((row, index) => {
    const at = parseTime(pick(row, ["time", "received", "receivedat", "date", "datetime", "sent", "timestamp"]));
    const body = String(pick(row, ["body", "text", "content", "message", "preview", "snippet"]) ?? "").trim();
    const subject = String(pick(row, ["subject", "title"]) ?? "").trim();
    if (!at || (!body && !subject)) {
      skipped++;
      return;
    }
    const numbered = Number(pick(row, ["#", "id", "no", "number", "emailno", "email#"]));
    const n = Number.isInteger(numbered) && numbered > 0 ? numbered : index + 1;
    inbox.push({
      id: `em-${n}`,
      kind: "email",
      at,
      from: personId(String(pick(row, ["from", "sender", "fromname"]) ?? "Unknown"), people),
      ref: `Email #${n}`,
      subject: subject || undefined,
      text: body || subject,
      provenance: { kind: "imported", file },
    });
  });
  return { inbox, skipped };
}
