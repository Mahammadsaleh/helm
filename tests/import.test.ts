import { describe, expect, it } from "vitest";
import { RECONSTRUCTED_EVENTS } from "@/lib/data/calendar";
import { PEOPLE } from "@/lib/data/people";
import { parseTime, personId, rowsToEvents, rowsToInbox } from "@/lib/import/rows";

describe("spreadsheet import", () => {
  it("parses the time formats spreadsheets produce", () => {
    expect(parseTime(0.4375)).toBe("10:30");
    expect(parseTime(45000.5)).toBe("12:00");
    expect(parseTime("9:05")).toBe("09:05");
    expect(parseTime("2:30 PM")).toBe("14:30");
    expect(parseTime("12:10 am")).toBe("00:10");
    expect(parseTime("2026-10-02 15:12:00")).toBe("15:12");
    expect(parseTime(new Date(2026, 9, 2, 13, 16))).toBe("13:16");
    expect(parseTime("tbd")).toBeNull();
  });

  it("matches senders to known people", () => {
    expect(personId("Sam Reyes <sam@techinsight.com>", PEOPLE)).toBe("sam");
    expect(personId("Sarah", PEOPLE)).toBe("sarah");
    expect(personId("Unknown Person", PEOPLE)).toBe("Unknown Person");
  });

  it("keeps existing event ids when start times match, so analysis links still work", () => {
    const { events, skipped } = rowsToEvents(
      [
        { "Start Time": "10:30", "End Time": "11:15", Subject: "Davr Bank call", Attendees: "Bekzod Nazarov; Dilnoza Rashidova" },
        { Start: "17:00", End: "17:30", Title: "Wrap-up" },
        { Start: "", End: "", Title: "Broken row" },
      ],
      "01_calendar.xlsx",
      PEOPLE,
      RECONSTRUCTED_EVENTS,
    );
    expect(skipped).toBe(1);
    expect(events[0]).toMatchObject({ id: "ev-davr", kind: "call", attendees: ["bekzod", "dilnoza"] });
    expect(events[1].id).toBe("ev-1700-wrap-up");
    expect(events[1].provenance).toEqual({ kind: "imported", file: "01_calendar.xlsx" });
  });

  it("numbers emails from the sheet so 'Email #25' references resolve", () => {
    const { inbox } = rowsToInbox(
      [
        { "#": 25, Received: "13:00", From: "Sam Reyes", Subject: "Requesting comment", Body: "Deadline 4pm." },
        { Received: "13:15", From: "Jordan Blake", Subject: "Draft statement", Body: "Draft attached." },
      ],
      "02_inbox.xlsx",
      PEOPLE,
    );
    expect(inbox[0]).toMatchObject({ id: "em-25", ref: "Email #25", from: "sam", at: "13:00" });
    expect(inbox[1]).toMatchObject({ id: "em-2", from: "jordan" });
  });
});
