"use client";

import { useEffect, useState } from "react";
import { useRootFlag } from "@/lib/ui/root-flag";

/**
 * THE FLOATING GLASS PILL over the deal story (the founder's
 * `stack-scroll-reveal.jpg`: a glass control pill floating over the stack).
 *
 * It says where the reader is (the step's number lit and its name beside it)
 * and is the way to jump: each number is a link to its card, so it works with
 * no script at all as five anchors. With script it appears only while the
 * story is on screen and follows the card that holds the middle of the
 * window. Nothing on it moves under reduced motion beyond appearing.
 */
export function StoryPill({ label, steps }: { label: string; steps: { id: string; label: string }[] }) {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(false);
  /* `data-story-pill` on <html> while the pill is up: back to top steps
     aside, one floating control at a time (landing-plasma.css,
     lib/ui/root-flag.ts). */
  useRootFlag("story-pill", shown);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const cards = steps.map((step) => document.getElementById(step.id)).filter((el): el is HTMLElement => el !== null);
    const list = cards[0]?.parentElement;
    if (!list || cards.length === 0) return;
    /* The card crossing the window's middle line is the current step. */
    const middle = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const k = cards.indexOf(entry.target as HTMLElement);
            if (k >= 0) setActive(k);
          }
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    cards.forEach((card) => middle.observe(card));
    /* The pill shows while the list is on screen. */
    const presence = new IntersectionObserver(([entry]) => setShown(Boolean(entry?.isIntersecting)), {
      rootMargin: "-30% 0px -30% 0px",
    });
    presence.observe(list);
    return () => {
      middle.disconnect();
      presence.disconnect();
    };
  }, [steps]);

  return (
    <nav className="nf-pl-pill" aria-label={label} data-shown={shown ? "true" : "false"}>
      <ol className="nf-pl-pill__list">
        {steps.map((step, k) => (
          <li key={step.id}>
            <a
              href={`#${step.id}`}
              className="nf-pl-pill__step nf-numeric"
              aria-current={k === active ? "step" : undefined}
              aria-label={step.label}
            >
              {String(k + 1).padStart(2, "0")}
            </a>
          </li>
        ))}
      </ol>
      <span className="nf-pl-pill__now" aria-hidden="true">
        {steps[active]?.label}
      </span>
    </nav>
  );
}
