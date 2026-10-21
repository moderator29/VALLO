"use client";

import { useRootFlag } from "@/lib/ui/root-flag";

/**
 * Renders nothing; holds `data-<name>` on <html> while mounted, so a server
 * component (a shell, a layout) can raise a root flag without becoming a
 * client component. See `lib/ui/root-flag.ts` for why root flags replace
 * `:root:has(...)`.
 */
export function RootFlag({ name }: { name: string }) {
  useRootFlag(name);
  return null;
}
