"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Check";
import { TextField } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { verifyProtectedIdentity } from "@/lib/money/protected-actions";
import {
  PROTECTED_ACTION_REFUSED,
  PROTECTED_IDENTITY_CONSENT,
  PROTECTED_IDENTITY_CTA,
  PROTECTED_IDENTITY_DOB_HINT,
  PROTECTED_IDENTITY_DOB_LABEL,
  PROTECTED_IDENTITY_KINDS,
  PROTECTED_IDENTITY_KIND_LABEL,
  PROTECTED_IDENTITY_LEAD,
  PROTECTED_IDENTITY_NUMBER_HINT,
  PROTECTED_IDENTITY_NUMBER_LABEL,
  PROTECTED_IDENTITY_RESULT,
  PROTECTED_IDENTITY_TITLE,
} from "@/lib/money/copy";
import { THIRD_PARTIES_LINE } from "@/lib/money/protected-wording";
import { ScreenHead } from "./kit";

type Kind = keyof typeof PROTECTED_IDENTITY_KINDS;
const KINDS = (Object.keys(PROTECTED_IDENTITY_KINDS) as Kind[]).map((value) => ({ value, label: PROTECTED_IDENTITY_KINDS[value] }));

/**
 * THE ONE IDENTITY CHECK the holder of the money asks of every payer and
 * every lister before a first protected payment. The number is held only in
 * this component's memory until it is sent, is never stored in the browser
 * (no draft, no autofill), and is cleared the moment the answer comes back.
 * The member ticks the consent themselves; nothing is sent without it.
 */
export function IdentityCheck({ onVerified }: { onVerified: () => void }) {
  const [kind, setKind] = useState<Kind>("nin");
  const [identifier, setIdentifier] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [consent, setConsent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const ready = /^\d{11}$/.test(identifier) && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) && consent;

  const submit = () => {
    if (!ready || pending) return;
    setProblem(null);
    start(async () => {
      let message: string | null = null;
      try {
        const out = await verifyProtectedIdentity({ kind, identifier, dateOfBirth, consent: true });
        if (!out.ok) message = out.error;
      } catch {
        message = PROTECTED_ACTION_REFUSED.unavailable;
      }
      /* The number never outlives the request it was typed for. */
      setIdentifier("");
      if (message) setProblem(message);
      else onVerified();
    });
  };

  return (
    <form
      className="nf-pp-screen"
      data-testid="pp-identity"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <ScreenHead title={PROTECTED_IDENTITY_TITLE} lead={<p>{PROTECTED_IDENTITY_LEAD}</p>} />
      <Segmented options={KINDS} value={kind} onChange={setKind} semantics="radio" label={PROTECTED_IDENTITY_KIND_LABEL} full />
      <TextField
        label={PROTECTED_IDENTITY_NUMBER_LABEL[kind]}
        hint={PROTECTED_IDENTITY_NUMBER_HINT}
        error={problem ?? undefined}
        value={identifier}
        onChange={(e) => setIdentifier(e.currentTarget.value.replace(/\D/g, "").slice(0, 11))}
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        required
        data-testid="pp-identity-number"
      />
      <TextField
        label={PROTECTED_IDENTITY_DOB_LABEL}
        hint={PROTECTED_IDENTITY_DOB_HINT}
        type="date"
        value={dateOfBirth}
        onChange={(e) => setDateOfBirth(e.currentTarget.value)}
        autoComplete="off"
        required
        data-testid="pp-identity-dob"
      />
      <Checkbox checked={consent} onChange={(e) => setConsent(e.currentTarget.checked)} data-testid="pp-identity-consent">
        {PROTECTED_IDENTITY_CONSENT}
      </Checkbox>
      <p className="nf-pp-fine">{THIRD_PARTIES_LINE}</p>
      <div className="nf-pp-actions">
        <Button type="submit" variant="primary" size="lg" full disabled={!ready || pending} data-testid="pp-identity-submit">
          {PROTECTED_IDENTITY_CTA}
        </Button>
      </div>
      <span hidden data-testid="pp-identity-fallback">
        {PROTECTED_IDENTITY_RESULT.unavailable}
      </span>
    </form>
  );
}
