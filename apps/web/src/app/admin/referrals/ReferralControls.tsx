"use client";

import { useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmPanel } from "@/components/app/confirm/ConfirmPanel";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import type { ActionResult } from "@/lib/actions/envelope";
import { decidePayout, decideReferral, setReferralBudget } from "@/lib/admin/referral-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * THE REFERRAL DESK'S HANDS: set the budget, decide a referral, decide a
 * payout. Each opens a sheet that states what is about to happen, takes the
 * reason the database requires, runs the server action and either shows the
 * sentence the server sent (nothing changed) or refreshes the route so the
 * desk re-reads from the database rather than from a guess.
 *
 * Every word arrives as a slice of the dictionary from the page: these are
 * client components, so none of them resolves a locale itself.
 */

type Copy = Dictionary["referralDesk"];

/* ------------------------------------------------------------ reason sheet */

type ReasonSheetProps = {
  open: boolean;
  onClose: () => void;
  icon: UiIconName;
  tone?: "brand" | "warning" | "danger";
  title: string;
  context: string;
  summary?: { label: string; value: ReactNode }[];
  next: string[];
  reasonLabel: string;
  reasonHelp: string;
  reasonPlaceholder: string;
  minReason: number;
  cta: string;
  working: string;
  cancel: string;
  destructive?: boolean;
  doneMessage: string;
  errorReason: string;
  close: string;
  run: (reason: string) => Promise<ActionResult<unknown>>;
};

function ReasonSheet(p: ReasonSheetProps) {
  const router = useRouter();
  const fieldId = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useSafeTransition();

  const reset = () => {
    setReason("");
    setError(null);
    setDone(false);
  };
  const close = () => {
    if (pending) return;
    const finished = done;
    p.onClose();
    reset();
    if (finished) router.refresh();
  };

  function submit() {
    const trimmed = reason.trim();
    if (trimmed.length < p.minReason) {
      setError(p.errorReason);
      return;
    }
    setError(null);
    start(async () => {
      const result = await p.run(trimmed);
      if (!result.ok) {
        setError(result.fieldErrors?.["reason"] ?? result.error);
        return;
      }
      setDone(true);
    });
  }

  return (
    <Sheet open={p.open} onOpenChange={(next) => !next && close()} title={p.title} hideTitle card detents={[0.9]}>
      {done ? (
        <div data-testid="referral-decision-done">
          <p className="nf-rdesk-done" role="status">
            {p.doneMessage}
          </p>
          <div className="mt-md">
            <Button type="button" size="md" onClick={close}>
              {p.close}
            </Button>
          </div>
        </div>
      ) : (
        <ConfirmPanel
          icon={p.icon}
          tone={p.tone ?? "brand"}
          title={p.title}
          context={p.context}
          summary={p.summary}
          next={p.next.map((text) => ({ icon: "circle-check" as UiIconName, text }))}
          error={error}
          cancel={
            <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={close}>
              {p.cancel}
            </Button>
          }
          primary={
            <Button
              type="button"
              size="sm"
              variant={p.destructive ? "danger" : "primary"}
              disabled={pending}
              onClick={submit}
            >
              {pending ? p.working : p.cta}
            </Button>
          }
        >
          <div className="nf-rdesk-field">
            <label htmlFor={fieldId} className="nf-label">
              {p.reasonLabel}
            </label>
            <textarea
              id={fieldId}
              className="nf-field min-h-[84px] resize-y"
              value={reason}
              maxLength={500}
              required
              aria-required="true"
              aria-invalid={error ? true : undefined}
              placeholder={p.reasonPlaceholder}
              onChange={(e) => setReason(e.target.value)}
            />
            <span className="nf-caption">{p.reasonHelp}</span>
          </div>
        </ConfirmPanel>
      )}
    </Sheet>
  );
}

/* ----------------------------------------------------------- referral rows */

