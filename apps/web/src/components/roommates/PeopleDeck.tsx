"use client";

import { animate } from "framer-motion";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

import { Button } from "@/components/ui/Button";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import type { RoommateCard } from "@/lib/features/roommates/model";
import { motionQuiet } from "@/lib/motion/gate";
import { feedback } from "@/lib/ui/feedback";

import { RoommateCardView } from "./Cards";
import { fill } from "./format";

/**
 * PEOPLE WHO MATCH, AS A DECK (phones). The top card follows the finger and
 * is thrown to either side on a spring; the next card rises from behind.
 * Previous and Next buttons do the same for a keyboard or a switch, and the
 * count says where you are. Reduced motion, Calm and Off move with no throw.
 * A wide screen shows the grid instead (`.nf-rm-deck` is hidden there).
 */
const THROW = 90;

export function PeopleDeck({ people }: { people: RoommateCard[] }) {
  const copy = useScopedCopy("roommates");
  const [at, setAt] = useState(0);
  const top = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; id: number } | null>(null);
  const moved = useRef(0);
  const count = people.length;
  if (!count) return null;

  const go = (dir: 1 | -1) => {
    const next = (at + dir + count) % count;
    const el = top.current;
    feedback("select");
    if (!el || motionQuiet()) {
      setAt(next);
      return;
    }
    void animate(el, { x: dir * 420, rotate: dir * 12, opacity: 0 }, { type: "spring", stiffness: 260, damping: 28 }).then(() => {
      el.style.transform = "";
      el.style.opacity = "";
      setAt(next);
    });
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    start.current = { x: e.clientX, id: e.pointerId };
    moved.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const dx = e.clientX - start.current.x;
    moved.current = dx;
    e.currentTarget.style.transform = `translateX(${dx}px) rotate(${dx / 24}deg)`;
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    start.current = null;
    const dx = moved.current;
    const el = e.currentTarget;
    if (Math.abs(dx) > THROW) {
      go(dx > 0 ? -1 : 1);
      return;
    }
    if (motionQuiet()) {
      el.style.transform = "";
      return;
    }
    void animate(el, { x: 0, rotate: 0 }, { type: "spring", stiffness: 420, damping: 30 });
  };

  const order = [0, 1, 2].map((k) => people[(at + k) % count]!).slice(0, Math.min(3, count));
  return (
    <div className="nf-rm-deck" data-testid="roommates-deck">
      <div className="nf-rm-deck__stack">
        {order
          .map((p, k) => (
            <div
              key={`${p.userId}-${at}-${k}`}
              ref={k === 0 ? top : undefined}
              className="nf-rm-deck__card"
              data-depth={k}
              style={{ "--nf-rm-depth": k } as CSSProperties}
              aria-hidden={k === 0 ? undefined : true}
              {...(k === 0 ? { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up } : { inert: true })}
            >
              <RoommateCardView card={p} t={copy} />
            </div>
          ))
          .reverse()}
      </div>
      {count > 1 ? (
        <div className="nf-rm-deck__nav">
          <Button variant="icon" round iconOnly leadingIcon="arrow-left" aria-label={copy.ui.deck.previous} onClick={() => go(-1)} />
          <span className="nf-rm-deck__count" aria-live="polite">
            {fill(copy.ui.deck.count, { n: at + 1, total: count })}
          </span>
          <Button variant="icon" round iconOnly leadingIcon="arrow-right" aria-label={copy.ui.deck.next} onClick={() => go(1)} />
        </div>
      ) : null}
    </div>
  );
}
