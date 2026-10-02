/**
 * Records the narrated product walkthrough as a 1920x1080 MP4, plus a transcript
 * timed to it: Markdown, SRT, plain narration for text-to-speech, per-line
 * segments, and narrate.mjs, which voices the lines and lays them onto the video.
 *
 *   pnpm build && pnpm start --port 3100
 *   BASE_URL=http://localhost:3100 OUT=/tmp/helm-walkthrough pnpm walkthrough
 *
 * CUT=short records the highlights in under two minutes instead of all 16 steps.
 * FAST=1 runs the same flow at speed without recording, to check the selectors.
 * SCRIPT_ONLY=1 writes just narration_segments.json, so the voice can be made first;
 * VOICE_CLIPS=dir then holds each shot until its clip (001.mp3, …) has finished.
 */
import { chromium, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = path.resolve(process.env.OUT ?? "/tmp/helm-walkthrough");
const FAST = process.env.FAST === "1";
const SCRIPT_ONLY = process.env.SCRIPT_ONLY === "1";
const VOICE_CLIPS = process.env.VOICE_CLIPS ? path.resolve(process.env.VOICE_CLIPS) : null;
/** Breathing room after a recorded voice clip before the next line starts. */
const PAUSE_AFTER_CLIP = 0.45;
const VIEWPORT = { width: 1536, height: 864 };
const SCALE = 1.25;
/** Slightly slower than a typical TTS voice, so each line finishes before the next one starts. */
const WORDS_PER_SECOND = 2.35;
const PAUSE_AFTER_LINE = 0.6;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Overlay {
  move(x: number, y: number, ms: number): void;
  press(): void;
  ring(r: Rect, ms: number): void;
  clear(): void;
  caption(n: number, total: number, title: string): void;
  card(html: string | null): void;
}

declare global {
  interface Window {
    __wt?: Overlay;
  }
}

interface Beat {
  say: string;
  do?: () => Promise<void>;
}

interface Scene {
  title: string;
  beats: Beat[];
}

interface Line {
  step: number;
  title: string;
  start: number;
  say: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 120) : ms));

let page: Page;
let videoStart = 0;
const clock = () => Date.now() / 1000 - videoStart;

/* ---------- overlay: cursor, highlight rings, step caption, title cards ---------- */

function installOverlay(anchor: { left: number; width: number }) {
  if (window.__wt) return;
  const style = document.createElement("style");
  style.textContent = `
    #wt-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-80px,-80px);will-change:transform}
    #wt-cursor.wt-hidden svg{opacity:0}
    #wt-cursor svg{transition:opacity .4s ease}
    #wt-cursor svg{display:block;filter:drop-shadow(0 2px 3px rgb(0 0 0/.35))}
    .wt-ripple{position:fixed;z-index:2147483646;pointer-events:none;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;background:rgb(245 78 0/.32);animation:wt-ripple .55s ease-out forwards}
    @keyframes wt-ripple{from{transform:scale(.3);opacity:1}to{transform:scale(1.5);opacity:0}}
    .wt-ring{position:fixed;z-index:2147483645;pointer-events:none;border:2.5px solid #f54e00;border-radius:14px;box-shadow:0 0 0 5px rgb(245 78 0/.13);opacity:0;transition:opacity .28s ease}
    #wt-caption{position:fixed;bottom:32px;z-index:2147483644;pointer-events:none;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;background:#26251e;color:#f7f7f4;font:500 15px/1.3 var(--font-geist-sans),Inter,system-ui,sans-serif;letter-spacing:-.01em;box-shadow:0 14px 34px -16px rgb(0 0 0/.55);opacity:0;transform:translateY(8px);transition:opacity .3s ease,transform .3s ease}
    #wt-caption .wt-n{flex:none;font:600 12px/1 var(--font-geist-mono),ui-monospace,monospace;color:#ff8a4c;padding:5px 7px;border-radius:7px;background:rgb(245 78 0/.16)}
    #wt-card{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:#f7f7f4;color:#26251e;opacity:0;pointer-events:none;transition:opacity .8s ease;font-family:var(--font-geist-sans),Inter,system-ui,sans-serif}
    #wt-card .in{display:flex;flex-direction:column;align-items:center;text-align:center;max-width:760px}
    #wt-card h1{margin:22px 0 0;font-size:64px;font-weight:600;letter-spacing:-.04em;line-height:1}
    #wt-card p{margin:20px 0 0;font-size:30px;font-weight:400;letter-spacing:-.025em;line-height:1.25;color:#26251e}
    #wt-card small{margin-top:28px;font:500 13px/1 var(--font-geist-mono),ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#c43e00}
  `;
  document.head.append(style);

  const cursor = document.createElement("div");
  cursor.id = "wt-cursor";
  cursor.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 2.8v17.4l4.5-4.3 3 6.6 3-1.4-3-6.5h6.3z" fill="#1d1c18" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const caption = document.createElement("div");
  caption.id = "wt-caption";
  caption.style.left = `${anchor.left}px`;
  caption.style.width = `${anchor.width}px`;
  caption.innerHTML = '<span class="wt-n"></span><span class="wt-t"></span>';
  const card = document.createElement("div");
  card.id = "wt-card";
  document.body.append(card, caption, cursor);

  let at = { x: -80, y: -80 };
  window.__wt = {
    move(x, y, ms) {
      cursor.style.transition = ms ? `transform ${ms}ms cubic-bezier(.45,0,.2,1)` : "none";
      cursor.style.transform = `translate(${x - 6}px,${y - 3}px)`;
      at = { x, y };
    },
    press() {
      const r = document.createElement("div");
      r.className = "wt-ripple";
      r.style.left = `${at.x}px`;
      r.style.top = `${at.y}px`;
      document.body.append(r);
      setTimeout(() => r.remove(), 650);
    },
    ring(r, ms) {
      const el = document.createElement("div");
      el.className = "wt-ring";
      Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
      document.body.append(el);
      requestAnimationFrame(() => requestAnimationFrame(() => (el.style.opacity = "1")));
      setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 320);
      }, ms);
    },
    clear() {
      document.querySelectorAll<HTMLElement>(".wt-ring").forEach((el) => {
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 320);
      });
    },
    caption(n, total, title) {
      caption.style.opacity = "0";
      caption.style.transform = "translateY(8px)";
      setTimeout(() => {
        caption.querySelector(".wt-n")!.textContent = `${String(n).padStart(2, "0")} / ${total}`;
        caption.querySelector(".wt-t")!.textContent = title;
        caption.style.opacity = "1";
        caption.style.transform = "none";
      }, 260);
    },
    card(html) {
      if (html) card.innerHTML = html;
      card.style.opacity = html ? "1" : "0";
      cursor.classList.toggle("wt-hidden", Boolean(html));
    },
  };
}

const MARK =
  '<svg width="64" height="64" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#26251e"/><circle cx="12" cy="12" r="6" fill="none" stroke="#f7f7f4" stroke-width="2"/><circle cx="12" cy="12" r="2.25" fill="#f54e00"/></svg>';
const INTRO_CARD = `<div class="in">${MARK}<h1>Helm</h1><p>The CEO's impossible day, re-planned as it happens.</p><small>Product walkthrough</small></div>`;
const OUTRO_CARD = `<div class="in">${MARK}<h1>Helm</h1><p>Reads everything as it arrives. Re-plans at the moments that matter. Leaves the CEO only the calls nobody else can make.</p></div>`;

/* ---------- pointer, scrolling and highlighting ---------- */

let pointer = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };

async function moveTo(x: number, y: number) {
  const distance = Math.hypot(x - pointer.x, y - pointer.y);
  const ms = FAST ? 0 : Math.round(Math.min(950, Math.max(380, distance * 0.95)));
  await page.evaluate(([x, y, ms]) => window.__wt?.move(x, y, ms), [x, y, ms] as const);
  await page.mouse.move(x, y, { steps: 6 });
  pointer = { x, y };
  await sleep(ms + 60);
}

async function boxOf(loc: Locator) {
  await loc.waitFor({ state: "visible", timeout: 10_000 });
  const box = await loc.boundingBox();
  if (!box) throw new Error(`No bounding box for ${loc}`);
  return box;
}

