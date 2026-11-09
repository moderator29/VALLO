"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { writeModeCookie, type Mode } from "@/lib/mode.constants";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";

/**
 * Mode switch control, matching the "Choose your mode" sheet in the reference.
 *
 * Writes the mode cookie and refreshes the server tree so the correct workspace
 * renders. Presented as a two-option picker rather than a silent toggle so the
 * difference between Personal and Agent is explicit every time, which the design
 * direction calls for.
 */
export function ModeSwitcher({
  t,
  current,
  variant = "menu",
}: {
  t: Dictionary;
  current: Mode;
  variant?: "menu" | "picker";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function choose(next: Mode) {
    writeModeCookie(next);
    startTransition(() => {
      router.push(next === "working" ? "/agent/dashboard" : "/home");
      router.refresh();
    });
  }

  const other: Mode = current === "working" ? "personal" : "working";

  // Compact control used inside a rail: a single row that flips to the other mode.
  if (variant === "menu") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => choose(other)}
        className="flex w-full items-center gap-sm rounded-md px-sm py-sm text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-secondary)] transition-colors hover:bg-[var(--nf-glass-fill)] hover:text-[var(--nf-content-primary)] disabled:opacity-60"
      >
        <UiIcon name={other === "working" ? "briefcase" : "user"} size={20} />
        <span className="flex-1 text-left leading-tight">
          {other === "working" ? t.agent.mode.switchToAgent : t.agent.mode.switchToPersonal}
          <span className="block text-[length:var(--nf-text-overline)] font-normal text-[var(--nf-content-muted)]">
            {t.agent.mode.manageSub}
          </span>
        </span>
      </button>
    );
  }

  // Full picker: the "Choose your mode" card.
  const options: { mode: Mode; icon: "user" | "briefcase"; label: string; desc: string }[] = [
    { mode: "personal", icon: "user", label: t.agent.mode.personal, desc: t.agent.mode.personalDesc },
    { mode: "working", icon: "briefcase", label: t.agent.mode.agent, desc: t.agent.mode.agentDesc },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="nf-chip"
      >
        <UiIcon name={current === "working" ? "briefcase" : "user"} size={16} />
        {current === "working" ? t.agent.mode.agent : t.agent.mode.personal}
      </button>

      {open && (
        <div className="nf-panel absolute right-0 top-full z-50 mt-xs block w-[19rem] p-sm">
          <p className="px-2xs pb-xs pt-2xs">
            <span className="block text-[length:var(--nf-text-body-sm)] font-semibold">{t.agent.mode.chooseTitle}</span>
            <span className="block text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
              {t.agent.mode.chooseSub}
            </span>
          </p>
          <ul className="space-y-xs">
            {options.map((o) => (
              <li key={o.mode}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => choose(o.mode)}
                  aria-current={o.mode === current ? "true" : undefined}
                  className={[
                    "nf-panel nf-panel--card nf-agent-mode-option flex w-full flex-row items-center gap-sm p-sm text-left disabled:opacity-60",
                  ].join(" ")}
                >
                  <IconPlate size="sm" tone={o.mode === current ? "brand" : "neutral"}>
                    <UiIcon name={o.icon} size={20} />
                  </IconPlate>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[length:var(--nf-text-body-sm)] font-semibold">{o.label}</span>
                    <span className="block text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                      {o.desc}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
