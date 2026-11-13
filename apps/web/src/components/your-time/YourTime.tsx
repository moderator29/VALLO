"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "@vallo/i18n/core";
import { deviceZone, yourTimeAt } from "@/lib/your-time/your-time";

/**
 * The instant on the reader's own clock, beside a Lagos time, only when the
 * two differ (`lib/your-time/your-time.ts`). Lagos time stays the time of
 * record and is printed by the caller as before; this adds a muted
 * "09:00 your time" after it.
 *
 * The server and the first client render draw nothing (the server cannot
 * know the device's zone), then the line appears: an addition after
 * hydration, never a figure that changes under the reader.
 */

const noSubscription = () => () => undefined;

export type YourTimeCopy = {
  /** "{time} your time" */
  yourTime: string;
  /** "{day} {time} your time", when the reader's day differs from Lagos's. */
  yourTimeDay: string;
};

export function YourTime({
  at,
  locale,
  copy,
  className,
  zone,
}: {
  /** The instant, ISO 8601, as the visit screens hold it. */
  at: string;
  locale: Locale;
  copy: YourTimeCopy;
  className?: string;
  /** For tests: the device zone to use instead of reading it. */
  zone?: string | null;
}) {
  const device = useSyncExternalStore(noSubscription, deviceZone, () => null);
  const local = yourTimeAt(at, zone === undefined ? device : zone, locale);
  if (!local) return null;
  const text = local.day
    ? copy.yourTimeDay.replace("{day}", local.day).replace("{time}", local.time)
    : copy.yourTime.replace("{time}", local.time);
  return (
    <span className={["nf-caption font-normal text-[var(--nf-content-muted)]", className ?? ""].filter(Boolean).join(" ")} data-your-time={local.zone}>
      {text}
    </span>
  );
}
