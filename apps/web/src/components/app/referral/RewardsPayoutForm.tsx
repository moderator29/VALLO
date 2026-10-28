"use client";

import { useState } from "react";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import type { ActionResult } from "@/lib/actions/envelope";
import type { RewardsPayoutResult } from "@/lib/payouts/referral-payout";
import { money } from "./format";
import { fill } from "./money-words";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type Copy = Dictionary["experienceRewards"]["withdraw"];

/**
 * THE WITHDRAW FORM, ONCE WITHDRAWALS ARE OPEN (D85). The bank and the ten
 * digits; the bank names the account holder (the member never types a name),
 * and the payout is the whole Available balance in whole referrals, exactly
 * what `rewards_payout_open` holds. The answer is "on its way" or "with a
 * person at Vallo", never "paid": paid is the provider's webhook alone.
 * Drawn only when the withdraw page's gate is open.
 */
export function RewardsPayoutForm({
  availableMinor,
  banks,
  copy,
  locale,
  action,
  historyHref,
}: {
  availableMinor: number;
  banks: readonly { code: string; name: string }[];
  copy: Copy;
  locale: Locale;
  action: (input: { bankCode: string; accountNumber: string }) => Promise<ActionResult<RewardsPayoutResult>>;
  historyHref: string;
}) {
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<RewardsPayoutResult | null>(null);
  const [pending, start] = useSafeTransition();

  if (done) {
    return (
      <div className="grid gap-sm" role="status" data-testid="rewards-payout-done">
        <p className="nf-rewards-note">
          {done.status === "under_review" ? copy.form.review : fill(copy.form.sent, { amount: money(done.amountMinor, locale) })}
        </p>
        <ButtonLink href={historyHref} variant="secondary" size="lg">
          {copy.done.action}
        </ButtonLink>
      </div>
    );
  }

  if (banks.length === 0) {
    return (
      <p className="nf-rewards-note" role="status" data-testid="rewards-payout-no-banks">
        {copy.form.noBanks}
      </p>
    );
  }

  return (
    <form
      className="grid gap-sm"
      data-testid="rewards-payout-form"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setFieldErrors({});
        start(async () => {
          /* A dropped connection is said here, never handed to the error
             boundary with the form's state still in it. */
          try {
            const result = await action({ bankCode, accountNumber });
            if (result.ok) setDone(result.data);
            else {
              setError(result.error);
              setFieldErrors(result.fieldErrors ?? {});
            }
          } catch {
            setError("We could not reach Vallo. Check your connection and try again. Nothing was withdrawn.");
          }
        });
      }}
    >
      <SelectField
        label={copy.form.bank}
        name="bankCode"
        value={bankCode}
        onChange={(event) => setBankCode(event.target.value)}
        error={fieldErrors.bankCode}
        required
      >
        <option value="">{copy.form.bankPlaceholder}</option>
        {banks.map((bank) => (
          <option key={bank.code} value={bank.code}>
            {bank.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label={copy.form.account}
        hint={copy.form.accountHint}
        name="accountNumber"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        value={accountNumber}
        onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))}
        error={fieldErrors.accountNumber}
        required
      />
      {error ? (
        <p className="nf-rewards-error" role="alert" data-testid="rewards-payout-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" full loading={pending} data-testid="rewards-payout-submit">
        {pending ? copy.form.sending : fill(copy.form.submit, { amount: money(availableMinor, locale) })}
      </Button>
    </form>
  );
}
