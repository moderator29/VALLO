"use client";

import type { ButtonHTMLAttributes } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useBack, useBackDestination } from "@/lib/nav/use-back";
import { backToLabel } from "@/lib/nav/route-labels";
import { useClientCopy } from "@/lib/i18n/client-copy";

/**
 * THE BACK CONTROL. One object, on every screen that has a way back.
 *
 * Founder, 29 September 2026: "all back buttons should all be on professional
 * level". Before this there were eleven hand-drawn back arrows at four glyph
 * sizes (12, 16, 20, 24), three target sizes (40, 44 and a 36 faked up to 44),
 * with "Back" as the only name and two of them calling history directly. Now:
 *
 *   - ALWAYS 44 BY 44, drawn rather than implied (no `nf-tap` pseudo target:
 *     that class is unlayered and its `position: relative` beat the fixed
 *     floating back), with the arrow at 20 (the
 *     `ICON.inline` step, 2.25px rendered stroke per docs/ICON_SYSTEM.md).
 *   - ONE BEHAVIOUR. Without `onBack` it runs `useBack`, so the destination is
 *     `chooseBack`'s (the screen you came from when that is safe, else the
 *     declared parent; `docs/BACK_NAVIGATION.md`). With `onBack` it is a step
 *     back inside one screen (a wizard, a sign-up step) and the caller owns it.
 *   - A NAME THAT SAYS WHERE. "Back to Messages" for an English reader, read
 *     off the destination; the translated `common.back` in every other locale.
 *   - A NATIVE BUTTON, so Enter and Space work, the focus ring is the
 *     platform's, and `data-nav-back` is the one handle the browser walks
 *     (`tests/back-destinations.spec.mjs`) uses.
 *
 * `surface` picks the material for where it sits, never the size or the glyph:
 *
 *   bare    no plate: bars that paint their own control (auth, the slate).
 *   round   the 44px white circle on a soft shadow (a raised night surface
 *           in dark): founder references 44 and 45, CLEAN_UNIFIED_DIRECTION
 *           section 17. `PageHeader`, the workspace and console bars,
 *           settings, support, the thread and the assistant.
 *   plate   the old base square; renders `round` now.
 *   glass   the old glass square; renders `round` now.
 *   media   over a photograph: the listing gallery, a profile cover, a story.
 *   pill    `media` with the word on it: the profile banner.
 */
export type BackSurface = "bare" | "round" | "plate" | "glass" | "media" | "pill";

const ROUND = "nf-icon-btn nf-icon-btn--round";

const SURFACE: Record<BackSurface, string> = {
  bare: "rounded-[var(--nf-radius-control)] text-[var(--nf-content-primary)] transition-colors hover:text-[var(--nf-brand-secondary)]",
  round: ROUND,
  plate: ROUND,
  glass: ROUND,
  media: "nf-social-round nf-btn--glass",
  pill: "nf-social-round nf-social-round--pill nf-btn--glass",
};

type Passthrough = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children" | "type" | "aria-label"> & {
  [data: `data-${string}`]: string | undefined;
};

export function BackControl({
  fallback = "/home",
  onBack,
  label,
  surface = "bare",
  className,
  ...rest
}: {
  /** Only for a route with no declared parent. See `useBack`. */
  fallback?: string;
  /** A step back inside the screen. Omit for a real back navigation. */
  onBack?: () => void;
  /** An explicit accessible name. Omit to get "Back to <destination>". */
  label?: string;
  surface?: BackSurface;
  /**
   * Paint for a specific bar (the auth slate, the workspace island, the
   * inspection plate). On the `bare` surface it REPLACES the default ink,
   * because a utility colour would beat the bar's component class. Never a
   * size: the control is 44 by 44 whatever this says.
   */
  className?: string;
} & Passthrough) {
  const t = useClientCopy();
  const back = useBack(fallback);
  const destination = useBackDestination(fallback);

  /* The reader's dictionary arrives from the server, so it is the one locale
     signal that is identical in the server render and the first client
     render. The cookie hook answers English on the server whatever the
     reader chose, which would have painted "Back to Search" for a Yoruba
     reader until hydration. */
  const english = t.common.back === "Back";
  const named = english && !onBack ? backToLabel(destination) : null;
  /* On the pill the word is drawn and `label` is that word; the announced
     name still says where ("Back to Around" contains the visible "Back"). */
  const word = surface === "pill" ? (label ?? t.common.back) : null;
  const accessibleName = (word ? null : label) ?? named ?? label ?? t.common.back;

  return (
    <button
      type="button"
      onClick={onBack ?? back}
      aria-label={accessibleName}
      title={accessibleName}
      data-nav-back=""
      data-back-destination={onBack ? undefined : destination}
      className={`inline-grid min-h-11 min-w-11 shrink-0 place-items-center ${
        surface === "pill" ? "" : "h-11 w-11"
      } ${surface === "bare" && className ? "" : SURFACE[surface]} ${className ?? ""}`}
      {...rest}
    >
      <UiIcon name="arrow-left" size={20} />
      {word ? <span aria-hidden="true">{word}</span> : null}
    </button>
  );
}
