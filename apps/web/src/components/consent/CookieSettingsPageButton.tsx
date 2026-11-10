"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useCookieSheet } from "./use-cookie-sheet";

/** The button on the Cookies page that opens the choice sheet. */
export function CookieSettingsPageButton({ children }: { children: ReactNode }) {
  const { open, sheet } = useCookieSheet();
  return (
    <>
      <Button size="md" onClick={open} aria-haspopup="dialog" data-testid="cookies-page-settings">
        {children}
      </Button>
      {sheet}
    </>
  );
}
