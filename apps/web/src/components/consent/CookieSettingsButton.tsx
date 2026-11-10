"use client";

import type { ReactNode } from "react";
import { useCookieSheet } from "./use-cookie-sheet";

/**
 * "Cookie settings": the footer link and the Cookies page button. It ships no
 * copy; see `useCookieSheet`.
 */
export function CookieSettingsButton({ className, children, "data-testid": testId }: { className?: string; children: ReactNode; "data-testid"?: string }) {
  const { open, sheet } = useCookieSheet();
  return (
    <>
      <button type="button" className={className} onClick={open} aria-haspopup="dialog" data-testid={testId}>
        {children}
      </button>
      {sheet}
    </>
  );
}
