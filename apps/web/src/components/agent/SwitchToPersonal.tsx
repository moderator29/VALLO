"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { writeModeCookie } from "@/lib/mode.constants";
import { UiIcon } from "@/design-system/icons/UiIcon";

/**
 * BACK TO THE PERSONAL SIDE, FROM THE TOP OF THE DASHBOARD (the founder, 15
 * November 2026: "opposite where the Dashboard text is, put a button that says
 * switch to personal account, so it takes users back").
 *
 * The same switch the rail and the drawer already offer (`ModeSwitcher`):
 * the mode cookie, then the personal home. It is put where a lister looks
 * first, because the only ways back were inside the drawer.
 *
 * Two lines, "Switch to" over "personal account", so the whole sentence fits
 * beside a large title at 390px instead of dropping under it.
 */
export function SwitchToPersonal({ lead, main, aria }: { lead: string; main: string; aria: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="nf-switch-personal"
      aria-label={aria}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() => {
        writeModeCookie("personal");
        startTransition(() => {
          router.push("/home");
          router.refresh();
        });
      }}
      data-testid="switch-to-personal"
    >
      <span className="nf-switch-personal__mark" aria-hidden="true">
        <UiIcon name="user" size={18} />
      </span>
      <span className="nf-switch-personal__words" aria-hidden="true">
        <span className="nf-switch-personal__lead">{lead}</span>
        <span className="nf-switch-personal__main">{main}</span>
      </span>
    </button>
  );
}
