"use client";

import { PhoneField } from "@/components/app/PhoneField";
import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { fileListingMandate } from "@/lib/compliance/beneficial-ownership-actions";
import { MANDATE_KINDS, RELATIONSHIPS, type MyMandate } from "@/lib/compliance/beneficial-ownership";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type Copy = Dictionary["complianceBeneficialOwnership"]["lister"];

/**
 * SCUML item 17: the lister's mandate form. Sends a new mandate, corrects
 * one still waiting, or files the renewal of one that is running out (the
 * current mandate stays in force until staff approve the renewal).
 */
export function MandateForm({
  listingId,
  copy,
  initial,
  template = null,
  renewing = false,
  today = null,
}: {
  listingId: string;
  copy: Copy;
  /** A waiting mandate being corrected. */
  initial: MyMandate | null;
  /** The mandate being renewed: its principal is filled in, its dates are not. */
  template?: MyMandate | null;
  renewing?: boolean;
  /** The Lagos date, from the database: an end date before it is refused. */
  today?: string | null;
}) {
  const seed = initial ?? template;
  const [kind, setKind] = useState<string>(seed?.kind ?? "letting");
  const [name, setName] = useState(seed?.principalName ?? "");
  const [phone, setPhone] = useState(seed?.principalPhone ?? "");
  const [relationship, setRelationship] = useState<string>(seed?.relationship ?? "");
  const [exclusive, setExclusive] = useState<"yes" | "no" | "unknown">(
    seed?.exclusive === true ? "yes" : seed?.exclusive === false ? "no" : "unknown",
  );
  const [signedOn, setSignedOn] = useState(initial?.signedOn ?? "");
  const [expiresOn, setExpiresOn] = useState(initial?.expiresOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useSafeTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await fileListingMandate({
          listingId,
          form: { kind, principalName: name, principalPhone: phone, relationship, exclusive, signedOn, expiresOn },
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSent(true);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  if (sent) {
    return (
      <p className="nf-body-sm" role="status" data-testid="mandate-sent">
        {copy.sent}
      </p>
    );
  }

  return (
    <form className="grid gap-xs" onSubmit={submit} data-testid="mandate-form">
      <label className="nf-label" htmlFor="mandate-kind">
        {copy.kind}
      </label>
      <select id="mandate-kind" className="nf-field" value={kind} onChange={(e) => setKind(e.target.value)}>
        {MANDATE_KINDS.map((k) => (
          <option key={k} value={k}>
            {copy.kinds[k]}
          </option>
        ))}
      </select>
      <label className="nf-label" htmlFor="mandate-name">
        {copy.name}
      </label>
      <input
        id="mandate-name"
        className="nf-field"
        value={name}
        maxLength={160}
        autoComplete="off"
        required
        onChange={(e) => setName(e.target.value)}
      />
      <PhoneField
        id="mandate-phone"
        name="principalPhone"
        label={copy.phone}
        value={phone}
        onChange={setPhone}
        autoComplete="off"
      />
      <p id="mandate-phone-hint" className="nf-caption text-[var(--nf-content-secondary)]">
        {copy.phoneHint}
      </p>
      <label className="nf-label" htmlFor="mandate-relationship">
        {copy.relationship}
      </label>
      <select
        id="mandate-relationship"
        className="nf-field"
        value={relationship}
        required
        onChange={(e) => setRelationship(e.target.value)}
      >
        <option value="" disabled>
          {copy.relationship}
        </option>
        {RELATIONSHIPS.map((r) => (
          <option key={r} value={r}>
            {copy.relationships[r]}
          </option>
        ))}
      </select>
      <fieldset className="grid gap-2xs">
        <legend className="nf-label">{copy.exclusive}</legend>
        {(
          [
            ["yes", copy.exclusiveYes],
            ["no", copy.exclusiveNo],
            ["unknown", copy.exclusiveUnknown],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-xs nf-body-sm">
            <input type="radio" name="exclusive" value={value} checked={exclusive === value} onChange={() => setExclusive(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="nf-label" htmlFor="mandate-signed">
        {copy.signedOn}
      </label>
      <input id="mandate-signed" className="nf-field" type="date" value={signedOn} onChange={(e) => setSignedOn(e.target.value)} />
      <label className="nf-label" htmlFor="mandate-expires">
        {copy.expiresOn}
      </label>
      <input id="mandate-expires" className="nf-field" type="date" min={today ?? undefined} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
      {error && (
        <p role="alert" className="nf-body-sm" style={{ color: "var(--nf-state-error)" }}>
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" loading={pending} data-testid="mandate-send">
        {initial ? copy.update : renewing ? copy.renew : copy.send}
      </Button>
    </form>
  );
}
