"use client";

import type { ReactNode } from "react";

import { useKeptCopy } from "@/components/app/offline/KeptPriceNote";

/**
 * Drawn only when the page is fresh. On the phone's kept copy (offline, or a
 * copy not yet replaced) a room's "Available now" or "From 12 Jan" is not
 * claimed: it may have been taken since the copy was made.
 */
export function FreshOnly({ children }: { children: ReactNode }) {
  const stale = useKeptCopy();
  return stale ? null : <>{children}</>;
}
