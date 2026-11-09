import { initial } from "@/lib/text/initial";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { TierBadge } from "@/components/trust/TierBadge";
import { type BadgeTier } from "@/lib/trust/badge-tier";

/**
 * A person's avatar in messaging, with the verified mark on it.
 *
 * The badge overlaps the bottom right of the circle, which is where every
 * platform that has one puts it, and it is drawn with a ring in the surface
 * colour so it reads as sitting ON the avatar rather than beside it.
 *
 * ---------------------------------------------------------------------------
 * IT IS A FACT, NOT A DECORATION, AND THE TYPE ENFORCES THAT.
 *
 * `tier` is required and has no default. A call site that has not resolved the
 * counterpart's real badge cannot render this component at all - it will not
 * compile - and that is the whole reason the prop is not optional. A verified
 * tick that appears because somebody forgot to pass a prop is worse than no
 * tick anywhere: it is the one mark on the platform that a person is going to
 * weigh before sending money to a stranger.
 *
 * WHERE THE TRUTH COMES FROM. `agent_badges.verified`, now read through
 * `public.person_badge.tier`, resolved in `lib/messages/live.ts` and carried
 * through as `counterpartTier`. That is the one published derivation of the
 * badge: `private.sync_agent_badge` writes `verified` as
 * `agents.verification_tier >= 1`, the tier is computed by `private.agent_tier`
 * from the rungs in `agent_verification_checks`, each one a named member of
 * staff's recorded decision, and `public.badge_tier` turns that plus
 * `public.is_platform_staff` into which mark to draw. So the mark means one
 * thing only: a person here looked at a government document and said yes, or
 * this person is Vallo. It is the same chain every listing surface reads, which
 * is the point: one badge, one derivation, no screen disagreeing with another.
 *
 * IT IS KEYED BY THE PERSON, NOT BY THE AGENT, and that is not a detail.
 * `agent_badges` is keyed by agent, so a member of staff in a thread resolved
 * to nothing at all: the founder's own account, in his own messages, with no
 * mark. `public.person_badge` answers for anybody.
 *
 * IT USED TO READ `agents.verified`, and that was the fault this docstring was
 * wrong about. That column was hand-set to true at the moment an agent
 * application was approved, at tier 0, so this component drew a tick for
 * somebody nobody had checked while their own listings correctly drew none.
 * The column is now derived from the tier and constrained to it, and nothing
 * on this path reads it any more.
 *
 * Not from "is this person an agent", which is a different and much weaker
 * fact: an unapproved agent has a row in that table too. Not from the
 * LISTING's verified flag either, which is about the property.
 *
 * IT CANNOT APPEAR ON SEED CONTENT. The seed message repository has no agents
 * table behind it, so nothing there resolves an identity and `counterpartName`
 * falls back with the tier at `none`. Demo content therefore carries no mark,
 * which is correct: the badge means a person was checked, and nobody checked a
 * fixture.
 *
 * A server component wherever it is allowed to be. It renders in the client
 * inbox too, which is fine - it holds no state and no effects.
 */

export type AvatarSize = "sm" | "md" | "lg";

const SHELL: Record<AvatarSize, string> = {
  sm: "h-9 w-9 text-[length:var(--nf-text-body-sm)]",
  md: "h-11 w-11 text-[length:var(--nf-text-body)]",
  lg: "h-12 w-12 text-[length:var(--nf-text-body-lg)]",
};

/**
 * THE WRAPPER NOW STATES ITS OWN BOX, AND THAT IS TWO VISIBLE FAULTS CLOSED.
 *
 * The wrapper used to carry no size and be left to take its shell's. It did
 * not. Measured on the live inbox at 390 dark, the wrapper came back 32x44
 * around a 44x44 shell: its intrinsic width collapsed to 32px and the avatar
 * simply overflowed it. Both things hanging off that box then went wrong.
 *
 * THE RING WENT OVAL AGAIN. `.nf-inbox-row__ring` is a grid sized by this
 * element, so a 32x44 item made a 38x50 ring, and a 50 per cent radius on a
 * box half again as tall as it is wide draws an ELLIPSE. There is already a
 * note in `threads.css` about this ring having been an oval on every row it
 * ever drew, fixed there with `align-self: center` and `aspect-ratio: 1`.
 * That fix was right about the stretch and could not reach this, because the
 * width was never coming from the row: four ovals down the inbox and three
 * more on the share picker, in the shots.
 *
 * THE VERIFIED MARK LANDED IN THE MIDDLE OF THE FACE. The badge is positioned
 * `-bottom-0.5 -right-0.5` against this box, so a box 12px narrower than the
 * avatar put the one mark that says a human was checked at roughly seven
 * o'clock ON the photograph instead of on its bottom-right corner. Both
 * governing thread references draw their avatars as clean circles with the
 * corner mark clear of the face.
 *
 * Stating the box here rather than patching the ring fixes it once for every
 * call site, including the thread header's own ring, and keeps the badge's
 * anchor and the shell the same square by construction.
 *
 * IT IS STATED IN PIXELS FROM `PIXELS`, NOT IN A SPACING UTILITY, and that is
 * the second half of the finding. Adding `h-11 w-11` to this span first, the
 * same pair the shell already wears, did NOT fix it: measured again on the
 * live share picker, the shell resolved `w-11` to 44px and this span resolved
 * the identical class on the identical inherited `--spacing` of `.25rem` to
 * 32px, so the wrapper stayed 32x44 and the ring stayed an oval. Whatever is
 * eating the utility on this one box, a definite length is not eatable: with
 * an explicit width the wrapper measures 44 and the ring measures 50x50, a
 * true circle. `PIXELS` is already the file's single source for these three
 * sizes and is already trusted for the image's `width`/`height`, so the box
 * and the fetched candidate cannot drift apart.
 */

