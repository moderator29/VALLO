"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";

/**
 * THE MEDIA PILL (the founder, 9 November 2026, from the pump.fun share
 * surface: "the button with a profile and then the space and the button,
 * exactly like that, I need them in many places"). A capsule control that
 * leads with a round piece of media (a face, a listing photo, or a colour
 * swatch) and carries a short label, with room on the right for a chevron, a
 * value, or a toggle dot.
 *
 * It is the one control that shows WHAT is picked inside the button for picking
 * it: the current background on a share card, the active account, the chosen
 * area, the selected cover. The capsule shape is the founder's call for this
 * family and is listed in the shape guard (PILL_ALLOWED) with that reason, so
 * it does not loosen the rectangle rule anywhere else.
 *
 * `media` is the round leader: an image `src`, a gradient `swatch`, or any
 * node. `trailing` is the right end: a chevron by default when `onClick` is
 * set and nothing else is given, or a value, a toggle, a custom node.
 */
export function MediaPill({
  media,
  label,
  sub,
  trailing,
  trailingIcon,
  onClick,
  pressed,
  tone = "dark",
  className,
  "aria-label": ariaLabel,
}: {
  media: { src: string; alt?: string } | { swatch: string } | ReactNode;
  label: string;
  sub?: string;
  trailing?: ReactNode;
  trailingIcon?: UiIconName;
  onClick?: () => void;
  /** A toggle pill: draws the pressed ring and sets aria-pressed. */
  pressed?: boolean;
  tone?: "dark" | "brand" | "light";
  className?: string;
  "aria-label"?: string;
}) {
  const lead =
    media && typeof media === "object" && "src" in media ? (
      <span className="nf-media-pill__media">
        <Image src={media.src} alt={media.alt ?? ""} fill sizes="40px" />
      </span>
    ) : media && typeof media === "object" && "swatch" in media ? (
      <span className="nf-media-pill__media" style={{ background: media.swatch }} aria-hidden />
    ) : (
      <span className="nf-media-pill__media nf-media-pill__media--node" aria-hidden>
        {media}
      </span>
    );

  const end =
    trailing ??
    (trailingIcon ? <UiIcon name={trailingIcon} size={18} className="nf-media-pill__chev" /> : onClick && pressed === undefined ? <UiIcon name="chevron-right" size={18} className="nf-media-pill__chev" /> : null);

  const body = (
    <>
      {lead}
      <span className="nf-media-pill__text">
        <span className="nf-media-pill__label">{label}</span>
        {sub ? <span className="nf-media-pill__sub">{sub}</span> : null}
      </span>
      {end}
    </>
  );

  const cls = ["nf-media-pill", `nf-media-pill--${tone}`, className].filter(Boolean).join(" ");

  if (!onClick) {
    return (
      <span className={cls} aria-label={ariaLabel}>
        {body}
      </span>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} aria-pressed={pressed} aria-label={ariaLabel}>
      {body}
    </button>
  );
}
