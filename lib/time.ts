import type { HHMM } from "@/lib/types";

export const DAY_START: HHMM = "08:00";
export const DAY_END: HHMM = "18:30";

export function toMin(t: HHMM): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fromMin(min: number): HHMM {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function compact(t: HHMM): string {
  return t.replace(":", "");
}

export function fromCompact(s: string | null | undefined): HHMM | null {
  if (!s || !/^\d{4}$/.test(s)) return null;
  const t = `${s.slice(0, 2)}:${s.slice(2)}`;
  return toMin(t) < 24 * 60 ? t : null;
}

export function duration(min: number): string {
  const abs = Math.abs(Math.round(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function relative(now: HHMM, target: HHMM): string {
  const diff = toMin(target) - toMin(now);
  if (diff === 0) return "now";
  return diff > 0 ? `in ${duration(diff)}` : `${duration(diff)} ago`;
}
