/**
 * LAYS OUT VIDEO ONE'S PROVISIONAL CLOCK (until the real recording lands).
 *
 *   node films/how2/lay-out.mjs
 *
 * Runs films/provisional.mjs over the script, then does the one thing a
 * provisional clock cannot know: the end card's last line ("Vallo. Real
 * estate, done right.") has to land ON the music's logo hit, which is a bar
 * line. The aligner's real clock puts every sentence on the beat grid
 * (films/install-voice.mjs); this puts the last one on its bar so the hit and
 * the mark arrive together.
 *
 * When the recording is in, DO NOT run this: run
 *   python3 scripts/marketing/audio/timings.py --voice <take> --script <script> --out <dir>
 *   node scripts/marketing/video/films/install-voice.mjs how2 <dir>/timings.json <script>
 * and every beat re-anchors itself (nothing in the film refers to seconds).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "..", "..", "..", "..", "docs", "marketing", "voiceover", "scripts", "video-1-how-vallo-works.txt");
execFileSync("node", [join(HERE, "..", "provisional.mjs"), "how2", SCRIPT], { stdio: "inherit", cwd: join(HERE, "..", "..") });

const file = join(HERE, "timeline.json");
const T = JSON.parse(readFileSync(file, "utf8"));
const BAR = T.music.bar;
const last = T.sentences[T.sentences.length - 1];
const snapped = Math.round(last.start / BAR) * BAR;
const d = snapped - last.start;
last.start = +(last.start + d).toFixed(3);
last.end = +(last.end + d).toFixed(3);
for (const w of T.words) if (w.sentence === last.i) { w.start = +(w.start + d).toFixed(3); w.end = +(w.end + d).toFixed(3); }
T.voice.end = last.end;
T.music.logo_hit = +snapped.toFixed(3);
T.music.resolve = +(snapped + BAR).toFixed(3);
T.music.badges = +(snapped + 2 * BAR).toFixed(3);
const barUp = (x) => Math.ceil(x / BAR - 1e-9) * BAR;
T.duration = +barUp(Math.max(last.end, T.music.badges) + BAR).toFixed(3);
T.music.duration = T.duration;
writeFileSync(file, JSON.stringify(T, null, 1));
console.log(`how2: last line snapped by ${d.toFixed(2)} s onto the logo bar; film ${T.duration} s`);
