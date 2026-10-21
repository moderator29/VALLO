/**
 * The edge lap's ring (`.nf-edge-lap__ring`, site.css): one empty child,
 * rendered last inside a host that carries `.nf-edge-lap`. `EdgeLap` renders
 * it for its own host and `HeroBand lap` for the band; nothing else should
 * need it. Kept apart from `EdgeLap.tsx` so a component can draw the ring
 * without importing the public site's sheet: the page that shows the band
 * imports `site.css` itself (`css-diet.test.ts` holds the list).
 */
export function EdgeLapRing() {
  return <span className="nf-edge-lap__ring" aria-hidden="true" />;
}