async function hover(loc: Locator, fx = 0.5, fy = 0.5) {
  await reveal(loc, "center", 12, true);
  const b = await boxOf(loc);
  await moveTo(b.x + b.width * fx, b.y + b.height * fy);
}

async function click(loc: Locator, fx = 0.5, fy = 0.5) {
  await hover(loc, fx, fy);
  await page.evaluate(() => window.__wt?.press());
  await page.mouse.down();
  await sleep(80);
  await page.mouse.up();
  await sleep(320);
}

/** Smoothly scrolls the element's nearest scroll container so the element is in view. */
async function reveal(loc: Locator, block: "start" | "center" | "end" = "start", offset = 12, ifNeeded = false) {
  await loc.waitFor({ state: "visible", timeout: 10_000 });
  const scroller = await loc.evaluate((el) => {
    let s = el.parentElement;
    while (s && !(/(auto|scroll)/.test(getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight)) s = s.parentElement;
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  if (!scroller) return;
  const needed = await loc.evaluate(
    (el, [block, offset, ifNeeded]) => {
      let s = el.parentElement;
      while (s && !(/(auto|scroll)/.test(getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight)) s = s.parentElement;
      if (!s) return false;
      const r = el.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      if (ifNeeded && r.top >= sr.top + 8 && r.bottom <= sr.bottom - 8) return false;
      return block !== "center" || Math.abs(r.top + r.height / 2 - (sr.top + sr.height / 2)) > 4 || offset < 0;
    },
    [block, offset, ifNeeded] as const,
  );
  if (!needed) return;
  const inside =
    pointer.x > scroller.x && pointer.x < scroller.x + scroller.w && pointer.y > scroller.y && pointer.y < scroller.y + scroller.h;
  if (!inside && !FAST) await moveTo(scroller.x + scroller.w - 56, scroller.y + scroller.h * 0.58);
  await page.evaluate(() => window.__wt?.clear());
  await loc.evaluate(
    async (el, [block, offset, fast]) => {
      let s = el.parentElement;
      while (s && !(/(auto|scroll)/.test(getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight)) s = s.parentElement;
      if (!s) return;
      const scroller = s;
      const r = el.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      let top =
        block === "start"
          ? scroller.scrollTop + r.top - sr.top - offset
          : block === "end"
            ? scroller.scrollTop + r.bottom - sr.bottom + offset
            : scroller.scrollTop + r.top - sr.top - (sr.height - r.height) / 2;
      top = Math.max(0, Math.min(Math.round(top), scroller.scrollHeight - scroller.clientHeight));
      if (Math.abs(top - scroller.scrollTop) < 2) return;
      await new Promise<void>((done) => {
        const timer = setTimeout(done, 1800);
        scroller.addEventListener(
          "scrollend",
          () => {
            clearTimeout(timer);
            done();
          },
          { once: true },
        );
        scroller.scrollTo({ top, behavior: fast ? "instant" : "smooth" });
      });
    },
    [block, offset, FAST] as const,
  );
  await sleep(180);
}

async function scrollTop(loc: Locator) {
  await loc.evaluate(async (el, fast) => {
    if (el.scrollTop < 2) return;
    await new Promise<void>((done) => {
      const timer = setTimeout(done, 1800);
      el.addEventListener(
        "scrollend",
        () => {
          clearTimeout(timer);
          done();
        },
        { once: true },
      );
      el.scrollTo({ top: 0, behavior: fast ? "instant" : "smooth" });
    });
  }, FAST);
  await sleep(150);
}

/** Draws a ring around one or more elements, clipped to the visible part of their scroll container. */
async function ring(targets: Locator | Locator[], ms = 2600, pad = 6) {
  const rects = await Promise.all(
    [targets].flat().map(async (loc) => {
      await loc.waitFor({ state: "visible", timeout: 10_000 });
      return loc.evaluate((el) => {
        const r = el.getBoundingClientRect();
        let s = el.parentElement;
        while (s && !(/(auto|scroll)/.test(getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight)) s = s.parentElement;
        const c = s?.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height, clip: c ? { x: c.left, y: c.top, w: c.width, h: c.height } : null };
      });
    }),
  );
  const x1 = Math.min(...rects.map((r) => r.x)) - pad;
  const y1 = Math.min(...rects.map((r) => r.y)) - pad;
  const x2 = Math.max(...rects.map((r) => r.x + r.w)) + pad;
  const y2 = Math.max(...rects.map((r) => r.y + r.h)) + pad;
  const clip = rects[0].clip;
  const box = clip
    ? {
        x: Math.max(x1, clip.x + 2),
        y: Math.max(y1, clip.y + 2),
        w: Math.min(x2, clip.x + clip.w - 2) - Math.max(x1, clip.x + 2),
        h: Math.min(y2, clip.y + clip.h - 2) - Math.max(y1, clip.y + 2),
      }
    : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  await page.evaluate(([b, ms]) => window.__wt?.ring(b, ms), [box, FAST ? 100 : ms] as const);
}

/** Ring for elements inside the phone iframe, using page coordinates. */
async function ringBox(loc: Locator, ms = 2600, pad = 6) {
  const b = await boxOf(loc);
  await page.evaluate(
    ([b, ms]) => window.__wt?.ring(b, ms),
    [{ x: b.x - pad, y: b.y - pad, w: b.width + pad * 2, h: b.height + pad * 2 }, FAST ? 100 : ms] as const,
  );
}

/* ---------- locators ---------- */

const phone = () => page.locator("#helm-main");
const left = () => page.locator('aside[aria-label="Demo controls"]');
const right = () => page.locator('aside[aria-label="What Helm did"]');
const dialog = () => page.getByRole("dialog");
const tab = (name: string) =>
  page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: new RegExp(`^${name}`) });
const nextCheckpoint = () => left().getByRole("button", { name: /^Jump to/ });
const proposal = (text: string) => phone().locator(".border-dashed").filter({ hasText: text }).first();
const card = (text: string) => phone().getByRole("article").filter({ hasText: text }).first();
const alertCard = (text: string) => phone().locator("li").filter({ hasText: text }).first();
const timelineRow = (text: string) => phone().locator("ol > li").filter({ hasText: text }).first();
const mode = (group: string, option: string) => left().getByRole("group", { name: group }).getByRole("button", { name: option });

async function waitForTime(t: string) {
  await page.locator("aside[aria-label='Demo controls'] p.font-mono").filter({ hasText: t }).waitFor({ timeout: 10_000 });
  await sleep(500);
}

async function jumpTo(t: string) {
  await click(nextCheckpoint());
  await waitForTime(t);
}

async function dragClockTo(target: number) {
  const slider = left().getByRole("slider", { name: "Scenario time" });
  await reveal(slider, "center", 12, true);
  const b = await boxOf(slider);
  const x = (minutes: number) => b.x + 9 + ((b.width - 18) * (minutes - 480)) / 630;
  const value = Number(await slider.inputValue());
  await moveTo(x(value), b.y + b.height / 2);
  await page.evaluate(() => window.__wt?.press());
  await page.mouse.down();
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const m = value + ((target - value) * i) / steps;
    await page.evaluate(([x, y]) => window.__wt?.move(x, y, 0), [x(m), b.y + b.height / 2] as const);
    await page.mouse.move(x(m), b.y + b.height / 2);
    await sleep(45);
  }
  await page.mouse.up();
  pointer = { x: x(target), y: b.y + b.height / 2 };
  for (let guard = 0; guard < 40; guard++) {
    const v = Number(await slider.inputValue());
    if (v === target) break;
    await slider.press(v < target ? "ArrowRight" : "ArrowLeft");
  }
  const hh = String(Math.floor(target / 60)).padStart(2, "0");
  await waitForTime(`${hh}:${String(target % 60).padStart(2, "0")}`);
}

/* ---------- the walkthrough ---------- */

let frame: FrameLocator;

const FULL_SCENES: Scene[] = [
  {
    title: "Meet Helm",
    beats: [
      {
        say: "This is Helm, an AI chief of staff for a bank CEO who is having an impossible day.",
        do: async () => {
          await sleep(1200);
        },
      },
      {
        say: "Helm reads the email, Slack messages, calendar and documents as they arrive, keeps re-planning the day, and hands the CEO only the decisions nobody else can make.",
        do: async () => {
          await page.evaluate(() => window.__wt?.card(null));
          await sleep(900);
          await showCaption();
          await sleep(500);
          await ring(page.locator('[class*="lg:border-bezel"]'), 4200, 8);
        },
      },
      {
        say: "The screen has three parts. On the left, the demo controls. In the middle, the app itself, exactly as the CEO sees it on a phone. And on the right, Helm shows its working.",
        do: async () => {
          await sleep(900);
          await hover(left().locator(":scope > div").first());
          await ring(left(), 2300, 10);
          await sleep(2600);
          await hover(phone(), 0.5, 0.35);
          await ring(page.locator('[class*="lg:border-bezel"]'), 3000, 8);
          await sleep(3300);
          await hover(right().locator("section"));
          await ring(right().locator("section"), 2600, 12);
        },
      },
      {
        say: "Everything runs on this scenario clock. It is eight in the morning, and Helm only knows what has arrived by the time on the clock. Nothing from later in the day can leak in.",
        do: async () => {
          const clockBlock = left().locator(":scope > div").nth(1);
          await hover(clockBlock.locator("p.font-mono"));
          await ring(clockBlock, 6000, 10);
        },
      },
      {
        say: "Helm re-plans the day at five moments: the morning brief at eight thirty, the interpreter cancelling at five past ten, the midday changes at ten past twelve, a press inquiry at one sixteen, and a correction from the CFO at three twelve.",
        do: async () => {
          const list = left().locator(":scope > ol");
          await reveal(list, "end", 8, true);
          await ring(list, 13000, 8);
          const items = list.locator("li");
          for (let i = 0; i < 5; i++) {
            await hover(items.nth(i), 0.3, 0.5);
            await sleep(1900);
          }
        },
      },
    ],
  },
  {
    title: "08:30 · The morning brief",
    beats: [
      {
        say: "Let's jump to eight thirty, when Helm runs its first analysis.",
        do: async () => {
          await jumpTo("08:30");
        },
      },
      {
        say: "The headline sums up the morning: three things need the CEO before ten, and the ten thirty call with Davr Bank, the bank being acquired, has a regulatory dependency nobody has flagged.",
        do: async () => {
          await hover(phone().locator("h1"), 0.7, 0.5);
          await ring(phone().locator("h1"), 7000);
        },
      },
      {
        say: "Below it: three decisions need the CEO, three meetings overlap, and Helm has three calendar suggestions ready.",
        do: async () => {
          await ring(phone().locator("header div.flex-wrap"), 5000, 6);
        },
      },
      {
        say: "Here is the hidden dependency. An article in the CEO's reading backlog says new Central Bank of Uzbekistan rules require a signed data sharing agreement before any customer data moves, plus a named local data protection contact. The agreement is unsigned, and nobody has named a contact.",
        do: async () => {
          const alert = alertCard("Your reading backlog changes the 10:30 call");
          await reveal(alert, "start", 10);
          await hover(alert, 0.6, 0.4);
          await ring(alert, 13000);
        },
      },
      {
        say: "Every claim links to its sources. Tapping this chip opens the original article, word for word, with a note on where it came from.",
        do: async () => {
          await click(phone().getByRole("button", { name: "Open source: Backlog 1" }).first());
          await dialog().waitFor();
          await sleep(900);
          await ring(dialog().getByText(/Verbatim from/), 3500, 8);
        },
      },
      {
        say: "Close it, and we're back on the brief.",
        do: async () => {
          await click(dialog().getByRole("button", { name: "Close" }));
          await dialog().waitFor({ state: "hidden" });
        },
      },
    ],
  },
  {
    title: "Fixing the calendar",
    beats: [
      {
        say: "Further down is the day itself. Late morning is triple booked: the Q3 close review starts before the Davr call ends, and two more meetings pile up behind it. Each clash is marked in red, with the exact minutes.",
        do: async () => {
          const row = timelineRow("Q3 close review");
          await reveal(row, "start", 70);
          await sleep(500);
          const pill = row.getByText(/Overlaps the 10:30 by 15 min/).first();
          await hover(pill);
          await ring(pill, 6000, 5);
        },
      },
      {
        say: "Under each clash, Helm suggests a fix and drafts the message to send. Here it proposes starting the Q3 close review at eleven fifteen, with a note to Sarah, the CFO.",
        do: async () => {
          const p = proposal("Move to 11:15-11:45");
          await reveal(p, "center");
          await ring(p, 7500);
        },
      },
      {
        say: "Accept, and the calendar updates.",
        do: async () => {
          await click(proposal("Move to 11:15-11:45").getByRole("button", { name: "Accept" }));
          await sleep(900);
        },
      },
      {
        say: "Then move the team structure follow-up to eleven forty five, so it starts right after.",
        do: async () => {
          const p = proposal("Move to 11:45-12:30");
          await reveal(p, "center");
          await ring(p, 2600);
          await sleep(1500);
          await click(p.getByRole("button", { name: "Accept" }));
          await sleep(700);
        },
      },
      {
        say: "And push the SME lending review to tomorrow, since nothing in it is due today.",
        do: async () => {
          const p = proposal("Move to tomorrow");
          await reveal(p, "center");
          await ring(p, 2600);
          await sleep(1500);
          await click(p.getByRole("button", { name: "Accept" }));
          await sleep(700);
        },
      },
      {
        say: "Three taps, and the pill at the top turns green: no overlaps ahead.",
        do: async () => {
          await scrollTop(phone());
          const pill = phone().getByText("No overlaps ahead");
          await hover(pill);
          await ring(pill, 3500, 5);
        },
      },
      {
        say: "Tap any meeting to open a sixty second brief. For the Davr call: who is on it, what only the CEO decides, and what to watch out for.",
        do: async () => {
          const event = phone().getByRole("button", { name: /^Davr Bank: Day-1 integration sign-off/ });
          await reveal(event, "start", 70);
          await click(event, 0.4, 0.3);
          await sleep(500);
          const brief = phone().locator("div.border-t").filter({ hasText: "60-second brief" });
          await reveal(brief, "center");
          await ring(brief, 6500);
        },
      },
    ],
  },
  {
    title: "Decisions only the CEO can make",
    beats: [
      {
        say: "The Decide tab is the CEO's queue: only the calls nobody else can make.",
        do: async () => {
          await click(tab("Decide"));
          await sleep(500);
          await ring(phone().locator("h1"), 2800);
        },
      },
      {
        say: "Each card says why it needs the CEO, lists the options with their consequences, marks Helm's recommendation, and checks there is actually time before the deadline. Here, there are fifteen free minutes before eight forty five, and it needs two.",
        do: async () => {
          const first = phone().getByRole("article").first();
          await ring(first, 6200);
          await sleep(6600);
          const fit = first.getByText(/min free before 08:45/).last();
          await hover(fit);
          await ring(fit, 3800, 5);
        },
      },
      {
        say: "The assistant is out sick, so Helm recommends asking Maya to cover scheduling, with access limited to the calendar and the tasks routed to her. Confirm.",
        do: async () => {
          const first = card("Ask Maya to cover your scheduling today?");
          const option = first.locator("label").filter({ hasText: "Recommended" });
          await reveal(option, "center");
          await hover(option, 0.3, 0.3);
          await ring(option, 5200, 4);
          await sleep(5600);
          await click(first.getByRole("button", { name: "Confirm" }));
          await sleep(600);
        },
      },
      {
        say: "Below the decisions are messages Helm has drafted for other people. Here's the ask for Maya. Anything can be edited before it goes.",
        do: async () => {
          const draft = card("Could you cover my scheduling today?");
          await reveal(draft, "start", 50);
          await ring(draft, 4800);
          await sleep(4200);
          await click(draft.getByRole("button", { name: "Edit" }));
        },
      },
      {
        say: "I'll add a quick thank you, then send it.",
        do: async () => {
          const draft = card("Could you cover my scheduling today?");
          const field = draft.locator("textarea");
          await click(field, 0.85, 0.85);
          await field.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length, el.value.length));
          await page.keyboard.type(" Thank you!", { delay: FAST ? 0 : 75 });
          await sleep(400);
          await click(draft.getByRole("button", { name: "Done" }));
          await click(draft.getByRole("button", { name: "Send", exact: true }));
          await sleep(900);
        },
      },
      {
        say: "Decisions and sent messages collect at the bottom, with an undo for anything from the current checkpoint.",
        do: async () => {
          const decided = phone().locator('section[aria-labelledby="decided-title"]');
          const sent = phone().locator('section[aria-labelledby="sent-title"]');
          await reveal(sent, "end", 12);
          await ring([decided, sent], 4500);
          await hover(decided.getByRole("button", { name: /^Undo/ }));
        },
      },
    ],
  },
  {
    title: "The feed and the audio digest",
    beats: [
      {
        say: "The Feed holds everything that has arrived: email, Slack, documents and the reading backlog. Fifteen items so far, already sorted.",
        do: async () => {
          await click(tab("Feed"));
          await sleep(500);
          await ring(phone().locator("h1"), 3500);
        },
      },
      {
        say: "The reading backlog becomes a short audio digest for the commute home: three episodes, about five minutes. One article is pulled forward because it matters before the ten thirty call, and a duplicate is skipped.",
        do: async () => {
          const digest = phone().locator('section[aria-labelledby="digest-title"]');
          await hover(digest.getByRole("button", { name: "Play digest" }));
          await ring(digest, 6000);
          await sleep(6400);
          const forward = digest.locator("div.border-t");
          await reveal(forward, "center");
          await ring(forward, 4500, 4);
        },
      },
      {
        say: "Filters split the feed by triage: for you, delegate, for your information, and noise. Every item says why it landed where it did.",
        do: async () => {
          const filters = phone().getByRole("group", { name: "Filter by triage" });
          await reveal(filters, "start", 0);
          await click(filters.getByRole("button", { name: /^For You/ }));
          await sleep(1300);
          const reason = phone().getByText("Needs your signature; blocks Davr data migration").first();
          await ring(reason, 2600, 5);
          await sleep(2600);
          await click(filters.getByRole("button", { name: /^Noise/ }));
          await sleep(1500);
          await click(filters.getByRole("button", { name: /^All/ }));
        },
      },
      {
        say: "Some sources here had to be rebuilt, because the calendar and inbox spreadsheets weren't part of the brief. Helm says so on every one of them.",
        do: async () => {
          await click(phone().getByRole("button", { name: /^Legal/ }).first(), 0.4, 0.3);
          await dialog().waitFor();
          await sleep(700);
          const note = dialog().getByText(/^Reconstructed\./).first();
          await reveal(note, "center");
          await ring(note.locator(".."), 4200, 4);
          await sleep(4400);
          await click(dialog().getByRole("button", { name: "Close" }));
        },
      },
    ],
  },
  {
    title: "Under the hood",
    beats: [
      {
        say: "On the right, the inspector shows what Helm did at this checkpoint: it read fifteen new items, flagged three issues, proposed three calendar changes, drafted three messages, and asked for three decisions.",
        do: async () => {
          const activity = right().locator("section > div").first();
          await hover(activity.locator("li").first(), 0.4, 0.5);
          await ring(activity, 11000, 10);
          const rows = activity.locator("li");
          for (let i = 1; i < 5; i++) {
            await sleep(1700);
            await hover(rows.nth(i), 0.4, 0.5);
          }
        },
      },
      {
        say: "This part isn't the model at all. Plain code checks the output. Helm saw only the fifteen items stamped before eight thirty; the other thirty six were withheld. Code recomputes overlaps and free time for every deadline, and every money or percentage figure has to appear in a cited source.",
        do: async () => {
          const checks = right().locator("section > div").nth(1);
          await hover(checks.locator("h3"));
          await ring(checks, 15000, 10);
          const rows = checks.locator("li");
          const n = await rows.count();
          for (let i = 0; i < n; i++) {
            await sleep(2600);
            await hover(rows.nth(i), 0.35, 0.5);
          }
        },
      },
    ],
  },
  {
    title: "10:05 · The interpreter cancels",
    beats: [
      {
        say: "Now let's move the clock to five past ten. When time moves on, anything left untouched is treated as if the CEO took Helm's recommendation.",
        do: async () => {
          await click(tab("Today"));
          await jumpTo("10:05");
        },
      },
      {
        say: "The interpreter for the Davr call has just cancelled. Helm's new plan: keep the ten thirty slot as an alignment call, and sign later, in writing.",
        do: async () => {
          await hover(phone().locator("h1"), 0.7, 0.5);
          await ring(phone().locator("h1"), 6500);
        },
      },
      {
        say: "It also flags that sign-off was premature anyway: the agreement is unsigned, the redline unreviewed, governing law disputed, and Central Bank approval still pending.",
        do: async () => {
          const alert = alertCard("Sign-off was premature");
          await reveal(alert, "start", 10);
          await ring(alert, 8000);
        },
      },
      {
        say: "Without an interpreter every point takes longer, so Helm suggests extending the call to eleven thirty. Accept.",
        do: async () => {
          const p = proposal("Extend to 10:30-11:30");
          await reveal(p, "center");
          await ring(p, 4200);
          await sleep(4600);
          await click(p.getByRole("button", { name: "Accept" }));
          await sleep(700);
        },
      },
      {
        say: "That now clashes with the Q3 close review, so Helm suggests handing it to Sarah, and asking her for five bullets to read at lunch. Accept.",
        do: async () => {
          const p = proposal("Hand to Sarah");
          await reveal(p, "center");
          await ring(p, 5200);
          await sleep(5600);
          await click(p.getByRole("button", { name: "Accept" }));
          await sleep(700);
        },
      },
      {
        say: "In Decide there's a new question. Richard, the board chair, wants a Q3 one-pager by five o'clock for tomorrow's investor meeting. Helm recommends that it drafts, Sarah checks the numbers, and the CEO approves once. Confirm.",
        do: async () => {
          await click(tab("Decide"));
          await sleep(500);
          const d = card("How should Richard's Q3 one-pager get made?");
          await reveal(d, "start", 10);
          await ring(d, 9500);
          await sleep(9800);
          await click(d.getByRole("button", { name: "Confirm" }));
          await sleep(600);
        },
      },
    ],
  },
  {
    title: "The bilingual call kit",
    beats: [
      {
        say: "Back on Today, the Davr call now carries a call kit. Open it.",
        do: async () => {
          await click(tab("Today"));
          await sleep(400);
          const event = phone().getByRole("button", { name: /^Davr Bank/ });
          await reveal(event, "start", 70);
          await click(event, 0.4, 0.3);
          await sleep(400);
          await click(phone().getByRole("button", { name: "Open Call Kit" }));
          await dialog().waitFor();
          await sleep(600);
        },
      },
      {
        say: "It opens in Uzbek for the Davr leadership, with the English underneath. The opening explains there is no interpreter today, everyone will speak slowly, and every point will be confirmed in writing.",
        do: async () => {
          const opening = dialog().locator("p[lang]").first();
          await reveal(opening, "center");
          await hover(opening, 0.6, 0.5);
          await ring([opening, opening.locator("xpath=following-sibling::p[1]")], 9000);
        },
      },
      {
        say: "One tap switches to Russian.",
        do: async () => {
          const ru = dialog().getByRole("button", { name: "Русский" });
          await reveal(ru, "center", 12, true);
          await click(ru);
          await sleep(500);
        },
      },
      {
        say: "It's clearly marked as machine translation, so Dilnoza, the Davr CFO, is asked to confirm the legal terms in writing after the call.",
        do: async () => {
          const note = dialog().getByText(/Machine translation/).first();
          await hover(note, 0.4, 0.5);
          await ring(note, 5000, 6);
        },
      },
      {
        say: "Then the agenda, and a glossary of the legal and financial terms, in the same language.",
        do: async () => {
          const agenda = dialog().locator("ol").first();
          await reveal(agenda, "start", 40);
          await ring(agenda, 2600);
          await sleep(2800);
          const glossary = dialog().locator("dl");
          await reveal(glossary, "start", 40);
          await ring(glossary, 2600);
        },
      },
      {
        say: "And a short list of things not to agree to out loud: governing law, tranche amounts, a day one date, or starting the data migration.",
        do: async () => {
          const list = dialog().locator("ul").last();
          await reveal(list, "end", 12);
          await ring([dialog().getByRole("heading", { name: "Do not commit to" }), list], 7000);
        },
      },
      {
        say: "Send the pre-read to Bekzod and Dilnoza before the call starts.",
        do: async () => {
          await click(dialog().getByRole("button", { name: /Send Pre-read/ }));
          const done = dialog().getByText(/Pre-read sent at/).first();
          await done.waitFor();
          await ring(done, 2200, 6);
          await sleep(2400);
          await click(dialog().getByRole("button", { name: "Close" }));
          await dialog().waitFor({ state: "hidden" });
        },
      },
    ],
  },
  {
    title: "The board one-pager",
    beats: [
      {
        say: "The One-pager tab already holds Helm's draft for Richard. Every line is either verified, or waiting on a check that names its owner.",
        do: async () => {
          await click(tab("One-pager"));
          await sleep(500);
          await ring(phone().locator("header div.flex-wrap"), 5500, 6);
        },
      },
      {
        say: "Here, Sarah needs to confirm whether the twenty two percent growth in net interest income is quarter on quarter, and whether it includes Davr.",
        do: async () => {
          const line = phone().locator("li").filter({ hasText: "Net interest income" }).first();
          await reveal(line, "center");
          await hover(line.getByText(/^Sarah:/).first(), 0.4, 0.5);
          await ring(line, 7000);
        },
      },
    ],
  },
  {
    title: "12:10 · Midday changes",
    beats: [
      {
        say: "Ten past twelve. TechCorp is staying, the Acme deal is close, Richard wants Davr status in the one-pager, and comms is preparing a press statement.",
        do: async () => {
          await click(tab("Today"));
          await jumpTo("12:10");
          await ring(phone().locator("h1"), 5000);
        },
      },
      {
        say: "Helm also catches facts that have gone stale. The Q3 notes still list TechCorp as an attrition risk, so the one-pager's risk line is updated.",
        do: async () => {
          const alert = alertCard("The Q3 notes still list TechCorp as attrition");
          await reveal(alert, "start", 10);
          await hover(alert, 0.6, 0.4);
          await ring(alert, 7000);
        },
      },
      {
        say: "With TechCorp staying, the afternoon escalation can shrink to a fifteen minute thank you call that Lena leads, and Helm uses the freed time for a half hour block to review Richard's one-pager. Accept both.",
        do: async () => {
          const shorten = proposal("Shorten to 15:30-15:45");
          await reveal(shorten, "center");
          await ring(shorten, 5000);
          await sleep(5200);
          await click(shorten.getByRole("button", { name: "Accept" }));
          await sleep(800);
          const block = proposal("Add 15:45-16:15");
          await reveal(block, "center");
          await ring(block, 3000);
          await sleep(2600);
          await click(block.getByRole("button", { name: "Accept" }));
          await sleep(700);
        },
      },
      {
        say: "The dot on the One-pager tab means something in it changed. Lines that changed since the last look are tagged, like Acme, now close to signing, and TechCorp, confirmed as staying.",
        do: async () => {
          await hover(tab("One-pager"));
          await ring(tab("One-pager"), 2600, 2);
          await sleep(2800);
          await click(tab("One-pager"));
          await sleep(600);
          const acme = phone().locator("li").filter({ hasText: "Acme corporate loan" }).first();
          await reveal(acme, "start", 60);
          await ring(acme, 3600);
          await sleep(3800);
          const techcorp = phone().locator("li").filter({ hasText: "TechCorp, previously an attrition risk" }).first();
          await reveal(techcorp, "center");
          await ring(techcorp, 3000);
        },
      },
    ],
  },
  {
    title: "13:16 · A press inquiry",
    beats: [
      {
        say: "Sixteen minutes past one. A reporter wants comment on a layoffs rumor by four o'clock, and comms needs a decision by about three. The afternoon is back to back.",
        do: async () => {
          await click(tab("Today"));
          await jumpTo("13:16");
          await ring(phone().locator("h1"), 6500);
        },
      },
      {
        say: "This red card is a check computed by code. The press decision needs about ten minutes, and there is no free time before three o'clock. The next free slot comes after the reporter's deadline.",
        do: async () => {
          const alert = alertCard("No time before 15:00");
          await reveal(alert, "start", 10);
          await hover(alert, 0.5, 0.3);
          await ring(alert, 9000);
        },
      },
      {
        say: "The inspector shows the same failed check, worked out by code rather than guessed by the model.",
        do: async () => {
          const check = right().locator("li").filter({ hasText: "No free time before 15:00" }).first();
          await hover(check, 0.4, 0.5);
          await ring(check, 4500, 6);
        },
      },
      {
        say: "Make Time applies Helm's fix in one tap: a short decision block right now, and the CEO joins the lunch roundtable fifteen minutes late. The check turns green.",
        do: async () => {
          await click(phone().getByRole("button", { name: "Make Time" }));
          await sleep(1200);
          const check = right().locator("li").filter({ hasText: /free min before 15:00/ }).first();
          await hover(check, 0.4, 0.5);
          await ring(check, 4000, 6);
        },
      },
      {
        say: "The new block is marked Added by Helm, the roundtable keeps a note of its original time, and Maya gets a message asking her to tell the host.",
        do: async () => {
          const block = timelineRow("Decide: press statement");
          await reveal(block, "center");
          await ring(block, 4000);
          await sleep(4200);
          const roundtable = timelineRow("Branch managers roundtable");
          await ring(roundtable, 3500);
        },
      },
      {
        say: "Helm also spots a contradiction. Comms promised nothing goes out without approval, but their process sends a final version at five by default, an hour after the reporter's deadline.",
        do: async () => {
          await scrollTop(phone());
          const alert = alertCard("Comms' fallback misses the deadline");
          await reveal(alert, "start", 10);
          await ring(alert, 9000);
        },
      },
    ],
  },
  {
    title: "Approving the statement",
    beats: [
      {
        say: "In Decide, the press statement comes first. Helm recommends approving after a scope check: the statement says there are no layoffs, so the People team should confirm that also holds for Davr Bank staff during the integration. Confirm.",
        do: async () => {
          await click(tab("Decide"));
          await sleep(500);
          const d = card("Approve the statement for TechInsight");
          await ring(d, 6000);
          await sleep(6400);
          const option = d.locator("label").filter({ hasText: "Recommended" });
          await reveal(option, "center");
          await ring(option, 5000, 4);
          await sleep(5400);
          await click(d.getByRole("button", { name: "Confirm" }));
          await sleep(600);
        },
      },
      {
        say: "Helm has drafted the messages that follow from it: a one-line scope check for the People team, the approval for Jordan in comms, and a heads-up to Richard before his investor meeting. Send, send, and send.",
        do: async () => {
          const drafts = phone().locator('section[aria-labelledby="drafts-title"]');
          await reveal(drafts, "start", 10);
          await ring(drafts, 7000);
          await sleep(7600);
          for (let i = 0; i < 3; i++) {
            const send = drafts.getByRole("button", { name: "Send", exact: true }).first();
            if (!(await send.isVisible().catch(() => false))) break;
            await click(send);
            await sleep(900);
          }
        },
      },
    ],
  },
  {
    title: "15:12 · The CFO's correction",
    beats: [
      {
        say: "Twelve minutes past three. Sarah corrects the Davr numbers, and warns that the integration terms have shifted, so legal should check before anything goes out in writing.",
        do: async () => {
          await click(tab("Today"));
          await jumpTo("15:12");
          await ring(phone().locator("h1"), 7000);
        },
      },
      {
        say: "On the one-pager, the old eighteen million dollar figure is struck through and replaced with eighteen point six million: eleven point two at day one, and seven point four at day one hundred. Nobody had to remember that the morning deck was wrong.",
        do: async () => {
          await click(tab("One-pager"));
          await sleep(500);
          const capital = phone().locator("li").filter({ hasText: "$18.6M integration capital" }).first();
          await reveal(capital, "start", 40);
          await hover(capital.locator(".strike-old").first(), 0.3, 0.5);
          await ring(capital, 12000);
        },
      },
      {
        say: "Sarah's email also confirms the net interest income line, now worded to say it includes Davr.",
        do: async () => {
          const line = phone().locator("li").filter({ hasText: "Net interest income up ~22% QoQ, including Davr" }).first();
          await reveal(line, "start", 50);
          await ring(line, 5000);
        },
      },
      {
        say: "Review and Send lists the five lines still waiting on a check, so Richard will see them marked as unconfirmed.",
        do: async () => {
          await click(phone().getByRole("button", { name: "Review and Send" }));
          await dialog().waitFor();
          await sleep(700);
          await ring(dialog().locator("ul"), 4500);
        },
      },
      {
        say: "Send it, and the one-pager is with Richard well before five.",
        do: async () => {
          await click(dialog().getByRole("button", { name: "Send Anyway" }));
          const sent = phone().getByText(/Sent to Richard Voss at/).first();
          await sent.waitFor();
          await reveal(sent, "center", 12, true);
          await ring(sent, 2600, 4);
        },
      },
    ],
  },
  {
    title: "The same day without Helm",
    beats: [
      {
        say: "Now, the same day without Helm.",
        do: async () => {
          await click(mode("Replay the day", "Without Helm"));
          await sleep(500);
        },
      },
      {
        say: "The one-pager is a blank document. It would start at half past four, from a deck that still says eighteen million.",
        do: async () => {
          const empty = phone().getByText("Blank document").first().locator("..");
          await hover(empty, 0.5, 0.4);
          await ring(empty, 6000);
        },
      },
      {
        say: "Let's drag the clock to five o'clock.",
        do: async () => {
          await dragClockTo(17 * 60);
        },
      },
      {
        say: "Today has no plan: fifty four messages and documents, the same three overlaps, and nobody re-planning the day.",
        do: async () => {
          await click(tab("Today"));
          await sleep(500);
          await ring(phone().locator("header"), 5000);
          await sleep(5200);
          const pill = phone().getByText(/^Overlaps the 10:30 by 15 min$/).first();
          await reveal(pill, "center");
          await ring(pill, 2200, 5);
        },
      },
      {
        say: "The feed is unsorted, and it now holds messages that only exist because nobody acted: Jordan chasing the statement at twenty past four, Maya asking whether Richard has his one-pager, and comms' final statement going out by default at five, an hour after the reporter's deadline.",
        do: async () => {
          await click(tab("Feed"));
          await sleep(600);
          const rows = phone().locator("li").filter({ hasText: "Only happens without Helm" });
          await ring(rows.nth(2), 4200);
          await hover(rows.nth(2), 0.5, 0.4);
          await sleep(4600);
          await ring(rows.nth(1), 4200);
          await hover(rows.nth(1), 0.5, 0.4);
          await sleep(4600);
          await ring(rows.nth(0), 5500);
          await hover(rows.nth(0), 0.5, 0.4);
        },
      },
      {
        say: "And there's no decision queue. Every decision is still buried in an email or a Slack thread.",
        do: async () => {
          await click(tab("Decide"));
          await sleep(500);
          const empty = phone().getByText("No decision queue without Helm").first().locator("..");
          await ring(empty, 4500);
        },
      },
    ],
  },
  {
    title: "Maya's delegate view",
    beats: [
      {
        say: "Back to Helm for one more view. Maya is covering the CEO's calendar today, so she gets her own delegate view.",
        do: async () => {
          await click(mode("Replay the day", "With Helm"));
          await sleep(600);
          await click(mode("View as", "Maya, delegate"));
          await sleep(700);
        },
      },
      {
        say: "She sees only the asks routed to her, and can tick them off as she goes.",
        do: async () => {
          const asks = phone().locator("ul").first();
          await ring(asks, 3500);
          await sleep(2600);
          await click(phone().locator("button[aria-pressed]").first(), 0.08, 0.3);
        },
      },
      {
        say: "Below that is every calendar change made today, so she can answer anyone who asks.",
        do: async () => {
          const changes = phone().locator("ul").nth(1);
          await reveal(changes, "start", 50);
          await ring(changes, 5000);
        },
      },
      {
        say: "Email bodies, the board one-pager, the press inquiry and the Davr terms stay hidden from her.",
        do: async () => {
          const note = phone().getByText(/^Hidden from Maya/).first().locator("..");
          await reveal(note, "end", 16);
          await hover(note, 0.5, 0.5);
          await ring(note, 5200, 4);
        },
      },
    ],
  },
  {
    title: "Live mode, and Helm on a phone",
    beats: [
      {
        say: "Everything you have seen is the bundled analysis, written against the same schema and held to the same checks as live model output. With an OpenAI or Anthropic API key, any checkpoint can be re-run live with a model.",
        do: async () => {
          await click(mode("View as", "CEO"));
          await sleep(500);
          await click(left().locator(":scope > ol > li").nth(4).getByRole("button"), 0.3, 0.5);
          await sleep(500);
          await click(tab("Today"));
          const live = left().locator(":scope > div").nth(4);
          await reveal(live, "end", 16);
          await hover(live.locator("p").first(), 0.5, 0.4);
          await ring(live, 9000, 8);
        },
      },
      {
        say: "Reset Demo starts the day over.",
        do: async () => {
          const reset = left().getByRole("button", { name: "Reset Demo" });
          await hover(reset);
          await ring(reset, 2200, 4);
        },
      },
      {
        say: "On an actual phone, Helm fills the screen, and the demo controls fold into this bar at the top. The arrows step between checkpoints.",
        do: async () => {
          await openPhone();
          const bar = frame.locator("div.bg-ink").first();
          await ringBox(bar, 3800, 4);
          await sleep(4000);
          await click(frame.getByRole("button", { name: /^Back to 13:16/ }));
          await sleep(1200);
        },
      },
      {
        say: "Demo opens the clock, the checkpoints and the inspector in a sheet.",
        do: async () => {
          await click(frame.getByRole("button", { name: "Demo controls" }));
          await frame.getByRole("dialog").waitFor();
          await sleep(1400);
          await frame
            .getByRole("dialog")
            .locator(".scroll-area")
            .evaluate((el, fast) => el.scrollTo({ top: 300, behavior: fast ? "instant" : "smooth" }), FAST);
          await sleep(1600);
          await click(frame.getByRole("dialog").getByRole("button", { name: "Close" }));
        },
      },
      {
        say: "Helm reads everything as it arrives, re-plans the day at the moments that matter, and leaves the CEO with only the calls nobody else can make. That's Helm.",
        do: async () => {
          await sleep(3000);
          await page.evaluate((html) => window.__wt?.card(html), OUTRO_CARD);
          await sleep(2500);
        },
      },
    ],
  },
];

