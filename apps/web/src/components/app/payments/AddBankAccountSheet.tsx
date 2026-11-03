"use client";

import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { useMoneyStepUp } from "@/components/app/money/MoneyStepUp";
import { useEffect, useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { RowButton, Sheet } from "@/components/app/account/rows";
import { ICON, TYPE } from "@/components/app/Screen";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { NUBAN_LENGTH, digitsOnly, groupNuban } from "@/lib/agent/payout-model";
import { addBankAccount, listBanks, resolveBankAccount } from "@/lib/payments/bank-accounts-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type PaymentsCopy = Dictionary["paymentsPage"];
type Bank = { name: string; code: string };
type Beat = "bank" | "number" | "confirm";

/**
 * Adding a bank account, in three beats: pick the bank (with a search
 * field, because the list is long), type the ten digits grouped
 * 0123 456 789, and confirm the name the bank returns before anything is
 * saved. The server resolves the account again on save, so the name shown
 * here is a courtesy and never the guard.
 *
 * Mounted only while open, so every attempt starts clean and nothing from a
 * previous try can be saved by accident. Every state is honest: a bank list
 * that failed to load says so and offers a retry; a number that does not
 * resolve says so in rose; a name the person does not recognise has a way
 * back to the number without saving anything.
 */
export function AddBankAccountSheet({
  copy,
  onClose,
  onSaved,
}: {
  copy: PaymentsCopy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [beat, setBeat] = useState<Beat>("bank");
  const [banks, setBanks] = useState<
    { state: "loading" } | { state: "ready"; banks: Bank[] } | { state: "failed"; reason: string }
  >({ state: "loading" });
  const [search, setSearch] = useState("");
  const [bank, setBank] = useState<Bank | null>(null);
  const [number, setNumber] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useSafeTransition();
  const [reload, setReload] = useState(0);
  /* ONE KEY PER SHEET. Saving an account is a paid resolution at Paystack and
     the allowance is five an hour, so a dropped response followed by a second
     tap must replay the first answer rather than spend a second slot. The key
     is minted once per mount: a person who closes the sheet and opens it again
     is deliberately starting over and gets a fresh one. */
  const [idempotencyKey] = useState(() => {
    try {
      return crypto.randomUUID();
    } catch {
      return `k-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    }
  });

  useEffect(() => {
    let live = true;
    void listBanks().then((result) => {
      if (!live) return;
      if (result.ok) setBanks({ state: "ready", banks: result.data });
      else setBanks({ state: "failed", reason: result.error });
    });
    return () => {
      live = false;
    };
  }, [reload]);

  const digits = digitsOnly(number);
  const complete = digits.length === NUBAN_LENGTH && bank !== null;
  const q = search.trim().toLowerCase();
  const shown =
    banks.state === "ready"
      ? banks.banks.filter((one) => q.length === 0 || one.name.toLowerCase().includes(q)).slice(0, 60)
      : [];

  const resolve = () => {
    if (!bank) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await resolveBankAccount({ bankCode: bank.code, accountNumber: digits });
        if (!result.ok) {
          setError(result.fieldErrors?.accountNumber ?? result.error);
          return;
        }
        setName(result.data.accountName);
        setBeat("confirm");
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const lockWords = useScopedCopy("moneyLock");
  const lock = useMoneyStepUp();

  const save = () => {
    if (!bank) return;
    setError(null);
    startTransition(async () => {
      try {
        /* V-81: a new account to be paid into asks for the phone lock, when there is one. */
        const result = await lock.guard({ kind: "bank_add", target: `${bank.code}:${digits}` }, (stepUp) =>
          addBankAccount({ bankCode: bank.code, accountNumber: digits, idempotencyKey, stepUp }),
        );
        if (result === null) {
          setError(lockWords.notConfirmed);
          return;
        }
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onSaved();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <Sheet open onClose={onClose} title={copy.addSheetTitle}>
      {lock.sheet}
      {beat === "bank" && (
        <div>
          <TextField
            label={copy.pickBank}
            hideLabel
            type="search"
            leadingIcon="search"
            placeholder={copy.searchBanks}
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {banks.state === "loading" && (
            <p role="status" aria-live="polite" className={`mt-row px-2xs ${TYPE.rowMeta}`}>
              {copy.banksLoading}
            </p>
          )}
          {banks.state === "failed" && (
            <div className="mt-row px-2xs">
              <p role="alert" className={`${TYPE.rowMeta} text-[var(--nf-state-error)]`}>
                {banks.reason || copy.banksFailed}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-inline"
                onClick={() => {
                  setBanks({ state: "loading" });
                  setReload((n) => n + 1);
                }}
              >
                {copy.tryAgain}
              </Button>
            </div>
          )}
          {banks.state === "ready" && (
            <div className="mt-row" role="listbox" aria-label={copy.pickBank}>
              {shown.map((one) => (
                <RowButton
                  key={one.code}
                  label={one.name}
                  onClick={() => {
                    setBank(one);
                    setBeat("number");
                  }}
                />
              ))}
              {shown.length === 0 && (
                <p className={`px-2xs py-row ${TYPE.rowMeta}`}>{copy.noBankMatch}</p>
              )}
            </div>
          )}
        </div>
      )}

      {beat === "number" && bank && (
        <div>
          <RowButton
            icon="building-apartment"
            label={bank.name}
            sub={copy.changeBank}
            onClick={() => setBeat("bank")}
            disabled={pending}
          />
          <div className="mt-row">
            <TextField
              label={copy.accountNumber}
              hint={copy.accountNumberHint}
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              placeholder="0123 456 789"
              value={groupNuban(number)}
              onChange={(event) => setNumber(digitsOnly(event.target.value))}
              inputClassName="nf-numeric tracking-[0.08em]"
              error={error ?? undefined}
            />
          </div>
          <Button
            variant="primary"
            full
            className="mt-block"
            disabled={!complete}
            loading={pending}
            onClick={resolve}
          >
            {pending ? copy.checking : copy.checkName}
          </Button>
        </div>
      )}

      {beat === "confirm" && bank && name && (
        <div className="px-2xs">
          <p className={TYPE.sectionTitle}>{copy.isThisYou}</p>
          <div className="mt-row flex items-start gap-row rounded-[var(--nf-container-radius)] border border-[var(--nf-brand-edge)] bg-[var(--nf-surface-inset)] p-row">
            <UiIcon
              name="verified"
              size={ICON.inline}
              className="mt-3xs shrink-0 text-[var(--nf-state-success)]"
            />
            <div className="min-w-0">
              <p className={TYPE.rowMeta}>{copy.confirmsBelongs.replace("{bank}", bank.name)}</p>
              <p className={`mt-3xs ${TYPE.rowTitle}`}>{name}</p>
              <p className={`nf-numeric mt-3xs ${TYPE.caption}`}>{groupNuban(number)}</p>
            </div>
          </div>
          {error && (
            <p role="alert" className={`mt-row ${TYPE.rowMeta} text-[var(--nf-state-error)]`}>
              {error}
            </p>
          )}
          <div className="mt-block flex flex-col gap-inline">
            <Button variant="primary" full loading={pending} onClick={save}>
              {pending ? copy.saving : copy.yesSave}
            </Button>
            <Button
              variant="ghost"
              full
              disabled={pending}
              onClick={() => {
                setName(null);
                setError(null);
                setBeat("number");
              }}
            >
              {copy.notMe}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
