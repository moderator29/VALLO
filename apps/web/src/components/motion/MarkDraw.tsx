/**
 * THE VALLO MARK, DRAWING ITSELF ONCE (founder ruling (a): the animated mark
 * where the app shows its logo inside: sign-in, the empty home). The ring
 * draws in and the four towers rise one by one, from the exact brand paths
 * (`public/brand/launch/vallo-mark-draw.svg`, which also answers the
 * system's reduced motion itself); Calm and Off in the in-app Motion setting
 * show the still mark in its place (`launch.css`). Server-safe markup, no
 * script. Decorative: the page names itself in words.
 */
export function MarkDraw({ size, className }: { size?: number; className?: string }) {
  /* Without a size the caller's class sets the width (the sign-in ring). */
  const width = size ?? 56;
  const height = Math.round((width * 664) / 776);
  return (
    <span
      className={["nf-mark-draw", className ?? ""].filter(Boolean).join(" ")}
      style={size ? { inlineSize: size } : undefined}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- an animated SVG must stay an SVG, never a re-encoded bitmap */}
      <img className="nf-mark-draw__live" src="/brand/launch/vallo-mark-draw.svg" alt="" width={width} height={height} decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element -- the exact brand mark, still */}
      <img className="nf-mark-draw__still" src="/brand/vallo-mark.svg" alt="" width={width} height={height} decoding="async" loading="lazy" />
    </span>
  );
}
