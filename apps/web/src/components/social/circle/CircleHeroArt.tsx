/**
 * THE CIRCLE HERO'S OWN ARTWORK. Drawn here, in SVG and tokens, not a photo:
 * three open rings that share one point (a circle of people, each ring a
 * community) with small dots riding them, and one warm dot at the shared
 * point. The rings turn very slowly; with reduced motion they hold still.
 * Decorative: hidden from assistive technology.
 */
export function CircleHeroArt() {
  return (
    <svg className="nf-cbn__svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="nf-cbn-glow" cx="68%" cy="38%" r="70%">
          <stop offset="0%" stopColor="var(--nf-brand-primary)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--nf-brand-primary)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#nf-cbn-glow)" />
      <g className="nf-cbn__rings" transform="translate(272 112)" fill="none" stroke="var(--nf-content-on-brand)" strokeLinecap="round">
        <circle className="nf-cbn__ring nf-cbn__ring--a" r="92" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="2 9" />
        <circle className="nf-cbn__ring nf-cbn__ring--b" r="64" strokeWidth="2" strokeOpacity="0.7" strokeDasharray="70 30" />
        <circle className="nf-cbn__ring nf-cbn__ring--c" r="38" strokeWidth="2.5" strokeOpacity="0.9" strokeDasharray="30 18" />
        <circle r="9" fill="var(--nf-brand-accent, var(--nf-content-on-brand))" stroke="none" />
        <circle cx="92" cy="0" r="5" fill="var(--nf-content-on-brand)" stroke="none" fillOpacity="0.9" />
        <circle cx="-45" cy="-45" r="4" fill="var(--nf-content-on-brand)" stroke="none" fillOpacity="0.8" />
        <circle cx="-19" cy="33" r="3.5" fill="var(--nf-content-on-brand)" stroke="none" fillOpacity="0.8" />
      </g>
    </svg>
  );
}
