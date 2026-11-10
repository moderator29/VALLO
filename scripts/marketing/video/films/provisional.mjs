/**
 * A PROVISIONAL CLOCK, so a film can be built before its voice exists.
 *
 *   node films/provisional.mjs <proj> <script.txt>
 *
 * The films hang every beat on a sentence or a word of the voiceover
 * (`s(i)`, `w(i, "word")`), which normally comes from the aligner. This lays
 * the same shape out from the script alone, at the rate the two long films
 * were actually spoken (2.3 words a second, a 0.8 s breath between
 * sentences, a word's length in proportion to its letters), so the whole
 * film can be built, checked and looked at while the recording is still
 * being made.
 *
 * When the real recording lands, run the aligner over it and every beat
 * re-anchors itself: nothing in the film refers to a number of seconds.
 *
 *   python3 ../audio/mix.py align --voice <file.mp3> --script <script.txt>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const [proj, scriptPath] = process.argv.slice(2);
if (!proj || !scriptPath) {
  console.error("usage: node films/provisional.mjs <proj> <script.txt>");
  process.exit(1);
}

/*
 * Measured, 17 October, from the sign-up recording as it was actually read
 * (95 words, nine lines, 39.2 s on the film's clock once installed): the
 * long films' 2.3 words a second was half a minute too slow over a one-minute
 * script. A provisional clock laid out at these numbers lands within a few
 * hundred milliseconds of the real one, so a film built on it needs no
 * respacing when the recording arrives.
 */
const RATE = 2.95;         /* words a second, as the short films were spoken */
const GAP = 0.32;          /* the breath between two sentences */
const LEAD = 2.308;        /* the quiet before the first word: one bar at 104 */
const TAIL = 2.4;          /* the room the ending needs after the last word */
const BPM = 104;

/* Sentences are the script's own lines; a blank line is a longer breath. */
const raw = readFileSync(scriptPath, "utf8");
const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

const sentences = [];
const words = [];
let t = LEAD;
lines.forEach((text, k) => {
  const i = k + 1;
  const parts = text.split(/\s+/).filter(Boolean);
  /* a sentence's length is its words at the rate, with longer words longer */
  const weight = parts.map((w) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length));
  const total = weight.reduce((a, b) => a + b, 0);
  const dur = parts.length / RATE;
  const start = t;
  let at = t;
  parts.forEach((w, j) => {
    const d = (weight[j] / total) * dur;
    words.push({ sentence: i, word: w, start: +at.toFixed(3), end: +(at + d * 0.92).toFixed(3) });
    at += d;
  });
  t = start + dur;
  sentences.push({ i, start: +start.toFixed(3), end: +t.toFixed(3), text });
  t += GAP;
});

const beat = 60 / BPM;
const bar = beat * 4;
/*
 * THE MUSIC'S MARKERS, on bar lines, the same way install-voice.mjs derives
 * them from a real recording. Without them audio/music.py falls back to the
 * defaults it carries for a 101 s film and lays a 19-bar arrangement over
 * the wrong places, and it refuses any marker that is not on a bar line. A
 * provisional clock that cannot render its own bed is only half a clock: a
 * film on one could be looked at but not heard.
 */
const barAt = (x) => Math.round(x / bar) * bar;
const barUp = (x) => Math.ceil(x / bar - 1e-9) * bar;
const last = sentences[sentences.length - 1];
const logo = barAt(last.start);
const resolve = logo + bar;
const badges = resolve + bar;
const duration = +barUp(Math.max(last.end, badges) + bar).toFixed(3);
const body = sentences.slice(1, -1);
const lifts = [0.3, 0.55, 0.78]
  .map((u) => barAt(body[0].start + (body[body.length - 1].end - body[0].start) * u))
  .filter((x, i, a) => x > barAt(sentences[1].start) && x < logo - bar && a.indexOf(x) === i);
const out = {
  fps: 60,
  duration,
  provisional: true,
  voice: { plan: [], end: +(t - GAP).toFixed(3) },
  music: {
    bpm: BPM, beat: +beat.toFixed(6), bar: +bar.toFixed(6),
    intro_end: bar,
    drop: Math.max(barAt(sentences[1].start), 2 * bar),
    lifts,
    logo_hit: logo,
    resolve,
    badges,
    url: null,
    duration,
  },
  sentences,
  words,
};
const dir = join(HERE, proj);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "timeline.json"), JSON.stringify(out, null, 1));
console.log(`${proj}: ${sentences.length} sentences, ${words.length} words, ${duration.toFixed(1)} s (provisional)`);
