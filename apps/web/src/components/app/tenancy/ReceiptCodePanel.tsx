"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { formatReceiptCode } from "@/lib/receipts/code";
import { createReceiptCode, revokeReceiptCode } from "@/lib/receipts/actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * V-55. The tenant's proof of payment: a code anybody can check at /r.
 *
 * Share goes through the device's own share sheet (the one exit the rules
 * allow), with the copy link as the fallback. The shared text carries the
 * link and nothing else: no amount, no address, no name. Whoever opens it
 * sees what the check page decides to show, which is area-level only.
 */
export function ReceiptCodePanel({
  tenancyId,
  live,
  copy,
}: {
  tenancyId: string;
  /** The live code's id and last two characters; the code itself is never stored. */
  live: { id: string; hint: string } | null;
  copy: Dictionary["afterTheGate"]["receipt"];
}) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [note, setNote] = useState<string | null>(null);
  // The code as minted, held only in this page: it is shown once.
  const [fresh, setFresh] = useState<string | null>(null);
  const link = fresh ? `${typeof window === "undefined" ? "" : window.location.origin}/r/${formatReceiptCode(fresh)}` : "";

  function run(work: () => Promise<{ ok: boolean; error?: string }>, done?: string) {
    setNote(null);
    start(async () => {
      const result = await work();
      if (!result.ok) {
        setNote(result.error ?? copy.failed);
        return;
      }
      if (done) setNote(done);
      router.refresh();
    });
  }

  return (
    /* `tenancy-proof` is where the Share tile on the money sheet lands: the
       receipt is shared as a code anyone can check at /r, never as a file. */
    <div id="tenancy-proof" className="nf-panel nf-panel--card block scroll-mt-24 p-md" data-testid="tenancy-receipt">
      <h3 className="nf-h4">{copy.heading}</h3>
      <p className="nf-body-sm mt-xs text-[var(--nf-content-secondary)]">{copy.lede}</p>
      {fresh ? (
        <div className="mt-md grid gap-sm">
          <p className="nf-caption">{copy.code}</p>
          <p className="nf-h3 nf-numeric tracking-wide">{formatReceiptCode(fresh)}</p>
          <p className="nf-caption">{copy.onlyOnce}</p>
          <div className="grid gap-sm sm:grid-cols-2">
            <Button
              variant="primary"
              full
              onClick={async () => {
                const text = copy.shareText.replace("{link}", link);
                try {
                  if (navigator.share) {
                    await navigator.share({ text, url: link });
                    return;
                  }
                } catch {
                  return;
                }
                try {
                  await navigator.clipboard.writeText(link);
                  setNote(copy.copied);
                } catch {
                  setNote(copy.failed);
                }
              }}
            >
              {copy.share}
            </Button>
            <Button
              variant="secondary"
              full
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setNote(copy.copied);
                } catch {
                  setNote(copy.failed);
                }
              }}
            >
              {copy.copy}
            </Button>
          </div>
          <Button
            variant="ghost"
            full
            disabled={pending}
            onClick={() => {
              setFresh(null);
              if (live) run(() => revokeReceiptCode({ tenancyId, codeId: live.id }), copy.revoked);
            }}
          >
            {copy.revoke}
          </Button>
        </div>
      ) : (
        <div className="mt-md grid gap-sm">
          {live && <p className="nf-body-sm">{copy.liveHint.replace("{hint}", live.hint)}</p>}
          <Button
            variant="secondary"
            full
            disabled={pending}
            onClick={() => {
              setNote(null);
              start(async () => {
                const result = await createReceiptCode({ tenancyId });
                if (!result.ok) {
                  setNote(result.error ?? copy.failed);
                  return;
                }
                setFresh(result.data.code);
                router.refresh();
              });
            }}
          >
            {live ? copy.makeNew : copy.make}
          </Button>
          {live && (
            <Button
              variant="ghost"
              full
              disabled={pending}
              onClick={() => run(() => revokeReceiptCode({ tenancyId, codeId: live.id }), copy.revoked)}
            >
              {copy.revoke}
            </Button>
          )}
        </div>
      )}
      {note && (
        <p className="nf-caption mt-sm" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
