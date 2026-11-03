"use client";

import { useState } from "react";
import { formatMoney, type Locale } from "@vallo/i18n/core";
import { pauseRelease, resolveHeldPayment, resumeRelease } from "@/lib/admin/agreements-actions";
import { signalWords, type WatchRow } from "@/lib/admin/watch-list";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * D68d: the watch list over live deals, riskiest first. A deal waiting for a
 * decision is decided in the queue below; a payment held by the provider can
 * have its release paused here while Vallo looks, which the database enforces.
 */
export function WatchList({ rows, locale }: { rows: WatchRow[]; locale: Locale }) {
  if (rows.length === 0) {
    return <p className="nf-body text-[var(--nf-content-secondary)]">No live deals to watch.</p>;
  }
  return (
    <ul className="nf-admin-queue" data-testid="watch-list">
      {rows.map((row) => (
        <WatchItem key={row.agreementId} row={row} locale={locale} />
      ))}
    </ul>
  );
}

function WatchItem({ row, locale }: { row: WatchRow; locale: Locale }) {
  const [pending, start] = useSafeTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const held = row.arrangementId !== null && ["protected", "release_requested", "payment_processing"].includes(row.heldStatus ?? "");
  /* A person decides a held payment (refund or dispute): only once the
     partner has said it holds the money. */
  const decidable = row.arrangementId !== null && ["protected", "release_requested", "disputed"].includes(row.heldStatus ?? "");
  const [note, setNote] = useState("");
  const [resolveMessage, setResolveMessage] = useState<string | null>(null);
  return (
    <li className="nf-admin-queue-row" data-risk={row.riskScore}>
      <p className="font-semibold">
        <a href={`/agreements/${row.agreementId}`}>
          {row.kind === "rent" ? "Rent" : "Stay"} · {formatMoney(row.amountMinor, locale)}
        </a>{" "}
        <span className="text-[var(--nf-content-secondary)]">
          · {row.rail ?? "no rail"} · {row.needsDecision ? "waiting for a decision" : row.heldStatus ? `held: ${row.heldStatus}` : row.agreementStatus}
          {row.releasePaused ? " · release paused" : ""}
        </span>
      </p>
      {row.reasons.length > 0 ? (
        <ul className="mt-inline grid gap-inline">
          {row.reasons.map((r) => (
            <li key={r} className="nf-caption">
              {signalWords(r)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="nf-caption text-[var(--nf-content-secondary)]">No risk signal.</p>
      )}
      {held && row.arrangementId && (
        <div className="mt-row flex flex-wrap items-center gap-sm">
          {row.releasePaused ? (
            <button
              type="button"
              className="nf-btn nf-btn--glass nf-btn--sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    const r = await resumeRelease({ arrangementId: row.arrangementId! });
                    setMessage(r.ok ? "Release resumed." : r.error);
                  } catch (error) {
                    if (!tapFailedOffline(error)) throw error;
                  }
                })
              }
            >
              Resume release
            </button>
          ) : (
            <>
              <input
                aria-label="Why pause the release"
                className="nf-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why, in a sentence"
              />
              <button
                type="button"
                className="nf-btn nf-btn--glass nf-btn--sm"
                disabled={pending || reason.trim().length < 10}
                onClick={() =>
                  start(async () => {
                    try {
                      const r = await pauseRelease({ arrangementId: row.arrangementId!, reason });
                      setMessage(r.ok ? "Release paused. The money stays held." : r.error);
                    } catch (error) {
                      if (!tapFailedOffline(error)) throw error;
                    }
                  })
                }
              >
                Pause release
              </button>
            </>
          )}
          {message && (
            <span role="status" className="nf-caption">
              {message}
            </span>
          )}
        </div>
      )}
      {decidable && row.arrangementId && (
        <div className="mt-row flex flex-wrap items-center gap-sm" data-testid="watch-resolve">
          <input
            aria-label="Why refund or release this held payment"
            className="nf-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Your decision, in a sentence both parties read"
          />
          <button
            type="button"
            className="nf-btn nf-btn--glass nf-btn--sm"
            disabled={pending || note.trim().length < 10}
            onClick={() =>
              start(async () => {
                try {
                  const r = await resolveHeldPayment({ arrangementId: row.arrangementId!, outcome: "refund", note });
                  setResolveMessage(r.ok ? "Refund asked of the partner. It shows as refunded when the partner confirms." : r.error);
                } catch (error) {
                  if (!tapFailedOffline(error)) throw error;
                }
              })
            }
          >
            Refund to payer
          </button>
          <button
            type="button"
            className="nf-btn nf-btn--glass nf-btn--sm"
            disabled={pending || note.trim().length < 10}
            onClick={() =>
              start(async () => {
                try {
                  const r = await resolveHeldPayment({ arrangementId: row.arrangementId!, outcome: "release", note });
                  setResolveMessage(r.ok ? "Release asked of the partner. It shows as released when the partner confirms." : r.error);
                } catch (error) {
                  if (!tapFailedOffline(error)) throw error;
                }
              })
            }
          >
            Release to lister
          </button>
          {resolveMessage && (
            <span role="status" className="nf-caption">
              {resolveMessage}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
