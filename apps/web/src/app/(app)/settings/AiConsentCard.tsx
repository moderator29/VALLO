"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AiConsentCopy } from "@/components/app/account/settings-copy";
import { RowButton, RowLink, SettingsGroup } from "@/components/app/account/rows";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { withdrawAiConsent } from "@/lib/ai/consent-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * STORE-07: the AI disclosure a person agreed to in the assistant, stated on
 * the privacy screen with a way to take it back.
 *
 * Agreed, the row opens a confirm sheet; withdrawing clears this device's
 * cookie and the account's record (`withdrawAiConsent`), and the server tree
 * is refreshed so the assistant and the support chat mount asking again.
 * Not agreed, the row leads to the assistant, which asks before the first
 * question as it always has: agreement is given there, next to what it
 * covers, and never from a settings switch.
 */
export function AiConsentCard({ t, consented }: { t: AiConsentCopy; consented: boolean }) {
  const copy = t.settings.aiConsent;
  const router = useRouter();
  const [withdrawn, setWithdrawn] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useSafeTransition();
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const agreed = consented && !withdrawn;

  const withdraw = () => {
    startTransition(async () => {
      try {
        const result = await withdrawAiConsent().catch(() => ({ ok: false }));
        if (!result.ok) {
          banner.error(copy.failed, { retry: withdraw });
          return;
        }
        setWithdrawn(true);
        setAsking(false);
        banner.success(copy.withdrawn, { "data-testid": "settings-ai-consent-withdrawn" });
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <SettingsGroup
      label={copy.label}
      note={agreed ? copy.note : undefined}
    >
      {agreed ? (
        <RowButton
          icon="bot"
          label={copy.row}
          sub={copy.subOn}
          value={copy.on}
          onClick={() => setAsking(true)}
          testId="settings-ai-consent-row"
        />
      ) : (
        <RowLink
          href="/assistant"
          icon="bot"
          label={copy.row}
          sub={copy.subOff}
          value={copy.off}
          testId="settings-ai-consent-row"
        />
      )}
      <Sheet
        open={asking}
        onOpenChange={(next) => {
          if (!next && !pending) setAsking(false);
        }}
        title={copy.confirmTitle}
        closeLabel={copy.keep}
        initialFocus={bodyRef}
        testId="settings-ai-consent-sheet"
        footer={
          <div className="grid gap-sm sm:grid-cols-2">
            <Button variant="primary" full onClick={() => setAsking(false)} disabled={pending}>
              {copy.keep}
            </Button>
            <Button
              variant="dangerQuiet"
              full
              onClick={withdraw}
              loading={pending}
              data-testid="settings-ai-consent-withdraw"
            >
              {copy.confirm}
            </Button>
          </div>
        }
      >
        <p
          ref={bodyRef}
          tabIndex={-1}
          className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)] outline-none"
        >
          {copy.confirmBody}
        </p>
      </Sheet>
    </SettingsGroup>
  );
}
