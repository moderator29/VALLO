import type { ReactNode } from "react";
import { getDictionary } from "@vallo/i18n";

import { isFeatureEnabled } from "@/lib/flags";
import { CopyScope } from "@/lib/i18n/copy-scope";
import { copyScopeOf } from "@/lib/i18n/copy-scope-of";

import { RoommatesSubNav } from "./_parts/SubNav";

import "./roommates.css";

/**
 * Vallo Roommates' own sheet and words for every page under /roommates: the
 * client islands read `useScopedCopy("roommates")` from this scope.
 */
export default async function RoommatesLayout({ children }: { children: ReactNode }) {
  /* The `roommates` switch (fails open): off, the area says so once, plainly. */
  if (!(await isFeatureEnabled("roommates"))) {
    return (
      <div className="nf-rmp" data-testid="roommates-switched-off">
        <p className="nf-rm-panel__sub">{getDictionary("en").roommates.notOpen}</p>
      </div>
    );
  }
  return (
    <CopyScope copy={copyScopeOf(getDictionary("en"), ["roommates"])}>
      <RoommatesSubNav />
      {children}
    </CopyScope>
  );
}