/** The highlights in under two minutes. */
const SHORT_SCENES: Scene[] = [
  {
    title: "Meet Helm",
    beats: [
      {
        say: "This is Helm, an AI chief of staff for a bank CEO who is having an impossible day.",
        do: async () => {
          await sleep(1200);
        },
      },
      {
        say: "It reads every email, Slack message and calendar change as it arrives, and re-plans the day at five key moments.",
        do: async () => {
          await page.evaluate(() => window.__wt?.card(null));
          await sleep(900);
          await showCaption();
          const list = left().locator(":scope > ol");
          await reveal(list, "end", 8, true);
          await ring(list, 5200, 8);
          const items = list.locator("li");
          for (let i = 0; i < 5; i++) {
            await hover(items.nth(i), 0.3, 0.5);
            await sleep(450);
          }
        },
      },
    ],
  },
  {
    title: "08:30 · The morning brief",
    beats: [
      {
        say: "At eight thirty, the brief shows what needs the CEO: three decisions, three meeting clashes, and a fix for each.",
        do: async () => {
          await jumpTo("08:30");
          await ring(phone().locator("header div.flex-wrap"), 4500, 6);
        },
      },
      {
        say: "It even catches a hidden risk in the CEO's reading: new central bank rules that change the ten thirty call.",
        do: async () => {
          const alert = alertCard("Your reading backlog changes the 10:30 call");
          await reveal(alert, "start", 10);
          await hover(alert, 0.6, 0.4);
          await ring(alert, 5500);
        },
      },
    ],
  },
  {
    title: "One-tap calendar fixes",
    beats: [
      {
        say: "Each clash comes with a proposed fix and a drafted message. One tap on Accept, and the calendar updates.",
        do: async () => {
          const p = proposal("Move to 11:15-11:45");
          await reveal(p, "center");
          await ring(p, 3000);
          await sleep(2600);
          await click(p.getByRole("button", { name: "Accept" }));
          await sleep(600);
        },
      },
    ],
  },
  {
    title: "Decisions only the CEO can make",
    beats: [
      {
        say: "The Decide tab holds only the calls nobody else can make, with options, a recommendation, and a check that there is time before the deadline. Confirm.",
        do: async () => {
          await click(tab("Decide"));
          await sleep(400);
          const first = card("Ask Maya to cover your scheduling today?");
          await ring(first, 4400);
          await sleep(4000);
          const fit = first.getByText(/min free before 08:45/).last();
          await hover(fit);
          await ring(fit, 2400, 5);
          await sleep(1800);
          await click(first.getByRole("button", { name: "Confirm" }));
          await sleep(500);
        },
      },
    ],
  },
  {
    title: "13:16 · A press inquiry",
    beats: [
      {
        say: "At one sixteen, a reporter wants a comment by four. Helm's code check finds no time to make the decision before three.",
        do: async () => {
          await click(tab("Today"));
          await click(left().locator(":scope > ol > li").nth(3).getByRole("button"), 0.3, 0.5);
          await waitForTime("13:16");
          const alert = alertCard("No time before 15:00");
          await reveal(alert, "start", 10);
          await hover(alert, 0.5, 0.3);
          await ring(alert, 5000);
        },
      },
      {
        say: "Make Time fixes it in one tap: a short decision block right now, and the check turns green.",
        do: async () => {
          await click(phone().getByRole("button", { name: "Make Time" }));
          await sleep(1000);
          const check = right().locator("li").filter({ hasText: /free min before 15:00/ }).first();
          await hover(check, 0.4, 0.5);
          await ring(check, 3500, 6);
        },
      },
    ],
  },
  {
    title: "15:12 · The CFO's correction",
    beats: [
      {
        say: "At three twelve, the CFO corrects the numbers, and Helm fixes every affected line of the board one-pager.",
        do: async () => {
          await jumpTo("15:12");
          await click(tab("One-pager"));
          await sleep(400);
          const capital = phone().locator("li").filter({ hasText: "$18.6M integration capital" }).first();
          await reveal(capital, "start", 40);
          await hover(capital.locator(".strike-old").first(), 0.3, 0.5);
          await ring(capital, 4500);
        },
      },
    ],
  },
  {
    title: "The same day without Helm",
    beats: [
      {
        say: "Now, the same day without Helm.",
        do: async () => {
          await click(mode("Replay the day", "Without Helm"));
          await dragClockTo(17 * 60);
        },
      },
      {
        say: "By five o'clock: fifty four unsorted messages, the same three clashes, and no plan.",
        do: async () => {
          await click(tab("Today"));
          await sleep(400);
          await ring(phone().locator("header"), 4200);
        },
      },
    ],
  },
  {
    title: "Maya's delegate view",
    beats: [
      {
        say: "With Helm, Maya, who is covering the CEO's calendar, gets her own view with only the tasks routed to her.",
        do: async () => {
          await click(mode("Replay the day", "With Helm"));
          await sleep(400);
          await click(mode("View as", "Maya, delegate"));
          await sleep(600);
          await ring(phone().locator("ul").first(), 4000);
        },
      },
    ],
  },
  {
    title: "Helm on a phone",
    beats: [
      {
        say: "And on a phone, Helm fills the whole screen.",
        do: async () => {
          await click(mode("View as", "CEO"));
          await openPhone();
          await ringBox(frame.locator("div.bg-ink").first(), 2600, 4);
        },
      },
      {
        say: "Helm reads everything, re-plans at the moments that matter, and leaves the CEO only the calls nobody else can make.",
        do: async () => {
          await sleep(1800);
          await page.evaluate((html) => window.__wt?.card(html), OUTRO_CARD);
          await sleep(1500);
        },
      },
    ],
  },
];

