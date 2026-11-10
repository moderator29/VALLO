"use client";

import { useState, type ReactNode, type SyntheticEvent } from "react";
import { useHydrated } from "@/components/motion/useInView";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";

/**
 * A REAL SCREEN OF THE PRODUCT, OR NOTHING (DOCS_AND_PRESENCE_UPGRADE.md
 * section 5; R85). The guides embed shots the capture harness writes to
 * `/help/shots/<id>.webp`, dark and light. Until the founder runs the capture
 * those files do not exist, and a guide must never show a broken image, so
 * the figure removes itself (or draws `fallback`) the moment its image fails.
 *
 * Both themes: the dark shot and the light shot are both in the markup and
 * the theme on the root decides which one shows, so a reader on light is
 * never handed a dark screen. The hidden one is lazy and never fetched.
 */
export function GuideShot({
  dark,
  light,
  alt,
  variant = "phone",
  fallback = null,
  className = "",
}: {
  dark: string;
  light: string;
  alt: string;
  /** A phone capture sits narrow and centred; a desktop one fills the card. */
  variant?: "phone" | "wide";
  /** Drawn instead when the shot has not been captured yet. */
  fallback?: ReactNode;
  className?: string;
}) {
  /*
   * DRAWN AFTER THE PAGE WAKES, NOT IN THE SERVER HTML. The platform's
   * broken-image guard (`components/app/ImageFallbackGuard.tsx`) swaps any
   * image that failed before hydration for a branded tile, which is right for
   * a listing photograph and wrong here: a shot that has not been captured
   * should leave no trace, and an image whose src changed under React fails
   * hydration. Rendered after mount, a missing shot fires its error event in
   * front of React, so the figure removes itself; the guard's swap (it runs
   * first, on the capture phase) is caught too, by its `data-broken` mark.
   */
  const mounted = useHydrated();
  const [missing, setMissing] = useState(false);

  if (!mounted || missing) return <>{fallback}</>;

  const frame =
    variant === "phone"
      ? "mx-auto w-full max-w-[18rem] rounded-[var(--nf-radius-xl)]"
      : "w-full rounded-[var(--nf-radius-lg)]";
  const img = `block h-auto w-full ${frame} border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-raised)]`;
  const check = (event: SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.dataset.broken === "1" || event.currentTarget.naturalWidth === 0) setMissing(true);
  };

  return (
    <figure className={`m-0 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a capture that may not exist yet: next/image would 404 through the optimiser and could not report it */}
      <img
        src={dark}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setMissing(true)}
        onLoad={check}
        className={`${img} [:root[data-theme=light]_&]:hidden`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
      <img
        src={light}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setMissing(true)}
        onLoad={check}
        className={`${img} hidden [:root[data-theme=light]_&]:block`}
      />
    </figure>
  );
}

/**
 * Where a shot will go, until the capture runs: a brand-tinted panel with the
 * subject's glyph on the kit's icon plate, so a card or a step keeps its
 * shape and never shows a broken image.
 */
export function ShotPlaceholder({ icon, ratio = "16/9" }: { icon: UiIconName; ratio?: "16/9" | "3/4" }) {
  return (
    <span
      aria-hidden="true"
      className={`grid w-full place-items-center rounded-[var(--nf-radius-lg)] [background:var(--nf-brand-tint-2)] ${ratio === "3/4" ? "mx-auto aspect-[3/4] max-w-[14rem]" : "aspect-[16/9]"}`}
    >
      <span className="nf-doc-card__icon">
        <UiIcon name={icon} size={22} />
      </span>
    </span>
  );
}
