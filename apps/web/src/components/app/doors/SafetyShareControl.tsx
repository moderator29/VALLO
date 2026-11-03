"use client";

import { useState } from "react";
import { formatDate, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { createSafetyShare, markSafetyDone, stopSafetyShare } from "@/lib/doors/safety-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/** The first segment of the trusted contact's page (`app/safe/[token]`). */
const SAFE_DOOR = "safe";

type ShareCopy = Dictionary["trustDoors"]["safetyShare"];

type Phase =
  | { kind: "idle" }
  | { kind: "made"; url: string; text: string; copied: boolean }
  | { kind: "shared" }
  | { kind: "done" }
  | { kind: "stopped" };

/**
 * V-62 on a confirmed inspection: "Tell someone where I am going".
 *
 * One tap makes a link and hands it to the phone's own share sheet, so the
 * renter sends it from their own WhatsApp or SMS to whoever they choose; Vallo
 * never messages the contact. Where there is no share sheet the link is copied
 * instead and shown, so it can be pasted. After that the control becomes
 * "I'm done", which updates the contact's page.
 */
export function SafetyShareControl({
  inspectionId,
  title,
  slotAt,
  locale,
  copy,
  initial,
}: {
  inspectionId: string;
  /** The listing's title as the renter already sees it on this page. */
  title: string | null;
  slotAt: string;
  locale: Locale;
  copy: ShareCopy;
  /** Whether this inspection is already shared and checked in, read on the server. */
  initial: "none" | "shared" | "done";
}) {
  const [phase, setPhase] = useState<Phase>(
    initial === "done" ? { kind: "done" } : initial === "shared" ? { kind: "shared" } : { kind: "idle" },
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  const when = formatDate(new Date(slotAt), locale, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });

  const make = () => {
    setError(null);
    start(async () => {
      try {
        const result = await createSafetyShare({ inspectionId });
        if (!result.ok) {
          setError(copy.failed);
          return;
        }
        const url = new URL(`/${SAFE_DOOR}/${result.data.token}`, window.location.origin).toString();
        const area = result.data.area ?? "";
        const text = result.data.firstName
          ? copy.shareText.replace("{name}", result.data.firstName).replace("{area}", area)
          : copy.shareTextNoName.replace("{area}", area);
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
          try {
            await navigator.share({ title: copy.shareTitle, text, url });
            setPhase({ kind: "shared" });
            return;
          } catch {
            /* Dismissed or refused: fall through to the link on screen. */
          }
        }
        let copied = false;
        try {
          await navigator.clipboard.writeText(`${text} ${url}`);
          copied = true;
        } catch {
          copied = false;
        }
        setPhase({ kind: "made", url, text, copied });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const done = () => {
    setError(null);
    start(async () => {
      try {
        const result = await markSafetyDone({ inspectionId });
        if (!result.ok) {
          setError(copy.failed);
          return;
        }
        setPhase({ kind: "done" });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const stop = () => {
    setError(null);
    start(async () => {
      try {
        const result = await stopSafetyShare({ inspectionId });
        if (!result.ok) {
          setError(copy.failed);
          return;
        }
        setPhase({ kind: "stopped" });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const stopButton = (
    <Button type="button" variant="ghost" size="md" full className="mt-xs" disabled={pending} onClick={stop}>
      {copy.stop}
    </Button>
  );

  return (
    <div className="nf-panel nf-panel--card p-panel" data-testid="safety-share">
      <p className="flex items-center gap-xs text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
        <UiIcon name="share" size={20} className="shrink-0 text-[var(--nf-content-secondary)]" />
        <span className="min-w-0 break-words">{title ? `${title} · ${when}` : when}</span>
      </p>

      {phase.kind === "idle" && (
        <>
          <p className="mt-xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
            {copy.controlHint}
          </p>
          <Button type="button" variant="secondary" size="md" full className="mt-sm" loading={pending} onClick={make}>
            {copy.control}
          </Button>
        </>
      )}

      {phase.kind === "made" && (
        <div className="mt-sm">
          <p className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">{copy.linkLabel}</p>
          <p className="mt-2xs select-all break-all text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
            {phase.url}
          </p>
          <p className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]" aria-live="polite">
            {phase.copied ? copy.copied : ""}
          </p>
          <div className="mt-sm grid gap-xs">
            <Button
              type="button"
              variant="secondary"
              size="md"
              full
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(`${phase.text} ${phase.url}`)
                  .then(() => setPhase({ ...phase, copied: true }))
                  .catch(() => undefined);
              }}
            >
              {copy.copy}
            </Button>
            <Button type="button" variant="primary" size="md" full loading={pending} onClick={done}>
              {copy.done}
            </Button>
          </div>
          <p className="mt-xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
            {copy.doneHint}
          </p>
          {stopButton}
        </div>
      )}

      {phase.kind === "shared" && (
        <div className="mt-sm">
          <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">{copy.shared}</p>
          <Button type="button" variant="primary" size="md" full className="mt-sm" loading={pending} onClick={done}>
            {copy.done}
          </Button>
          <p className="mt-xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
            {copy.doneHint}
          </p>
          {stopButton}
        </div>
      )}

      {phase.kind === "stopped" && (
        <p className="mt-sm text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]" role="status">
          {copy.stopped}
        </p>
      )}

      {phase.kind === "done" && (
        <div className="mt-sm">
          <p className="flex items-center gap-xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-state-success)]" role="status">
            <UiIcon name="verified" size={16} className="shrink-0" />
            {copy.doneThanks}
          </p>
          {/* The page still shows "done" to whoever holds the link until it
              expires; the renter can take it down now. */}
          {stopButton}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
