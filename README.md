# Helm

A chief of staff on the CEO's phone. Helm reads the calendar, inbox, Slack and documents as they arrive, works out what depends on what, re-plans the day, and leaves the CEO only the decisions that need them.

Built for the AI Efficiency Hackathon problem "The CEO's Impossible Day".

## Run it

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. On a desktop the app sits in a phone frame with the demo controls on the left and an "under the hood" panel on the right. On a phone it runs full screen, with a small demo bar on top.

No API key is needed for the demo. See [Live analysis](#live-analysis) to run the model.

## The demo in five moments

Helm replays the day at five checkpoints. At each one it only sees what has arrived by then, so nothing it says can come from the future.

| Time | What happens | What Helm does |
| --- | --- | --- |
| 08:30 | Start of day | Three overlapping late-morning meetings get two moves and one deferral. A saved article about new Central Bank data rules is linked to the 10:30 Davr Bank call. Maya is asked to cover scheduling. |
| 10:05 | The interpreter cancels | The Davr call becomes an alignment call with no sign-off. A bilingual call kit (English, Uzbek, Russian) is ready, with a glossary and a list of things not to commit to. The Q3 close review is handed to Sarah. |
| 12:10 | Richard wants Davr in the one-pager | TechCorp is staying, so its 15:30 call shrinks to 15 minutes and frees a block to finish the one-pager. |
| 13:16 | A reporter asks about layoffs | The engine finds no free time before Jordan's 15:00 deadline. "Make Time" adds a block at 13:16 and pushes the roundtable start to 13:30, and the decision becomes feasible. |
| 15:12 | The CFO corrects the Davr figures | The one-pager replaces the $18M figure with $18.6M and strikes through the old line. |

Switch to **Without Helm** to see the same day with nobody re-planning: the overlaps stay, the one-pager is blank, and the 16:20 and 16:40 chasers arrive.

Switch to **Maya, delegate** to see the scoped view Maya gets once the CEO asks her to cover: calendar changes and the asks routed to her, with email bodies and board material hidden.

The URL holds the state, for example `/?t=1316&tab=decide` or `/?t=1520&tab=onepager`, so any moment can be linked directly.

## How it works

The model is not trusted with arithmetic or with facts it cannot cite.

- **Data** (`lib/data`): every item has a timestamp and a provenance. Slack, the Davr call brief, the reporter's email and the board chair's notes are verbatim copies of the brief's text files (`data/raw`).
- **Engine** (`lib/engine`, plain TypeScript, unit tested):
  - filters items to those visible at the current time
  - applies accepted calendar changes
  - finds overlaps, counts free minutes and checks whether each decision fits before its deadline
  - merges one-pager facts across checkpoints, so a newer figure replaces an older one with the same key
  - checks that every money and percentage figure the model writes appears in one of the sources it cites
- **AI layer** (`lib/ai`): one structured call per checkpoint. The prompt gives the model the visible items, the planned calendar and the engine's findings. Output is validated against a zod schema (`lib/ai/schema.ts`): decisions with 2 to 4 options, delegations, calendar changes, briefs, one-pager facts, triage, alerts, the call kit and the reading digest. Every item must cite source ids.
- **UI** (`components`): Today (timeline with suggestions), Decide (decision queue plus messages drafted for others), One-pager (verified versus to-check lines, struck-through replacements), Feed (triage and an audio digest using the browser's speech synthesis).

The right-hand panel on desktop shows, for each checkpoint, what the model produced and what code checked.

## Live analysis

The repo ships with analysis for each checkpoint in `lib/seed/checkpoints.ts`. It was written by hand against the same schema, and the tests hold it to the same rules as model output: sources must exist and be visible at that time, figures must be grounded, and the recommended option must be one of the options.

To use a model instead, copy `.env.example` to `.env.local` and add a key:

```bash
OPENAI_API_KEY=...            # or ANTHROPIC_API_KEY=...
HELM_MODEL=openai:gpt-4.1     # optional, provider:model-id
```

Then either:

- use the **Re-run** button in the demo controls to re-analyse the current checkpoint (set `HELM_WRITE_CACHE=1` to keep the result), or
- run `pnpm analyze` to regenerate all five checkpoints into `data/checkpoints/*.json`, which replace the bundled analysis.

## Data provenance

`01_calendar.xlsx` and `02_inbox.xlsx` were not included with the brief. Until they are imported, Helm uses a reconstruction:

- The calendar follows the times in the brief and is marked as reconstructed.
- Emails that the text files cite by number (for example Email #25 from the reporter) are grounded in those files. The rest are plausible filler.
- The figures in the CFO's 15:12 correction email ($18.6M, $11.2M, $7.4M, a $0.6M FX buffer) are invented, because the Slack message only says a correction exists. The source viewer flags this.

Every reconstructed entry says so in its source sheet. To use the real spreadsheets:

```bash
cp 01_calendar.xlsx 02_inbox.xlsx data/raw/
pnpm import:xlsx
```

The importer accepts common column names and time formats. It keeps existing event ids when start times match, and numbers emails so "Email #25" style references still resolve. After importing, run `pnpm analyze` so the analysis matches the real data.

## Checks

```bash
pnpm test        # engine, seed and import unit tests (vitest)
pnpm typecheck
pnpm lint
pnpm qa          # Playwright on desktop and mobile: the five-moment walkthrough, axe accessibility, overflow, dark mode
```

`pnpm qa` starts the dev server if one is not already running and saves screenshots to `qa/screenshots`.

## Walkthrough video

```bash
pnpm build && pnpm start --port 3100
BASE_URL=http://localhost:3100 OUT=/tmp/helm-walkthrough pnpm walkthrough
ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... pnpm narrate /tmp/helm-walkthrough
```

`pnpm walkthrough` drives the app through every feature in 16 steps and writes a 1920x1080 MP4 with a visible cursor, highlights and step captions. Next to it go a narration script timed to the video (`transcript.md`, `transcript.srt`, `narration.txt`, `narration_segments.csv` and `.json`) and a copy of `narrate.mjs`. Set `FAST=1` to check the flow without recording. The script used for the current video is in `docs/walkthrough-transcript.md`.

`pnpm narrate` voices each line with ElevenLabs, places every clip at its start time and writes `helm_walkthrough_narrated.mp4`, `narration.m4a` and `transcript_narrated.srt`. Clips land in `clips/001.mp3`, `002.mp3`, … and are reused on the next run. Without an API key it mixes clips you saved there yourself. A clip longer than its slot is sped up just enough to fit.

`CUT=short` records the highlights in under two minutes. To time every shot to the real voice, make the clips first:

```bash
CUT=short SCRIPT_ONLY=1 OUT=/tmp/helm-voice pnpm walkthrough
ELEVENLABS_API_KEY=... pnpm narrate /tmp/helm-voice --clips-only
CUT=short VOICE_CLIPS=/tmp/helm-voice/clips OUT=/tmp/helm-short pnpm walkthrough
pnpm narrate /tmp/helm-short
```

## Design

- Tokens come from the Cursor design analysis in `DESIGN.md`: a cream canvas, warm ink, one orange accent, hairline borders, and pastel pills reserved for agent activity. Text colours are darkened where the originals fail WCAG AA.
- Avatars come from [Blobatar](https://blobatar.dev), icons from Phosphor, and type is Geist and Geist Mono.
- Interaction follows the Vercel web interface guidelines: the URL reflects state, every icon button has a label, there are visible focus rings, reduced motion is respected, and sheets contain their scroll.
- The app supports light and dark mode, following the system setting.

## Layout

```
app/                 page, API route for live analysis, manifest
components/app/      phone app screens and sheets
components/demo/     demo controls, inspector, responsive shell
lib/data/            scenario data and loaders
lib/engine/          deterministic planning and checks
lib/ai/              schema, prompt, model provider
lib/seed/            bundled analysis per checkpoint
lib/import/          spreadsheet row mapping
scripts/             import-xlsx, analyze, record-walkthrough, narrate-walkthrough
tests/ qa/           unit tests, Playwright QA
docs/                walkthrough narration script
```