export function ReferralDecisionControl({
  referralId,
  referrer,
  invited,
  rewardLabel,
  copy,
}: {
  referralId: string;
  referrer: string;
  invited: string;
  /** The reward as the desk prints it, or the "no reward set" line. */
  rewardLabel: string;
  copy: Copy["review"];
}) {
  const [open, setOpen] = useState<"approve" | "reject" | null>(null);
  const context = (template: string) =>
    template.replace("{referrer}", referrer).replace("{invited}", invited).replace("{amount}", rewardLabel);
  return (
    <>
      <div className="nf-rdesk-actions">
        <Button type="button" size="sm" onClick={() => setOpen("approve")} data-testid="referral-approve">
          {copy.approve}
        </Button>
        <Button type="button" size="sm" variant="dangerQuiet" onClick={() => setOpen("reject")} data-testid="referral-reject">
          {copy.reject}
        </Button>
      </div>
      <ReasonSheet
        open={open === "approve"}
        onClose={() => setOpen(null)}
        icon="user-check"
        title={copy.approveTitle}
        context={context(copy.approveContext)}
        next={copy.approveNext}
        reasonLabel={copy.reasonLabel}
        reasonHelp={copy.reasonHelp}
        reasonPlaceholder={copy.reasonPlaceholder}
        minReason={8}
        cta={copy.approveCta}
        working={copy.working}
        cancel={copy.cancel}
        doneMessage={copy.doneApproved}
        errorReason={copy.errorReason}
        close={copy.close}
        run={(reason) => decideReferral({ referralId, decision: "approve", reason })}
      />
      <ReasonSheet
        open={open === "reject"}
        onClose={() => setOpen(null)}
        icon="alert-triangle"
        tone="warning"
        title={copy.rejectTitle}
        context={context(copy.rejectContext)}
        next={copy.rejectNext}
        reasonLabel={copy.reasonLabel}
        reasonHelp={copy.reasonHelp}
        reasonPlaceholder={copy.reasonPlaceholder}
        minReason={8}
        cta={copy.rejectCta}
        working={copy.working}
        cancel={copy.cancel}
        destructive
        doneMessage={copy.doneRejected}
        errorReason={copy.errorReason}
        close={copy.close}
        run={(reason) => decideReferral({ referralId, decision: "reject", reason })}
      />
    </>
  );
}

/* ------------------------------------------------------------- payout rows */

