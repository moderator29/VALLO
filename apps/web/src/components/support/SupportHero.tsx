"use client";

import type { Dictionary } from "@vallo/i18n/core";
import { useState } from "react";
import Link from "next/link";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SupportChat } from "@/components/app/account/SupportChat";
import { Icon3D } from "@/components/ui/Icon3D";
import { withNext } from "@/lib/auth/next-link";

/** The hero's words, from the dictionary through the page (W13: never a client dictionary read). */
export type SupportHomeCopy = Dictionary["experienceInbox"]["support"]["home"];

/**
 * The top of the support home.
 *
 * It follows the reader's theme (the founder, 29 September 2026: in light
 * mode it is WHITE, dark text and the blue action, not the navy island it
 * was). At night it is a raised navy card on the night canvas; in daylight a
 * white card on a soft hairline with a blue drop (light.css, "THE SUPPORT
 * HERO"), its round actions carrying blue glyphs.
 *
 * One primary action: Ask a question, which opens the AI helper in the shared
 * sheet. The helper answers from the help articles and hands over to a person
 * with the conversation attached. The round actions under it are the other
 * doors, quieter on purpose: report a problem, write to the team, the help
 * centre.
 */
export function SupportHero({
  greeting,
  promise,
  aiConsented,
  signedIn,
  assistantCopy,
  copy,
}: {
  greeting: string;
  copy: SupportHomeCopy;
  /** Handed to the helper so it never reads a client dictionary. */
  assistantCopy?: Dictionary["experienceInbox"]["assistant"];
  promise: string;
  aiConsented: boolean;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-labelledby="support-hero-title"
      className="nf-support-hero relative overflow-hidden rounded-xl border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-primary)] p-card"
      data-testid="support-hero"
    >
      <div className="flex items-start gap-group">
        <div className="min-w-0 flex-1">
          <h1
            id="support-hero-title"
            className="nf-h2 break-words text-[var(--nf-content-primary)]"
            data-testid="support-greeting"
          >
            {greeting}
          </h1>
          <p className="nf-body-sm mt-row text-[var(--nf-content-secondary)]">{promise}</p>
        </div>
        <span className="grid size-16 shrink-0 place-items-center" aria-hidden="true" data-art="support">
          <Icon3D name="support" size={64} />
        </span>
      </div>

      <Button
        variant="primary"
        size="lg"
        full
        className="mt-block"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-testid="support-ask"
      >
        {copy.ask}
      </Button>

      <ul className="mt-block grid grid-cols-3 gap-xs" aria-label={copy.otherWays}>
        <RoundAction
          href={signedIn ? "/support/new?kind=problem" : withNext("/sign-in", "/support/new?kind=problem")}
          icon="flag"
          label={copy.reportProblem}
          testId="support-report"
        />
        <RoundAction
          href={signedIn ? "/support/new" : "/contact"}
          icon="mail"
          label={copy.writeToUs}
          testId="support-write"
        />
        <RoundAction href="/help" icon="info" label={copy.helpCentre} testId="support-help-centre" />
      </ul>

      <Sheet open={open} onOpenChange={setOpen} title={copy.ask} closeLabel={copy.close} detents={[0.92]}>
        <SupportChat aiConsented={aiConsented} signedIn={signedIn} defaultOpen embedded assistantCopy={assistantCopy} />
      </Sheet>
    </section>
  );
}

function RoundAction({ href, icon, label, testId }: { href: string; icon: UiIconName; label: string; testId: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-11 flex-col items-center gap-row text-center"
        data-testid={testId}
      >
        <span className="nf-support-hero__round nf-glass grid h-14 w-14 place-items-center rounded-full border border-[var(--nf-border-subtle)] text-[var(--nf-content-primary)]">
          <UiIcon name={icon} size={24} />
        </span>
        <span className="nf-caption font-normal leading-tight text-[var(--nf-content-secondary)]">{label}</span>
      </Link>
    </li>
  );
}
