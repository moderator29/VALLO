"use client";

import { useEffect, useState } from "react";
import { PROTECTED_FUNDING_NO_EXPIRY, protectedExpiresIn } from "@/lib/money/copy";
import { transferCountdown } from "@/lib/money/protected-journey";

/**
 * The transfer window, drawn ONLY from the provider's own expiry (spec screen
 * 3). With none, it says so; it never invents a clock. Ticks once a second;
 * the draining bar stands still under reduced motion (CSS), and the time is
 * announced politely once a minute at most, not every tick.
 */
export function TransferClock({ expiresAt, now }: { expiresAt: string | null; now: number }) {
  const [at, setAt] = useState(now);
  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setAt(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const clock = transferCountdown(expiresAt, at);
  if (!clock) {
    return <p className="nf-pp-clock nf-pp-clock--none">{PROTECTED_FUNDING_NO_EXPIRY}</p>;
  }
  const minute = Math.ceil(clock.remainingSeconds / 60);
  return (
    <div className="nf-pp-clock" data-testid="pp-clock">
      <p>
        <span aria-hidden="true">{protectedExpiresIn(clock.label)}</span>
        <span className="sr-only" aria-live="polite">
          {protectedExpiresIn(`${minute} minute${minute === 1 ? "" : "s"}`)}
        </span>
      </p>
      <span className="nf-pp-clock__bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${clock.fraction})` }} />
      </span>
    </div>
  );
}
