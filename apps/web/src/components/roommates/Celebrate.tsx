import type { CSSProperties, ReactNode } from "react";

import { Icon3D, type Icon3DName } from "@/components/ui/Icon3D";
import type { ArtSlot } from "@/lib/features/art";

import "./roommates-kit.css";

/**
 * THE PAYOFF SCREEN (the founder's "Post Published!" board, in Vallo's
 * blue): the celebrate object rising on a soft glow, a short burst of
 * confetti in the brand's colours, the title, one line, and the next steps.
 * The burst plays once; reduced motion, Calm and Off show the resting
 * screen with no particles. Server safe.
 */
const PIECES = 18;

export function Celebration({
  title,
  body,
  actions,
  art = "celebrate",
  artSlot,
  testId,
}: {
  title: string;
  body: string;
  actions: ReactNode;
  art?: Icon3DName;
  /** A feature-art cut-out (the house and tick) that drops in, in place of the 3D object. */
  artSlot?: ArtSlot;
  testId?: string;
}) {
  return (
    <section className="nf-rmy" data-testid={testId} aria-labelledby="rmy-title">
      <span className="nf-rmy__burst" aria-hidden="true">
        {Array.from({ length: PIECES }, (_, i) => (
          <span key={i} className="nf-rmy__piece" style={{ "--nf-rmy-i": i, "--nf-rmy-a": `${(360 / PIECES) * i}deg` } as CSSProperties} />
        ))}
      </span>
      <span className="nf-rmy__art" data-image={artSlot ? "" : undefined} aria-hidden="true">
        {artSlot ? (
          // eslint-disable-next-line @next/next/no-img-element -- the payoff cut-out, sized by CSS
          <img src={artSlot.src} alt="" width={176} height={176} decoding="async" />
        ) : (
          <Icon3D name={art} size={120} classic priority />
        )}
      </span>
      <h1 id="rmy-title" className="nf-rmy__title">
        {title}
      </h1>
      <p className="nf-rmy__body">{body}</p>
      <div className="nf-rmy__actions">{actions}</div>
    </section>
  );
}
