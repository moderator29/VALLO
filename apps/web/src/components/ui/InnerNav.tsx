"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { animate, useMotionValue, useTransform } from "framer-motion";
import "@/app/css/ported.css";
import { useMotionGate } from "@/components/motion/useMotionGate";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { cn } from "@/lib/cn";
import { feedback } from "@/lib/ui/feedback";
import { useOverlay } from "@/lib/ui/use-overlay";
import { SPRING_SETTLE, clamp, springFor, useDrive } from "./ported-motion";

/**
 * INNER NAV: GLASS SECOND-LEVEL NAVIGATION WITH A PHYSICAL PULL.
 *
 * Ported from the founder's component library (docs/design/COMPONENT_LIBRARY.md,
 * "Glass navigation"). His note, kept verbatim in spirit: this is NOT the main
 * navigation. It is for inner areas, inner features and inner pages, and the
 * pull on the hamburger is the part he likes.
 *
 * WHERE IT GOES: places with their own internal structure. Admin desks (each desk
 * has sections), the host and agent workspaces (calendar, decide, rooms,
 * earnings), settings (inside each screen), payments (history, methods,
 * receipts), space detail (overview, costs, amenities, trust, location),
 * analytics, support.
 *
 * WHERE IT IS MOUNTED TODAY (R3-08): the admin desks' sections
 * (`app/admin/_components/DeskSections.tsx`); the settings screens
 * (`components/app/account/SettingsInnerNav.tsx`); and a space's detail
 * sections (`components/app/listing/ListingSectionTabs.tsx`). The host and
 * agent consoles left it on 16 November 2026 (the workspace phone pass): each
 * already carries its pages as a sticky row of chips under the workspace bar
 * (`components/host/HostNav.tsx`, `components/agent/AgentInnerNav.tsx`), and a
 * second menu toggle above every page title read as scattered.
 *
 * WHERE IT MUST NEVER GO: the primary dock and the side navigation. They are
 * settled by D28 (the dock keeps its slots, the side nav keeps its structure) and
 * this component does not replace, wrap or restyle either.
 *
 * THE PULL, which must feel physical. Put a finger on the toggle and drag it
 * down: the toggle follows the finger with resistance, and the panel unfurls in
 * proportion to the pull, 1:1, not on a timer. Let go past halfway (or with a
 * downward flick) and it settles open on the spring (`--nf-ease-spring`, the
 * `drift` curve, `--nf-duration-slow`); let go short and it springs back
 * closed. Drag up from open to close it the same way. Pull past the end and
 * the toggle stretches with a rubber band rather than stopping dead. A tap does
 * the ordinary thing: toggles. The pull is never the only way: the toggle is a
 * real button, so Enter and Space work, Escape closes and returns focus to the
 * toggle, and Tab walks the items.
 *
 * WHY framer-motion, AND HOW (and why no `m` element). The pull is the founder's favourite thing about
 * this component, and it is exactly what CSS is worst at: motion that follows a
 * finger and then inherits it. One `useMotionValue` (`pull`, 0 to 1: how open)
 * and one for the toggle's own travel are written straight from the pointer
 * (no React render per frame); the panel's opacity, lift, scale and visibility,
 * and the menu and close glyphs, are all derived from `pull` with
 * `useTransform`, so everything tracks the finger together. On release `animate`
 * settles it on a spring with the finger's momentum (interruptible: put a finger
 * back on it mid-settle and it carries on from where it is). Pointer events
 * rather than framer's `drag` prop, because `drag` needs a feature bundle and
 * the platform loads none (D49.1). Those values are written into the elements
 * by `useDrive` (ported-motion.ts), not through `m` elements, which need a
 * feature bundle to render anything past their first frame. Open
 * and closed are React state and a data attribute, the panel is hidden by CSS
 * until it is open or being pulled, and the motion values only add the
 * continuous flourish on top, so the control works from its first frame. Quiet
 * readers (system reduced motion, Calm, Off) get an instant open and close; the
 * pull still tracks the finger.
 *
 * HAPTIC: one "select" (light, the grammar's tab and toggle weight) when the
 * panel settles open or closed by a gesture or tap. Nothing while dragging.
 *
 * MATERIAL: the sheet's glass panel, one hairline edge with the lit edge on the
 * leading side, the sheet's lift. Navy at night, white with a hairline on paper.
 * Data saver replaces the blur with a solid surface. Radius 26 (an Island); each
 * item is a Plate at radius 14; the toggle is a circular icon control (44px).
 *
 * LINKS OR ACTIONS. An item with `href` renders a real link (so it can be opened
 * in a new tab and prefetches); one without renders a button and calls
 * `onSelect`. Both close the panel. The active item carries `aria-current`.
 *
 * COPY is the caller's: no string here has a default.
 */

export type InnerNavItem = {
  id: string;
  label: string;
  icon?: UiIconName;
  href?: string;
  onSelect?: () => void;
};

