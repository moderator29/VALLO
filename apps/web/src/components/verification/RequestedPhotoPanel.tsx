"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SelfieCapture } from "./SelfieCapture";
import type { KycSelfie } from "./kyc";
import type { KycCopy } from "./KycFlow";
import { banner } from "@/lib/ui/toast";

/**
 * A REVIEWER ASKED FOR ONE MORE PHOTO (2 November 2026).
 *
 * Never a step of the verification flow. When a reviewer cannot confirm
 * someone's ID or selfie, they ask, in their own words, for a selfie holding
 * the ID; the person is notified and finds the request here, at the top of
 * /verification, with the same camera as the selfie step and one button that
 * sends the photo back. The reviewer's words are shown exactly as written.
 */
export function RequestedPhotoPanel({
  copy,
  requestId,
  message,
  submit,
}: {
  copy: KycCopy;
  requestId: string;
  message: string;
  submit: (input: { requestId: string; path: string }) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const r = copy.request;
  const router = useRouter();
  const [photo, setPhoto] = useState<KycSelfie | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const [batchId] = useState(() => {
    try {
      return `request-${crypto.randomUUID()}`;
    } catch {
      return `request-${Date.now()}`;
    }
  });

  if (sent) {
    return (
      <p role="status" className="nf-panel nf-panel--card mb-block block p-md text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-primary)]" data-testid="request-sent">
        {r.sent}
      </p>
    );
  }

  function send() {
    if (!photo) return;
    start(async () => {
      try {
        const result = await submit({ requestId, path: photo.path });
        if (!result.ok) {
          banner.error(result.message);
          return;
        }
        setSent(true);
        /* The panel keeps the record; the banner says it (founder, 7 November 2026). */
        banner.success(r.sent, { "data-testid": "banner-request-sent" });
        router.refresh();
      } catch {
        banner.error(r.failed);
      }
    });
  }

  return (
    <section className="mb-block grid gap-md" aria-label={r.title} data-testid="requested-photo">
      <div className="nf-panel nf-panel--card block p-md sm:p-lg">
        <h2 className="text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">{r.title}</h2>
        <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">{r.from}</p>
        <blockquote className="mt-xs border-l-2 border-[var(--nf-border-subtle)] pl-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-primary)]" data-testid="request-message">
          {message}
        </blockquote>
      </div>
      <SelfieCapture
        copy={copy}
        batchId={batchId}
        selfie={photo}
        onChange={setPhoto}
        fileStem="selfie-with-id"
        words={{ title: r.cameraTitle, tips: r.tips }}
      />
      <Button variant="primary" size="lg" full loading={pending} disabled={!photo} onClick={send} data-testid="request-send">
        {pending ? r.sending : r.send}
      </Button>
    </section>
  );
}
