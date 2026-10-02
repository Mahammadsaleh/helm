import type { CalEvent, Day, Item } from "@/lib/types";
import { toMin } from "@/lib/time";
import { RECONSTRUCTED_EVENTS } from "./calendar";
import { DOCS } from "./docs";
import { RECONSTRUCTED_INBOX } from "./inbox";
import { PEOPLE } from "./people";
import { SLACK } from "./slack";

export interface Imported {
  events?: CalEvent[];
  inbox?: Item[];
}

export function buildDay(imported: Imported = {}): Day {
  const events = imported.events?.length ? imported.events : RECONSTRUCTED_EVENTS;
  const inbox = imported.inbox?.length ? imported.inbox : RECONSTRUCTED_INBOX;
  const items = [...inbox, ...SLACK, ...DOCS].sort(
    (a, b) => toMin(a.at) - toMin(b.at) || a.id.localeCompare(b.id),
  );

  const sourcesNote: string[] = [];
  if (!imported.events?.length) {
    sourcesNote.push("Calendar reconstructed from the brief and text files (01_calendar.xlsx not provided).");
  }
  if (!imported.inbox?.length) {
    sourcesNote.push("Inbox reconstructed: emails cited by number are grounded in the text files, the rest are filler (02_inbox.xlsx not provided).");
  }

  return {
    date: "Scenario day",
    people: PEOPLE,
    events: [...events].sort((a, b) => toMin(a.start) - toMin(b.start)),
    items,
    sourcesNote,
  };
}
