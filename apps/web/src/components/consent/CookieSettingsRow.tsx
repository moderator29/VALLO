"use client";

import { RowButton } from "@/components/app/account/rows";
import { useCookieSheet } from "./use-cookie-sheet";

/** The Settings row that opens the cookie choice sheet (Privacy and security). */
export function CookieSettingsRow({ label, sub }: { label: string; sub: string }) {
  const { open, sheet } = useCookieSheet();
  return (
    <>
      <RowButton icon="shield-lock" label={label} sub={sub} onClick={open} testId="settings-cookies-row" />
      {sheet}
    </>
  );
}
