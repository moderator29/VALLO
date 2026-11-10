import type { CSSProperties } from "react";

/**
 * VALLO ROOMMATES' OWN ARTWORK, drawn in SVG from simple shapes (server safe,
 * no image file, no stock). Colours come only from the brand tokens through
 * the classes in `roommates-welcome.css`, so it follows both themes.
 *
 *   SkylineArt    layered apartment blocks with warm windows and two homes
 *                 joined by a dotted link: the hero's ground
 *   HandshakeArt  two arms meeting in a clasp: the "You're connected" mark
 *   KeyDoorArt    a door ajar with a key: the "Submitted for review" mark
 *
 * Motion is transform and opacity only (a slow drift per layer, a light
 * sweep, window flicker); reduced motion and the in-app Calm and Off show
 * the resting scene (the CSS holds the rule).
 */

/* A deterministic grid of windows: which are lit is a fixed pattern, so the server and the client agree. */
function windows(x: number, y: number, cols: number, rows: number, seed: number) {
  const out: { x: number; y: number; lit: boolean; i: number }[] = [];
  let k = seed;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      k = (k * 31 + 7) % 97;
      out.push({ x: x + c * 14, y: y + r * 18, lit: k % 3 !== 0, i: r * cols + c });
    }
  }
  return out;
}

const BLOCKS: { x: number; w: number; h: number; cols: number; rows: number; seed: number }[] = [
  { x: 8, w: 62, h: 118, cols: 4, rows: 5, seed: 3 },
  { x: 78, w: 50, h: 150, cols: 3, rows: 7, seed: 11 },
  { x: 250, w: 56, h: 134, cols: 3, rows: 6, seed: 19 },
  { x: 314, w: 68, h: 108, cols: 4, rows: 4, seed: 29 },
];

export function SkylineArt({ className }: { className?: string }) {
  return (
    <svg className={`nf-rma nf-rma--sky${className ? ` ${className}` : ""}`} viewBox="0 0 390 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <g className="nf-rma__far">
        <rect className="nf-rma__tone-1" x="-10" y="120" width="70" height="140" rx="3" />
        <rect className="nf-rma__tone-1" x="64" y="96" width="46" height="164" rx="3" />
        <rect className="nf-rma__tone-1" x="228" y="110" width="52" height="150" rx="3" />
        <rect className="nf-rma__tone-1" x="296" y="84" width="60" height="176" rx="3" />
        <rect className="nf-rma__tone-1" x="350" y="128" width="50" height="132" rx="3" />
      </g>
      <g className="nf-rma__mid">
        {BLOCKS.map((b) => (
          <g key={b.x}>
            <rect className="nf-rma__tone-2" x={b.x} y={260 - b.h} width={b.w} height={b.h} rx="4" />
            <rect className="nf-rma__roof" x={b.x + 4} y={260 - b.h - 5} width={b.w - 8} height="5" rx="2" />
            {windows(b.x + 9, 260 - b.h + 12, b.cols, b.rows, b.seed).map((w) => (
              <rect key={w.i} className={w.lit ? "nf-rma__win nf-rma__win--lit" : "nf-rma__win"} style={{ "--nf-rma-i": w.i % 9 } as CSSProperties} x={w.x} y={w.y} width="8" height="11" rx="1.5" />
            ))}
          </g>
        ))}
      </g>
      {/* The two homes and the link between them: two people, one space. */}
      <g className="nf-rma__link">
        <path className="nf-rma__arc" d="M150 150 C 176 96, 214 96, 240 150" fill="none" />
        <circle className="nf-rma__dot" style={{ "--nf-rma-i": 0 } as CSSProperties} cx="172" cy="112" r="2.6" />
        <circle className="nf-rma__dot" style={{ "--nf-rma-i": 1 } as CSSProperties} cx="195" cy="101" r="2.6" />
        <circle className="nf-rma__dot" style={{ "--nf-rma-i": 2 } as CSSProperties} cx="218" cy="112" r="2.6" />
        <g className="nf-rma__home" transform="translate(126 148)">
          <path d="M0 22 L24 2 L48 22 V50 H0 Z" />
          <rect className="nf-rma__door" x="18" y="30" width="12" height="20" rx="2" />
          <circle className="nf-rma__knob" cx="27" cy="41" r="1.4" />
        </g>
        <g className="nf-rma__home nf-rma__home--b" transform="translate(216 148)">
          <path d="M0 22 L24 2 L48 22 V50 H0 Z" />
          <rect className="nf-rma__door" x="18" y="30" width="12" height="20" rx="2" />
          <circle className="nf-rma__knob" cx="27" cy="41" r="1.4" />
        </g>
      </g>
      <rect className="nf-rma__ground" x="0" y="250" width="390" height="10" />
      <rect className="nf-rma__sweep" x="-120" y="0" width="90" height="260" />
    </svg>
  );
}

export function HandshakeArt({ className }: { className?: string }) {
  return (
    <svg className={`nf-rma nf-rma--hands${className ? ` ${className}` : ""}`} viewBox="0 0 220 160" aria-hidden="true" focusable="false">
      <circle className="nf-rma__halo" cx="110" cy="80" r="70" />
      <circle className="nf-rma__halo nf-rma__halo--b" cx="110" cy="80" r="52" />
      <g className="nf-rma__arm nf-rma__arm--l">
        <rect x="14" y="62" width="96" height="30" rx="15" transform="rotate(-14 62 77)" />
        <rect className="nf-rma__cuff" x="6" y="56" width="22" height="42" rx="7" transform="rotate(-14 17 77)" />
      </g>
      <g className="nf-rma__arm nf-rma__arm--r">
        <rect x="110" y="68" width="96" height="30" rx="15" transform="rotate(14 158 83)" />
        <rect className="nf-rma__cuff" x="192" y="62" width="22" height="42" rx="7" transform="rotate(14 203 83)" />
      </g>
      <g className="nf-rma__clasp">
        <rect x="84" y="58" width="52" height="40" rx="20" />
        <path className="nf-rma__finger" d="M92 70 H124 M92 78 H128 M96 86 H124" fill="none" />
      </g>
      <g className="nf-rma__spark">
        <circle cx="40" cy="30" r="3" />
        <circle cx="184" cy="38" r="2.4" />
        <circle cx="176" cy="128" r="3" />
        <circle cx="38" cy="124" r="2.2" />
      </g>
    </svg>
  );
}

export function KeyDoorArt({ className }: { className?: string }) {
  return (
    <svg className={`nf-rma nf-rma--door${className ? ` ${className}` : ""}`} viewBox="0 0 200 180" aria-hidden="true" focusable="false">
      <circle className="nf-rma__halo" cx="100" cy="92" r="72" />
      <g className="nf-rma__frame">
        <rect x="58" y="28" width="84" height="124" rx="8" />
        <path className="nf-rma__open" d="M66 36 L108 44 V148 L66 144 Z" />
        <circle className="nf-rma__knob" cx="100" cy="96" r="2.6" />
      </g>
      <g className="nf-rma__key">
        <circle cx="152" cy="118" r="14" />
        <circle className="nf-rma__hole" cx="152" cy="118" r="5" />
        <rect x="160" y="113" width="40" height="10" rx="3" transform="rotate(30 160 118)" />
      </g>
      <path className="nf-rma__tick" d="M84 90 L96 102 L118 78" fill="none" />
    </svg>
  );
}
