import type { CalEvent, Provenance } from "@/lib/types";

const reconstructed = (groundedIn: string[], note?: string): Provenance => ({
  kind: "reconstructed",
  missing: "01_calendar.xlsx",
  groundedIn,
  note,
});

/**
 * Stand-in for 01_calendar.xlsx, which was not provided. Times follow the brief
 * (09:00-10:00 back-to-back, Davr call 10:30-11:15, three overlapping meetings
 * 11:00-13:00, interviews and a customer escalation 14:00-17:00, booked until
 * 16:30). Run `pnpm import:xlsx` with the real file to replace it.
 */
export const RECONSTRUCTED_EVENTS: CalEvent[] = [
  {
    id: "ev-boardprep",
    start: "09:00",
    end: "09:20",
    title: "Board prep call",
    attendees: ["richard", "sarah"],
    kind: "call",
    provenance: reconstructed(["brief"]),
  },
  {
    id: "ev-product",
    start: "09:20",
    end: "09:45",
    title: "Product review",
    attendees: ["priya", "tom"],
    kind: "meeting",
    provenance: reconstructed(["brief", "06_slack_messages.txt"], "Priya calls it the roadmap review at 09:58."),
  },
  {
    id: "ev-marcus",
    start: "09:45",
    end: "10:00",
    title: "1:1 with Marcus",
    attendees: ["marcus"],
    kind: "meeting",
    notes: "Moved to 09:45 by Marcus at 08:22. The brief says this 1:1 keeps getting pushed.",
    provenance: reconstructed(["brief", "06_slack_messages.txt"]),
  },
  {
    id: "ev-davr",
    start: "10:30",
    end: "11:15",
    title: "Davr Bank: Day-1 integration sign-off",
    attendees: ["bekzod", "dilnoza", "nodira"],
    kind: "call",
    location: "Zoom",
    provenance: reconstructed(["03_davr_bank_call_brief.txt"]),
  },
  {
    id: "ev-q3close",
    start: "11:00",
    end: "11:45",
    title: "Q3 close review",
    attendees: ["sarah"],
    kind: "meeting",
    provenance: reconstructed(["brief"], "Title invented; the brief only says three meetings overlap."),
  },
  {
    id: "ev-reorg",
    start: "11:20",
    end: "12:10",
    title: "Digital banking team structure follow-up",
    attendees: ["priya", "people"],
    kind: "meeting",
    provenance: reconstructed(["brief", "04_journalist_inquiry.txt"], "Title invented; last month's reorg is from file 04."),
  },
  {
    id: "ev-sme",
    start: "11:50",
    end: "12:50",
    title: "SME lending competitive review",
    attendees: ["marcus"],
    kind: "meeting",
    provenance: reconstructed(["brief", "05_board_chair_request_and_notes.txt"], "Title invented; SME competition is from file 05."),
  },
  {
    id: "ev-roundtable",
    start: "13:15",
    end: "14:00",
    title: "Branch managers roundtable (lunch)",
    attendees: ["branch-network"],
    kind: "meeting",
    provenance: reconstructed(["04_journalist_inquiry.txt"], "Invented to match 'back-to-back meetings until 4:30pm'."),
  },
  {
    id: "ev-vp-aisha",
    start: "14:00",
    end: "14:45",
    title: "VP Engineering interview: Aisha (CEO round)",
    attendees: ["aisha", "priya"],
    kind: "interview",
    provenance: reconstructed(["brief", "06_slack_messages.txt"]),
  },
  {
    id: "ev-vp-2",
    start: "14:45",
    end: "15:30",
    title: "VP Engineering interview: second candidate",
    attendees: ["candidate-2"],
    kind: "interview",
    provenance: reconstructed(["brief"]),
  },
  {
    id: "ev-techcorp",
    start: "15:30",
    end: "16:30",
    title: "Customer escalation: TechCorp",
    attendees: ["lena", "techcorp"],
    kind: "call",
    provenance: reconstructed(["brief", "05_board_chair_request_and_notes.txt", "06_slack_messages.txt"], "Assumes the afternoon escalation is the TechCorp account."),
  },
];
