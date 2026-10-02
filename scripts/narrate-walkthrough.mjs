#!/usr/bin/env node
/**
 * Voices the walkthrough with ElevenLabs and lays every line onto the video at its start time.
 *
 *   ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… node narrate.mjs [folder]
 *
 * The folder holds the video and narration_segments.json: by default the folder this file
 * sits in, or $OUT. Clips are saved as clips/001.mp3, 002.mp3, … and reused on the next run,
 * so delete a clip to regenerate just that line. Without an API key the clips must already be
 * there (made by hand in ElevenLabs; .mp3, .wav, .m4a, .ogg or .flac). A clip longer than its
 * slot is sped up just enough to finish before the next line starts.
 *
 * Writes helm_walkthrough_narrated.mp4, narration.m4a and transcript_narrated.srt.
 * Optional: ELEVENLABS_MODEL_ID (default eleven_multilingual_v2), VIDEO (path to the video).
 * Needs Node 18+ and ffmpeg.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_KEY = process.env.ELEVENLABS_API_KEY;
/** "George", the voice used in the ElevenLabs quickstart. */
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";
/** Silence kept between the end of one line and the start of the next. */
const GAP = 0.15;
const CLIP_TYPES = [".mp3", ".wav", ".m4a", ".ogg", ".flac"];

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(
  process.argv[2] ?? (existsSync(path.join(here, "narration_segments.json")) ? here : (process.env.OUT ?? "/tmp/helm-walkthrough")),
);
const clipsDir = path.join(dir, "clips");

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) fail(`Could not run ${cmd}: ${result.error.message}. Install ffmpeg and try again.`);
  if (result.status !== 0) fail(`${cmd} failed:\n${result.stderr.trim().split("\n").slice(-15).join("\n")}`);
  return result.stdout;
}

const probeDuration = (file) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).trim());

function findVideo(name) {
  if (process.env.VIDEO) return path.resolve(process.env.VIDEO);
  if (existsSync(path.join(dir, name))) return path.join(dir, name);
  const candidates = readdirSync(dir).filter((f) => f.endsWith(".mp4") && !f.endsWith("_narrated.mp4"));
  if (candidates.length === 1) return path.join(dir, candidates[0]);
  fail(`Could not tell which video to narrate in ${dir}. Set VIDEO=/path/to/video.mp4.`);
}

function findClip(segment) {
  const base = path.basename(segment.clip, path.extname(segment.clip));
  return CLIP_TYPES.map((ext) => path.join(clipsDir, base + ext)).find((file) => existsSync(file));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function speak(segments, i) {
  const body = { text: segments[i].text, model_id: MODEL_ID };
  // Neighbouring text keeps intonation continuous across clips; eleven_v3 does not accept it.
  if (!MODEL_ID.startsWith("eleven_v3")) {
    if (segments[i - 1]) body.previous_text = segments[i - 1].text;
    if (segments[i + 1]) body.next_text = segments[i + 1].text;
  }
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    fail(`ElevenLabs answered ${res.status} for line ${segments[i].line}:\n${await res.text()}`);
  }
}

function subtitleChunks(text, max = 14) {
  const chunks = [];
  let current = [];
  for (const word of text.split(/\s+/)) {
    current.push(word);
    const sentenceEnd = /[.?!:;]$/.test(word) && current.length >= 4;
    const clauseEnd = /,$/.test(word) && current.length >= 9;
    if (current.length >= max || sentenceEnd || clauseEnd) {
      chunks.push(current);
      current = [];
    }
  }
  if (current.length && current.length < 3 && chunks.length) chunks[chunks.length - 1].push(...current);
  else if (current.length) chunks.push(current);
  return chunks.map((c) => c.join(" "));
}

