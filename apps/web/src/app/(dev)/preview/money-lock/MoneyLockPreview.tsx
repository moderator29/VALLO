"use client";

import { useState } from "react";
import type { Locale } from "@vallo/i18n/core";
import { MoneyLockGroup } from "@/app/(app)/settings/MoneyLockGroup";
import type { MoneyCredentialList } from "@/lib/security/money-step-up";

/**
 * The money lock group with this phone's own record staged, so the three
 * honest states can be drawn in a sandbox with no session.
 *
 * WHY THE RECORD HAS TO BE STAGED. Which state the screen is in is not a
 * server fact: it is the account's keys (`stepUpStatus`, which answers null
 * with no session) crossed with this phone's own record of the keys it made
 * (`lib/platform/device-keys.ts`, in local storage). With no session the
 * account half is unreadable and the phone's half decides, so writing the
 * record is the whole fixture.
 *
 * The write is in a `useState` initialiser rather than an effect because
 * `MoneyLockGroup` reads the record in ITS effect, and effects run after the
 * whole tree has rendered: an effect here would be one paint too late.
 */
export function MoneyLockPreview({
  list,
  locale,
  seed,
}: {
  list: MoneyCredentialList;
  locale: Locale;
  /** `has`: this phone made one of the keys. `none`: it is known to hold none. */
  seed: "has" | "none" | "unknown";
}) {
  useState(() => {
    try {
      if (seed === "unknown") window.localStorage.removeItem("vallo.device-keys");
      else if (seed === "has") window.localStorage.setItem("vallo.device-keys", JSON.stringify({ ids: ["preview-key"], fails: 0, none: false }));
      else window.localStorage.setItem("vallo.device-keys", JSON.stringify({ ids: [], fails: 2, none: true }));
    } catch {
      /* A sandbox with storage off draws the unknown state, which is a state. */
    }
    return seed;
  });
  return <MoneyLockGroup list={list} locale={locale} />;
}
