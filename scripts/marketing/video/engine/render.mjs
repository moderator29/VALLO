/**
 * RENDERS A FILM FRAME BY FRAME.
 *
 *   node scripts/marketing/video/engine/render.mjs --film mobile|desktop
 *     [--from 0] [--to <duration>] [--fps 60] [--workers 3] [--scale 1]
 *                           (a quick review clip: --scale 0.5 --fps 30, a quarter of the pixels, half the frames)
 *     [--scenes a,b]        build only these scene modules
 *     [--out file.mp4]      the video (default: <scratch>/renders/<film>.mp4)
 *     [--audio file.m4a]    mux this soundtrack in
 *     [--stills 1.2,3.4]    write PNG stills at these times instead of a video
 *     [--sheet 0.2]         a contact sheet: one frame every 0.2 s, with timestamps
 *     [--check 8]           determinism: render 8 frames twice, in a different order, and compare
 *     [--ending soon|live]  the store ending: "soon" (no badges) or "live" (official badges)
 *
 * Each worker is its own Chromium page holding the whole film; it seeks the
 * timeline to each frame's time and takes a screenshot, and its frames are
 * piped into its own ffmpeg (H.264, BT.709, yuv420p). The pieces are then
 * joined without re-encoding. The film's sound-effect cues are written next
 * to the output (sfx-<film>.json) for the mixer.
 */
import { chromium } from "playwright-core";
import sharp from "sharp";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { startServer } from "./server.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback = null) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const film = opt("film", "mobile");
const reel = opt("reel");
const proj = opt("proj");
const fps = Number(opt("fps", 60));
const workers = Number(opt("workers", 3));
const scale = Number(opt("scale", 1));
const scenes = opt("scenes");
const stills = opt("stills");
const sheet = opt("sheet");
const check = opt("check");
const audio = opt("audio");
const SCRATCH = process.env.RENDER_DIR ?? "/tmp/claude-0/-home-user-read-it-well/e877abda-8aaf-57c8-a7aa-c0953c2acde6/scratchpad/renders";
const out = resolve(opt("out", join(SCRATCH, `${film}.mp4`)));
mkdirSync(dirname(out), { recursive: true });

const SIZE = film === "desktop" ? { W: 1920, H: 1080 } : { W: 1080, H: 1920 };
const GL_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"];
/* Software compositing (faster than compositing through SwiftShader); WebGL
   still runs on SwiftShader for the 3D phones and the map. */
const RENDER_ARGS = ["--disable-gpu-compositing", "--disable-partial-raster", "--run-all-compositor-stages-before-draw", "--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb", "--hide-scrollbars", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"];
/* JPEG at quality 100 is several times faster to capture than PNG, and the
   film is 4:2:0 H.264 anyway; stills for review stay PNG. */
const FRAME_FORMAT = process.env.FRAME_FORMAT ?? "jpeg";

const { server, url } = await startServer();
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: [...GL_ARGS, ...RENDER_ARGS] });

async function openFilm(pageScale = scale) {
  const context = await browser.newContext({ viewport: { width: SIZE.W, height: SIZE.H }, deviceScaleFactor: pageScale });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.error(`[page] ${m.text()}`); });
  page.on("pageerror", (e) => console.error(`[page error] ${e.message}`));
  const query = new URLSearchParams({ film, ending: opt("ending", "soon"), ...(reel ? { reel } : {}), ...(proj ? { proj } : {}), ...(scenes ? { scenes } : {}) });
  await page.goto(`${url}/film.html?${query}`, { waitUntil: "load", timeout: 120_000 });
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 300_000, polling: 200 });
  const error = await page.evaluate(() => window.__error);
  if (error) throw new Error(`film failed to build:\n${error}`);
  const cdp = await context.newCDPSession(page);
  const frame = async (t, format = FRAME_FORMAT) => {
    await page.evaluate((time) => window.__film.seek(time), t);
    const shot = format === "png" ? { format: "png", optimizeForSpeed: true } : { format: "jpeg", quality: 100 };
    const { data } = await cdp.send("Page.captureScreenshot", { ...shot, fromSurface: true, captureBeyondViewport: false });
    return Buffer.from(data, "base64");
  };
  return { page, context, frame, duration: await page.evaluate(() => window.__film.duration) };
}