function srtTime(s) {
  const ms = Math.round(s * 1000);
  const pad = (n, width = 2) => String(n).padStart(width, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor((ms % 3_600_000) / 60_000))}:${pad(Math.floor((ms % 60_000) / 1000))},${pad(ms % 1000, 3)}`;
}

function atempoChain(tempo) {
  const filters = [];
  for (; tempo > 2; tempo /= 2) filters.push("atempo=2");
  filters.push(`atempo=${tempo.toFixed(4)}`);
  return filters;
}

async function main() {
  const manifest = path.join(dir, "narration_segments.json");
  if (!existsSync(manifest)) fail(`No narration_segments.json in ${dir}. Pass the walkthrough folder as the first argument.`);
  const { video: videoName, duration: videoDuration, segments } = JSON.parse(readFileSync(manifest, "utf8"));
  const video = findVideo(videoName);
  const duration = videoDuration ?? probeDuration(video);
  mkdirSync(clipsDir, { recursive: true });

  const missing = segments.filter((s) => !findClip(s));
  if (missing.length && !API_KEY) {
    fail(
      [
        `${missing.length} of ${segments.length} clips are missing from ${clipsDir}, for example ${missing[0].clip}: "${missing[0].text}"`,
        "Set ELEVENLABS_API_KEY (and optionally ELEVENLABS_VOICE_ID) to generate them,",
        "or save one clip per line from narration_segments.csv as clips/001.mp3, clips/002.mp3, …",
      ].join("\n"),
    );
  }
  if (missing.length) {
    const characters = missing.reduce((sum, s) => sum + s.text.length, 0);
    console.log(`Voicing ${missing.length} lines (${characters.toLocaleString("en-US")} characters) with voice ${VOICE_ID}, model ${MODEL_ID}.`);
    for (const segment of missing) {
      const audio = await speak(segments, segments.indexOf(segment));
      writeFileSync(path.join(clipsDir, segment.clip), audio);
      process.stdout.write(`  ${segment.clip}  ${segment.text.slice(0, 70)}\n`);
    }
  }

  const placed = segments.map((segment) => {
    const file = findClip(segment);
    const length = probeDuration(file);
    const room = Math.max(0.5, segment.slot - GAP);
    const tempo = length > room ? length / room : 1;
    return { ...segment, file, length, tempo, spoken: length / tempo };
  });

  const squeezed = placed.filter((p) => p.tempo > 1);
  for (const p of squeezed) {
    const note = p.tempo > 1.15 ? "  (noticeable: try a faster voice or regenerate this line)" : "";
    console.log(`Line ${p.line} runs ${(p.length - p.spoken).toFixed(1)}s long, sped up ${Math.round((p.tempo - 1) * 100)}%${note}`);
  }

  const filters = placed.map((p, i) => {
    const chain = ["aresample=44100", "aformat=channel_layouts=stereo"];
    if (p.tempo > 1) chain.push(...atempoChain(p.tempo));
    chain.push(`adelay=${Math.round(p.start * 1000)}:all=1`);
    return `[${i + 1}:a]${chain.join(",")}[a${i}]`;
  });
  filters.push(
    `${placed.map((_, i) => `[a${i}]`).join("")}amix=inputs=${placed.length}:normalize=0:dropout_transition=0,` +
      `apad=whole_dur=${duration.toFixed(3)},asplit=2[withvideo][alone]`,
  );

  const narrated = path.join(dir, "helm_walkthrough_narrated.mp4");
  const audioOnly = path.join(dir, "narration.m4a");
  console.log(`Mixing ${placed.length} clips onto ${path.basename(video)} …`);
  run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    video,
    ...placed.flatMap((p) => ["-i", p.file]),
    "-filter_complex",
    filters.join(";"),
    "-map",
    "0:v",
    "-map",
    "[withvideo]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",
    narrated,
    "-map",
    "[alone]",
    "-t",
    duration.toFixed(3),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    audioOnly,
  ]);

  const cues = placed.flatMap((p) => {
    const words = p.text.split(/\s+/).length;
    let at = p.start;
    return subtitleChunks(p.text).map((text) => {
      const start = at;
      at += (p.spoken * text.split(/\s+/).length) / words;
      return { start, end: at, text };
    });
  });
  writeFileSync(
    path.join(dir, "transcript_narrated.srt"),
    cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n"),
  );

  console.log(`\nWrote ${path.basename(narrated)}, ${path.basename(audioOnly)} and transcript_narrated.srt in ${dir}`);
  if (squeezed.length) console.log(`${squeezed.length} of ${placed.length} lines were sped up to fit.`);
}

main().catch((err) => fail(err.stack ?? String(err)));