export function PayoutDecisionControl({
  payoutId,
  mode,
  who,
  amountLabel,
  last4,
  canRelease,
  copy,
}: {
  payoutId: string;
  /** `waiting` is a payout with a person (release or refuse); `stuck` is one open for more than a day (mark never sent). */
  mode: "waiting" | "stuck";
  who: string;
  amountLabel: string;
  last4: string;
  canRelease: boolean;
  copy: Copy["payouts"];
}) {
  const [open, setOpen] = useState<"release" | "refuse" | "never" | null>(null);
  const context = (template: string) =>
    template.replace("{amount}", amountLabel).replace("{name}", who).replace("{last4}", last4);

  if (mode === "stuck") {
    return (
      <>
        <div className="nf-rdesk-actions">
          <Button type="button" size="sm" variant="dangerQuiet" onClick={() => setOpen("never")} data-testid="payout-never-sent">
            {copy.neverSent}
          </Button>
        </div>
        <ReasonSheet
          open={open === "never"}
          onClose={() => setOpen(null)}
          icon="alert-triangle"
          tone="warning"
          title={copy.neverSentTitle}
          context={context(copy.neverSentContext)}
          next={copy.neverSentNext}
          reasonLabel={copy.neverSentReasonLabel}
          reasonHelp={copy.neverSentReasonHelp}
          reasonPlaceholder={copy.neverSentReasonPlaceholder}
          minReason={20}
          cta={copy.neverSentCta}
          working={copy.working}
          cancel={copy.cancel}
          destructive
          doneMessage={copy.doneNeverSent}
          errorReason={copy.errorNeverSent}
          close={copy.close}
          run={(reason) => decidePayout({ payoutId, decision: "fail_unsent", reason })}
        />
      </>
    );
  }

  return (
    <>
      <div className="nf-rdesk-actions">
        <Button type="button" size="sm" disabled={!canRelease} onClick={() => setOpen("release")} data-testid="payout-release">
          {copy.release}
        </Button>
        <Button type="button" size="sm" variant="dangerQuiet" onClick={() => setOpen("refuse")} data-testid="payout-refuse">
          {copy.refuse}
        </Button>
        <p className="nf-rdesk-actions__note">{canRelease ? copy.holdNote : copy.noRecipient}</p>
      </div>
      <ReasonSheet
        open={open === "release"}
        onClose={() => setOpen(null)}
        icon="hand-coins"
        title={copy.releaseTitle}
        context={context(copy.releaseContext)}
        next={copy.releaseNext}
        reasonLabel={copy.reasonLabel}
        reasonHelp={copy.reasonHelp}
        reasonPlaceholder={copy.reasonPlaceholder}
        minReason={8}
        cta={copy.releaseCta}
        working={copy.working}
        cancel={copy.cancel}
        doneMessage={copy.doneReleased}
        errorReason={copy.errorReason}
        close={copy.close}
        run={(reason) => decidePayout({ payoutId, decision: "release", reason })}
      />
      <ReasonSheet
        open={open === "refuse"}
        onClose={() => setOpen(null)}
        icon="alert-triangle"
        tone="warning"
        title={copy.refuseTitle}
        context={context(copy.refuseContext)}
        next={copy.refuseNext}
        reasonLabel={copy.reasonLabel}
        reasonHelp={copy.reasonHelp}
        reasonPlaceholder={copy.reasonPlaceholder}
        minReason={8}
        cta={copy.refuseCta}
        working={copy.working}
        cancel={copy.cancel}
        destructive
        doneMessage={copy.doneRefused}
        errorReason={copy.errorReason}
        close={copy.close}
        run={(reason) => decidePayout({ payoutId, decision: "refuse", reason })}
      />
    </>
  );
}

/* ----------------------------------------------------------------- budget */

export type BudgetMonthOption = {
  /** `YYYY-MM-01`. */
  value: string;
  /** "October 2026, this month". */
  label: string;
  /** "October 2026". */
  name: string;
  capMinor: number | null;
  committedMinor: number;
};

