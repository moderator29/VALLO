"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { State } from "@/components/ui/State";
import { answerBrief } from "@/lib/briefs/actions";
import { briefLine } from "@/lib/briefs/brief";
import type { DeskBrief } from "@/lib/briefs/queries";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * V-95: THE BRIEFS A LISTER CAN ANSWER, on the inbox behind its Briefs
 * filter. A brief is answered only by choosing one of the lister's own
 * published homes; there is no text box. States: could not be read, none,
 * the list, sending, sent, refused in words.
 */

type Copy = Dictionary["frontDoor"]["briefs"];

function BriefRow({ brief, homes, copy, locale }: { brief: DeskBrief; homes: { id: string; title: string }[]; copy: Copy; locale: Locale }) {
  const router = useRouter();
  const [choice, setChoice] = useState(homes[0]?.id ?? "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  const full = brief.answered >= 3;
  return (
    <li className="nf-panel nf-panel--card p-card-sm">
      <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">{briefLine(brief, copy, locale)}</p>
      <p className="mt-3xs nf-caption text-[var(--nf-content-muted)]">{copy.answered.replace("{count}", String(brief.answered))}</p>
      {!full && homes.length > 0 && (
        <div className="mt-row flex flex-col gap-row">
          <label className="block">
            <span className="nf-label">{copy.answerWith}</span>
            <select className="nf-field" value={choice} onChange={(e) => setChoice(e.target.value)}>
              {homes.map((home) => (
                <option key={home.id} value={home.id}>
                  {home.title}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="primary"
            loading={pending}
            disabled={choice === ""}
            onClick={() => {
              setError(null);
              start(async () => {
                try {
                  const result = await answerBrief({ briefId: brief.id, listingId: choice });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setSent(true);
                  router.refresh();
                } catch (error) {
                  if (!tapFailedOffline(error)) throw error;
                }
              });
            }}
          >
            {pending ? copy.sending : copy.send}
          </Button>
        </div>
      )}
      {sent && <p className="mt-inline nf-body-sm text-[var(--nf-content-secondary)]" role="status">{copy.sent}</p>}
      {error && (
        <p className="mt-inline nf-body-sm font-semibold text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

export function BriefsDesk({
  briefs,
  homes,
  copy,
  locale,
}: {
  briefs: DeskBrief[] | null;
  /** The lister's published homes; null when they could not be read. */
  homes: { id: string; title: string }[] | null;
  copy: Copy;
  locale: Locale;
}) {
  return (
    <section className="mt-md" aria-labelledby="briefs-desk-title" data-testid="briefs-desk">
      <h2 id="briefs-desk-title" className="nf-h4 text-[var(--nf-content-primary)]">
        {copy.deskTitle}
      </h2>
      <p className="mt-inline nf-body-sm text-[var(--nf-content-secondary)]">{copy.deskNote}</p>
      {briefs === null || homes === null ? (
        <p className="mt-group nf-body-sm text-[var(--nf-content-muted)]">{copy.unreachable}</p>
      ) : briefs.length === 0 ? (
        <State compact kind="empty" icon="home-search" title={copy.deskEmpty} className="mt-group" />
      ) : (
        <ul className="mt-group flex flex-col gap-row">
          {briefs.map((brief) => (
            <BriefRow key={brief.id} brief={brief} homes={homes} copy={copy} locale={locale} />
          ))}
        </ul>
      )}
    </section>
  );
}