/*
 * The mark scales with the avatar. It went UP when the plate came off: the seal
 * used to sit inside an 18px filled disc at 12px of glyph, and with nothing
 * behind it the silhouette itself has to carry the size. Sixteen is the floor
 * at which the eight lobes are still countable and the tick still reads.
 *
 * `BADGE`, the class map for that disc, and `VERIFIED_LABEL`, the string it
 * labelled, are both gone with it. The label now comes from
 * `BADGE_TIER_MEANING` inside the one renderer, so a tier cannot be announced
 * one way here and another way on a listing.
 */
const GLYPH: Record<AvatarSize, number> = { sm: 16, md: 18, lg: 20 };

/**
 * The same three sizes as `SHELL`, as numbers.
 *
 * `SHELL` states them in Tailwind's scale because that is what the class
 * attribute needs; `sizes` on the image needs the pixel count. Both are
 * derived from one row here so the two cannot drift: an avatar whose `sizes`
 * disagrees with its box fetches the wrong candidate, which is the one bug
 * this whole sweep exists to remove.
 */
const PIXELS: Record<AvatarSize, number> = { sm: 36, md: 44, lg: 48 };

function initialOf(name: string): string {
  const trimmed = name.trim();
  return initial(trimmed);
}

export function VerifiedAvatar({
  name,
  tier,
  photoUrl,
  size = "md",
  /**
   * What this person is, when there is no badge to show.
   *
   * The bottom-right corner of an avatar is one slot and it may carry ONE
   * meaning at a time. When somebody is verified, that is the meaning. When
   * they are not, the corner falls back to saying whether they are a host or
   * another member, which is the next most useful thing about the person whose
   * message you are reading. Two marks stacked in one corner is how a badge
   * stops being read at all.
   */
  kind,
  className,
}: {
  name: string;
  /**
   * THE PUBLISHED BADGE, AND THE ONLY INPUT THIS COMPONENT HAS FOR THE MARK.
   * `public.person_badge.tier`. Required, with no default, for the reason the
   * docstring above gives: a call site that has not resolved the counterpart's
   * real badge cannot render this component at all, it will not compile, and a
   * mark that appears because somebody forgot a prop is the one thing worse
   * than no mark anywhere.
   *
   * IT TOOK A BOOLEAN AS WELL FOR ABOUT AN HOUR, AND THE GUARD CAUGHT THAT.
   * While `ThreadView.tsx` carried another worker's uncommitted edit, this
   * component kept a `verified` prop and mapped a true onto gold so that file
   * could keep compiling. However small, that mapping is a rule about which
   * mark to draw living somewhere other than the derivation, and
   * `agent-badge-derivation.test.ts` flagged it by shape on the guard's very
   * first run. It is gone rather than excused: the moment that file was free,
   * the prop went with it.
   */
  tier: BadgeTier;
  photoUrl?: string;
  size?: AvatarSize;
  kind?: "agent" | "member";
  className?: string;
}) {
  return (
    <span
      className={`relative inline-block shrink-0 ${className ?? ""}`}
      style={{ width: PIXELS[size], height: PIXELS[size] }}
    >
      <span
        aria-hidden="true"
        className={`flex items-center justify-center overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--nf-brand-primary)_22%,transparent)] font-bold text-[var(--nf-content-primary)] ${SHELL[size]}`}
      >
        {photoUrl ? (
          /* 36, 44 or 48px, and the CSS above already crops it to the circle.
             The source is a full size upload, so the size it is fetched at is
             the whole saving: a thread of twenty messages was twenty full
             resolution photographs. */
          <RemoteImage
            src={photoUrl}
            alt=""
            width={PIXELS[size]}
            height={PIXELS[size]}
            sizes={`${PIXELS[size]}px`}
            className="h-full w-full object-cover"
          />
        ) : (
          initialOf(name)
        )}
      </span>

      {tier !== "none" ? (
        /*
          NO BACKGROUND BEHIND THE MARK, on the founder's instruction of 23
          September: no disc, no ring, no plate, no halo. It used to sit on a
          filled circle with a two pixel ring in the surface colour, which is
          what made it read as a chip rather than as the mark itself. The seal
          is its own silhouette and it carries its own contrast, so it needs
          nothing behind it, and a mark with nothing behind it cannot bring a
          background onto a surface the background was never designed for.

          Labelled, not aria-hidden. This is the one mark in a conversation
          carrying information a screen reader user needs as much as anybody:
          it is the difference between a stranger and a stranger the platform
          has checked.
        */
        <TierBadge tier={tier} size={GLYPH[size]} className="absolute -bottom-0.5 -right-0.5" />
      ) : (
        kind && (
          /* The fallback meaning. A dot, deliberately not a green "online"
             light: nothing maintains presence here and a light nobody is
             maintaining is a lie. */
          <span
            aria-hidden="true"
            className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[var(--nf-surface-primary)] ${
              kind === "agent"
                ? "bg-[var(--nf-brand-primary)]"
                : "bg-[var(--nf-content-muted)]"
            } ${size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"}`}
          />
        )
      )}
    </span>
  );
}