const SCENES = process.env.CUT === "short" ? SHORT_SCENES : FULL_SCENES;

/** A phone-width iframe of the app over the desktop layout, so the responsive layout shows without navigating away. */
const PHONE_LAYER = `<style>
  #wt-phone{position:fixed;inset:0;z-index:2147483640;background:#f7f7f4;color:#26251e;font-family:var(--font-geist-sans),Inter,system-ui,sans-serif;opacity:0;transition:opacity .6s ease}
  #wt-phone .wrap{display:flex;align-items:center;justify-content:center;gap:56px;height:100%}
  #wt-phone .copy{width:300px}
  #wt-phone .brand{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:600;letter-spacing:-.02em}
  #wt-phone h1{margin:16px 0 0;font-size:28px;font-weight:400;line-height:1.15;letter-spacing:-.03em}
  #wt-phone p{margin:12px 0 0;font-size:14px;line-height:1.6;color:#4d4b42}
  #wt-phone .device{width:390px;height:780px;border:10px solid #1d1c18;border-radius:54px;overflow:hidden;box-shadow:0 30px 80px -30px rgb(38 37 30/.45)}
  #wt-phone iframe{display:block;width:100%;height:100%;border:0;border-radius:44px}
  #wt-phone .spacer{width:300px}
</style><div class="wrap">
  <div class="copy">
    <div class="brand"><svg width="26" height="26" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#26251e"/><circle cx="12" cy="12" r="6" fill="none" stroke="#f7f7f4" stroke-width="2"/><circle cx="12" cy="12" r="2.25" fill="#f54e00"/></svg>Helm</div>
    <h1>On a phone, Helm is the whole screen.</h1>
    <p>The demo controls fold into the dark bar: the arrows step between checkpoints, and Demo opens the clock, modes and inspector.</p>
  </div>
  <div class="device"><iframe title="Helm on a phone" src="/?t=1512"></iframe></div>
  <div class="spacer"></div>
</div>`;

