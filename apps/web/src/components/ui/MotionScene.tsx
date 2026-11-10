"use client";

import { animate } from "framer-motion";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { Icon3D, type Icon3DName } from "@/components/ui/Icon3D";
import { useMotionGate } from "@/components/motion/useMotionGate";
import type { ArtSlot } from "@/lib/features/art";

import "./motion-scene.css";

/**
 * A MOTION SCENE: the one motion language every big banner shares (the
 * founder, 8 November 2026, "make the platform be animations and motion").
 *
 * It layers a scene from back to front and brings it alive the way the app's
 * own launch does:
 *
 *   - a brand gradient BED fills the stage;
 *   - an optional BACKDROP plate sits behind, softly blurred, drifting slowest;
 *   - a few slow brand-colour PARTICLES rise behind the subject;
 *   - the 3D OBJECTS float at the corners asked for;
 *   - the SUBJECT (the art slot's cut-out or scene) stands at the end edge,
 *     rising and fading in on a spring when it mounts, then breathing very
 *     slowly so it reads as alive rather than a flat photograph;
 *   - every layer takes a PARALLAX offset from the pointer and from a gentle
 *     device tilt, each at its own depth, so the scene has real space.
 *
 * The words (a headline, a CTA) are the `children`, drawn above the stage.
 *
 * ONE SWITCH TURNS IT ALL OFF. Under reduced motion, Calm, Off or save-data
 * (`useMotionGate`) there is no entrance, no breathing, no particles and no
 * parallax: the final frame, at once. Nothing loops for ever; the breathing
 * and the float run a set number of times and settle. Transform and opacity
 * only, so it composites at 60fps.
 */
export type SceneObject = { name: Icon3DName; at: "tl" | "tr" | "bl" | "br"; size?: number };

export function MotionScene({
  art,
  backdrop,
  objects = [],
  particles = true,
  anchor = "end",
  theme = "dark",
  className,
  stageClassName,
  children,
  testId,
}: {
  art: ArtSlot;
  /** A scene plate behind the subject, blurred and drifting slowest. */
  backdrop?: ArtSlot;
  objects?: readonly SceneObject[];
  particles?: boolean;
  /** Where a `contain` cut-out stands. */
  anchor?: "end" | "center";
  /**
   * The scene is a night island by default (its ground is the night artwork,
   * so its light-on-dark words read in both themes). Pass `null` for a scene
   * that should follow the reader's theme.
   */
  theme?: "dark" | null;
  className?: string;
  stageClassName?: string;
  children?: ReactNode;
  testId?: string;
}) {
  const { quiet, ambient } = useMotionGate();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const subjectRef = useRef<HTMLDivElement | null>(null);

  /* The entrance and the breathing, once the scene is on screen. */
  useEffect(() => {
    const el = subjectRef.current;
    if (!el || quiet) return;
    const rise = animate(el, { opacity: [0, 1], transform: ["translateY(28px) scale(0.94)", "translateY(0px) scale(1)"] }, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    let breathe: ReturnType<typeof animate> | undefined;
    const t = window.setTimeout(() => {
      if (!ambient) return;
      /* A slow, bounded "breath": scale drifts up and back a few times, then
         settles. Never infinite (the platform bans a loop that never ends). */
      breathe = animate(el, { transform: ["scale(1)", "scale(1.025)", "scale(1)"] }, { duration: 7.5, ease: "easeInOut", repeat: 5, repeatType: "loop" });
    }, 1000);
    return () => {
      window.clearTimeout(t);
      rise.stop();
      breathe?.stop();
    };
  }, [quiet, ambient]);

  /* Parallax from the pointer and from a gentle device tilt: each layer reads
     `--nf-scene-x` / `--nf-scene-y` (roughly -1..1) and shifts by its depth. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !ambient) return;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    const apply = () => {
      raf = 0;
      root.style.setProperty("--nf-scene-x", tx.toFixed(3));
      root.style.setProperty("--nf-scene-y", ty.toFixed(3));
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onPointer = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      queue();
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tx = Math.max(-1, Math.min(1, e.gamma / 24));
      ty = Math.max(-1, Math.min(1, (e.beta - 45) / 24));
      queue();
    };
    root.addEventListener("pointermove", onPointer);
    window.addEventListener("deviceorientation", onTilt);
    return () => {
      root.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onTilt);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ambient]);

  return (
    <div ref={rootRef} className={["nf-scene", className ?? ""].filter(Boolean).join(" ")} {...(theme ? { "data-theme": theme } : {})} data-anchor={anchor} data-quiet={quiet || undefined} data-testid={testId} style={{ "--nf-scene-ratio": String(Math.max(art.ratio ?? 4 / 3, 1.4)) } as CSSProperties}>
      <div className={["nf-scene__stage", stageClassName ?? ""].filter(Boolean).join(" ")} aria-hidden="true">
        <span className="nf-scene__bed" />
        {backdrop ? (
          <span className="nf-scene__layer nf-scene__backdrop" data-depth="back">
            {/* eslint-disable-next-line @next/next/no-img-element -- a decorative scene plate, sized by CSS */}
            <img src={backdrop.src} alt="" loading="lazy" decoding="async" style={backdrop.focus ? { objectPosition: backdrop.focus } : undefined} />
          </span>
        ) : null}
        {particles ? (
          <span className="nf-scene__particles" data-depth="mid">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="nf-scene__particle" style={{ "--nf-scene-p": i } as CSSProperties} />
            ))}
          </span>
        ) : null}
        {objects.map((o) => (
          <span key={`${o.name}-${o.at}`} className="nf-scene__object" data-at={o.at} data-depth="mid">
            <Icon3D name={o.name} size={o.size ?? 56} classic />
          </span>
        ))}
        <div ref={subjectRef} className="nf-scene__layer nf-scene__subject" data-depth="front" data-fit={art.fit}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the scene's subject, a cut-out or a plate, sized by CSS */}
          <img src={art.src} alt="" loading="eager" decoding="async" style={art.focus ? { objectPosition: art.focus } : undefined} />
        </div>
        <span className="nf-scene__veil" />
      </div>
      {children ? <div className="nf-scene__words">{children}</div> : null}
    </div>
  );
}
