"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";
import type { Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { BrandIcon } from "@/design-system/icons/BrandIcon";
import { ButtonLink } from "@/components/ui/Button";
import { feedback } from "@/lib/ui/feedback";
import { MOVE_COPY, NOT_CONNECTED_FIGURE } from "@/lib/money/balance-copy";
import { cleanNaira, groupNaira } from "@/lib/money/wallet-view";
import { MoneyFigure } from "../kit";

/**
 * THE MOVE-MONEY KIT (D81; the Dribbble "Supay" reference the founder named
 * for top up, send and payment steps): the Available line, the amount large
 * under "Enter amount", quick chips, a row that opens a choice, the keypad,
 * and the honest end of a flow that cannot run yet. It holds nothing: each
 * screen owns its plain figure ("25000"), exactly what the server parses.
 */

export function AvailableLine({ minor, locale, connected }: { minor: number | null; locale: Locale; connected: boolean }) {
  return (
    <p className="nf-mw-avail" data-testid="move-available">
      <span>{MOVE_COPY.available}</span>
      {minor !== null ? <MoneyFigure minor={minor} locale={locale} size="row" kobo="auto" /> : <span>{connected ? "Not available right now" : NOT_CONNECTED_FIGURE}</span>}
    </p>
  );
}

/** The figure as a real text field: a keyboard types into it, a screen reader hears a labelled amount. */
export function AmountEntry({ value, onChange, label, hint }: { value: string; onChange(next: string): void; label: string; hint?: ReactNode }) {
  const id = useId();
  const shown = groupNaira(value);
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className="nf-mw-amount" data-testid="move-amount">
      <label htmlFor={id} className="nf-mw-amount__label">
        {MOVE_COPY.enterAmount}
        <span className="sr-only">, {label}</span>
      </label>
      <div className="nf-mw-amount__figure nf-numeric" data-long={value.length > 7 ? "" : undefined}>
        <span className="nf-mw-amount__cur" aria-hidden="true">
          ₦
        </span>
        {/* The figure is drawn by this span; the field lies over it, clear,
            because a phone forces every field to 16px (touch.css) and the
            figure has to be large. The field still takes typing and focus. */}
        <span className="nf-mw-amount__digits" aria-hidden="true" data-empty={shown ? undefined : ""}>
          {shown || "0"}
        </span>
        <input
          id={id}
          className="nf-mw-amount__input"
          inputMode="none"
          autoComplete="off"
          value={shown}
          onChange={(e) => onChange(cleanNaira(e.target.value))}
          onKeyDown={onKey}
          data-testid="move-amount-input"
        />
      </div>
      {hint ? <p className="nf-mw-amount__hint">{hint}</p> : null}
    </div>
  );
}

export type QuickAmount = { label: string; naira: number | null };

/** Round figures to tap; a `null` chip ("Other") clears the figure for typing. */
export function QuickChips({ chips, value, onChange }: { chips: QuickAmount[]; value: string; onChange(next: string): void }) {
  return (
    <div className="nf-mw-quick" role="group" aria-label="Quick amounts" data-testid="move-quick">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          className="nf-mw-chip"
          aria-pressed={c.naira !== null && value !== "" && Number(value) === c.naira}
          onClick={() => {
            feedback("select");
            onChange(c.naira === null ? "" : String(c.naira));
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"] as const;

/** The phone's keyboard on this screen. Hidden from a laptop up, where the field takes typing. */
export function Keypad({ value, onChange }: { value: string; onChange(next: string): void }) {
  const press = (key: (typeof KEYS)[number]) => {
    feedback("select");
    if (key === "del") onChange(value.slice(0, -1));
    else onChange(cleanNaira(value + key));
  };
  return (
    <div className="nf-mw-keys" role="group" aria-label="Keypad" data-testid="move-keypad">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className="nf-mw-key nf-numeric"
          onClick={() => press(key)}
          aria-label={key === "del" ? "Delete last digit" : key === "00" ? "Double zero" : key}
          disabled={key === "del" ? value === "" : value.length >= 11 || (value === "" && (key === "0" || key === "00"))}
        >
          {key === "del" ? (
            <UiIcon name="backspace" size={24} />
          ) : (
            key
          )}
        </button>
      ))}
    </div>
  );
}

/** A row that opens a choice: the method, the recipient, the bank account. */
export function PickRow({
  label,
  value,
  lead,
  onOpen,
  action = MOVE_COPY.change,
  testId,
}: {
  label: string;
  value: string;
  lead: ReactNode;
  onOpen(): void;
  action?: string;
  testId?: string;
}) {
  return (
    <button type="button" className="nf-mw-panel nf-mw-pick" onClick={onOpen} data-testid={testId}>
      {lead}
      <span className="nf-mw-pick__text">
        <span className="nf-mw-pick__label">{label}</span>
        <span className="nf-mw-pick__value">{value}</span>
      </span>
      <span className="nf-mw-pick__change">{action}</span>
    </button>
  );
}

export function PickArt({ name }: { name: Parameters<typeof BrandIcon>[0]["name"] }) {
  return (
    <span className="nf-mw-tool-art" data-host-plate="" aria-hidden="true">
      <BrandIcon name={name} size={30} />
    </span>
  );
}

export function Initial({ name }: { name: string }) {
  return (
    <span className="nf-mw-avatar" aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/**
 * THE HONEST END (the founder: never a faked success). When Wallet is not
 * connected, the last step of a flow says so plainly, in one line, and moves
 * nothing: no figure, no reference, no "sent".
 */
export function NotAvailable({ body, back, icon = "clock" }: { body: string; back: string; icon?: UiIconName }) {
  return (
    <div className="nf-mw-panel nf-mw-result" role="status" data-testid="move-not-available">
      <span className="nf-mw-tool-art" aria-hidden="true">
        <UiIcon name={icon} size={24} />
      </span>
      <p className="nf-mw-result__title">{MOVE_COPY.notAvailableTitle}</p>
      <p className="nf-mw-result__body">{body}</p>
      <ButtonLink href={back} variant="secondary" size="lg" full data-testid="move-back">
        {MOVE_COPY.backToWallet}
      </ButtonLink>
    </div>
  );
}

/** What the member chose, read back before anything is asked of the server. */
export function Summary({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="nf-mw-panel nf-mw-sum" data-testid="move-summary">
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
