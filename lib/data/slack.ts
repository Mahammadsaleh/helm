import type { Item } from "@/lib/types";

const FILE = { kind: "file", file: "06_slack_messages.txt" } as const;

const msg = (
  at: string,
  channel: string,
  from: string,
  text: string,
  defaultPathOnly = false,
): Item => ({
  id: `sl-${at.replace(":", "")}`,
  kind: "slack",
  at,
  from,
  channel,
  ref: `${channel} ${at}`,
  text,
  provenance: FILE,
  ...(defaultPathOnly ? { defaultPathOnly } : {}),
});

/** Verbatim from 06_slack_messages.txt. */
export const SLACK: Item[] = [
  msg("07:38", "#exec-assistants", "maya", "heads up CEO's assistant is out sick today, flagging in case anyone needs coverage on scheduling"),
  msg("08:07", "#exec-assistants", "maya", "also dropped the unread reading backlog in your inbox (07_reading_backlog.txt) — no rush, thought a podcast-style summary might be handy for the commute"),
  msg("08:05", "#eng-leads", "tom", "notification system tech debt ticket is growing, not blocking anything this week but wanted it on record before Q3 wraps"),
  msg("08:22", "#sales", "marcus", "pushing my 1:1 with CEO to 9:45, posted here in case anyone needs the room before then"),
  msg("10:42", "#sales", "marcus", "Acme deal update — legal redlines back, looks close to signing this week 🎉"),
  msg("09:58", "#general", "priya", "heads up team, roadmap review ran long, CEO might be a couple min late to whatever's next"),
  msg("11:47", "#general", "lena", "on the TechCorp call now, will report back"),
  msg("12:05", "#general", "lena", "🎉 TechCorp staying, more details soon"),
  msg("12:15", "#exec-assistants", "maya", "reminder — board chair Richard leaves for airport around 6, flight at 7, if CEO needs anything printed/signed before then let me know"),
  msg("12:03", "#comms", "jordan", "journalist thing is real, drafting a statement now, will send to CEO for approval before anything goes out"),
  msg("13:16", "#comms", "jordan", "draft sent to CEO's email, need a decision before ~3pm to hit the 4pm deadline comfortably"),
  msg("16:20", "#comms", "jordan", "still haven't heard back on the statement, deadline is 4pm, getting tight — can someone confirm CEO has seen it?", true),
  msg("13:50", "#eng-leads", "priya", "final round with Aisha went really well, references are excellent, I'd move on an offer this week if we can"),
  msg("15:12", "#general", "sarah", "correction on Davr Bank integration numbers is in CEO's inbox, flagging here too in case the one-pager for Richard is already in progress"),
  msg("16:40", "#exec-assistants", "maya", "does the board chair have his one-pager yet? he's asking me directly now and I don't have visibility", true),
];