async function openPhone() {
  await page.evaluate((html) => {
    const layer = document.createElement("div");
    layer.id = "wt-phone";
    layer.innerHTML = html;
    document.body.append(layer);
    layer.querySelector("iframe")!.addEventListener("load", () => requestAnimationFrame(() => (layer.style.opacity = "1")), { once: true });
  }, PHONE_LAYER);
  frame = page.frameLocator("#wt-phone iframe");
  await frame.locator("[data-hydrated]").waitFor();
  await sleep(900);
}

async function showCaption() {
  await page.evaluate(([n, total, title]) => window.__wt?.caption(n, total, title), [
    currentStep.n,
    currentStep.total,
    currentStep.title,
  ] as const);
}

let currentStep = { n: 1, total: SCENES.length, title: SCENES[0].title };

/* ---------- recording ---------- */

interface Frame {
  file: string;
  at: number;
}

function voiceLength(line: number) {
  if (!VOICE_CLIPS || FAST) return null;
  const file = path.join(VOICE_CLIPS, clip(line));
  if (!existsSync(file)) throw new Error(`Missing voice clip ${file}`);
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  const seconds = Number(probe.stdout.trim());
  if (!seconds) throw new Error(`Could not read the length of ${file}`);
  return seconds;
}

function writeScript() {
  mkdirSync(OUT, { recursive: true });
  const segments = SCENES.flatMap((scene, i) => scene.beats.map((beat) => ({ step: i + 1, stepTitle: scene.title, text: beat.say })));
  writeFileSync(
    path.join(OUT, "narration_segments.json"),
    JSON.stringify({ segments: segments.map((s, i) => ({ line: i + 1, clip: clip(i), ...s })) }, null, 2) + "\n",
  );
  const characters = segments.reduce((sum, s) => sum + s.text.length, 0);
  console.log(`Wrote ${segments.length} lines (${characters} characters) to ${path.join(OUT, "narration_segments.json")}`);
}

