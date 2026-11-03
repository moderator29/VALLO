"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { countOf, formatMoney, intlTag, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { NairaField } from "@/components/ui/NairaField";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { TYPE } from "@/components/app/Screen";
import { saveDepositSettings } from "@/lib/reservations/deposit-settings-actions";
import {
  PARTY_MAX,
  PARTY_MIN,
  REFUND_HOUR_CHOICES,
  depositSettingsProblem,
  percentFromBps,
  type DepositSettings,
} from "@/lib/reservations/deposit-rules";
import type { DeskDeposits, DeskWindow } from "@/lib/reservations/deposit-settings";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * THE RESTAURANT'S TABLE DEPOSIT SETTINGS (track/restaurant-deposits), on the
 * table desk. On or off; an amount per guest or for the table; which parties
 * (every party, or from a size); which times (every service window, or the
 * ones picked, e.g. Friday and Saturday dinner); and the free cancellation
 * time. Saved through `saveDepositSettings`, which writes the venue's
 * `restaurant_deposit_rules` as the owner under RLS. Drawn only while
 * `restaurant_deposits` is on (the route reads it on the server).
 */

type Words = Dictionary["tableDeposits"]["desk"];

/** "Fri 18:00-23:00": the weekday in the reader's language, the hours on the 24-hour clock. */
function windowLabel(w: DeskWindow, locale: Locale): string {
  /* 4 January 2026 was a Sunday, so day 4 + weekday names weekday 0 to 6. */
  const day = new Intl.DateTimeFormat(intlTag[locale], { weekday: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, 0, 4 + w.weekday)),
  );
  return `${day} ${w.opens.slice(0, 5)}-${w.closes.slice(0, 5)}`;
}

export function depositSummaryLine(s: DepositSettings, words: Words, locale: Locale): string {
  if (!s.on) return words.summaryOff;
  const amount = formatMoney(s.amountMinor, locale, "NGN");
  const parts = [
    (s.perGuest ? words.summaryPerGuest : words.summaryPerTable).replace("{amount}", amount),
    s.minPartySize === null ? words.summaryEveryParty : words.summaryFromParty.replace("{count}", String(s.minPartySize)),
    s.windowIds === null ? words.summaryAllTimes : words.summarySomeTimes,
    s.refundUntilHours === 0
      ? words.summaryRefundUntilTable
      : words.summaryRefund.replace("{hours}", countOf(s.refundUntilHours, "hours", locale)),
  ];
  return parts.join(", ");
}

