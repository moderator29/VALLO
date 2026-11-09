/**
 * MOTION HOOKS: JS utilities for premium motion across the platform.
 *
 * Each hook is composited-safe (transform and opacity only), respects
 * reduced motion, and uses the design system's timing tokens where
 * possible. Nothing here loops; everything settles.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motionQuiet } from "@/lib/motion/gate";

/**
 * Returns true when the user has not opted out of motion (neither the
 * OS reduced-motion setting nor the app's Calm/Off level).
 */
export function useMotionAllowed(): boolean {
  const [allowed, setAllowed] = useState(() => !motionQuiet());
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAllowed(!motionQuiet());
    mq.addEventListener("change", update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => {
      mq.removeEventListener("change", update);
      mo.disconnect();
    };
  }, []);
  return allowed;
}

/**
 * Stagger-reveal children as they enter the viewport. Applies
 * `data-reveal="in"` to each child with a stagger delay.
 *
 * Usage: `<div ref={staggerRef}>` wrapping a list of items.
 */
export function useStaggerReveal(opts?: { delay?: number; threshold?: number }) {
  const ref = useRef<HTMLElement | null>(null);
  const delay = opts?.delay ?? 60;
  const threshold = opts?.threshold ?? 0.1;

  useEffect(() => {
    const el = ref.current;
    if (!el || motionQuiet()) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target as HTMLElement;
          const index = Array.from(el.children).indexOf(target);
          target.style.animationDelay = `${Math.min(index, 5) * delay}ms`;
          target.dataset.reveal = "in";
          io.unobserve(target);
        }
      },
      { threshold, rootMargin: "0px 0px -6% 0px" },
    );

    for (const child of Array.from(el.children)) {
      (child as HTMLElement).dataset.reveal = "out";
      io.observe(child);
    }

    return () => io.disconnect();
  }, [delay, threshold]);

  return ref;
}

/**
 * Press feedback hook: returns handlers that scale the element down
 * on press and back up on release, with spring physics. Uses the
 * Web Animations API for composited transforms.
 */
export function usePressSpring(scale = 0.96) {
  const ref = useRef<HTMLElement | null>(null);
  const anim = useRef<Animation | null>(null);

  const onPointerDown = useCallback(() => {
    const el = ref.current;
    if (!el || motionQuiet()) return;
    anim.current?.cancel();
    anim.current = el.animate(
      [{ transform: `scale(${scale})` }],
      { duration: 120, fill: "forwards", easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
    );
  }, [scale]);

  const onPointerUp = useCallback(() => {
    const el = ref.current;
    if (!el || motionQuiet()) return;
    anim.current?.cancel();
    anim.current = el.animate(
      [{ transform: `scale(${scale})` }, { transform: "scale(1.02)" }, { transform: "scale(1)" }],
      { duration: 300, easing: "cubic-bezier(0.34, 1.28, 0.64, 1)" },
    );
  }, [scale]);

  return { ref, onPointerDown, onPointerUp, onPointerLeave: onPointerUp };
}

/**
 * Trigger a one-shot CSS class animation. Adds the class, waits for
 * animationend, removes it. Returns a trigger function.
 */
export function useOneShot(className: string) {
  const ref = useRef<HTMLElement | null>(null);

  const trigger = useCallback(() => {
    const el = ref.current;
    if (!el || motionQuiet()) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    const handler = () => {
      el.classList.remove(className);
      el.removeEventListener("animationend", handler);
    };
    el.addEventListener("animationend", handler, { once: true });
  }, [className]);

  return { ref, trigger };
}

/**
 * Badge bump: triggers a bounce animation on a badge element when its
 * count changes. Returns the ref to place on the badge.
 */
export function useBadgeBump(count: number) {
  const ref = useRef<HTMLElement | null>(null);
  const prev = useRef(count);

  useEffect(() => {
    const el = ref.current;
    if (!el || motionQuiet() || prev.current === count) return;
    prev.current = count;
    el.classList.remove("nf-badge-bump");
    void el.offsetWidth;
    el.classList.add("nf-badge-bump");
    const handler = () => el.classList.remove("nf-badge-bump");
    el.addEventListener("animationend", handler, { once: true });
  }, [count]);

  return ref;
}

/**
 * Heart pop: plays the heart burst + ring expansion when saved becomes
 * true, and the shrink when it becomes false.
 */
export function useHeartPop(saved: boolean) {
  const ref = useRef<HTMLElement | null>(null);
  const prev = useRef(saved);

  useEffect(() => {
    const el = ref.current;
    if (!el || motionQuiet()) return;
    if (prev.current === saved) return;
    prev.current = saved;

    el.classList.remove("nf-heart-pop", "nf-heart-unsave");
    void el.offsetWidth;

    if (saved) {
      el.classList.add("nf-heart-pop");
    } else {
      el.classList.add("nf-heart-unsave");
    }

    const handler = () => el.classList.remove("nf-heart-pop", "nf-heart-unsave");
    el.addEventListener("animationend", handler, { once: true });
  }, [saved]);

  return ref;
}

/**
 * Number direction: returns "up" or "down" when a numeric value changes,
 * for applying nf-num-up or nf-num-down classes.
 */
export function useNumberDirection(value: number): "up" | "down" | null {
  const prev = useRef(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (prev.current === value) return;
    setDir(value > prev.current ? "up" : "down");
    prev.current = value;
    const t = setTimeout(() => setDir(null), 400);
    return () => clearTimeout(t);
  }, [value]);

  return dir;
}

/**
 * Confetti burst: creates and animates 6 particles radiating from an
 * element's center. Returns a trigger function.
 */
export function useConfetti() {
  const ref = useRef<HTMLElement | null>(null);

  const burst = useCallback(() => {
    const el = ref.current;
    if (!el || motionQuiet()) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const particles = Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 30 + Math.random() * 40;
      const dot = document.createElement("div");
      dot.className = "nf-confetti";
      dot.style.cssText = `
        position: fixed;
        left: ${cx}px;
        top: ${cy}px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--nf-brand-primary);
        z-index: 9999;
        pointer-events: none;
        --cx: ${Math.cos(angle) * dist}px;
        --cy: ${Math.sin(angle) * dist}px;
        --cr: ${Math.random() * 360}deg;
        --cd: ${i * 40}ms;
      `;
      document.body.appendChild(dot);
      return dot;
    });

    setTimeout(() => particles.forEach((p) => p.remove()), 1200);
  }, []);

  return { ref, burst };
}

/**
 * Smooth counter: animates a number from its previous value to the
 * current one over a duration, for stats and figures.
 */
export function useSmoothCounter(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  const raf = useRef(0);

  useEffect(() => {
    if (motionQuiet() || prev.current === target) {
      prev.current = target;
      setDisplay(target);
      return;
    }

    const from = prev.current;
    prev.current = target;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - (1 - t) * (1 - t);
      setDisplay(Math.round(from + (target - from) * ease));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return display;
}