/* The video's size follows --scale: 1 for the films, 0.5 for quick reviews. */
function encoder(file, { w = Math.round(SIZE.W * Math.min(scale, 1) / 2) * 2, h = Math.round(SIZE.H * Math.min(scale, 1) / 2) * 2 } = {}) {
  const vf = [`scale=${w}:${h}:flags=lanczos:out_color_matrix=bt709:out_range=tv`, "format=yuv420p"].join(",");
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", FRAME_FORMAT === "png" ? "png" : "mjpeg", "-i", "-",
    "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-x264-params", `keyint=${fps * 2}:min-keyint=${fps}`, "-movflags", "+faststart", file,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((ok, fail) => ff.on("close", (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`)))));
  const write = (buf) => new Promise((ok) => (ff.stdin.write(buf) ? ok() : ff.stdin.once("drain", ok)));
  return { write, end: () => { ff.stdin.end(); return done; } };
}

const run = (cmd, argv) => new Promise((ok, fail) => {
  const p = spawn(cmd, argv, { stdio: ["ignore", "inherit", "inherit"] });
  p.on("close", (code) => (code === 0 ? ok() : fail(new Error(`${cmd} exited ${code}`))));
});

const started = Date.now();
try {
  if (stills) {
    const film0 = await openFilm();
    for (const t of stills.split(",").map(Number)) {
      const png = await film0.frame(t, "png");
      const file = join(dirname(out), `${proj ? `${proj}-${film}` : reel ?? film}-${t.toFixed(2)}.png`);
      await sharp(png).resize(Math.round(SIZE.W * scale), Math.round(SIZE.H * scale), { kernel: "lanczos3" }).png().toFile(file);
      console.log(file);
    }
  } else if (check) {
    const n = Number(check);
    const a = await openFilm();
    const b = await openFilm();
    const times = Array.from({ length: n }, (_, k) => +(((k + 0.37) / n) * (Number(opt("to", a.duration)) - Number(opt("from", 0))) + Number(opt("from", 0))).toFixed(4));
    const hash = (buf) => createHash("sha1").update(buf).digest("hex").slice(0, 12);
    const first = [];
    for (const t of times) first.push(hash(await a.frame(t, "png")));
    const second = [];
    for (const t of [...times].reverse()) second.unshift(hash(await b.frame(t, "png")));
    const again = [];
    for (const t of times) again.push(hash(await a.frame(t, "png")));
    let same = 0;
    times.forEach((t, k) => {
      const ok = first[k] === second[k] && first[k] === again[k];
      if (ok) same += 1;
      console.log(`${ok ? "same" : "DIFF"}  t=${t}  ${first[k]} ${second[k]} ${again[k]}`);
    });
    console.log(`determinism: ${same}/${times.length} frames identical`);
    if (same !== times.length) process.exitCode = 2;
  } else if (sheet) {
    const step = Number(sheet);
    const film0 = await openFilm(Math.min(scale, 0.5));
    const from = Number(opt("from", 0));
    const to = Number(opt("to", film0.duration));
    const tw = film === "desktop" ? 384 : 216;
    const th = film === "desktop" ? 216 : 384;
    const tiles = [];
    for (let t = from; t < to - 1e-6; t += step) {
      const png = await film0.frame(+t.toFixed(4), "png");
      const label = Buffer.from(`<svg width="${tw}" height="26"><rect width="${tw}" height="26" fill="#000" fill-opacity="0.6"/><text x="6" y="19" font-family="Inter, sans-serif" font-size="16" fill="#fff">${t.toFixed(2)} s</text></svg>`);
      tiles.push(await sharp(png).resize(tw, th).composite([{ input: label, left: 0, top: th - 26 }]).png().toBuffer());
    }
    const cols = film === "desktop" ? 8 : 12;
    const rows = Math.ceil(tiles.length / cols);
    const gap = 4;
    const file = out.replace(/\.mp4$/, "") + `-sheet-${from}-${to}.png`;
    await sharp({ create: { width: cols * (tw + gap) + gap, height: rows * (th + gap) + gap, channels: 3, background: "#222" } })
      .composite(tiles.map((input, k) => ({ input, left: gap + (k % cols) * (tw + gap), top: gap + Math.floor(k / cols) * (th + gap) })))
      .png().toFile(file);
    console.log(`${file} (${tiles.length} frames)`);
  } else {
    const probe = await openFilm();
    const from = Number(opt("from", 0));
    const to = Math.min(Number(opt("to", probe.duration)), probe.duration);
    const total = Math.round((to - from) * fps);
    const cues = await probe.page.evaluate(() => window.__film.cues());
    writeFileSync(join(dirname(out), `sfx-${proj ? `${proj}-${film}` : reel ?? film}.json`), JSON.stringify(cues.filter((c) => c.t >= from && c.t < to).map((c) => ({ ...c, t: +(c.t - from).toFixed(3) })), null, 1) + "\n");
    const pages = [probe];
    for (let k = 1; k < workers; k += 1) pages.push(await openFilm());
    const parts = [];
    let doneFrames = 0;
    const tick = setInterval(() => {
      const s = (Date.now() - started) / 1000;
      process.stdout.write(`\r${doneFrames}/${total} frames, ${(doneFrames / s).toFixed(1)} fps, ${s.toFixed(0)} s`);
    }, 5000);
    await Promise.all(pages.map(async (p, k) => {
      const a = Math.floor((total * k) / pages.length);
      const b = Math.floor((total * (k + 1)) / pages.length);
      if (b <= a) return;
      const file = out.replace(/\.mp4$/, `.part${k}.mp4`);
      parts[k] = file;
      const enc = encoder(file);
      for (let i = a; i < b; i += 1) {
        await enc.write(await p.frame(+(from + i / fps).toFixed(6)));
        doneFrames += 1;
      }
      await enc.end();
    }));
    clearInterval(tick);
    const list = out.replace(/\.mp4$/, ".parts.txt");
    writeFileSync(list, parts.filter(Boolean).map((f) => `file '${f}'`).join("\n") + "\n");
    const silent = audio ? out.replace(/\.mp4$/, ".video.mp4") : out;
    await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", silent]);
    if (audio) {
      await run("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-ss", String(from), "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", out]);
      rmSync(silent);
    }
    for (const f of parts.filter(Boolean)) rmSync(f);
    rmSync(list);
    console.log(`\n${out}: ${total} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
} finally {
  await browser.close();
  server.close();
}