/** Two answers to one question, as the platform's choice chips (`aria-pressed`). */
function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2xs" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="nf-choice"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DepositSettingsCard({
  deposits,
  words,
  locale,
}: {
  deposits: DeskDeposits;
  words: Words;
  locale: Locale;
}) {
  const [venueId, setVenueId] = useState(deposits.venues[0]?.businessId ?? "");
  const venue = deposits.venues.find((v) => v.businessId === venueId) ?? deposits.venues[0];
  const [saved, setSaved] = useState<Record<string, DepositSettings>>(() =>
    Object.fromEntries(deposits.venues.map((v) => [v.businessId, v.settings])),
  );
  const [draft, setDraft] = useState<DepositSettings>(venue?.settings ?? deposits.venues[0]!.settings);
  const [amount, setAmount] = useState(String(Math.round((venue?.settings.amountMinor ?? 0) / 100)));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const windows = venue?.windows ?? [];
  const current: DepositSettings = useMemo(
    () => ({ ...draft, amountMinor: Math.round(Number(amount || "0") * 100) }),
    [draft, amount],
  );
  const problem = depositSettingsProblem(current, windows.map((w) => w.id));
  if (!venue) return null;
  const set = (patch: Partial<DepositSettings>) => {
    setMessage(null);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const pickVenue = (id: string) => {
    const next = deposits.venues.find((v) => v.businessId === id);
    if (!next) return;
    const s = saved[id] ?? next.settings;
    setVenueId(id);
    setDraft(s);
    setAmount(String(Math.round(s.amountMinor / 100)));
    setMessage(null);
  };
  const save = () =>
    start(async () => {
      try {
        setMessage(null);
        const result = await saveDepositSettings({ businessId: venue.businessId, settings: current });
        if (!result.ok) {
          setMessage({ ok: false, text: result.error });
          return;
        }
        setSaved((all) => ({ ...all, [venue.businessId]: result.data.settings }));
        setDraft(result.data.settings);
        setMessage({ ok: true, text: words.saved });
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const shown = saved[venue.businessId] ?? venue.settings;

  return (
    <section className="nf-panel nf-panel--card block p-card" aria-labelledby="deposit-settings-title" data-testid="deposit-settings">
      <div className="flex flex-wrap items-start justify-between gap-inline">
        <div className="min-w-0">
          <h2 id="deposit-settings-title" className="nf-h4 flex items-center gap-inline-tight text-[var(--nf-content-primary)]">
            <UiIcon name="credit-card" size={20} aria-hidden />
            {words.title}
          </h2>
          <p className={`mt-inline-tight ${TYPE.rowMeta}`}>{words.lede}</p>
        </div>
      </div>
      <p className={`mt-row ${TYPE.rowTitle}`} data-testid="deposit-settings-summary">
        {depositSummaryLine(shown, words, locale)}
      </p>

      {!deposits.payoutReady && (
        <p
          className={`mt-row flex items-start gap-inline-tight rounded-[var(--nf-container-radius)] bg-[var(--nf-surface-raised)] px-row py-inline ${TYPE.rowMeta}`}
          data-testid="deposit-payout-missing"
        >
          <UiIcon name="bank" size={16} className="mt-[0.15rem] shrink-0" aria-hidden />
          <span>
            {words.payoutMissing}{" "}
            <Link href="/settings/payments" className="font-semibold text-[var(--nf-content-link)] underline underline-offset-4">
              {words.payoutLink}
            </Link>
          </span>
        </p>
      )}

      <div className="mt-row grid gap-row border-t border-[var(--nf-border-subtle)] pt-row">
        {deposits.venues.length > 1 && (
          <label className="grid gap-inline-tight">
            <span className={TYPE.label}>{words.venue}</span>
            <select className="nf-field w-full sm:max-w-sm" value={venue.businessId} onChange={(e) => pickVenue(e.target.value)}>
              {deposits.venues.map((v) => (
                <option key={v.businessId} value={v.businessId}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <Switch
          checked={draft.on}
          onCheckedChange={(on) => set({ on })}
          label={words.on}
          description={draft.on ? undefined : words.offHint}
          data-testid="deposit-on"
        />

        {draft.on && (
          <div className="grid gap-row lg:grid-cols-2">
            <div className="grid gap-inline">
              <NairaField
                label={words.amount}
                hint={words.amountHint}
                value={amount}
                onValueChange={(v) => {
                  setMessage(null);
                  setAmount(v);
                }}
                data-testid="deposit-amount"
              />
              <Choices
                label={words.amount}
                options={[
                  { value: "guest", label: words.perGuest },
                  { value: "table", label: words.perTable },
                ]}
                value={draft.perGuest ? "guest" : "table"}
                onChange={(v) => set({ perGuest: v === "guest" })}
              />
            </div>

            <div className="grid gap-inline">
              <span className={TYPE.label}>{words.parties}</span>
              <Choices
                label={words.parties}
                options={[
                  { value: "every", label: words.everyParty },
                  { value: "from", label: words.fromParty },
                ]}
                value={draft.minPartySize === null ? "every" : "from"}
                onChange={(v) => set({ minPartySize: v === "every" ? null : (draft.minPartySize ?? 6) })}
              />
              {draft.minPartySize !== null && (
                <div className="flex items-center gap-sm" role="group" aria-label={words.partySize}>
                  <Button
                    variant="glass"
                    size="sm"
                    iconOnly
                    aria-label={words.fewer}
                    disabled={draft.minPartySize <= PARTY_MIN}
                    onClick={() => set({ minPartySize: Math.max(PARTY_MIN, (draft.minPartySize ?? 2) - 1) })}
                    className="grid h-11 w-11 place-items-center rounded-[var(--nf-radius-sm)]"
                  >
                    <UiIcon name="minus" size={16} aria-hidden />
                  </Button>
                  <span className={`nf-numeric ${TYPE.rowTitle}`} data-testid="deposit-party">
                    {words.partyValue.replace("{count}", String(draft.minPartySize))}
                  </span>
                  <Button
                    variant="glass"
                    size="sm"
                    iconOnly
                    aria-label={words.more}
                    disabled={draft.minPartySize >= PARTY_MAX}
                    onClick={() => set({ minPartySize: Math.min(PARTY_MAX, (draft.minPartySize ?? 2) + 1) })}
                    className="grid h-11 w-11 place-items-center rounded-[var(--nf-radius-sm)]"
                  >
                    <UiIcon name="plus" size={16} aria-hidden />
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-inline">
              <span className={TYPE.label}>{words.times}</span>
              {windows.length === 0 ? (
                <p className={TYPE.rowMeta}>{words.noWindows}</p>
              ) : (
                <>
                  <Choices
                    label={words.times}
                    options={[
                      { value: "all", label: words.allTimes },
                      { value: "some", label: words.someTimes },
                    ]}
                    value={draft.windowIds === null ? "all" : "some"}
                    onChange={(v) => set({ windowIds: v === "all" ? null : (draft.windowIds ?? []) })}
                  />
                  {draft.windowIds !== null && (
                    <div className="flex flex-wrap gap-2xs" role="group" aria-label={words.times}>
                      {windows.map((w) => {
                        const on = draft.windowIds?.includes(w.id) ?? false;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            className="nf-choice nf-numeric"
                            aria-pressed={on}
                            onClick={() =>
                              set({
                                windowIds: on
                                  ? (draft.windowIds ?? []).filter((id) => id !== w.id)
                                  : [...(draft.windowIds ?? []), w.id],
                              })
                            }
                          >
                            {windowLabel(w, locale)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-inline">
              <label className="grid gap-inline-tight">
                <span className={TYPE.label}>{words.refund}</span>
                <select
                  className="nf-field w-full"
                  value={String(draft.refundUntilHours)}
                  onChange={(e) => set({ refundUntilHours: Number(e.target.value) })}
                  data-testid="deposit-refund"
                >
                  {REFUND_HOUR_CHOICES.map((h) => (
                    <option key={h} value={h}>
                      {h === 0 ? words.refundUntilTable : words.refundHours.replace("{hours}", countOf(h, "hours", locale))}
                    </option>
                  ))}
                </select>
              </label>
              <p className={TYPE.caption}>{words.refundHint}</p>
            </div>
          </div>
        )}

        <div className={`grid gap-inline-tight ${TYPE.caption}`}>
          <p>{words.money}</p>
          {deposits.commissionBps !== null && deposits.commissionBps > 0 ? (
            <p>{words.commission.replace("{percent}", percentFromBps(deposits.commissionBps))}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-inline">
          <Button variant="primary" disabled={pending || problem !== null} loading={pending} onClick={save} data-testid="deposit-save">
            {pending ? words.saving : words.save}
          </Button>
          {problem && draft.on ? <p className={TYPE.rowMeta}>{words.problems[problem]}</p> : null}
        </div>
        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={`${TYPE.rowMeta} ${message.ok ? "" : "text-[var(--nf-state-error)]"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
