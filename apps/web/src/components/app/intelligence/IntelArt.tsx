import type { ReactNode } from "react";
import type { PostcardCity } from "./model";

/**
 * VALLO INTELLIGENCE'S OWN DRAWINGS (16 November 2026): small original line
 * art in the brand's ink, drawn here as inline SVG so it costs no request,
 * themes itself through `currentColor` and the CSS tokens, and is never a
 * photograph of anything.
 *
 *   Aurora         the light behind the title: three soft brand blooms and
 *                  a film of grain (CSS paints them; this is the frame).
 *   CitySkyline    a postcard vignette per city, simple and imagined: Lagos
 *                  on its lagoon and bridge, Abuja under its rock, Port
 *                  Harcourt by the river, Ibadan's roofs on the hills, Enugu's
 *                  ridges. Impressions, not maps.
 *   OpenDoor       the no-results picture: a door left ajar, light on the
 *                  floor, a key waiting.
 *
 * Every picture is decoration (`aria-hidden`); the words beside it carry
 * the meaning.
 */

/** The light behind the title. Three blooms and the grain, each its own layer so CSS can drift them once. */
export function Aurora() {
  return (
    <span className="nf-intel-aurora" aria-hidden="true">
      <span className="nf-intel-aurora__bloom nf-intel-aurora__bloom--a" />
      <span className="nf-intel-aurora__bloom nf-intel-aurora__bloom--b" />
      <span className="nf-intel-aurora__bloom nf-intel-aurora__bloom--c" />
      <span className="nf-intel-aurora__grain" />
    </span>
  );
}

/* Shared strokes: `ink` is the line, `soft` a quieter line, `fill` a brand wash, `sun` the accent. */
const ink = "nf-intel-art__ink";
const soft = "nf-intel-art__soft";
const fill = "nf-intel-art__fill";
const sun = "nf-intel-art__sun";

function Water({ y = 100 }: { y?: number }) {
  return (
    <g className={soft}>
      <path d={`M14 ${y}c10 -3 20 -3 30 0s20 3 30 0 20 -3 30 0 20 3 30 0`} />
      <path d={`M120 ${y + 8}c10 -3 20 -3 30 0s20 3 30 0 20 -3 30 0`} />
      <path d={`M40 ${y + 14}c8 -2 16 -2 24 0s16 2 24 0`} />
    </g>
  );
}

