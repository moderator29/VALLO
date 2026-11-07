"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { icon3dSrc, type Icon3DName } from "./icon-3d";
import { ICON3D_GLYPH, glyphMasterSrc } from "@/design-system/icons/glyphs";

/**
 * THE FOUNDER'S 3D ICONS (30 September): soft clay objects in royal blue with
 * one orange accent, sliced from his transparent sheet by
 * `scripts/brand-3d.mjs` into `public/brand/3d/` (real alpha, so they sit on
 * the warm paper as well as on the night glass).
 *
 *   stays    hotel, shortlet, restaurant, local-talks
 *   actions  buy, rent, pay, list
 *   sheet 2  bell, assistant, calendar-booked, calendar-pending, shield,
 *            search, explore, verified, id-check, card-secure,
 *            home-verified, home-small, villa, city, apartment, land,
 *            stay-rated, earnings, coin, handover, keys
 *   sheet 5  camera, video, checklist, contract, receipt, boxes, toolbox,
 *            price-tag, analytics, bank, megaphone, support, team, folder,
 *            clock, report-flag, saved-heart, envelope, phone-code,
 *            passcode-lock, gift, map, power, celebrate
 *   (the first eight come from icon-sheet-4 since 30 September)
 *
 * Where they go: doors, heroes, empty states, category pickers and first-run
 * cards (one object per card, 40 to 96 px). Rows, controls and nav chrome
 * stay UiIcon.
 *
 * Pictures, not glyphs: `UiIcon` stays the icon system for rows, chrome and
 * controls. Use these where a door or a category wants an object (the Home
 * quick actions, the Stays doors). The image is decorative by default
 * (`alt=""`), because a label always sits beside it; pass `label` only when
 * it stands alone.
 */
export { ICON_3D_NAMES, icon3dEmailSrc, icon3dSrc, type Icon3DName } from "./icon-3d";

/**
 * THE STICKER THAT STANDS IN WHEN THE PICTURE DOES NOT ARRIVE. On weak data a
 * door's art can fail or stall, and the browser then draws its broken-image
 * glyph (the founder's 27 October screenshot of the home page). The picture
 * is replaced by a brand-blue plate with the line glyph for the same idea,
 * drawn from the icon font of the product itself, so it needs no request.
 */
const FALLBACK_GLYPH: Partial<Record<Icon3DName, UiIconName>> = {
  hotel: "building-hotel",
  shortlet: "house",
  restaurant: "utensils",
  "local-talks": "chat-bubble",
  buy: "house",
  rent: "key",
  pay: "wallet",
  list: "clipboard-list",
  bell: "bell",
  assistant: "bot",
  "calendar-booked": "calendar-check",
  "calendar-pending": "calendar-clock",
  shield: "shield-check",
  search: "search",
  explore: "compass",
  verified: "verified",
  "id-check": "id-card",
  "card-secure": "credit-card",
  "home-verified": "house-heart",
  "home-small": "house",
  villa: "house-terrace",
  city: "building-apartment",
  apartment: "building-apartment",
  land: "land-plot",
  "stay-rated": "star",
  earnings: "trending-up",
  coin: "coins",
  handover: "key",
  keys: "key",
  camera: "camera",
  video: "video",
  checklist: "clipboard-list",
  contract: "file-text",
  receipt: "receipt",
  "price-tag": "price-tag",
  analytics: "chart-bar",
  bank: "bank",
  support: "headset",
  team: "users",
  clock: "clock",
  "report-flag": "flag",
  "saved-heart": "heart",
  envelope: "mail",
  "phone-code": "phone",
  "passcode-lock": "lock",
  gift: "gift",
  map: "map",
  celebrate: "star",
};

export function Icon3D({
  name,
  size = 48,
  label,
  className,
  priority,
  classic = false,
}: {
  name: Icon3DName;
  /** Keep the older 3D sticker instead of the founder's glyph set (landing, category tiles). */
  classic?: boolean;
  /** The drawn size in CSS pixels (square). */
  size?: number;
  /** An accessible name, only when no visible label sits beside it. */
  label?: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement | null>(null);
  /* A picture that failed before this component hydrated never fires
     `onError` here, so read its state once on mount. */
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  const classes = ["nf-icon3d", className ?? ""].filter(Boolean).join(" ");
  /* The founder's glyph set (1 November 2026) where it has this object. */
  const glyph = classic ? undefined : ICON3D_GLYPH[name];
  const sized = { "--nf-icon3d-default": `${size}px` } as CSSProperties;
  const sticker = failed ? (
    <span
      className={`${classes} nf-icon3d--fallback`}
      style={sized}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="icon3d-fallback"
    >
      <UiIcon name={FALLBACK_GLYPH[name] ?? "grid"} size={24} />
    </span>
  ) : null;
  return (
    <>
      {sticker}
      <Image
        ref={ref}
        onError={() => setFailed(true)}
        src={glyph ? glyphMasterSrc(glyph) : icon3dSrc(name)}
        alt={label ?? ""}
        aria-hidden={label ? undefined : true}
        width={256}
        height={256}
        sizes={`${size}px`}
        /* The drawn size is a custom property, so a host can resize it in CSS
           (`.nf-icon3d` in app/css/brand-glass.css). */
        style={failed ? { ...sized, display: "none" } : sized}
        className={classes}
        draggable={false}
        {...(priority ? { priority: true } : {})}
      />
    </>
  );
}
