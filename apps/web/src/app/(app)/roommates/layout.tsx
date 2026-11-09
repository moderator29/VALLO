import type { ReactNode } from "react";
import { getDictionary } from "@vallo/i18n";

import { CopyScope } from "@/lib/i18n/copy-scope";
import { copyScopeOf } from "@/lib/i18n/copy-scope-of";

import "./roommates.css";

/**
 * Vallo Roommates' own sheet and words for every page under /roommates: the
 * client islands read `useScopedCopy("roommates")` from this scope.
 */
export default function RoommatesLayout({ children }: { children: ReactNode }) {
  return <CopyScope copy={copyScopeOf(getDictionary("en"), ["roommates"])}>{children}</CopyScope>;
}
