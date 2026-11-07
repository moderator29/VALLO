"use client";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { adjustInterest } from "@/lib/interests/actions";
import type { IntentDirection, PropertyType } from "@/lib/interests/model";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * "More like this" / "Not for me", on the card itself.
 *
 * WHY IT IS HERE AND NOT ONLY IN SETTINGS.
 *
 * `/settings/interests` already asks the same question, and it is a backstop: a
 * screen somebody has to go looking for. Every product of this shape gets its
 * real signal from a control that is in front of a person at the moment they
 * have an opinion, and the whole cost of that opinion is one tap on the card
 * they are already looking at. So this writes THE SAME stored answer that
 * screen writes - `profiles.interests`, a `property_type[]` - through
 * `adjustInterest`. One signal, one vocabulary, no shadow table.
 *
 * SIGNED OUT, IT IS NOT RENDERED. The search page decides that, because only
 * the server knows. There is no anonymous store for this and inventing one
 * (a cookie, localStorage) would create a second answer that has to be merged
 * with the real one at sign-in by a rule nobody has written. A control that
 * appears and then says "sign in to continue" is worse than no control: it
 * spends somebody's tap to tell them they wasted it.
 *
 * DISCOVERABILITY. A small square control on the card, visible at rest rather
 * than on hover, because a phone has no hover and a long-press is not an
 * affordance anybody can see. It paints at 32px and reaches the 44pt floor
 * through an `::after` that overflows its box - never a child span, which
 * `icons-and-targets.spec` cannot measure and which therefore reports as a
 * failure even when the target is genuinely met. See the note in `Switch.tsx`.
 *
 * WHY A SHEET RATHER THAN TWO BUTTONS ON THE CARD. Two visible verbs on every
 * card in a scrolling grid is twenty visible verbs, and it turns a results page
 * into a survey. The sheet also has room to say what the control actually does,
 * which matters: somebody who thinks "Not for me" hides the listing will be
 * angry when it is still there. `Sheet` renders nothing at all until it opens,
 * so a grid of twenty cards carries twenty buttons and zero dialogs.
 *
 * HONEST FEEDBACK, WHICH IS THE POINT.
 *
 * The optimistic state flips the moment the tap lands and REVERTS if the write
 * fails, and the failure shows the action's own message rather than a shrug.
 * The confirmation names the market and what happened to it, and the two
 * "already" lines exist because the write is idempotent: "More like this" on a
 * market already stored changes nothing, and the screen says so. A toast
 * reading "Saved" over a write that never happened is the exact dishonesty this
 * component is built to avoid, and the server is what decides which line is
 * true - `changed` comes back from the action, not from a guess made here.
 */
export function IntentTune({
  type,
  t,
  /** The caller's whole stored answer, so the sheet can open on the truth. */
  interests,
}: {
  type: PropertyType;
  /* Threaded from the server component that resolved the locale. There is no
     locale context on this platform, and every word below is read by somebody
     who may have chosen Hausa. */
  t: Dictionary;
  interests: readonly PropertyType[];
}) {
  const copy = t.interests.tune;
  const market = t.interests.markets[type];

  const [open, setOpen] = useState(false);
  /* The optimistic answer to "is this market ranked ahead". Seeded from the
     server's read and moved by a tap before the round trip returns. */
  const [ranked, setRanked] = useState(() => interests.includes(type));
  const [pending, startTransition] = useSafeTransition();

  const say = (line: string) => line.replace("{market}", market);
  /* One line, naming the market and what actually happened to it, said by the
     one banner at the top of the screen (Grade 1), which sits above this
     sheet. The tone as an option: the card's dictionary slice test counts any
     `.success` read. */
  const tell = (line: string) => banner(line, { tone: "success", "data-testid": "intent-tune-note" });

  const choose = (direction: IntentDirection) => {
    const wants = direction === "more";
    const before = ranked;
    /*
     * What we BELIEVE happened, said immediately. The server is the authority
     * on whether anything moved - two tabs, or a settings screen open on
     * another device, can both make this belief wrong - so the line is written
     * again from the real result below.
     */
    setRanked(wants);
    tell(
      before === wants
        ? say(wants ? copy.alreadyUp : copy.alreadyBack)
        : say(wants ? copy.movedUp : copy.steppedBack),
    );

    startTransition(async () => {
      try {
        const result = await adjustInterest({ type, direction });
        if (!result.ok) {
          // Nothing was written, so the screen goes back to what is true.
          setRanked(before);
          banner.error(result.error, { retry: () => choose(direction), "data-testid": "intent-tune-error" });
          return;
        }
        setRanked(result.data.interests.includes(type));
        tell(
          result.data.changed
            ? say(wants ? copy.movedUp : copy.steppedBack)
            : say(wants ? copy.alreadyUp : copy.alreadyBack),
        );
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <>
      <button
        type="button"
        data-testid={`intent-tune-${type}`}
        aria-label={copy.open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        /*
         * `nf-tap` is the 44pt floor, and it is the platform's own rule rather
         * than a local one: an `::after` centred on the control at
         * `max(100%, 44px)` in each axis. The button still paints at 32 so it
         * does not swallow the photograph. It has to be a pseudo element and
         * not a child span - both reach the same hit area, but
         * `icons-and-targets.spec` measures the box plus `::before`/`::after`
         * and nothing else, so a span reports 32x32 and fails a floor it is
         * actually meeting. The same reasoning is written out in `Switch.tsx`.
         */
        /*
         * THE SAME MATERIAL AS THE HEART BESIDE IT.
         *
         * This was `bg-[var(--nf-overlay-media)]` with `--nf-content-on-media`
         * ink, which is the theme-independent dark-glass treatment, and it was
         * correct while the control floated on a photograph. The card no longer
         * has one: the media is an information band drawn in the surface
         * family, and on the light theme a permanent dark disc sat beside a
         * pale one on the same corner of the same card. `nf-icon-btn` is the
         * platform's round control, it follows the theme, and it guarantees the
         * 44px target through an overflowing pseudo-element, so the drawn 36px
         * matches the save control exactly (both draw 28px since the founder
         * found them too big on the card, 7 October; the target stays 44).
         */
        className="nf-icon-btn h-7 w-7"
      >
        <UiIcon name="sliders" size={16} />
      </button>

      <Sheet open={open} onOpenChange={setOpen} title={copy.title} detents={[0.5]}>
        <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
          {market}
        </p>
        {/* The standing, before anything is tapped, so the two buttons are a
            choice about a known state rather than a guess. */}
        <p className="mt-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
          {say(ranked ? copy.standingOn : copy.standingOff)}
        </p>

        <div className="mt-md flex flex-col gap-xs">
          <Button
            type="button"
            variant="primary"
            full
            leadingIcon="heart"
            disabled={pending}
            data-testid="intent-tune-more"
            onClick={() => choose("more")}
          >
            {copy.more}
          </Button>
          <Button
            type="button"
            variant="secondary"
            full
            disabled={pending}
            data-testid="intent-tune-less"
            onClick={() => choose("less")}
          >
            {copy.less}
          </Button>
        </div>

        {/* Says what the control does, and what it does NOT do. Somebody who
            reads "Not for me" as "hide this" has to be corrected here, before
            they tap it, not after they wonder why the card is still there. */}
        <p className="mt-md text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
          {copy.explain}
        </p>

        <Button
          type="button"
          variant="ghost"
          full
          className="mt-md"
          onClick={() => setOpen(false)}
        >
          {copy.close}
        </Button>
      </Sheet>
    </>
  );
}