/** Finger travel, in px, that opens the panel completely. */
const PULL = 96;
/** Movement under this is a tap, not a pull. */
const SLOP = 6;
/** Most the toggle itself travels, in px, however far the finger goes. */
const TOGGLE_TRAVEL = 22;

type PanelDrive = { p: number };
type GlyphDrive = { opacity: number; rotate: number };
/* Module level and stable, as `useDrive` requires. The panel is `visibility:
   hidden` in the stylesheet until it is open or pulled, and these only add the
   in-between: opacity, lift and scale follow `p`, and a panel that has fully
   closed is hidden again. */
const writeToggle = (el: HTMLElement, y: number) => {
  el.style.transform = `translate3d(0, ${y}px, 0)`;
};
const writePanel = (el: HTMLElement, { p }: PanelDrive) => {
  el.style.opacity = String(p);
  el.style.transform = `translate3d(0, ${(1 - p) * -12}px, 0) scale(${0.94 + 0.06 * p})`;
  el.style.visibility = p > 0.001 ? "visible" : "hidden";
  el.style.pointerEvents = p > 0.05 ? "auto" : "none";
};
const writeGlyph = (el: HTMLElement, { opacity, rotate }: GlyphDrive) => {
  el.style.opacity = String(opacity);
  el.style.transform = `rotate(${rotate}deg)`;
};

