"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLockRecovery, useMoneyStepUp } from "@/components/app/money/MoneyStepUp";
import { useRouter } from "next/navigation";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy, type SuccessWords } from "@/lib/ui/success-moments";
import type { ActionResult } from "@/lib/actions/envelope";
import {
  addPayoutAccount,
  removePayoutAccount,
  resolvePayoutAccount,
  setDefaultPayoutAccount,
  type ResolvedName,
} from "@/lib/agent/payout-actions";
import type { PayoutAccount } from "@/lib/agent/payout-queries";
import { NUBAN_LENGTH, digitsOnly, groupNuban } from "@/lib/agent/payout-model";
import { BrandIcon } from "@/design-system/icons/BrandIcon";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useActionBanner } from "@/components/ui/use-action-banner";

/**
 * Where earnings are paid.
 *
 * Two steps on purpose. The agent picks a bank and types ten digits, we ask the
 * bank whose account it is, and only once they have seen the real name can they
 * save it. That is how every Nigerian banking app behaves and it is the single
 * best defence against paying the wrong person.
 *
 * The name is never trusted from this component: the add action re-resolves it
 * server side and stores what the bank said, not what this form carried.
 */

type Bank = { name: string; code: string };

export function PayoutAccounts({
  accounts,
  banks,
  resolveAvailable,
  success,
}: {
  /** The page's `t.success`, for "Payout account added". Absent, no sheet. */
  success?: SuccessWords;
  accounts: PayoutAccount[];
  banks: Bank[];
  resolveAvailable: boolean;
}) {
  const router = useRouter();

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const [resolveState, resolveAction, resolving] = useActionState<
    ActionResult<ResolvedName> | null,
    FormData
  >(resolvePayoutAccount, null);
  /* V-81: where payouts go asks for the phone lock, when there is one. */
  const addLock = useMoneyStepUp((form) => ({
    kind: "payout_add",
    target: `${String(form.get("bankCode") ?? "")}:${String(form.get("accountNumber") ?? "")}`,
  }));
  const [addState, addAction, adding] = useActionState<ActionResult<null> | null, FormData>(
    addPayoutAccount,
    null,
  );
  useLockRecovery(addLock, addState);
  /* A refusal is said by the one banner; an added account opens its success sheet. */
  useActionBanner(resolveState);
  useActionBanner(addState, { ok: success ? undefined : "Payout account added" });

  const bankName = banks.find((b) => b.code === bankCode)?.name ?? "";
  const complete = digitsOnly(accountNumber).length === NUBAN_LENGTH && bankCode.length > 0;

  useEffect(() => {
    if (resolveState?.ok) setConfirmed(resolveState.data.accountName);
  }, [resolveState]);

  /* Changing either field invalidates a confirmation that was for the old one. */
  useEffect(() => {
    setConfirmed(null);
  }, [bankCode, accountNumber]);

  useEffect(() => {
    if (addState?.ok) {
      setBankCode("");
      setAccountNumber("");
      setConfirmed(null);
      router.refresh();
    }
  }, [addState, router]);

  /* Once per saved account: the action answer the sheet was shown for is
     remembered, so a re-render does not reopen it. */
  const [acknowledged, setAcknowledged] = useState<typeof addState>(null);
  const addedWords = success ? successCopy(success, "payoutAccountAdded") : null;

  return (
    <section aria-labelledby="payout-accounts-heading" className="mt-xl">
      {success && addedWords ? (
      <SuccessSheet
        open={addState?.ok === true && acknowledged !== addState}
        onOpenChange={(open) => {
          if (!open) setAcknowledged(addState);
        }}
        variant={addedWords.variant}
        haptic={addedWords.haptic}
        object={addedWords.object}
        title={addedWords.title}
        body={addedWords.body}
        primary={{ label: success.continue }}
      />
      ) : null}
      <h2 id="payout-accounts-heading" className="nf-h3">
        Where your earnings are paid
      </h2>
      <p className="mt-2xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
        Add the bank account your settled earnings should reach. We confirm the
        name with the bank before saving it, and Vallo takes nothing for holding
        or moving it.
      </p>

      {accounts.length > 0 ? (
        <ul className="mt-md grid gap-sm">
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} />
          ))}
        </ul>
      ) : (
        <div className="nf-panel nf-panel--card block mt-md p-lg text-center">
          <span className="mx-auto block h-16 w-16">
            <BrandIcon name="naira-hand" fill />
          </span>
          <p className="mt-sm font-semibold text-[var(--nf-content-primary)]">
            No payout account yet
          </p>
          <p className="mx-auto mt-2xs max-w-[40ch] text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
            Your earnings are recorded and waiting. Add an account below and the
            first one becomes your default automatically.
          </p>
        </div>
      )}

      {!resolveAvailable ? (
        <div className="nf-panel nf-panel--card mt-md flex flex-row items-start gap-sm p-md">
          <span className="mt-3xs block h-8 w-8 shrink-0">
            <BrandIcon name="card-lock" fill tile={false} />
          </span>
          <p className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
            We cannot add a payout account right now. We
            will not store an account we cannot confirm belongs to you, because
            an unconfirmed payout target is how money reaches the wrong person.
          </p>
        </div>
      ) : (
        <div className="nf-panel nf-panel--card block mt-md p-md sm:p-panel">
          <h3 className="nf-overline text-[var(--nf-content-muted)]">Add an account</h3>

          <div className="mt-sm grid gap-sm">
            <div>
              <label
                htmlFor="payout-bank"
                className="block text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-secondary)]"
              >
                Bank
              </label>
              <select
                id="payout-bank"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="nf-field mt-xs w-full"
              >
                <option value="">Choose your bank</option>
                {banks.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="payout-number"
                className="block text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-secondary)]"
              >
                Account number
              </label>
              <input
                id="payout-number"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                value={groupNuban(accountNumber)}
                onChange={(e) => setAccountNumber(digitsOnly(e.target.value))}
                placeholder="0123 456 789"
                aria-describedby="payout-number-hint"
                className="nf-numeric nf-field mt-xs w-full tracking-[0.08em]"
              />
              <p id="payout-number-hint" className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                Ten digits. We show the account name before anything is saved.
              </p>
            </div>
          </div>

          {confirmed === null ? (
            <form action={resolveAction} className="mt-md">
              <input type="hidden" name="bankCode" value={bankCode} />
              <input type="hidden" name="accountNumber" value={digitsOnly(accountNumber)} />
              <Button
                type="submit"
                variant="secondary"
                full
                disabled={!complete || resolving}
                className="disabled:opacity-55"
              >
                {resolving ? "Checking with the bank..." : "Confirm account name"}
              </Button>
            </form>
          ) : (
            <form action={addAction} className="mt-md" onSubmit={(event) => void addLock.pass(event)}>
              {addLock.sheet}
              <input type="hidden" name="stepUp" value={addLock.token} />
              <input type="hidden" name="bankCode" value={bankCode} />
              <input type="hidden" name="bankName" value={bankName} />
              <input type="hidden" name="accountNumber" value={digitsOnly(accountNumber)} />
              <input type="hidden" name="accountName" value={confirmed} />

              <p className="nf-panel nf-panel--card flex flex-row items-start gap-sm p-sm">
                <UiIcon
                  name="verified"
                  size={20}
                  className="mt-3xs shrink-0 text-[var(--nf-state-success)]"
                />
                <span className="leading-snug">
                  <span className="block text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                    {bankName} confirms this account belongs to
                  </span>
                  <span className="block text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                    {confirmed}
                  </span>
                </span>
              </p>

              <Button type="submit" variant="primary" full disabled={adding} className="mt-sm disabled:opacity-60">
                {adding ? "Saving..." : "Save this account"}
              </Button>
              <Button variant="quiet" size="sm" full className="mt-xs" onClick={() => setConfirmed(null)}>
                Not my account, change it
              </Button>
            </form>
          )}

        </div>
      )}
    </section>
  );
}

