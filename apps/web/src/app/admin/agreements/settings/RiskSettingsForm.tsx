"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { NairaField } from "@/components/ui/NairaField";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/Field";
import { saveRiskSettings, setReviewKillSwitch } from "@/lib/admin/agreements-actions";
import {
  MAX_CHANGE_DAYS,
  RULING_THRESHOLD_MINOR,
  SIGNALS,
  thresholdFieldText,
  type RiskSettings,
  type SignalChecks,
} from "@/lib/admin/risk-settings";
import { parseNairaToKobo } from "@/lib/money/amount";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * D77: the risk settings, one form, and the incident switch apart from it, as
 * a deliberate act with a reason. The database checks the scope, validates the
 * values and writes the audit log; this screen only asks.
 */
export function RiskSettingsForm({ settings, locale }: { settings: RiskSettings; locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [threshold, setThreshold] = useState(thresholdFieldText(settings.amountThresholdMinor));
  const [days, setDays] = useState(String(settings.recentChangeDays));
  const [checks, setChecks] = useState<SignalChecks>(settings.checks);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const thresholdMinor = parseNairaToKobo(threshold);
  const daysNumber = /^\d{1,2}$/.test(days.trim()) ? Number(days.trim()) : null;
  const daysOk = daysNumber !== null && daysNumber <= MAX_CHANGE_DAYS;
  const changed =
    thresholdMinor !== settings.amountThresholdMinor ||
    daysNumber !== settings.recentChangeDays ||
    SIGNALS.some((s) => checks[s.key] !== settings.checks[s.key]);
  const offCount = SIGNALS.filter((s) => !checks[s.key]).length;

  function save() {
    setMessage(null);
    start(async () => {
      const r = await saveRiskSettings({ thresholdNaira: threshold, recentChangeDays: daysNumber ?? -1, checks });
      setMessage(r.ok ? { tone: "ok", text: "Saved. The next deal both parties agree is read against these settings." } : { tone: "error", text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="nf-risk-settings">
      <section className="nf-panel nf-panel--card nf-admin-card nf-risk-settings__block" aria-labelledby="risk-threshold">
        <h2 id="risk-threshold" className="nf-risk-settings__title">
          Review threshold
        </h2>
        <p className="nf-risk-settings__lede">
          A direct-rail deal above this amount waits for a person. The founder&apos;s ruling is{" "}
          {formatMoney(RULING_THRESHOLD_MINOR, locale)}. Protected payments never wait here: the provider holds the money.
        </p>
        <div className="nf-risk-settings__fields">
          <NairaField
            label="Threshold"
            value={threshold}
            onValueChange={setThreshold}
            allowKobo
            error={thresholdMinor === null ? "Enter an amount in naira." : undefined}
            hint={thresholdMinor !== null ? `Deals above ${formatMoney(thresholdMinor, locale)} are reviewed.` : undefined}
            data-testid="risk-threshold"
          />
          <TextField
            label="Change window, in days"
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            error={daysOk ? undefined : `From 0 to ${MAX_CHANGE_DAYS} days.`}
            hint="A price or listing change this recent is a signal. 0 turns the window off."
            data-testid="risk-days"
          />
        </div>
      </section>

      <section className="nf-panel nf-panel--card nf-admin-card nf-risk-settings__block" aria-labelledby="risk-signals">
        <h2 id="risk-signals" className="nf-risk-settings__title">
          Signals
        </h2>
        <p className="nf-risk-settings__lede">
          Any signal that fires sends a direct-rail deal to review. A signal turned off is not read at all.
        </p>
        <ul className="nf-risk-settings__signals">
          {SIGNALS.map((s) => (
            <li key={s.key} className="nf-risk-settings__signal">
              <Switch
                checked={checks[s.key]}
                onCheckedChange={(next) => setChecks((c) => ({ ...c, [s.key]: next }))}
                label={s.title}
                description={s.detail}
                data-testid={`risk-signal-${s.key}`}
              />
            </li>
          ))}
        </ul>
        {offCount > 0 && (
          <p className="nf-risk-settings__caution" role="note">
            {`Signals off: ${offCount}.`} Deals it would have caught open without a person.
          </p>
        )}
        <div className="nf-risk-settings__actions">
          <Button variant="primary" onClick={save} loading={pending} disabled={!changed || thresholdMinor === null || !daysOk}>
            Save settings
          </Button>
          {settings.updatedAt && (
            <span className="nf-risk-settings__meta">
              {settings.setByStaff ? "Last saved" : "Seeded"} {new Date(settings.updatedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}
            </span>
          )}
        </div>
        {message && (
          <p role={message.tone === "error" ? "alert" : "status"} className={`nf-risk-settings__message nf-risk-settings__message--${message.tone}`}>
            {message.text}
          </p>
        )}
      </section>

      <KillSwitch on={settings.killSwitchOn} note={settings.killSwitchNote} />
    </div>
  );
}

function KillSwitch({ on, note }: { on: boolean; note: string | null }) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const next = !on;
  return (
    <section
      className={`nf-panel nf-panel--card nf-admin-card nf-risk-settings__block nf-risk-kill${on ? " nf-risk-kill--on" : ""}`}
      aria-labelledby="risk-kill"
    >
      <h2 id="risk-kill" className="nf-risk-settings__title">
        Incident switch: review every deal
      </h2>
      <p className="nf-risk-settings__lede">
        {on
          ? "ON. Every deal waits for a person, on both rails, and no system-approved payment opens."
          : "Off. Deals are read against the signals above."}{" "}
        For a fraud wave or an outage, not for routine use.
      </p>
      {on && note && <p className="nf-risk-settings__meta">Turned on because: {note}</p>}
      <div className="nf-risk-settings__fields">
        <TextField
          label={next ? "Why turn it on" : "Why turn it off"}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint="At least ten characters. Kept in the audit log."
          data-testid="risk-kill-reason"
        />
      </div>
      <div className="nf-risk-settings__actions">
        <Button
          variant={next ? "dangerQuiet" : "primary"}
          loading={pending}
          disabled={reason.trim().length < 10}
          onClick={() =>
            start(async () => {
              const r = await setReviewKillSwitch({ on: next, reason });
              setMessage(r.ok ? (next ? "Every deal now waits for review." : "Back to the signals.") : r.error);
              if (r.ok) {
                setReason("");
                router.refresh();
              }
            })
          }
        >
          {next ? "Turn on: review every deal" : "Turn off"}
        </Button>
      </div>
      {message && (
        <p role="status" className="nf-risk-settings__message">
          {message}
        </p>
      )}
    </section>
  );
}
