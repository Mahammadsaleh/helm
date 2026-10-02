import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CalEvent, Day, Item } from "@/lib/types";
import { buildDay } from "./day";

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "data", "imported", file), "utf8")) as T;
  } catch {
    return undefined;
  }
}

/** Uses data/imported/*.json (written by `pnpm import:xlsx`) when present. */
export async function loadDay(): Promise<Day> {
  const [events, inbox] = await Promise.all([
    readJson<CalEvent[]>("calendar.json"),
    readJson<Item[]>("inbox.json"),
  ]);
  return buildDay({ events, inbox });
}