const SKYLINES: Record<PostcardCity, ReactNode> = {
  /* Towers on the water, the long low bridge, a boat, the sun over the lagoon. */
  Lagos: (
    <>
      <circle className={sun} cx="186" cy="30" r="12" />
      <path className={fill} d="M24 86V58h10v-8h8v36zM52 86V40h12v46zM70 86V30l7-8 7 8v56zM92 86V48h14v38zM112 86V36h10v50zM128 86V56h16v30z" />
      <g className={ink}>
        <path d="M24 86V58h10v-8h8v36" />
        <path d="M52 86V40h12v46" />
        <path d="M70 86V30l7-8 7 8v56" />
        <path d="M77 22v-8" />
        <path d="M92 86V48h14v38" />
        <path d="M112 86V36h10v50" />
        <path d="M128 86V56h16v30" />
        <path d="M56 48h4M56 56h4M56 64h4M96 56h6M96 64h6M116 44h2M116 52h2" />
        <path d="M10 86h220" />
        <path d="M150 80c14-10 30-10 44 0s30 10 44 0" />
        <path d="M150 80v8M168 74v14M186 76v12M204 82v6M222 76v12" />
      </g>
      <g className={ink}>
        <path d="M160 108h20l-3 5h-14z" />
        <path d="M170 108V97l7 8" />
      </g>
      <Water y={98} />
    </>
  ),
  /* The great rock behind the city, a dome and its columns, a palm. */
  Abuja: (
    <>
      <circle className={sun} cx="54" cy="28" r="10" />
      <path className={fill} d="M88 86c4-28 22-50 52-52 30 2 48 24 56 52z" />
      <g className={ink}>
        <path d="M88 86c4-28 22-50 52-52 30 2 48 24 56 52" />
        <path d="M120 50c6 4 10 10 12 18M160 46c-4 8-4 16 0 24" />
        <path d="M30 86V68h44v18" />
        <path d="M34 68c0-12 8-20 18-20s18 8 18 20" />
        <path d="M52 48v-6" />
        <path d="M38 86V74M46 86V74M58 86V74M66 86V74" />
        <path d="M206 86V56" />
        <path d="M206 56c-6-6-14-6-18-2M206 56c6-6 14-6 18-2M206 56c-2-8-8-12-14-12M206 56c2-8 8-12 14-12" />
        <path d="M10 86h220" />
      </g>
      <g className={soft}>
        <path d="M24 100h70M110 100h56M40 110h40M140 110h60" />
      </g>
    </>
  ),
  /* The river, a working crane and its ship, mangrove roots on the bank. */
  "Port Harcourt": (
    <>
      <circle className={sun} cx="190" cy="26" r="10" />
      <path className={fill} d="M22 86V62h18v24zM46 86V52h14v34zM66 86V66h20v20z" />
      <g className={ink}>
        <path d="M22 86V62h18v24M46 86V52h14v34M66 86V66h20v20" />
        <path d="M50 60h6M50 68h6M26 70h10" />
        <path d="M120 86V30h6v56" />
        <path d="M120 34h52M126 30l-22 6h16" />
        <path d="M160 34v16" />
        <path d="M154 50h12v6h-12z" />
        <path d="M134 98h64l-8 10h-50z" />
        <path d="M146 98v-10h18v10M170 98v-6h10v6" />
        <path d="M10 86h110M126 86h18" />
        <path d="M196 86c2-8 6-12 10-12s8 4 10 12M200 86l-4 6M206 86v6M212 86l4 6" />
        <path d="M206 74v-10c-6-2-10-6-10-12 6 0 10 4 10 8 0-6 4-10 10-10 0 6-4 10-10 12" />
      </g>
      <Water y={100} />
    </>
  ),
  /* Roofs on the hills, one tall tower, the long view. */
  Ibadan: (
    <>
      <circle className={sun} cx="40" cy="26" r="10" />
      <path className={fill} d="M10 86c30-24 70-30 110-18s70 4 110-10v28z" />
      <g className={ink}>
        <path d="M10 86c30-24 70-30 110-18s70 4 110-10" />
        <path d="M150 86V24h16v62" />
        <path d="M150 34h16M150 44h16M150 54h16M150 64h16M150 74h16" />
        <path d="M158 24v-8" />
        <path d="M30 86V76l8-6 8 6v10M54 86V74l9-7 9 7v12M84 86V78l7-5 7 5v8M104 86V74l8-6 8 6v12M178 86V76l8-6 8 6v10M200 86V78l7-5 7 5v8" />
        <path d="M10 86h220" />
      </g>
      <g className={soft}>
        <path d="M30 100h60M110 100h40M170 100h44M60 110h70" />
      </g>
    </>
  ),
  /* Ridge behind ridge, small houses, the road winding up. */
  Enugu: (
    <>
      <circle className={sun} cx="176" cy="24" r="10" />
      <path className={fill} d="M10 70c24-24 48-34 72-26s40 4 60-12 50-14 88 8v46H10z" />
      <g className={ink}>
        <path d="M10 70c24-24 48-34 72-26s40 4 60-12 50-14 88 8" />
        <path d="M10 80c30-14 60-16 90-8s60 6 130-6" />
        <path d="M120 112c-4-10 10-14 24-18s20-10 16-18" />
        <path d="M40 86V76l8-6 8 6v10M64 86V78l7-5 7 5v8M184 86V74l9-7 9 7v12" />
        <path d="M10 86h110M168 86h62" />
      </g>
      <g className={soft}>
        <path d="M24 100h70M180 100h36M30 110h50" />
      </g>
    </>
  ),
};

/** One city's vignette, in the brand's ink. */
export function CitySkyline({ city }: { city: PostcardCity }) {
  return (
    <svg className="nf-intel-art nf-intel-postcard__art" viewBox="0 0 240 120" fill="none" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMax meet">
      {SKYLINES[city]}
    </svg>
  );
}

/** Nothing matched: a door left open, its light on the floor, a key on the step. */
export function OpenDoor() {
  return (
    <svg className="nf-intel-art nf-intel-empty__art" viewBox="0 0 200 140" fill="none" aria-hidden="true" focusable="false">
      <path className={fill} d="M84 118 60 136h112l-28-18z" />
      <g className={ink}>
        <path d="M70 118V22h60v96" />
        <path d="M70 22l28 10v94l-28-8" />
        <path d="M91 74v6" />
        <path d="M40 118h120" />
        <path d="M84 118 60 136M130 118l34 18" />
      </g>
      <g className={soft}>
        <path d="M104 40h18M104 52h18M104 64h12" />
      </g>
      <g className={ink}>
        <circle cx="148" cy="108" r="6" />
        <path d="M154 108h16M164 108v5M168 108v4" />
      </g>
      <circle className={sun} cx="160" cy="34" r="6" />
      <path className={soft} d="M150 22l3 5M170 22l-3 5M160 18v6" />
    </svg>
  );
}