async function main() {
  if (SCRIPT_ONLY) return writeScript();
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(path.join(OUT, "frames"), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  page = await context.newPage();

  await page.goto(`${BASE}/?t=0800`);
  await page.locator("[data-hydrated]").waitFor();
  const anchor = await right().boundingBox();
  await page.evaluate(installOverlay, { left: anchor?.x ?? VIEWPORT.width - 348, width: anchor?.width ?? 300 });
  await page.evaluate((html) => window.__wt?.card(html), INTRO_CARD);
  await page.evaluate(([x, y]) => window.__wt?.move(x, y, 0), [pointer.x, pointer.y] as const);
  await page.mouse.move(pointer.x, pointer.y);
  await sleep(1200);

  const frames: Frame[] = [];
  const cdp = await context.newCDPSession(page);
  if (!FAST) {
    cdp.on("Page.screencastFrame", (f) => {
      const file = path.join(OUT, "frames", `${String(frames.length).padStart(6, "0")}.jpg`);
      writeFileSync(file, Buffer.from(f.data, "base64"));
      frames.push({ file, at: Date.now() / 1000 });
      cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    await page.evaluate(([x, y]) => window.__wt?.move(x + 1, y, 0), [pointer.x, pointer.y] as const);
    while (!frames.length) await sleep(20);
    videoStart = frames[0].at;
  } else {
    videoStart = Date.now() / 1000;
  }

  const lines: Line[] = [];
  try {
    for (const [i, scene] of SCENES.entries()) {
      currentStep = { n: i + 1, total: SCENES.length, title: scene.title };
      if (i > 0) await showCaption();
      for (const beat of scene.beats) {
        const start = clock();
        const words = beat.say.split(/\s+/).length;
        const voiced = voiceLength(lines.length);
        const minEnd = start + (FAST ? 0.05 : voiced ? voiced + PAUSE_AFTER_CLIP : words / WORDS_PER_SECOND + PAUSE_AFTER_LINE);
        console.log(`[${fmt(start)}] ${i + 1}. ${beat.say.slice(0, 70)}`);
        await beat.do?.();
        const end = Math.max(minEnd, clock() + (FAST ? 0 : 0.35));
        await sleep((end - clock()) * 1000);
        lines.push({ step: i + 1, title: scene.title, start, say: beat.say });
      }
    }
    await sleep(1500);
  } catch (err) {
    await page.screenshot({ path: path.join(OUT, "error.png") });
    throw err;
  } finally {
    if (!FAST) await cdp.send("Page.stopScreencast").catch(() => {});
    await browser.close();
  }

  if (FAST) {
    console.log("Fast run finished: every step found its targets.");
    return;
  }

  const duration = clock();
  encode(frames, duration);
  writeTranscripts(lines, duration);
  if (VOICE_CLIPS) cpSync(VOICE_CLIPS, path.join(OUT, "clips"), { recursive: true });
  console.log(`Done: ${fmt(duration)} of video in ${OUT}`);
}

function encode(frames: Frame[], duration: number) {
  const list = ["ffconcat version 1.0"];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].at : videoStart + duration;
    list.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.at).toFixed(4)}`);
  });
  list.push(`file '${frames[frames.length - 1].file}'`);
  writeFileSync(path.join(OUT, "frames.ffconcat"), list.join("\n"));
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      path.join(OUT, "frames.ffconcat"),
      "-vf",
      "fps=30,scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf7f7f4,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18",
      "-movflags",
      "+faststart",
      path.join(OUT, "helm_walkthrough.mp4"),
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error("ffmpeg failed");
}

/* ---------- transcript files ---------- */

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
}

function srtTime(s: number) {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const clip = (i: number) => `${String(i + 1).padStart(3, "0")}.mp3`;

/** Splits a line into subtitle-sized pieces at clause breaks; longer clauses split evenly. */
function subtitleChunks(text: string, max = 16) {
  const clauses: string[][] = [[]];
  for (const word of text.split(/\s+/)) {
    clauses[clauses.length - 1].push(word);
    if (/[.?!:;,]$/.test(word)) clauses.push([]);
  }
  const chunks: string[][] = [];
  for (const clause of clauses.filter((c) => c.length)) {
    const last = chunks[chunks.length - 1];
    const fits = last && last.length + clause.length <= max;
    if (fits && (!/[.?!]$/.test(last[last.length - 1]) || last.length < 4 || clause.length < 3)) last.push(...clause);
    else chunks.push([...clause]);
  }
  return chunks.flatMap((c) => {
    const size = Math.ceil(c.length / Math.ceil(c.length / max));
    return Array.from({ length: Math.ceil(c.length / size) }, (_, i) => c.slice(i * size, (i + 1) * size).join(" "));
  });
}

function writeTranscripts(lines: Line[], duration: number) {
  const steps = [...new Set(lines.map((l) => l.step))].map((n) => {
    const own = lines.filter((l) => l.step === n);
    return { n, title: own[0].title, start: own[0].start, lines: own };
  });
  const wordCount = (s: string) => s.split(/\s+/).length;
  const words = lines.reduce((sum, l) => sum + wordCount(l.say), 0);
  const characters = lines.reduce((sum, l) => sum + l.say.length, 0);
  const slot = (i: number) => (lines[i + 1]?.start ?? duration) - lines[i].start;

  const md = [
    "# Helm product walkthrough: narration script",
    "",
    `Video: \`helm_walkthrough.mp4\`, 1920x1080, ${mmss(duration)}. Narration: ${lines.length} lines, ${words} words, ${characters.toLocaleString("en-US")} characters.`,
    "",
    ...(VOICE_CLIPS
      ? ["Each line starts at the timestamp shown, and every shot was held until its recorded voice clip had finished."]
      : [
          "Each line starts at the timestamp shown and was given enough room for an unhurried read",
          `(about ${Math.round(WORDS_PER_SECOND * 60)} words per minute plus a short pause), so a typical voice finishes before the next line begins.`,
        ]),
    "",
    "## Using it with ElevenLabs",
    "",
    "- **Exact sync, automatic:** `ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… node narrate.mjs` voices every line,",
    "  places each clip at its start time and writes `helm_walkthrough_narrated.mp4` and `narration.m4a`. Needs Node 18+ and ffmpeg.",
    "- **Exact sync, by hand:** generate one clip per line in ElevenLabs (the numbered lines below, or `narration_segments.csv`),",
    "  save them as `clips/001.mp3`, `clips/002.mp3`, … next to the video, then run `node narrate.mjs` without a key to do the mix.",
    "- **One take:** paste `narration.txt` (one paragraph per step) into ElevenLabs, then slide each step to its start time below.",
    `- ElevenLabs bills by character: the full script is ${characters.toLocaleString("en-US")} characters.`,
    "- Numbers, times and acronyms are already written the way they should be spoken.",
    "",
    "## Steps",
    "",
    "| Step | Starts | Title |",
    "| ---: | :---: | --- |",
    ...steps.map((s) => `| ${s.n} | ${mmss(s.start)} | ${s.title} |`),
    "",
    ...steps.flatMap((s) => [
      `## Step ${s.n}: ${s.title}`,
      "",
      ...s.lines.map((l) => `${lines.indexOf(l) + 1}. \`[${mmss(l.start)}]\` ${l.say}`),
      "",
    ]),
  ].join("\n");
  writeFileSync(path.join(OUT, "transcript.md"), md);

  const cues = lines.flatMap((l, i) => {
    const total = wordCount(l.say);
    const spoken = Math.min(total / WORDS_PER_SECOND, slot(i) - 0.08);
    let at = l.start;
    return subtitleChunks(l.say).map((text) => {
      const start = at;
      at += (spoken * wordCount(text)) / total;
      return { start, end: at, text };
    });
  });
  writeFileSync(
    path.join(OUT, "transcript.srt"),
    cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n"),
  );

  writeFileSync(
    path.join(OUT, "narration.txt"),
    steps.map((s) => s.lines.map((l) => l.say).join(" ")).join("\n\n") + "\n",
  );

  const csv = [
    "line,clip,step,step_title,start_seconds,start_timecode,slot_seconds,text",
    ...lines.map((l, i) =>
      [i + 1, clip(i), l.step, `"${l.title}"`, l.start.toFixed(2), mmss(l.start), slot(i).toFixed(2), `"${l.say.replace(/"/g, '""')}"`].join(","),
    ),
  ].join("\n");
  writeFileSync(path.join(OUT, "narration_segments.csv"), csv + "\n");
  writeFileSync(
    path.join(OUT, "narration_segments.json"),
    JSON.stringify(
      {
        video: "helm_walkthrough.mp4",
        duration: Number(duration.toFixed(2)),
        segments: lines.map((l, i) => ({
          line: i + 1,
          clip: clip(i),
          step: l.step,
          stepTitle: l.title,
          start: Number(l.start.toFixed(2)),
          slot: Number(slot(i).toFixed(2)),
          text: l.say,
        })),
      },
      null,
      2,
    ) + "\n",
  );
  copyFileSync(path.resolve("scripts/narrate-walkthrough.mjs"), path.join(OUT, "narrate.mjs"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
