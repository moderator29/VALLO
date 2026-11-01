import type { Dictionary } from "@vallo/i18n/core";
import { MotionReveal } from "@/components/motion/Reveal";
import { HeroBand } from "@/components/ui/HeroBand";
import { Icon3D } from "@/components/ui/Icon3D";
import { storeBadges } from "./store-badges";
import { StoreBadges } from "./StoreBadges";
import { APP_OBJECTS, LANDING_OBJECT_SIZE } from "./landing-objects";

/**
 * Take Vallo with you: one branded panel, no device frame (the founder's
 * ruling of 29 September removed the drawn phones).
 *
 * The panel is the shared `HeroBand` (navy on paper, a raised night surface
 * at night), so it reads as the brand speaking rather than one more card.
 * On it: the app promise, the store badges or the install line, and three
 * short points on what the phone gives you, divided by hairlines.
 *
 * STORE-06 (also UI-07, UX-26), revised 30 September: the apps launch this
 * week, so the "Add it to your home screen" instructions are gone and the two
 * official badges always show (`store-badges.ts`):
 *
 *   - a badge is a link ONLY when its store URL is set and is that store's
 *     own address (NEXT_PUBLIC_APP_STORE_URL, NEXT_PUBLIC_PLAY_STORE_URL);
 *   - until then it shows "Coming soon" beneath it and is not a link;
 *   - neither renders inside a native shell, whatever is set (`LandingBody`
 *     passes the surface the server read from the shell's User-Agent, and
 *     leaves this band out entirely there).
 */
export function AppBand({
  t,
  native = false,
}: {
  t: Dictionary;
  /** True when the server is rendering for a native shell. */
  native?: boolean;
}) {
  const a = t.landing.face.app;
  const points: { key: keyof typeof APP_OBJECTS; label: string }[] = [
    { key: "notify", label: a.points.notify },
    { key: "sides", label: a.points.sides },
    { key: "record", label: a.points.record },
  ];
  /* `NEXT_PUBLIC_*` is inlined at build time. */
  const badges = storeBadges({
    appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL,
    playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL,
    native,
  });
  return (
    <section className="nf-shell nf-room" data-chapter="app" aria-labelledby="nf-landing-app-title">
      <MotionReveal>
        {/* THE NAVY HERO BAND (spec section 16, Q2 as the founder widened
            it): the light theme's one signature block, flat, no glass, the
            same band Home and the desks open on. One panel, two columns, no
            card inside it (UIUX item 11). */}
        <HeroBand
          as="div"
          className="nf-app-band"
          label={a.eyebrow}
          title={<span id="nf-landing-app-title">{a.title}</span>}
          sub={a.body}
        >
          <div className="nf-app-band__cols">
            <div className="nf-app-band__store">
              {/* The official artwork, drawn inline (StoreBadges.tsx). */}
              <StoreBadges badges={badges} labels={t.landingRooms.badges} className="nf-app-panel__badges" />
            </div>
            <div className="nf-app-band__aside">
              <p className="nf-section-label">{a.rightTitle}</p>
              <ul className="nf-app-band__points">
                {points.map((p) => (
                  <li key={p.key}>
                    <span className="nf-obj nf-app-band__obj">
                      <Icon3D classic name={APP_OBJECTS[p.key]} size={LANDING_OBJECT_SIZE.app} />
                    </span>
                    {p.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </HeroBand>
      </MotionReveal>
    </section>
  );
}