export function InnerNav({
  label,
  toggleLabel,
  items,
  activeId,
  currentLabel,
  onOpenChange,
  className,
  "data-testid": testId,
}: {
  /** The navigation's accessible name, e.g. the area it belongs to. */
  label: string;
  /** The toggle button's accessible name. */
  toggleLabel: string;
  items: readonly InnerNavItem[];
  activeId?: string;
  /** Visible text beside the toggle, usually the active section's name. */
  currentLabel?: string;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  "data-testid"?: string;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const { quiet } = useMotionGate();
  const [open, setOpenState] = useState(false);
  const [pulling, setPulling] = useState(false);
  const pull = useMotionValue(0);
  const toggleY = useMotionValue(0);
  const panelDrive = useTransform(pull, (p): PanelDrive => ({ p }));
  const menuDrive = useTransform(pull, (p): GlyphDrive => ({ opacity: 1 - p, rotate: p * 90 }));
  const closeDrive = useTransform(pull, (p): GlyphDrive => ({ opacity: p, rotate: (1 - p) * -90 }));
  const toggleRef = useDrive<HTMLButtonElement, number>(toggleY, writeToggle);
  const panelRef = useDrive<HTMLDivElement, PanelDrive>(panelDrive, writePanel);
  const menuRef = useDrive<HTMLSpanElement, GlyphDrive>(menuDrive, writeGlyph);
  const closeRef = useDrive<HTMLSpanElement, GlyphDrive>(closeDrive, writeGlyph);
  const gesture = useRef<{
    startY: number;
    from: number;
    moved: boolean;
    lastY: number;
    lastT: number;
    v: number;
  } | null>(null);
  const suppressClick = useRef(false);
  const focusFirst = useRef(false);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  /* Let the panel settle open or closed on a spring, from wherever it is. */
  const settle = useCallback(
    (to: 0 | 1) => {
      animate(pull, to, springFor(quiet, SPRING_SETTLE));
      animate(toggleY, 0, springFor(quiet, SPRING_SETTLE));
    },
    [pull, toggleY, quiet],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    /* Catch a settle in flight: the pull carries on from where it is. */
    pull.stop();
    toggleY.stop();
    gesture.current = {
      startY: e.clientY,
      from: pull.get(),
      moved: false,
      lastY: e.clientY,
      lastT: e.timeStamp,
      v: 0,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dy = e.clientY - g.startY;
    if (!g.moved) {
      if (Math.abs(dy) < SLOP) return;
      g.moved = true;
      setPulling(true);
    }
    const dt = e.timeStamp - g.lastT;
    if (dt > 0) g.v = (e.clientY - g.lastY) / dt;
    g.lastY = e.clientY;
    g.lastT = e.timeStamp;
    const raw = g.from + dy / PULL;
    const p = clamp(raw, 0, 1);
    /* Past either end the toggle stretches with a rubber band: a quarter of the
       overshoot, capped, so it never tears away from the panel. */
    const over = raw > 1 ? raw - 1 : raw < 0 ? raw : 0;
    pull.set(p);
    toggleY.set(clamp(p * 8 + over * PULL * 0.25, -TOGGLE_TRAVEL, TOGGLE_TRAVEL));
  };

  const finish = (cancelled: boolean, at: number) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    /* A finger that rested before lifting is not throwing: velocity is only
       what it was in the last instant. */
    if (at - g.lastT > 80) g.v = 0;
    if (!g.moved) return; /* A tap: the click handler toggles. */
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    /* Position plus a little of the throw, so a flick counts. */
    const projected = pull.get() + (g.v * 140) / PULL;
    const next = cancelled ? open : projected > 0.5;
    setPulling(false);
    setOpenState(next);
    settle(next ? 1 : 0);
    if (next !== open) {
      feedback("select");
      onOpenChange?.(next);
    }
  };

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (suppressClick.current) return;
    if (e.detail === 0 && !open) focusFirst.current = true;
    feedback("select");
    setOpen(!open);
    settle(open ? 0 : 1);
  };

  /* A keyboard open lands on the active item (or the first), so the next Tab
     is already inside the list. A pointer open leaves focus on the toggle. */
  useEffect(() => {
    if (!open) {
      focusFirst.current = false;
      return;
    }
    if (!focusFirst.current) return;
    /* True once focus has really landed. A hidden element refuses focus
       without a sound, so the keyboard open is only spent when it took: on a
       loaded machine (a CI runner) the first attempt can come a frame before
       the panel is focusable, and one silent miss left focus on the toggle. */
    const focus = () => {
      const target =
        listRef.current?.querySelector<HTMLElement>("[aria-current]") ??
        listRef.current?.querySelector<HTMLElement>("a,button");
      if (!target) return false;
      target.focus({ preventScroll: true });
      if (document.activeElement !== target) return false;
      focusFirst.current = false;
      return true;
    };
    /* The panel is still hidden on the frame the state flips; focus lands as
       soon as the spring has made it visible, retrying on each step until it
       takes. */
    if (pull.get() > 0.05 && focus()) return;
    const off = pull.on("change", (p) => {
      if (p > 0.05 && focus()) off();
    });
    /* A spring that has already settled sends no more changes: one more try
       on the next frame covers a panel that came to rest before it could take
       focus. */
    const frame = requestAnimationFrame(() => {
      if (focusFirst.current && pull.get() > 0.05 && focus()) off();
    });
    return () => {
      off();
      cancelAnimationFrame(frame);
    };
  }, [open, pull]);

  /* Escape closes and hands focus back. */
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Escape" || !open) return;
    e.stopPropagation();
    setOpen(false);
    settle(0);
    toggleRef.current?.focus();
  };

  /* THE MENU IS A NON-MODAL OVERLAY. It joins the shared overlay registry so
     Escape and the Android back button close it instead of leaving the page
     (`lib/native/back-button.ts` asks the registry). It is not modal: the page
     stays scrollable behind it (no body lock, so no scrollbar shift and a
     smooth scroll to a section is not cut short), Tab walks on out of it, and
     it moves its own focus. It creates no history entry, so the BROWSER's
     back button is not part of this (`use-sheet-history.ts` would add one,
     deliberately not used for a menu). */
  const closeFromBack = useCallback(() => {
    setOpen(false);
    settle(0);
    toggleRef.current?.focus();
  }, [setOpen, settle, toggleRef]);
  useOverlay({ open, onClose: closeFromBack, panelRef: rootRef, autoFocus: false, modal: false });

  /* A press outside closes it. */
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        settle(0);
      }
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, setOpen, settle]);

  const choose = (item: InnerNavItem) => {
    item.onSelect?.();
    setOpen(false);
    settle(0);
    /* Focus goes home without scrolling the page, which would cut short the
       smooth scroll a section jump has just started. */
    toggleRef.current?.focus({ preventScroll: true });
  };

  return (
    <nav
      ref={rootRef}
      aria-label={label}
      className={cn("nf-innernav", className)}
      data-open={open || undefined}
      data-pulling={pulling || undefined}
      data-testid={testId}
      onKeyDown={onKeyDown}
    >
      <div className="nf-innernav__bar">
        <button
          ref={toggleRef}
          type="button"
          className="nf-innernav__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={toggleLabel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => finish(false, e.timeStamp)}
          onPointerCancel={(e) => finish(true, e.timeStamp)}
          onClick={onClick}
        >
          <span ref={menuRef} className="nf-innernav__glyph">
            <UiIcon name="menu" size={24} />
          </span>
          <span ref={closeRef} className="nf-innernav__glyph nf-innernav__glyph--close">
            <UiIcon name="close" size={20} />
          </span>
        </button>
        {currentLabel ? <span className="nf-innernav__current">{currentLabel}</span> : null}
      </div>
      <div ref={panelRef} id={panelId} className="nf-innernav__panel" data-open={open || undefined} inert={!open && !pulling}>
        <ul ref={listRef} className="nf-innernav__list">
          {items.map((item) => {
            const active = item.id === activeId;
            const inner = (
              <>
                {item.icon ? <UiIcon name={item.icon} size={20} className="nf-innernav__icon" /> : null}
                <span className="nf-innernav__label">{item.label}</span>
              </>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="nf-innernav__item"
                    aria-current={active ? "page" : undefined}
                    onClick={() => choose(item)}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="nf-innernav__item"
                    aria-current={active ? "true" : undefined}
                    onClick={() => choose(item)}
                  >
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
