"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { feedback } from "@/lib/ui/feedback";
import { motionQuiet } from "@/lib/motion/gate";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";

/**
 * The segmented control.
 *
 * There were five separate implementations on the platform and none of them did
 * what the reference set does. Three hard-swapped the active state with no
 * transition at all; two slid a 2px underline. Not one had the thing the
 * references actually show: a floating capsule with its own shadow that TRAVELS
 * between segments, so the eye follows the selection instead of losing it.
 *
 * The capsule is a single absolutely-positioned element measured against the
 * real segment boxes, which is what makes it work with labels of different
 * lengths and in four locales where the same word can be three times longer.
 * A ResizeObserver keeps it correct through font loading, orientation changes
 * and container resizes rather than measuring once and drifting.
 *
 * TWO VARIANTS (the clean unified sweep, 29 September 2026;
 * `docs/design/CLEAN_UNIFIED_DIRECTION.md` section 7):
 *
 *   quiet  (default) a raised track with a white thumb on the card shadow
 *          (a raised night surface at night), ink on and muted off at 500.
 *          Filters and views: Property / Stays, Buy / Rent / Stay, list / map.
 *   solid  the brand thumb with a white label, lit at night: the ONE
 *          page-level mode switch (Setup / Configure / Test in an editor).
 *
 * THE THUMB SPRINGS (Session 3; north star motion 6, MOTION_SYSTEM.md
 * "Segmented pill"; reference 7064): `drift` 240ms to the chosen segment, by
 * TRANSFORM ONLY. The thumb takes its new width at once and is drawn where it
 * was, as it was (a translate plus a horizontal scale), then released to its
 * new place on the spring: the browser animates one composited transform
 * rather than relaying the track every frame. It is a pill, the one shape D2
 * reserves for a segmented control. Under reduced motion, Calm and Off it
 * jumps. The content under it crossfades 160ms (`SegmentedPanel`).
 * `shape="pill"` is the old name of `solid` and renders it.
 */

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: UiIconName;
  /** Rendered as a tabular trailing count, the way the reference filter rows do. */
  count?: number;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  /**
   * `tabs` gives a tablist with roving tabindex and arrow-key movement, for
   * switching between views of the same screen. `radio` gives a radiogroup, for
   * choosing a value inside a form. They are genuinely different to a screen
   * reader and the wrong one is worse than none.
   */
  semantics = "tabs",
  size = "md",
  shape = "control",
  stack = false,
  variant,
  full,
  iconOnly = false,
  label,
  itemIdPrefix,
  panelIdPrefix,
  className,
}: {
  /* `NoInfer` so T is read from `value` (the typed state) and the option
     list is checked against it, rather than widening T to `string` from the
     options and refusing a typed setter as the change handler. */
  options: readonly SegmentedOption<NoInfer<T>>[];
  value: T;
  onChange: (next: NoInfer<T>) => void;
  semantics?: "tabs" | "radio";
  size?: "sm" | "md";
  /**
   * The amended radius law (ledger section 8). `control` is the raised
   * neutral capsule on the inset track that every existing control draws;
   * `pill` is the renders' glass rail with the FILLED brand segment and its
   * glow: the feed's For You / Following and the search pill's Buy / Rent /
   * Stay / Invest.
   */
  shape?: "control" | "pill";
  /**
   * One option per line, as full-width rows with a radio dot, for a form
   * question whose answers are sentences or four or more words. A track of
   * capsules cannot give each of them room on a phone.
   */
  stack?: boolean;
  /** `quiet` (default) or `solid`; see the note at the top of this file. */
  variant?: "quiet" | "solid";
  full?: boolean;
  /**
   * Reference 55's icon-only segmented control: each segment shows its
   * `icon` alone and its `label` becomes the segment's accessible name
   * (visually hidden). Every option must carry an icon.
   */
  iconOnly?: boolean;
  /** Accessible name for the group. Required: an unlabelled group is a puzzle. */
  label: string;
  /**
   * Wires the tab/panel relationship. When both are given, each tab gets
   * `${itemIdPrefix}-${value}` and points `aria-controls` at
   * `${panelIdPrefix}-${value}`, so a panel can name itself with
   * aria-labelledby. Without these the control is still a valid tablist, it
   * just has no panel association - which is correct for a filter row.
   */
  itemIdPrefix?: string;
  panelIdPrefix?: string;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const capsuleRef = useRef<HTMLSpanElement | null>(null);
  const [capsule, setCapsule] = useState<{ x: number; w: number } | null>(null);
  /* Where the thumb was drawn last, so a move can start from there. */
  const drawn = useRef<{ x: number; w: number } | null>(null);

  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const measure = useCallback(() => {
    const track = trackRef.current;
    const item = itemRefs.current[index];
    if (!track || !item) return;
    setCapsule({ x: item.offsetLeft, w: item.offsetWidth });
  }, [index]);

  // Layout effect so the capsule is already in place on first paint rather
  // than visibly jumping into position after mount.
  useLayoutEffect(measure, [measure, options.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    for (const el of itemRefs.current) if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  /*
   * THE SPRING, AS A FLIP. The inline style below puts the thumb at its new
   * place and width; this plays it in from the old one with one transform
   * animation (Web Animations, so no stylesheet transition can fight it).
   * The first placement, a resize and a re-measure that moved nothing do not
   * animate: only a change of the chosen segment does.
   */
  useLayoutEffect(() => {
    const el = capsuleRef.current;
    const from = drawn.current;
    drawn.current = capsule;
    if (!el || !capsule || !from || typeof el.animate !== "function") return;
    if (from.x === capsule.x && from.w === capsule.w) return;
    if (motionQuiet()) return;
    const css = getComputedStyle(el);
    /*
     * INTERRUPTIBLE. A second tap mid-flight starts from where the thumb IS,
     * not from where it was headed: the running animation's present transform
     * is read off the computed matrix before it is cancelled, so the thumb
     * turns in place rather than jumping. (The lead's binding split keeps a
     * known-track move like this on WAAPI; framer-motion is for gestures.)
     */
    let start = { x: from.x, w: from.w };
    const running = el.getAnimations();
    if (running.length > 0) {
      const m = new DOMMatrixReadOnly(css.transform === "none" ? undefined : css.transform);
      start = { x: m.m41, w: m.m11 * capsule.w };
      for (const a of running) a.cancel();
    }
    const duration = Number.parseFloat(css.getPropertyValue("--nf-duration-base")) || 240;
    const easing = css.getPropertyValue("--nf-ease-spring").trim() || "cubic-bezier(0.34, 1.28, 0.64, 1)";
    el.animate(
      [
        { transform: `translateX(${start.x}px) scaleX(${start.w / Math.max(capsule.w, 1)})` },
        { transform: `translateX(${capsule.x}px) scaleX(1)` },
      ],
      { duration, easing },
    );
  }, [capsule]);

  /* Fonts change label widths after first paint; remeasure when they land. */
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts?.ready) return;
    let live = true;
    void fonts.ready.then(() => {
      if (live) measure();
    });
    return () => {
      live = false;
    };
  }, [measure]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (semantics !== "tabs") return;
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next]!.value);
    itemRefs.current[next]?.focus();
  };

  const pad = size === "sm" ? "p-3xs" : "p-2xs";
  /* A full-width track shares its width equally, so a segment's room is
     fixed and the padding is the first thing to give (12px, not 16). */
  const seg =
    size === "sm"
      ? "h-9 px-sm text-[length:var(--nf-text-caption)]"
      : `${variant === "solid" || (variant === undefined && shape === "pill") ? "h-11" : "h-9"} ${full ? "px-sm" : "px-md"} text-[length:var(--nf-text-body-sm)]`;
  /* A full-width segment that wraps to two lines grows to fit them rather than
     clipping the second ("Not answere"). */
  const solid = variant === "solid" || (variant === undefined && shape === "pill");
  /* The solid variant keeps the renders' brand rail (`.nf-segmented--pill`,
     chips.css); the quiet one is the neutral track (buttons.css). */
  const pill = solid;

  return (
    <div
      ref={trackRef}
      role={semantics === "tabs" ? "tablist" : "radiogroup"}
      aria-label={label}
      onKeyDown={onKeyDown}
      className={[
        "nf-segmented relative inline-flex items-center",
        pill ? "nf-segmented--pill nf-segmented--solid" : "nf-segmented--quiet",
        stack ? "nf-segmented--stack" : "",
        pad,
        full ? "flex w-full" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/*
        The travelling capsule. aria-hidden because it carries no meaning of its
        own: the selection is already stated by aria-selected / aria-checked.
      */}
      {capsule && !stack ? (
        <span
          ref={capsuleRef}
          aria-hidden="true"
          className="nf-segmented__capsule"
          style={{ transform: `translateX(${capsule.x}px)`, width: `${capsule.w}px` }}
        />
      ) : null}

      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            role={semantics === "tabs" ? "tab" : "radio"}
            id={itemIdPrefix ? `${itemIdPrefix}-${o.value}` : undefined}
            aria-controls={panelIdPrefix ? `${panelIdPrefix}-${o.value}` : undefined}
            aria-selected={semantics === "tabs" ? selected : undefined}
            aria-checked={semantics === "radio" ? selected : undefined}
            tabIndex={semantics === "tabs" ? (selected ? 0 : -1) : 0}
            onClick={() => {
              /* V-30: a choice taken is felt as `select`, once, and only
                 when it changes something. */
              if (o.value !== value) feedback("select");
              onChange(o.value);
            }}
            className={[
              /*
               * `min-w-0` IS THE WHOLE FIX AND IT IS THE SAME FIX IN THREE
               * PLACES.
               *
               * `flex-1` is `flex: 1 1 0%`, which frees the BASIS. It does not
               * touch the item's automatic minimum size, which is its
               * min-content width, which with a nowrap label is the whole
               * word. So when three translated labels are wider than the
               * track, the ITEMS leave the track, and the capsule follows them
               * out: `capsule.x` and `capsule.w` are read off
               * `item.offsetLeft` and `item.offsetWidth`, and that measurement
               * is honest, so it reports an item that is genuinely outside its
               * own control. `.nf-segmented` declares no `overflow`, so
               * nothing clips it.
               *
               * This is the same sentence as `minmax(0, 1fr)` on a grid track:
               * FREEING THE TRACK IS NOT FREEING THE ITEM. It is the root
               * cause of the landing search pill's escaping label, the dock's
               * escaping label and this one, which the research filed as three
               * separate defects.
               */
              "nf-segmented__item relative z-1 inline-flex min-w-0 items-center justify-center gap-inline transition-colors",
              /* A quiet segment paints 36px inside the 44px track; `nf-tap` keeps its
                 target at 44 (base.css). */
              pill ? "rounded-[var(--nf-radius-segment)] font-semibold" : "nf-tap rounded-[var(--nf-radius-segment)] font-semibold",
              seg,
              full ? "flex-1 !h-auto min-h-9 py-xs" : "",
              /* On the capsule the selected ink is on-brand and comes from the
                 stylesheet, since the segment sits on the filled capsule. */
              /* Reference 55: the selected segment is brand blue in both
                 variants, so its white word comes from the stylesheet. */
              selected ? "" : "text-[var(--nf-content-muted)] hover:text-[var(--nf-content-secondary)]",
              iconOnly ? "aspect-square !px-0 justify-center" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {o.icon ? <UiIcon name={o.icon} size={iconOnly ? 20 : 16} filled={selected} /> : null}
            {/* `truncate` is nowrap PLUS the clip. The nowrap was already
                here and was doing half the job: it stopped the word wrapping
                and had nothing to stop it escaping. */}
            {/* ON A FULL-WIDTH TRACK A LABEL WRAPS BEFORE IT CLIPS. Three equal
                segments at 360 left "Three months" 57px and it read "Three
                ...": a choice nobody can read is not a choice. There, a long
                label takes a second balanced line inside the same 44px item
                (clamped at two); a hugging track still truncates. */}
            <span
              className={
                iconOnly
                  ? "sr-only"
                  : stack
                  ? "min-w-0 text-start leading-snug"
                  : full
                  ? "min-w-0 text-center leading-tight [text-wrap:balance] line-clamp-2"
                  : "min-w-0 truncate"
              }
            >
              {o.label}
            </span>
            {typeof o.count === "number" ? (
              <span className="nf-numeric text-[length:max(0.75em,0.75rem)] opacity-70">{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * THE VIEW UNDER A SEGMENTED CONTROL, CROSSFADING (north star motion 6: "content
 * crossfades 160ms"). Keyed on the chosen value, so each choice mounts its
 * view fresh and it fades in on `glide` 160ms (`.nf-fade-swap`,
 * motion-kit.css); under reduced motion, Calm and Off it is simply there.
 *
 * Pass the same `panelIdPrefix` and `itemIdPrefix` given to `Segmented` and
 * the panel names itself after its tab.
 */
export function SegmentedPanel({
  value,
  panelIdPrefix,
  itemIdPrefix,
  className,
  children,
}: {
  value: string;
  panelIdPrefix?: string;
  itemIdPrefix?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      key={value}
      role={panelIdPrefix ? "tabpanel" : undefined}
      id={panelIdPrefix ? `${panelIdPrefix}-${value}` : undefined}
      aria-labelledby={panelIdPrefix && itemIdPrefix ? `${itemIdPrefix}-${value}` : undefined}
      className={["nf-fade-swap", className ?? ""].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}
