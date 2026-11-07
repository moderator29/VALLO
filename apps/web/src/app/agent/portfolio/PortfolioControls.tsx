"use client";

import { banner } from "@/lib/ui/toast";
import { useId, useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { withDone } from "@/lib/ui/success-moments";
import { awardMandate, inviteAgents, pitchForMandate, withdrawInvitation } from "@/lib/landlord/portfolio-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type Copy = Dictionary["landlord"]["portfolio"];

/** The owner invites verified agents to pitch for one unit. */
export function InviteForm({ listingId, place, copy }: { listingId: string; place: string; copy: Copy }) {
  const minId = useId();
  const maxId = useId();
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [pending, start] = useSafeTransition();
  const router = useRouter();

  return (
    <form
      className="mt-sm grid gap-xs"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          try {
            const result = await inviteAgents({ listingId, min, max });
            /* Said by the one banner at the top of the screen (Grade 1). When
               somebody was told, the portfolio's own moment says it instead. */
            if (result.ok) {
              if (result.data.told === 0) banner.info(copy.inviteSentNone);
              /* "Invitation sent" only when the database told somebody; the
                 portfolio checks the invitation is open on this unit before
                 it shows (arrival-moments.ts), and the form itself gives way
                 to the invitation as the page refreshes. */
              if (result.data.told > 0) {
                router.replace(withDone("/agent/portfolio", "agents-invited", { listing: listingId }), { scroll: false });
              }
              return;
            }
            banner.error(result.error === "band" ? copy.inviteBand : copy.inviteFailed);
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">{copy.inviteTitle}</p>
      <p className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
        {copy.inviteLede.replace("{place}", place)}
      </p>
      <div className="grid gap-xs sm:grid-cols-2">
        <div className="grid gap-3xs">
          <label htmlFor={minId} className="nf-label">
            {copy.inviteMin}
          </label>
          <input id={minId} inputMode="decimal" className="nf-field" value={min} onChange={(e) => setMin(e.target.value)} placeholder="2,000,000" />
        </div>
        <div className="grid gap-3xs">
          <label htmlFor={maxId} className="nf-label">
            {copy.inviteMax}
          </label>
          <input id={maxId} inputMode="decimal" className="nf-field" value={max} onChange={(e) => setMax(e.target.value)} placeholder="2,500,000" />
        </div>
      </div>
      <Button type="submit" variant="secondary" size="md" loading={pending} disabled={!min.trim() || !max.trim()} data-testid="portfolio-invite">
        {copy.inviteSend}
      </Button>
    </form>
  );
}

/** The owner gives the mandate to one pitch (and may give it to more). */
export function AwardButton({ pitchId, copy }: { pitchId: string; copy: Copy }) {
  const [pending, start] = useSafeTransition();
  return (
    <Button
      type="button"
      variant="primary"
      size="sm"
      loading={pending}
      onClick={() => {
        start(async () => {
          try {
            /* A refusal is said by the one banner (Grade 1). */
            const result = await awardMandate({ pitchId });
            if (!result.ok) banner.error(copy.awardFailed);
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      {copy.award}
    </Button>
  );
}

export function WithdrawButton({ invitationId, copy }: { invitationId: string; copy: Copy }) {
  const [pending, start] = useSafeTransition();
  return (
    <Button type="button" variant="ghost" size="sm" loading={pending} onClick={() => start(async () => void (await withdrawInvitation({ invitationId })))}>
      {copy.withdraw}
    </Button>
  );
}

/** A verified agent answers an owner's invitation. */
export function PitchForm({ invitationId, copy }: { invitationId: string; copy: Copy }) {
  const fieldId = useId();
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "short">("idle");
  const [pending, start] = useSafeTransition();

  if (state === "sent") {
    return (
      <p role="status" className="mt-sm text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
        {copy.pitched}
      </p>
    );
  }

  return (
    <form
      className="mt-sm grid gap-xs"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          try {
            const result = await pitchForMandate({ invitationId, note: text });
            /* Too short is the field's own line; any other refusal is the banner's. */
            if (!result.ok && result.error !== "short") banner.error(copy.pitchFailed);
            setState(result.ok ? "sent" : result.error === "short" ? "short" : "idle");
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      <label htmlFor={fieldId} className="nf-label">
        {copy.pitchLabel}
      </label>
      <textarea
        id={fieldId}
        className="nf-field min-h-24"
        maxLength={600}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={copy.pitchPlaceholder}
      />
      {state === "short" && (
        <p role="alert" className="text-[length:var(--nf-text-caption)] text-[var(--nf-state-error)]">
          {copy.pitchShort}
        </p>
      )}
      <Button type="submit" variant="primary" size="md" loading={pending} disabled={text.trim().length < 10} data-testid="portfolio-pitch">
        {copy.pitchSend}
      </Button>
    </form>
  );
}
