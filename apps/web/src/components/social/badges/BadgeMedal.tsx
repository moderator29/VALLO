import { useId } from "react";

/**
 * THE MEDAL, DRAWN IN CODE (the founder, 25 October 2026: "the badge is not
 * clean and strong, it is dull and not HD").
 *
 * It used to be the `rosette` raster: a 256 pixel file drawn at about 214 CSS
 * pixels, which is 640 device pixels on a three-times phone, so the medal was
 * stretched two and a half times and read soft and flat. This is a vector, so
 * it is exactly sharp at any size and any pixel density, and it carries real
 * depth: a scalloped body with a lit top-left and a deep bottom-right, a hard
 * dark edge so the shape holds on the night canvas, an orange ring, a pale
 * centre so the badge's own object stands out, and two ribbon tails.
 *
 * Square, 240 by 240. The medal's centre is (120, 108); the caller seats the
 * badge's object in the pale disc (`.nf-moment__object`). Decorative: the
 * badge's name is on the button that holds it.
 */
const LOBES = 16;
const CENTER = { x: 120, y: 108 };
const BODY_R = 78;
const LOBE_R = 17;

const lobes = Array.from({ length: LOBES }, (_, i) => {
  const a = (i / LOBES) * Math.PI * 2 - Math.PI / 2;
  return { cx: +(CENTER.x + Math.cos(a) * BODY_R).toFixed(2), cy: +(CENTER.y + Math.sin(a) * BODY_R).toFixed(2) };
});

export function BadgeMedal({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = (name: string) => `nfm-${name}-${uid}`;
  return (
    <svg
      className={className}
      viewBox="0 0 240 240"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id={g("tail")} x1="0" y1="150" x2="0" y2="236" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF9F55" />
          <stop offset="1" stopColor="#EE5F12" />
        </linearGradient>
        <radialGradient id={g("body")} cx="34%" cy="26%" r="95%">
          <stop offset="0" stopColor="#6FA2FF" />
          <stop offset="0.42" stopColor="#2F66EE" />
          <stop offset="1" stopColor="#1431B8" />
        </radialGradient>
        <linearGradient id={g("ring")} x1="64" y1="52" x2="176" y2="164" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD08F" />
          <stop offset="0.5" stopColor="#FF9136" />
          <stop offset="1" stopColor="#F26A12" />
        </linearGradient>
        <radialGradient id={g("disc")} cx="38%" cy="30%" r="85%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#CFE0FF" />
        </radialGradient>
        <clipPath id={g("clip")}>
          <circle cx={CENTER.x} cy={CENTER.y} r="66" />
        </clipPath>
        <linearGradient id={g("shine")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ribbon tails, behind the body. */}
      <path
        d="M78 160 L118 172 L100 234 L84 216 L58 230 Z"
        fill={`url(#${g("tail")})`}
        stroke="#C2490C"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M162 160 L122 172 L140 234 L156 216 L182 230 Z"
        fill={`url(#${g("tail")})`}
        stroke="#C2490C"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M118 172 L100 234" stroke="#C2490C" strokeWidth="1.4" opacity="0.5" />
      <path d="M122 172 L140 234" stroke="#C2490C" strokeWidth="1.4" opacity="0.5" />

      {/* A hard dark edge first, so the scallops hold their shape on night. */}
      <g fill="#0B1F7A">
        <circle cx={CENTER.x} cy={CENTER.y} r={BODY_R + 2.5} />
        {lobes.map((l, i) => (
          <circle key={`e${i}`} cx={l.cx} cy={l.cy} r={LOBE_R + 2.5} />
        ))}
      </g>
      {/* The lit body. */}
      <g fill={`url(#${g("body")})`}>
        <circle cx={CENTER.x} cy={CENTER.y} r={BODY_R} />
        {lobes.map((l, i) => (
          <circle key={`b${i}`} cx={l.cx} cy={l.cy} r={LOBE_R} />
        ))}
      </g>

      {/* The orange ring, then the pale centre the object sits on. */}
      <circle cx={CENTER.x} cy={CENTER.y} r="62" fill="none" stroke="#0B1F7A" strokeWidth="12" opacity="0.55" />
      <circle cx={CENTER.x} cy={CENTER.y} r="62" fill="none" stroke={`url(#${g("ring")})`} strokeWidth="9" />
      <circle cx={CENTER.x} cy={CENTER.y} r="56" fill={`url(#${g("disc")})`} />

      {/* Light from the top left. */}
      <g clipPath={`url(#${g("clip")})`}>
        <ellipse
          cx="96"
          cy="70"
          rx="52"
          ry="20"
          transform="rotate(-32 96 70)"
          fill={`url(#${g("shine")})`}
        />
      </g>
    </svg>
  );
}
