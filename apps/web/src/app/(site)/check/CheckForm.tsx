"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { banner } from "@/lib/ui/toast";
import { formatDate, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import type { ActionResult } from "@/lib/actions/envelope";
import { checkAgent, type CheckOutcome } from "@/lib/doors/agent-check-actions";
import { BRAND_DOMAIN } from "@/lib/brand-domain";

type CheckCopy = Dictionary["trustDoors"]["check"];
type WarningCopy = Dictionary["publicDoors"]["warning"];

/**
 * A7: the fixed warning a renter can forward after a "no match". It never
 * carries the number that was checked: the text is the same for everybody,
 * so sharing it names no one.
 */
export function warningShareHref(copy: WarningCopy): string {
  return `https://wa.me/?text=${encodeURIComponent(copy.text.replace("{url}", `${BRAND_DOMAIN}/check`))}`;
}

/**
 * The check itself. One field, one button, and the answer drawn under it in
 * words and an icon, never colour alone: a tick and the agent's name for yes,
 * a stop mark and "do not pay them anything" for no.
 */
export function CheckForm({
  copy,
  locale,
  initial,
  warning,
  compact = false,
}: {
  copy: CheckCopy;
  locale: Locale;
  initial: string;
  /** The "Share this warning" copy; without it the no-match answer offers no share. */
  warning?: WarningCopy;
  /** The landing card: the label is visually hidden because the card's title asks the question. */
  compact?: boolean;
}) {
  const fieldId = useId();
  const [state, action, pending] = useActionState<ActionResult<CheckOutcome> | null, FormData>(checkAgent, null);
  /* Held here so the typed number survives the answer: a form action resets
     its uncontrolled fields, which emptied the field under "that is not a
     number" and made the visitor type it again. */
  const [query, setQuery] = useState(initial);
  useEffect(() => {
    if (state && !state.ok) banner.error(copy.failed, { "data-testid": "check-failed" });
    // Once per answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="mt-md">
      <form action={action} className="grid gap-sm">
        <label htmlFor={fieldId} className={compact ? "sr-only" : "nf-label"}>
          {copy.label}
        </label>
        <input
          id={fieldId}
          name="query"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.placeholder}
          className="nf-field"
          maxLength={40}
          data-testid="check-query"
        />
        <Button type="submit" variant="primary" size="md" full loading={pending} data-testid="check-submit">
          {copy.submit}
        </Button>
      </form>

      <div aria-live="polite" className="mt-md">
        {/* A failed check is said by the one banner at the top of the screen (founder, 7 November 2026). */}
        {state?.ok && <CheckAnswer outcome={state.data} copy={copy} locale={locale} warning={warning} />}
      </div>
    </div>
  );
}

export function CheckAnswer({
  outcome,
  copy,
  locale,
  warning,
}: {
  outcome: CheckOutcome;
  copy: CheckCopy;
  locale: Locale;
  warning?: WarningCopy;
}) {
  if (outcome.state === "unreadable") {
    return (
      <Note tone="warning" icon="info">
        {copy.unreadable}
      </Note>
    );
  }
  if (outcome.state === "limited") {
    return (
      <Note tone="warning" icon="hourglass">
        {copy.limited.replace("{when}", outcome.retryIn)}
      </Note>
    );
  }
  const result = outcome.result;
  if (!result.found) {
    return (
      <div className="nf-check-answer" data-tone="warning" data-testid="check-no">
        <p className="nf-check-answer__title">
          <IconPlate size="sm" shape="round" tone="warning">
            <UiIcon name="shield-stop" size={20} />
          </IconPlate>
          {result.kind === "code" ? copy.noCodeTitle : copy.noTitle}
        </p>
        <p className="nf-check-answer__body">{result.kind === "code" ? copy.noCodeBody : copy.noBody}</p>
        {warning && (
          <>
            <ButtonLink
              href={warningShareHref(warning)}
              variant="secondary"
              size="md"
              full
              leadingIcon="share"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="check-warning-share"
            >
              {warning.share}
            </ButtonLink>
            <p className="nf-caption text-[var(--nf-content-muted)]">{warning.note}</p>
          </>
        )}
      </div>
    );
  }
  /* THE CLAIMS RULE. A code proves only that the code exists: a scammer can
     quote a real agent's code. So a code answer names the owner of the code
     and says to message them on Vallo; no badge unless an identity document
     was actually checked, and no sentence at all when it was not. */
  const checked = result.identityCheckedAt
    ? copy.yesIdentity.replace(
        "{date}",
        formatDate(new Date(result.identityCheckedAt), locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }),
      )
    : null;
  const title =
    result.kind === "code"
      ? (result.displayName ? copy.codeTitle.replace("{name}", result.displayName) : copy.codeTitleNoName).replace("{code}", result.code ?? "")
      : result.displayName
        ? copy.yesTitle.replace("{name}", result.displayName)
        : copy.yesTitleNoName;
  return (
    <div className="nf-check-answer" data-tone={checked ? "success" : "neutral"} data-testid="check-yes">
      <p className="nf-check-answer__title">
        <IconPlate size="sm" shape="round" tone={checked ? "success" : "neutral"}>
          <UiIcon name={checked ? "verified-badge" : "user"} size={20} />
        </IconPlate>
        {title}
      </p>
      {result.role && (
        <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">{copy.yesRole[result.role]}</p>
      )}
      {result.kind === "code" && result.hint && (
        <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">{copy.codeHint.replace("{hint}", result.hint)}</p>
      )}
      {checked && <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">{checked}</p>}
      <p className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
        {result.kind === "code" ? copy.codeCheck : copy.yesWhy}
      </p>
      {result.handle && (
        <ButtonLink href={`/u/${encodeURIComponent(result.handle)}`} variant="secondary" size="md" full>
          {copy.yesTalk}
        </ButtonLink>
      )}
    </div>
  );
}

/** A one-line state under the field: a glyph and the words, never colour alone. */
function Note({
  tone,
  icon,
  alert = false,
  testId,
  children,
}: {
  tone: "error" | "warning";
  icon: UiIconName;
  alert?: boolean;
  testId?: string;
  children: string;
}) {
  return (
    <p className="nf-check-note" data-tone={tone} role={alert ? "alert" : undefined} data-testid={testId}>
      <UiIcon name={icon} size={16} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
