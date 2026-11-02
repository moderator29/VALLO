"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { panelClass } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { dojahCheckStatus, startDojahCheck, type DojahStatus } from "@/lib/identity/dojah-actions";
import { feedback } from "@/lib/ui/feedback";

/**
 * THE SELFIE CHECK ON /verification (Dojah EasyOnboard).
 *
 * The flow runs in a full-page sheet as a frame on identity.dojah.io (the
 * camera is delegated to that origin and no other). The screen never decides
 * anything: it polls the check row that the signed webhook writes, every few
 * seconds while the sheet is open and for two minutes after it closes, and
 * says what the row says.
 *
 * A confirmed person sees nothing here at all: the page's path already says
 * the identity step is done.
 */

const POLL_MS = 4000;
const AFTER_CLOSE_MS = 120_000;
const SETTLED: ReadonlySet<DojahStatus> = new Set(["passed", "approved", "verified", "review", "refused", "retry", "abandoned"]);

export function DojahPanel({
  copy,
  initial,
  initialNote,
}: {
  copy: Dictionary["trustVisible"]["dojah"];
  initial: DojahStatus;
  initialNote: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<DojahStatus>(initial);
  const [note, setNote] = useState<string | null>(initialNote);
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pollUntil = useRef(0);

  const poll = useCallback(async () => {
    try {
      const result = await dojahCheckStatus();
      if (!result.ok) return;
      setStatus(result.data.status);
      setNote(result.data.note);
      if (result.data.status === "passed" || result.data.status === "approved" || result.data.status === "verified") {
        feedback("success");
        pollUntil.current = 0;
        setOpen(false);
        router.refresh();
      } else if (SETTLED.has(result.data.status) && !open) {
        pollUntil.current = 0;
      }
    } catch {
      /* A missed poll is retried by the next one. */
    }
  }, [open, router]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (open || Date.now() < pollUntil.current) void poll();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [open, poll]);

  function begin() {
    setMessage(null);
    start(async () => {
      try {
        const result = await startDojahCheck();
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        if ("url" in result.data) {
          setUrl(result.data.url);
          setStatus("opened");
          setOpen(true);
          return;
        }
        const s = result.data.status;
        if (s === "verified") {
          setStatus("verified");
          router.refresh();
        } else if (s === "in_review") setStatus("review");
        else setMessage(s === "limit" ? copy.limit : copy.closed);
      } catch {
        setMessage(copy.failed);
      }
    });
  }

  if (status === "verified" || status === "passed" || status === "approved") {
    return (
      <p role="status" className={panelClass({ className: "mb-block p-card nf-body-sm text-[var(--nf-content-primary)]" })} data-testid="dojah-done">
        {copy.passed}
      </p>
    );
  }

  const line =
    status === "waiting" || (status === "opened" && url && !open)
      ? copy.waiting
      : status === "review"
        ? copy.review
        : status === "retry"
          ? copy.retry
          : status === "abandoned"
            ? copy.abandoned
            : status === "refused"
              ? copy.refused.replace("{note}", note ?? "")
              : null;
  const canStart = status !== "review" && status !== "waiting";

  return (
    <section className={panelClass({ className: "mb-block grid gap-md p-card" })} aria-label={copy.title} data-testid="dojah-panel">
      <h2 className="nf-body font-semibold text-[var(--nf-content-primary)]">{copy.title}</h2>
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.lede}</p>
      {line && (
        <p role="status" className="nf-body-sm text-[var(--nf-content-primary)]" data-testid="dojah-status">
          {line}
        </p>
      )}
      {canStart && (
        <Button type="button" variant="primary" full loading={pending} onClick={begin} data-testid="dojah-start">
          {pending ? copy.opening : status === "none" || status === "opened" ? copy.start : copy.again}
        </Button>
      )}
      {message && (
        <p role="alert" className="nf-body-sm text-[var(--nf-state-error)]">
          {message}
        </p>
      )}
      <p className="nf-caption text-[var(--nf-content-muted)]">{copy.privacy}</p>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            pollUntil.current = Date.now() + AFTER_CLOSE_MS;
            void poll();
          }
        }}
        title={copy.frameTitle}
        closeLabel={copy.close}
        fullPage
        testId="dojah-sheet"
      >
        {url && open ? (
          <iframe
            src={url}
            title={copy.frameTitle}
            allow="camera; geolocation"
            className="block h-[min(80dvh,46rem)] w-full rounded-[var(--nf-radius-card)] border-0"
            data-testid="dojah-frame"
          />
        ) : null}
      </Sheet>
    </section>
  );
}