export function BudgetControl({
  months,
  locale,
  copy,
  hasBudget,
}: {
  months: BudgetMonthOption[];
  locale: Locale;
  copy: Copy["budget"];
  hasBudget: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"form" | "confirm" | "done">("form");
  const [month, setMonth] = useState(months[0]?.value ?? "");
  const picked = months.find((m) => m.value === month) ?? months[0]!;
  const [naira, setNaira] = useState(picked.capMinor !== null ? String(picked.capMinor / 100) : "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  const ids = { month: useId(), cap: useId(), reason: useId() };

  const nairaWhole = /^\d{1,12}$/.test(naira.trim()) ? Number(naira.trim()) : null;
  const capMinor = nairaWhole === null ? null : nairaWhole * 100;

  function close() {
    if (pending) return;
    const finished = stage === "done";
    setOpen(false);
    setStage("form");
    setError(null);
    setReason("");
    if (finished) router.refresh();
  }

  function review() {
    if (!picked || !month) {
      setError(copy.errorMonth);
      return;
    }
    if (capMinor === null) {
      setError(copy.errorCap);
      return;
    }
    if (reason.trim().length < 12) {
      setError(copy.errorReason);
      return;
    }
    setError(null);
    setStage("confirm");
  }

  function save() {
    if (capMinor === null) return;
    start(async () => {
      const result = await setReferralBudget({ month, capMinor, reason: reason.trim() });
      if (!result.ok) {
        setStage("form");
        setError(result.fieldErrors?.["reason"] ?? result.fieldErrors?.["capMinor"] ?? result.fieldErrors?.["month"] ?? result.error);
        return;
      }
      setStage("done");
    });
  }

  const money = (minor: number) => formatMoney(minor, locale);
  const below = capMinor !== null && capMinor < picked.committedMinor;
  const big = capMinor !== null && picked.capMinor !== null && picked.capMinor > 0 && capMinor > picked.capMinor * 5;

  return (
    <>
      <Button type="button" size="sm" variant={hasBudget ? "secondary" : "primary"} onClick={() => setOpen(true)} data-testid="budget-open">
        {hasBudget ? copy.openEdit : copy.openSet}
      </Button>
      <Sheet open={open} onOpenChange={(next) => !next && close()} title={copy.sheetTitle} hideTitle={stage !== "form"} card detents={[0.9]}>
        {stage === "done" ? (
          <div data-testid="budget-done">
            <p className="nf-rdesk-done" role="status">
              {copy.done.replace("{month}", picked.name)}
            </p>
            <div className="mt-md">
              <Button type="button" size="md" onClick={close}>
                {copy.close}
              </Button>
            </div>
          </div>
        ) : stage === "confirm" && capMinor !== null ? (
          <ConfirmPanel
            icon="price-tag"
            tone={below || big ? "warning" : "brand"}
            title={copy.confirmTitle.replace("{month}", picked.name).replace("{cap}", money(capMinor))}
            context={copy.confirmContext}
            summary={[
              { label: copy.confirmCap, value: money(capMinor) },
              { label: copy.confirmCommitted, value: money(picked.committedMinor) },
              ...(picked.capMinor !== null ? [{ label: copy.confirmWas, value: money(picked.capMinor) }] : []),
            ]}
            next={copy.confirmNext.map((text) => ({ icon: "circle-check" as UiIconName, text }))}
            error={error}
            cancel={
              <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => setStage("form")}>
                {copy.back}
              </Button>
            }
            primary={
              <Button type="button" size="sm" disabled={pending} onClick={save} data-testid="budget-save">
                {pending ? copy.saving : copy.confirmCta}
              </Button>
            }
          >
            {below ? <p className="nf-rdesk-note nf-rdesk-note--warn">{copy.confirmBelowCommitted}</p> : null}
            {big ? <p className="nf-rdesk-note nf-rdesk-note--warn">{copy.confirmRaisedBig}</p> : null}
          </ConfirmPanel>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              review();
            }}
            className="grid gap-md"
          >
            <p className="nf-rdesk-note">{copy.lede}</p>
            <div className="grid gap-xs">
              <label htmlFor={ids.month} className="nf-label">
                {copy.monthLabel}
              </label>
              <select
                id={ids.month}
                className="nf-field"
                value={month}
                onChange={(e) => {
                  const next = months.find((m) => m.value === e.target.value);
                  setMonth(e.target.value);
                  if (next) setNaira(next.capMinor !== null ? String(next.capMinor / 100) : "");
                }}
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-xs">
              <label htmlFor={ids.cap} className="nf-label">
                {copy.capLabel}
              </label>
              <input
                id={ids.cap}
                className="nf-field"
                inputMode="numeric"
                autoComplete="off"
                value={naira}
                onChange={(e) => setNaira(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="700000"
                aria-describedby={`${ids.cap}-help`}
              />
              <span id={`${ids.cap}-help`} className="nf-caption">
                {capMinor !== null ? `${money(capMinor)}. ` : ""}
                {copy.capHelp}
              </span>
            </div>
            <div className="grid gap-xs">
              <label htmlFor={ids.reason} className="nf-label">
                {copy.reasonLabel}
              </label>
              <textarea
                id={ids.reason}
                className="nf-field min-h-[84px] resize-y"
                value={reason}
                maxLength={500}
                required
                aria-required="true"
                aria-invalid={error ? true : undefined}
                placeholder={copy.reasonPlaceholder}
                onChange={(e) => setReason(e.target.value)}
              />
              <span className="nf-caption">{copy.reasonHelp}</span>
            </div>
            {error ? (
              <p className="nf-rdesk-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-xs">
              <Button type="submit" size="md" data-testid="budget-review">
                {copy.save}
              </Button>
              <Button type="button" size="md" variant="secondary" onClick={close}>
                {copy.cancel}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}