/** One saved account, with the two things an agent can do to it. */
function AccountRow({ account }: { account: PayoutAccount }) {
  const router = useRouter();
  const defaultLock = useMoneyStepUp((form) => ({ kind: "payout_default", target: String(form.get("accountId") ?? "") }));
  const [defaultState, defaultAction, settingDefault] = useActionState<
    ActionResult<null> | null,
    FormData
  >(setDefaultPayoutAccount, null);
  const [removeState, removeAction, removing] = useActionState<
    ActionResult<null> | null,
    FormData
  >(removePayoutAccount, null);
  /* V-81: removing the account payouts go to promotes another one. */
  const removeLock = useMoneyStepUp((form) => ({ kind: "payout_remove", target: `payout:${String(form.get("accountId") ?? "")}` }));
  useLockRecovery(defaultLock, defaultState);
  useLockRecovery(removeLock, removeState);

  useEffect(() => {
    if (defaultState?.ok || removeState?.ok) router.refresh();
  }, [defaultState, removeState, router]);

  /* Changed, removed or refused, said by the one banner at the top of the
     screen (founder, 7 November 2026, "THE BANNER EVERYWHERE"). */
  useActionBanner(defaultState, { ok: "Default payout account changed" });
  useActionBanner(removeState, { ok: "Payout account removed" });

  return (
    <li className="nf-panel nf-panel--card block p-md">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0 leading-tight">
          {/* The account holder's name on the screen where money leaves the
              platform. Never clipped: an operator or an agent checking a
              payout against a bank statement needs the whole string. */}
          <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)] break-words">
            {account.accountName}
          </p>
          <p className="nf-numeric mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
            {groupNuban(account.accountNumber)}
          </p>
          <p className="mt-3xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {account.bankName}
          </p>
        </div>
        {account.isDefault && (
          <span className="nf-badge nf-badge--neutral shrink-0">Paid here</span>
        )}
      </div>

      <div className="mt-sm flex flex-wrap items-center gap-md border-t border-[var(--nf-border-subtle)] pt-sm">
        {!account.isDefault && (
          <form action={defaultAction} onSubmit={(event) => void defaultLock.pass(event)}>
            {defaultLock.sheet}
            <input type="hidden" name="stepUp" value={defaultLock.token} />
            <input type="hidden" name="accountId" value={account.id} />
            <Button type="submit" variant="quiet" size="sm" disabled={settingDefault}>
              {settingDefault ? "Switching..." : "Pay me here instead"}
            </Button>
          </form>
        )}
        <form action={removeAction} onSubmit={account.isDefault ? (event) => void removeLock.pass(event) : undefined}>
          {account.isDefault && removeLock.sheet}
          {account.isDefault && <input type="hidden" name="stepUp" value={removeLock.token} />}
          <input type="hidden" name="accountId" value={account.id} />
          <Button type="submit" variant="quiet" size="sm" disabled={removing}>
            {removing ? "Removing..." : "Remove"}
          </Button>
        </form>
      </div>

    </li>
  );
}
