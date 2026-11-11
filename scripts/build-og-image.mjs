/**
 * Build the Open Graph card: the image a Vallo link shows when it is pasted
 * into WhatsApp, X, iMessage or anywhere else that unfurls links.
 *
 * Run from the repository root:
 *
 *   node scripts/build-og-image.mjs
 *
 * WHY A STATIC FILE AND NOT AN `opengraph-image.tsx` ROUTE. Next can render one
 * at request time with ImageResponse, and for a card that never changes that
 * buys nothing and costs a cold render on the first share, a font bundle, and
 * one more thing that can fail in production. The card is brand, not data. A
 * PNG in the app directory is served as-is, cached forever, and cannot break.
 *
 * WHY IT MATTERS THIS MUCH. In a WhatsApp-first market the unfurled card is the
 * first impression for most visitors, before the landing page and before the
 * app. Until 16 September 2026 the product had NO Open Graph image at all:
 * every shared link rendered as a blank grey rectangle.
 *
 * THE COMPOSITION (rebuilt 10 November 2026): a bright ground, white to pale blue like the app
 * icon, with a faint cyan bloom behind the lockup; the full-colour mark above the wordmark,
 * centred, then the slogan as live text in the brand ink and one quiet sub-line. Everything
 * meaningful sits in the middle 60 per cent horizontally, because WhatsApp crops toward a
 * square on some surfaces and 1200x630 is the one size every unfurler accepts. It was the
 * dusk villa photograph under a navy veil until then.
 *
 * THE BUDGET. Under 100KB (`BUDGET` below, the same ceiling as every share card), because the
 * card is fetched by every unfurler on every share. A smooth gradient with a lockup and two
 * lines of type is a small JPEG; the quality steps down only if it is ever not.
 */

import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
/* `next` lives in apps/web/node_modules, not beside this script (10 November 2026: it failed
   with "cannot find next" when run from here). Resolve it from the app's own package. */
const { ImageResponse } = createRequire(path.join(ROOT, "apps/web/package.json"))("next/og");
const BRAND = path.join(ROOT, "apps/web/public/brand");
const OUT = path.join(ROOT, "apps/web/src/app/opengraph-image.jpg");

const W = 1200, H = 630;
/* OPS-16: a JPEG. The palette PNG this used to write was 294KB, a hair under
   the roughly 300KB some unfurlers drop previews above; a photograph ground is
   what JPEG is for. W3 (round 5): under 100KB, the budget every share card now
   keeps (`apps/web/src/lib/share/og-encode.ts`); it was 117KB. */
const BUDGET = 95 * 1024;

/* THE BRIGHT CARD (10 November 2026, brand refresh). The same ground as the bright app
   icon, white to pale blue, with the full-colour mark and wordmark and the headline in the
   brand ink, so the unfurled card and the home-screen icon are one identity. The old card
   was the villa photograph under a navy veil, which made the new mark's cyan and orange read
   dim. Hex is correct here for the same reason it is in an email: this is a bitmap, and there
   is no stylesheet for a token to live in. Anchor: `--nf-ink-950`. NOTE (11 November 2026):
   the app icon this card was matched to went back to the brand navy, so the two no longer
   share a ground. The card is still bright on purpose, because an unfurled link sits on a
   white chat or timeline, not on a home screen. Revisit if the card is ever to match again. */
const INK_950 = "#010118";
const BRIGHT_TOP = "#FFFFFF";
const BRIGHT_BOTTOM = "#DCEBFF";
const CYAN = "#5BE7FF";
const BLUE = "#2F6BFF";
const ORANGE = "#FF9244";
const TEXT = INK_950;
const BODY = "#33407A";

/* The ground: the icon's vertical white to pale blue, a cyan bloom behind the mark and a
   warm one low right, both faint, so the card is lit rather than flat. */
