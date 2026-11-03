"use client";

import { useId, useState, useTransition } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { withDone } from "@/lib/ui/success-moments";
import { awardMandate, inviteAgents, pitchForMandate, withdrawInvitation } from "@/lib/landlord/portfolio-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type Copy = Dictionary["landlord"]["portfolio"];

/** The owner invites verified agents to pitch for one unit. */
export function InviteForm({ listingId, place, copy }: { listingId: string; place: string; copy: Copy }) {
  const minId = useId();
  const maxId = useId();
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="mt-sm grid gap-xs"
      onSubmit={(event) => {
        event.preventDefault();
        setNote(null);
        start(async () => {
          try {
            const result = await inviteAgents({ listingId, min, max });
            if (result.ok) {
              setNote({
                tone: "ok",
                text: result.data.told > 0 ? copy.inviteSent.replace("{n}", String(result.data.told)) : copy.inviteSentNone,
              });
              /* "Invitation sent" only when the database told somebody; the
                 portfolio checks the invitation is open on this unit before
                 it shows (arrival-moments.ts), and the form itself gives way
                 to the invitation as the page refreshes. */
              if (result.data.told > 0) {
                router.replace(withDone("/agent/portfolio", "agents-invited", { listing: listingId }), { scroll: false });
              }
              return;
            }
            setNote({ tone: "error", text: result.error === "band" ? copy.inviteBand : copy.inviteFailed });
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
      {note && (
        <p
          role={note.tone === "error" ? "alert" : "status"}
          className="text-[length:var(--nf-text-caption)]"
          style={{ color: note.tone === "error" ? "var(--nf-state-error)" : "var(--nf-content-secondary)" }}
        >
          {note.text}
        </p>
      )}
    </form>
  );
}

/** The owner gives the mandate to one pitch (and may give it to more). */
export function AwardButton({ pitchId, copy }: { pitchId: string; copy: Copy }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="sm"
        loading={pending}
        onClick={() => {
          setError(false);
          start(async () => {
            try {
              const result = await awardMandate({ pitchId });
              if (!result.ok) setError(true);
            } catch (error) {
              if (!tapFailedOffline(error)) throw error;
            }
          });
        }}
      >
        {copy.award}
      </Button>
      {error && (
        <p role="alert" className="text-[length:var(--nf-text-caption)] text-[var(--nf-state-error)]">
          {copy.awardFailed}
        </p>
      )}
    </>
  );
}

export function WithdrawButton({ invitationId, copy }: { invitationId: string; copy: Copy }) {
  const [pending, start] = useTransition();
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
  const [state, setState] = useState<"idle" | "sent" | "short" | "failed">("idle");
  const [pending, start] = useTransition();

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
            setState(result.ok ? "sent" : result.error === "short" ? "short" : "failed");
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
      {(state === "short" || state === "failed") && (
        <p role="alert" className="text-[length:var(--nf-text-caption)] text-[var(--nf-state-error)]">
          {state === "short" ? copy.pitchShort : copy.pitchFailed}
        </p>
      )}
      <Button type="submit" variant="primary" size="md" loading={pending} disabled={text.trim().length < 10} data-testid="portfolio-pitch">
        {copy.pitchSend}
      </Button>
    </form>
  );
}
