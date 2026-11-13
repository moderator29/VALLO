"use client";

import { useCopyFlash } from "@/lib/ui/use-copy";
import type { Dictionary } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
/* C12: `nf-pd-card` lives in the public doors sheet, which left `globals.css`. */
import "@/app/css/public-doors.css";

/** A5. The member's invite link: copy it, or send it on WhatsApp. */
export function InviteShare({ copy, url, code }: { copy: Dictionary["publicDoors"]["invite"]; url: string; code: string }) {
  const [copied, copyUrl] = useCopyFlash(2400);
  const text = copy.shareText.replace("{url}", url);
  return (
    <div className="grid gap-sm">
      <div className="nf-pd-card">
        <p className="nf-section-label">{copy.linkLabel}</p>
        {/* Stays `overflow-wrap: anywhere` on purpose: an invite link is one token and must wrap inside the card (13 November 2026; the gate is app/css/overflow-wrap.test.ts). */}
        <p className="nf-numeric [overflow-wrap:anywhere] font-semibold text-[var(--nf-content-primary)]" data-testid="invite-url">
          {url}
        </p>
        <p className="nf-caption text-[var(--nf-content-muted)]">
          {copy.codeLabel}: <span className="nf-numeric font-semibold">{code}</span>
        </p>
      </div>
      <Button
        type="button"
        variant="primary"
        size="lg"
        full
        leadingIcon="link"
        done={copied}
        onClick={() => void copyUrl(url, "link")}
      >
        {copied ? copy.copied : copy.copy}
      </Button>
      <ButtonLink
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        variant="secondary"
        size="lg"
        full
        leadingIcon="share"
        target="_blank"
        rel="noopener noreferrer"
      >
        {copy.whatsapp}
      </ButtonLink>
    </div>
  );
}
