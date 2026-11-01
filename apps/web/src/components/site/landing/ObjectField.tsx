"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Icon3D, type Icon3DName } from "@/components/ui/Icon3D";
import { objectsMayMove, pointerOffset } from "./object-field";

export type FieldObject = {
  name: Icon3DName;
  /** Where it sits: a slot the room's stylesheet places (landing-3d.css). */
  slot: string;
  /** Its drawn size at the widest breakpoint; the slot may scale it down. */
  size: number;
  /** How far it answers the pointer and the scroll, 0.5 (far) to 1.5 (near). */
  depth?: number;
};

/**
 * THE FLOATING OBJECTS (the founder, 30 September: "cool stuffs, designs,
 * animations"). A few of his 3D objects set around a room's centrepiece:
 * behind the hero's search, around the closing card. Decoration only, so
 * the whole field is `aria-hidden` and takes no pointer events; it is
 * absolutely placed inside its room, so it never adds height.
 *
 * WHAT MOVES, AND ONLY WHEN IT MAY (`objectsMayMove`):
 *
 *   - each object bobs and turns a few degrees on a slow loop, offset from
 *     its neighbours so they never move in step (CSS, transform only);
 *   - with a fine pointer, the field leans toward it, nearer objects
 *     further (`--o3-px`, `--o3-py`, written once per frame at most);
 *   - the loops pause while the room is off screen (IntersectionObserver),
 *     so a phone scrolled to the footer animates nothing here.
 *
 * Reduced motion, Calm, Off, data saver and a low-end device (`data-motion-
 * lite`) all leave the field without `data-on`: the objects are drawn at
 * rest, where they were placed, and the stylesheet's scroll drift is off too.
 */
export function ObjectField({
  objects,
  className,
  pointer = false,
}: {
  objects: readonly FieldObject[];
  className?: string;
  /** Lean toward a fine pointer anywhere over the parent room. */
  pointer?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !objectsMayMove()) return;
    el.dataset.on = "true";

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) el.dataset.live = "true";
        else delete el.dataset.live;
      });
      io.observe(el);
    } else {
      el.dataset.live = "true";
    }

    const room = el.parentElement;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!pointer || !fine || !room) return () => io?.disconnect();

    let frame = 0;
    let last: { x: number; y: number } | null = null;
    const paint = () => {
      frame = 0;
      if (!last) return;
      const { x, y } = pointerOffset(room.getBoundingClientRect(), last.x, last.y);
      el.style.setProperty("--o3-px", x.toFixed(3));
      el.style.setProperty("--o3-py", y.toFixed(3));
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const leave = () => {
      last = null;
      el.style.setProperty("--o3-px", "0");
      el.style.setProperty("--o3-py", "0");
    };
    room.addEventListener("pointermove", move, { passive: true });
    room.addEventListener("pointerleave", leave);
    return () => {
      io?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      room.removeEventListener("pointermove", move);
      room.removeEventListener("pointerleave", leave);
    };
  }, [pointer]);

  return (
    <div ref={ref} className={["nf-o3", className ?? ""].filter(Boolean).join(" ")} aria-hidden="true">
      {objects.map((o, i) => (
        <span
          key={o.slot}
          className="nf-o3__slot"
          data-slot={o.slot}
          style={{ "--o3-i": i, "--o3-depth": o.depth ?? 1, "--o3-size": `${o.size}px` } as CSSProperties}
        >
          <span className="nf-o3__lean">
            <Icon3D classic name={o.name} size={o.size} />
          </span>
        </span>
      ))}
    </div>
  );
}
