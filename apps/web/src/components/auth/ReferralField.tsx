"use client";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import type { ReferrerLookup } from "@/lib/referral/lookup-action";
import { Field } from "./fields";

/**
 * "Referral code or invite link" on sign-up: optional, paste either. As the
 * field loses focus the referrer's first name is shown back ("Referred by
 * Ada") when the code is real, so a wrong paste is caught before the account
 * exists. It only ever adds information: an unknown code, a busy check or no
 * answer never blocks Create account, and the server re-checks at sign-up.
 * A link that brought the person here arrives already filled in. Nothing about
 * what the referrer may earn is shown.
 */
export function ReferralField({
  t,
  error,
  check,
  initialCode = "",
  initialName = null,
}: {
  t: Dictionary;
  error?: string | undefined;
  check: (raw: string) => Promise<ReferrerLookup>;
  initialCode?: string;
  initialName?: string | null;
}) {
  const s = t.signUp;
  const [value, setValue] = useState(initialCode);
  const [result, setResult] = useState<ReferrerLookup>(
    initialCode ? { state: "found", code: initialCode, firstName: initialName } : { state: "empty" },
  );

  async function onBlur(raw: string) {
    if (raw.trim() === "") {
      setResult({ state: "empty" });
      return;
    }
    try {
      setResult(await check(raw));
    } catch {
      setResult({ state: "busy" });
    }
  }

  const note =
    result.state === "found"
      ? result.firstName
        ? s.referralFound.replace("{name}", result.firstName)
        : s.referralFoundNoName
      : result.state === "unknown"
        ? s.referralUnknown
        : result.state === "unreadable"
          ? s.referralUnreadable
          : result.state === "busy"
            ? s.referralBusy
            : null;

  return (
    <div>
      <Field
        t={t}
        id="referralCode"
        name="referralCode"
        type="text"
        label={s.referralInviteLabel}
        placeholder={s.referralInvitePlaceholder}
        autoComplete="off"
        enterKeyHint="done"
        optional
        error={error}
        value={value}
        onChange={(next) => {
          setValue(next);
          if (result.state !== "empty") setResult({ state: "empty" });
        }}
        onBlur={onBlur}
      />
      {note && !error ? (
        <p
          role="status"
          data-testid="referral-note"
          data-state={result.state}
          className="mt-xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]"
        >
          {note}
        </p>
      ) : (
        <p className="mt-xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-tertiary)]">
          {s.referralInviteHint}
        </p>
      )}
    </div>
  );
}
