"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { feedback } from "@/lib/ui/feedback";

/**
 * THE CIRCLE HOME'S TWO CLIENT TOUCHES (8 November 2026).
 *
 *   CircleComposeFab  the floating compose button. It steps aside while the
 *                     hero's own action is on screen (one primary action at
 *                     a time), then rises above the dock.
 *   TabIntoView       scrolls the live section tab into the middle of its
 *                     row on arrival, so a tab past the edge is never hidden.
 */
export function CircleComposeFab({ href, label }: { href: string; label: string }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const cta = document.querySelector("[data-testid='circle-hero-cta']");
    if (!cta || typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no hero action on this screen: the button shows at once
      setHidden(false);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setHidden(Boolean(entry?.isIntersecting)), { threshold: 0.1 });
    io.observe(cta);
    return () => io.disconnect();
  }, []);
  return (
    <Link
      href={href}
      className="nf-cfab"
      aria-label={label}
      data-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      onClick={() => feedback("confirm")}
      data-testid="circle-compose"
    >
      <UiIcon name="pencil" size={22} />
    </Link>
  );
}

export function TabIntoView() {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const row = ref.current?.closest("nav")?.querySelector("ul");
    const live = row?.querySelector<HTMLElement>("[aria-current='page']");
    if (!row || !live) return;
    const target = live.offsetLeft - (row.clientWidth - live.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, target), behavior: "auto" });
  }, []);
  return <span ref={ref} hidden />;
}