const plate = await sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BRIGHT_TOP}"/>
      <stop offset="1" stop-color="${BRIGHT_BOTTOM}"/>
    </linearGradient>
    <radialGradient id="cyan" cx="50%" cy="22%" r="46%">
      <stop offset="0" stop-color="${CYAN}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${CYAN}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="warm" cx="92%" cy="104%" r="42%">
      <stop offset="0" stop-color="${ORANGE}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blue" cx="6%" cy="104%" r="42%">
      <stop offset="0" stop-color="${BLUE}" stop-opacity="0.14"/>
      <stop offset="1" stop-color="${BLUE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#cyan)"/>
  <rect width="${W}" height="${H}" fill="url(#warm)"/>
  <rect width="${W}" height="${H}" fill="url(#blue)"/>
</svg>`)).png().toBuffer();

/*
 * THE SLOGAN, D1 (locked): "Space, without the runaround." It replaced
 * "Real Estate reimagined!", which this card still carried, exclamation mark
 * and all, on every link anybody pasted (W3, round 5). The sub-line is the
 * share description's first clause, so the picture and the words under it say
 * one thing.
 *
 * SET IN THE BRAND'S FACES, by the same renderer as every other card: the
 * slogan in Poppins 600, the sub-line in Inter 400, from the files the share
 * door's image route reads. It was Helvetica, by way of whatever font the
 * build machine had.
 */
const FONTS = path.join(ROOT, "apps/web/src/app/s/[token]");
const font = (file) => {
  const bytes = readFileSync(path.join(FONTS, file));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};
const lineImage = new ImageResponse(
  {
    type: "div",
    props: {
      style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center" },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", color: TEXT, fontFamily: "Poppins", fontWeight: 600, fontSize: 46, letterSpacing: -0.5 },
            children: "Space, without the runaround.",
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", marginTop: 14, color: BODY, fontFamily: "Inter", fontSize: 27 },
            children: "Homes, land, hotels and shortlets across Nigeria.",
          },
        },
      ],
    },
  },
  {
    width: W,
    height: 130,
    fonts: [
      { name: "Inter", data: font("Inter-Regular.woff"), weight: 400, style: "normal" },
      { name: "Poppins", data: font("Poppins-SemiBold.ttf"), weight: 600, style: "normal" },
    ],
  },
);
const line = Buffer.from(await lineImage.arrayBuffer());

const mark = await sharp(path.join(BRAND, "vallo-mark.png"))
  .resize(230, 230, { fit: "inside" })
  .png().toBuffer();
const word = await sharp(path.join(BRAND, "vallo-wordmark.png"))
  .resize(330, 80, { fit: "inside" })
  .png().toBuffer();

const markMeta = await sharp(mark).metadata();
const wordMeta = await sharp(word).metadata();

/* Vertical rhythm: mark, 28px, wordmark, 34px, slogan block. Centred on the
   canvas as one stack, sitting a little above the middle so the bloom reads
   as ground beneath it. */
const MARK_TOP = 96;
const WORD_TOP = MARK_TOP + markMeta.height + 28;
const LINE_TOP = WORD_TOP + wordMeta.height + 34;

const composed = sharp(plate)
  .composite([
    { input: mark, left: Math.round(W / 2 - markMeta.width / 2), top: MARK_TOP },
    { input: word, left: Math.round(W / 2 - wordMeta.width / 2), top: WORD_TOP },
    { input: line, left: 0, top: LINE_TOP },
  ]);

/*
 * Written as an 8-bit palette PNG. The colour count steps down until the file
 * fits the budget, and the first attempt is the richest, so the card is as
 * good as the budget allows rather than as small as it could be.
 */
const raw = await composed.png().toBuffer();
let written = null;
for (const quality of [86, 82, 78, 74, 70, 66, 62]) {
  const info = await sharp(raw)
    .flatten({ background: BRIGHT_BOTTOM })
    .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(OUT);
  written = { quality, size: statSync(OUT).size, width: info.width, height: info.height };
  if (written.size <= BUDGET) break;
}

if (written === null || written.size > BUDGET) {
  console.error(`opengraph-image.jpg is ${written?.size ?? 0} bytes, over the ${BUDGET} byte budget`);
  process.exit(1);
}

console.log(
  `opengraph-image.jpg ${written.width}x${written.height} ${(written.size / 1024).toFixed(0)}kB (quality ${written.quality})`,
);
