/**
 * PUTS A REAL RECORDING UNDER A FILM, ON THE MUSIC GRID.
 *
 *   node films/install-voice.mjs <proj> <timings.json> <script.txt> [--lead-bars 2] [--dry]
 *
 * `audio/timings.py` aligns a recording and writes word and sentence times on
 * the VOICE FILE's own clock. This turns that into the film's clock:
 *
 *  1. The aligner splits on full stops, so "No long form. No agent to call
 *     first. Nothing to pay." comes back as three sentences. The films count
 *     sentences by SCRIPT LINE (s(1)..s(9)), because that is what was written
 *     and what every beat in a film hangs on. So the aligner's sentences are
 *     regrouped into the script's lines, by walking both word lists together.
 *  2. Each of the aligner's sentences is placed on the beat grid, keeping the
 *     gap the voice actually left between them (snapped to the nearest beat,
 *     never less than a quarter of a bar), so the music lands with the words
 *     instead of near them.
 *  3. The music's markers are derived and SNAPPED TO BAR LINES, which is what
 *     audio/music.py requires: it refuses a marker that is not on one.
 *
 * Out: films/<proj>/timeline.json, in the shape the engine and the mixer read
 * (the provisional clock's shape, minus the `provisional` mark).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback = null) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const [proj, timingsPath, scriptPath] = args.filter((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true);
if (!proj || !timingsPath || !scriptPath) {
  console.error("usage: node films/install-voice.mjs <proj> <timings.json> <script.txt> [--lead-bars 2] [--dry]");
  process.exit(1);
}

const BPM = 104;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LEAD_BARS = Number(opt("lead-bars", 1));
const DRY = args.includes("--dry");
const MIN_GAP = BEAT / 2;       /* never run two sentences closer than half a beat */
const EDGE = 0.06;              /* a breath of room taken either side of a segment */

const T = JSON.parse(readFileSync(timingsPath, "utf8"));
const lines = readFileSync(scriptPath, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const beat = (t) => Math.round(t / BEAT) * BEAT;
const bar = (t) => Math.round(t / BAR) * BAR;
const barUp = (t) => Math.ceil(t / BAR - 1e-9) * BAR;
const r3 = (t) => Math.round(t * 1000) / 1000;

/* ---- 1. the aligner's words, walked against the script's lines ---- */

const want = lines.map((text) => text.split(/\s+/).filter(Boolean).map(norm));
const heard = T.words.map((w) => ({ ...w, key: norm(w.word) }));
let at = 0;
const lineOf = new Map();  /* aligner word index -> script line (1-based) */
want.forEach((wordsInLine, k) => {
  for (const expected of wordsInLine) {
    if (at >= heard.length) throw new Error(`the recording runs out at line ${k + 1} ("${lines[k].slice(0, 40)}...")`);
    if (heard[at].key !== expected) {
      throw new Error(`line ${k + 1}: the recording says "${heard[at].word}" where the script says "${expected}". Align against the script that was actually read.`);
    }
    lineOf.set(at, k + 1);
    at += 1;
  }
});
if (at !== heard.length) throw new Error(`the recording has ${heard.length - at} words the script does not`);

/* ---- 2. the aligner's sentences, placed on the beat grid ---- */

const subs = T.sentences.map((s) => {
  const idx = heard.map((w, i) => (w.sentence === s.i ? i : -1)).filter((i) => i >= 0);
  return { ...s, first: idx[0], last: idx[idx.length - 1], line: lineOf.get(idx[0]) };
}).sort((a, b) => a.start - b.start);

const plan = [];
let dstEnd = 0;
subs.forEach((s, k) => {
  const srcStart = Math.max(0, s.start - EDGE);
  const srcEnd = Math.min(T.duration, s.end + EDGE);
  /* keep the gap the voice actually left, on the grid */
  const wanted = k === 0 ? LEAD_BARS * BAR : dstEnd + (s.start - subs[k - 1].end);
  const dstStart = Math.max(k === 0 ? wanted : dstEnd + MIN_GAP, beat(wanted));
  plan.push({ i: s.i, line: s.line, src_start: r3(srcStart), src_end: r3(srcEnd), dst_start: r3(dstStart), shift: dstStart - s.start });
  dstEnd = dstStart + (s.end - s.start);
});

const shiftFor = new Map(plan.map((p) => [p.i, p.shift]));
const words = heard.map((w, i) => ({
  sentence: lineOf.get(i),
  word: w.word,
  start: r3(w.start + shiftFor.get(w.sentence)),
  end: r3(w.end + shiftFor.get(w.sentence)),
}));

/* ---- 3. the script's lines, from the words that now carry them ---- */

const sentences = lines.map((text, k) => {
  const mine = words.filter((w) => w.sentence === k + 1);
  return { i: k + 1, start: mine[0].start, end: mine[mine.length - 1].end, text };
});

/* ---- 4. the music, on bar lines, because music.py refuses anything else ---- */

const last = sentences[sentences.length - 1];
const logo = bar(last.start);                        /* "Vallo." */
const resolve = logo + BAR;                          /* "Real estate, done right." */
const badges = resolve + BAR;
/*
 * NO `url` ACCENT, and the film ends a bar after the badges. Every marker
 * has to sit on its own bar line (music.py refuses otherwise), so logo,
 * resolve, badges and url would need four bars after the last word and the
 * film would carry nearly seven seconds of end card on a forty-second film.
 * music.py takes the accents that are present, so the address gets the
 * badges' bar and no hit of its own. On the long films, where there was a
 * whole minute of room, it had one.
 */
const duration = barUp(Math.max(last.end, badges) + BAR);
const body = sentences.slice(1, -1);
const lifts = [0.3, 0.55, 0.78]
  .map((u) => bar(body[0].start + (body[body.length - 1].end - body[0].start) * u))
  .filter((t, i, a) => t > bar(sentences[1].start) && t < logo - BAR && a.indexOf(t) === i);
const music = {
  bpm: BPM, beat: BEAT, bar: BAR,
  intro_end: LEAD_BARS * BAR,
  drop: bar(sentences[1].start),
  lifts,
  logo_hit: logo,
  resolve,
  badges,
  url: null,
  duration,
};
for (const [k, v] of Object.entries(music)) {
  if (["bpm", "beat", "bar", "lifts"].includes(k) || v == null) continue;
  if (Math.abs(v / BAR - Math.round(v / BAR)) > 1e-6) throw new Error(`music marker ${k} (${v}) is not on a bar line`);
}
if (music.drop <= music.intro_end) music.drop = music.intro_end + BAR;

const out = {
  fps: 60,
  duration,
  voice: { plan: plan.map(({ i, src_start, src_end, dst_start }) => ({ i, src_start, src_end, dst_start })), end: last.end },
  music,
  sentences,
  words,
};

const file = join(HERE, proj, "timeline.json");
if (!DRY) writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
console.log(`${proj}: ${sentences.length} lines, ${words.length} words, voice ends ${last.end.toFixed(2)}s, film ${duration.toFixed(2)}s`);
for (const s of sentences) console.log(`  ${String(s.i).padStart(2)}  ${s.start.toFixed(2).padStart(6)} - ${s.end.toFixed(2).padStart(6)}  ${s.text.slice(0, 64)}`);
console.log(DRY ? "(dry run: nothing written)" : `wrote ${file}`);
