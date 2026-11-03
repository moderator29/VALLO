"use client";

import { useState, useTransition } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { recordCredential } from "@/lib/trust/credentials-actions";
import { Button } from "@/components/ui/Button";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * V-87: record a LASRERA or ESVARBON entry checked by hand on the public
 * register, with the name the register shows. Optional for the lister and
 * never a gate: this only dates a fact the desk checked. Every state is drawn:
 * choosing, recording, recorded, and the refusal.
 *
 * NO CAC OPTION. The free CAC search shows a company, not its directors, so a
 * directorship cannot be checked by hand; the form says so instead of
 * offering a choice that would record a sentence nobody saw. The desk reads
 * English.
 */

/** The desk's own words, handed down by the server page that draws the card. */
export function CredentialForm({ subjectId, desk }: { subjectId: string; desk: Dictionary["trustVisible"]["desk"] }) {
  const [kind, setKind] = useState<"lasrera" | "esvarbon">("lasrera");
  const [number, setNumber] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setNote(null);
    startTransition(async () => {
      try {
        const result = await recordCredential({ subjectId, kind, number, registerName });
        setNote(result.ok ? { ok: true, text: desk.credentialRecorded } : { ok: false, text: result.error });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  const ready = number.trim().length >= 2 && registerName.trim().length >= 2;

  return (
    <div className="mt-sm grid max-w-md gap-xs" data-testid="credential-form">
      <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
        {desk.credentialTitle}
      </p>
      <label className="grid gap-3xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
        {desk.credentialKind}
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
          className="nf-field min-h-[44px] w-full"
        >
          <option value="lasrera">{desk.lasrera}</option>
          <option value="esvarbon">{desk.esvarbon}</option>
        </select>
      </label>
      <label className="grid gap-3xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
        {desk.credentialNumber}
        <input value={number} onChange={(event) => setNumber(event.target.value)} className="nf-field min-h-[44px] w-full" />
      </label>
      <label className="grid gap-3xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
        {desk.credentialName}
        <input
          value={registerName}
          onChange={(event) => setRegisterName(event.target.value)}
          className="nf-field min-h-[44px] w-full"
        />
      </label>
      <Button variant="secondary" size="sm" type="button" onClick={submit} disabled={pending || !ready}>
        {pending ? desk.credentialRecording : desk.credentialSubmit}
      </Button>
      {note && (
        <p
          role={note.ok ? "status" : "alert"}
          className={`text-[length:var(--nf-text-body-sm)] ${note.ok ? "text-[var(--nf-content-primary)]" : "text-[var(--nf-state-error)]"}`}
        >
          {note.text}
        </p>
      )}
      <p className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">{desk.credentialCac}</p>
    </div>
  );
}
