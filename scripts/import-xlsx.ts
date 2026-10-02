/**
 * Imports the scenario spreadsheets into data/imported/*.json, which replace
 * the reconstructed calendar and inbox at runtime.
 *
 *   pnpm import:xlsx                       # looks for *calendar*.xlsx and *inbox*.xlsx in data/raw
 *   pnpm import:xlsx path/to/01_calendar.xlsx path/to/02_inbox.xlsx
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { RECONSTRUCTED_EVENTS } from "@/lib/data/calendar";
import { PEOPLE } from "@/lib/data/people";
import { rowsToEvents, rowsToInbox, type Row } from "@/lib/import/rows";

const root = process.cwd();
const outDir = path.join(root, "data", "imported");

function findFiles(): string[] {
  const args = process.argv.slice(2);
  if (args.length) return args.map((a) => path.resolve(a));
  const raw = path.join(root, "data", "raw");
  return existsSync(raw)
    ? readdirSync(raw)
        .filter((f) => /\.(xlsx|xls|csv)$/i.test(f))
        .map((f) => path.join(raw, f))
    : [];
}

function readRows(file: string): Row[] {
  const book = XLSX.read(readFileSync(file), { cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
}

const files = findFiles();
const calendar = files.find((f) => /calendar/i.test(path.basename(f)));
const inbox = files.find((f) => /inbox|email|mail/i.test(path.basename(f)));

if (!calendar && !inbox) {
  console.error("No spreadsheets found. Put 01_calendar.xlsx and 02_inbox.xlsx in data/raw, or pass their paths.");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

if (calendar) {
  const { events, skipped } = rowsToEvents(readRows(calendar), path.basename(calendar), PEOPLE, RECONSTRUCTED_EVENTS);
  writeFileSync(path.join(outDir, "calendar.json"), JSON.stringify(events, null, 2));
  const kept = events.filter((e) => RECONSTRUCTED_EVENTS.some((k) => k.id === e.id)).length;
  console.log(`Calendar: ${events.length} events from ${path.basename(calendar)} (${skipped} rows skipped, ${kept} matched to existing ids).`);
}

if (inbox) {
  const { inbox: items, skipped } = rowsToInbox(readRows(inbox), path.basename(inbox), PEOPLE);
  writeFileSync(path.join(outDir, "inbox.json"), JSON.stringify(items, null, 2));
  console.log(`Inbox: ${items.length} emails from ${path.basename(inbox)} (${skipped} rows skipped).`);
}

console.log("Restart the dev server to load them. Run `pnpm analyze` with a model key to regenerate the analysis for the real data.");
