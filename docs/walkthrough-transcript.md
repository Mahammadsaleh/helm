# Helm product walkthrough: narration script

Video: `helm_walkthrough.mp4`, 1920x1080, 01:42. Narration: 14 lines, 250 words, 1,359 characters.

Each line starts at the timestamp shown, and every shot was held until its recorded voice clip had finished.

## Using it with ElevenLabs

- **Exact sync, automatic:** `ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… node narrate.mjs` voices every line,
  places each clip at its start time and writes `helm_walkthrough_narrated.mp4` and `narration.m4a`. Needs Node 18+ and ffmpeg.
- **Exact sync, by hand:** generate one clip per line in ElevenLabs (the numbered lines below, or `narration_segments.csv`),
  save them as `clips/001.mp3`, `clips/002.mp3`, … next to the video, then run `node narrate.mjs` without a key to do the mix.
- **One take:** paste `narration.txt` (one paragraph per step) into ElevenLabs, then slide each step to its start time below.
- ElevenLabs bills by character: the full script is 1,359 characters.
- Numbers, times and acronyms are already written the way they should be spoken.

## Steps

| Step | Starts | Title |
| ---: | :---: | --- |
| 1 | 00:00 | Meet Helm |
| 2 | 00:14 | 08:30 · The morning brief |
| 3 | 00:30 | One-tap calendar fixes |
| 4 | 00:39 | Decisions only the CEO can make |
| 5 | 00:50 | 13:16 · A press inquiry |
| 6 | 01:04 | 15:12 · The CFO's correction |
| 7 | 01:11 | The same day without Helm |
| 8 | 01:21 | Maya's delegate view |
| 9 | 01:28 | Helm on a phone |

## Step 1: Meet Helm

1. `[00:00]` This is Helm, an AI chief of staff for a bank CEO who is having an impossible day.
2. `[00:05]` It reads every email, Slack message and calendar change as it arrives, and re-plans the day at five key moments.

## Step 2: 08:30 · The morning brief

3. `[00:14]` At eight thirty, the brief shows what needs the CEO: three decisions, three meeting clashes, and a fix for each.
4. `[00:22]` It even catches a hidden risk in the CEO's reading: new central bank rules that change the ten thirty call.

## Step 3: One-tap calendar fixes

5. `[00:30]` Each clash comes with a proposed fix and a drafted message. One tap on Accept, and the calendar updates.

## Step 4: Decisions only the CEO can make

6. `[00:39]` The Decide tab holds only the calls nobody else can make, with options, a recommendation, and a check that there is time before the deadline. Confirm.

## Step 5: 13:16 · A press inquiry

7. `[00:50]` At one sixteen, a reporter wants a comment by four. Helm's code check finds no time to make the decision before three.
8. `[00:58]` Make Time fixes it in one tap: a short decision block right now, and the check turns green.

## Step 6: 15:12 · The CFO's correction

9. `[01:04]` At three twelve, the CFO corrects the numbers, and Helm fixes every affected line of the board one-pager.

## Step 7: The same day without Helm

10. `[01:11]` Now, the same day without Helm.
11. `[01:15]` By five o'clock: fifty four unsorted messages, the same three clashes, and no plan.

## Step 8: Maya's delegate view

12. `[01:21]` With Helm, Maya, who is covering the CEO's calendar, gets her own view with only the tasks routed to her.

## Step 9: Helm on a phone

13. `[01:28]` And on a phone, Helm fills the whole screen.
14. `[01:32]` Helm reads everything, re-plans at the moments that matter, and leaves the CEO only the calls nobody else can make.
