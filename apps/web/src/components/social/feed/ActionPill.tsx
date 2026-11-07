"use client";

import { useState } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";

/**
 * ONE BARE GLYPH (D79, the founder on 7 October: "the wrapper you put on all
 * the icons, remove it"). A thin outline glyph at 20px and a tabular count
 * beside it, no capsule, no disc; the 44px target is the button's own box
 * (`GOVERNING-feed-plus-bloom` draws the row exactly so). The name is kept
 * so the thread, comments and stories did not have to change. The same
 * control serves the post card, the thread, a comment and a story, so the
 * like you press in one place is the like you press everywhere.
 *
 * `round` is a glyph with no count: the send and the save at the end of the row.
 *
 * THE PAYOFF. `payoff` marks a toggle whose turning ON is a moment (the
 * like): the capsule pops 1.0, 1.04, 1.0 over 180ms (A.5) and the glyph
 * fills. It plays only on the tap that turns it on, never for a mark that was
 * already on when the card loaded, and never under reduced motion, Calm or
 * Off (`feed-m.css` holds the settled frame).
 */
export function ActionPill({
  icon,
  label,
  count,
  pressed,
  payoff = false,
  round = false,
  tone,
  className,
  onClick,
  "data-testid": testId,
}: {
  icon: UiIconName;
  /** What a screen reader hears. Says the state and the verb. */
  label: string;
  /** Already formatted for the reader's locale. Absent draws no number. */
  count?: string;
  /** Present for a toggle (like, repost, save); absent for an action. */
  pressed?: boolean;
  payoff?: boolean;
  round?: boolean;
  /** `like` and `repost` keep their own lit colour when pressed. */
  tone?: "like" | "repost" | "save" | "reply" | "share";
  className?: string;
  onClick: () => void;
  "data-testid"?: string;
}) {
  const [popped, setPopped] = useState(false);
  /* Set by the first tap and never by a render: a count that changes because
     of this person's own tap rolls into place (feed-m.css), and a count that
     arrives with the page, or changes on a refresh, simply is. */
  const [touched, setTouched] = useState(false);
  const filled = Boolean(pressed) && (icon === "heart" || icon === "bookmark");
  return (
    <button
      type="button"
      className={[
        "nf-act-pill",
        round ? "nf-act-pill--round" : "",
        tone ? `nf-act-pill--${tone}` : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={pressed}
      aria-label={label}
      data-pop={payoff && popped && pressed ? "" : undefined}
      data-testid={testId}
      onClick={() => {
        if (payoff && !pressed) setPopped(true);
        setTouched(true);
        onClick();
      }}
    >
      <UiIcon name={icon} size={20} filled={filled} className="nf-act-pill__glyph" />
      {count !== undefined && !round ? (
        /* Keyed on the figure, so a new figure is a new element and the roll
           plays once for it; `data-roll` only after this person tapped. */
        <span key={count} className="nf-act-pill__count nf-numeric" aria-hidden="true" data-roll={touched ? "" : undefined}>
          {count}
        </span>
      ) : null}
    </button>
  );
}
