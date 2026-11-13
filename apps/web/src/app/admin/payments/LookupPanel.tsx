import { getDictionary, type Dictionary, type Locale } from "@vallo/i18n";
import type { SavedMethods } from "@/lib/admin/payments-queries";
import type { TermsStanding } from "@/lib/admin/legal-queries";
import type { AdminRead, SubjectLookup } from "@/lib/admin/queries";
import type { AdminUi } from "../_components/ui";
import { fill } from "../_components/copy";
import { RemoveSavedMethod } from "./MethodLookup";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import { Button } from "@/components/ui/Button";

/**
 * The payment-method lookup panel.
 *
 * "Which card is on my account" and "take that bank account off, I lost the
 * phone" are two of the commonest things support is asked, and until this
 * panel an operator could answer neither without SQL. The search is a GET so
 * the answer is a URL a colleague can open; the person is found by handle,
 * address or id through the console's one subject lookup; the cards are
 * shown as the processor filed them (brand, last four, expiry) and the
 * accounts masked to their tail, because an operator never needs more than
 * the tail to confirm "the one ending 4821" with the person on the phone.
 *
 * Out of the page so the preview harness draws the same panel the desk draws.
 */
export function LookupPanel({
  term,
  lookup,
  methods,
  standing = null,
  ui,
  base = "/admin/payments",
  locale = "en",
}: {
  term: string;
  lookup: AdminRead<SubjectLookup | null> | null;
  methods: AdminRead<SavedMethods> | null;
  /**
   * What this person agreed to and when. Optional, and null is a real state
   * that the row below says out loud, so a caller that has not fetched it and
   * a person who has nothing on file are never confused for one another.
   */
  standing?: AdminRead<TermsStanding> | null;
  ui: AdminUi;
  /** Where the GET lands. The desk's own path unless a harness says otherwise. */
  base?: string;
  /** The console's locale; English when a harness passes none. */
  locale?: Locale;
}) {
  const c = getDictionary(locale).admin.payments.lookup;
  return (
    <ui.Section title={c.title} hint={c.hint}>
      <form method="get" action={base} className="flex flex-wrap items-end gap-row">
        <label className="min-w-0 flex-1">
          <span className="nf-label">{c.field}</span>
          <input
            type="search"
            enterKeyHint="search"
            name="q"
            defaultValue={term}
            placeholder={c.placeholder}
            className="nf-field mt-inline-tight w-full"
          />
        </label>
        <Button type="submit" variant="secondary" className="shrink-0">
          {c.submit}
        </Button>
      </form>

      {term.length > 0 && (
        <LookupResult lookup={lookup} methods={methods} standing={standing} ui={ui} locale={locale} />
      )}
    </ui.Section>
  );
}

export function LookupResult({
  lookup,
  methods,
  standing = null,
  ui,
  locale = "en",
}: {
  lookup: AdminRead<SubjectLookup | null> | null;
  methods: AdminRead<SavedMethods> | null;
  standing?: AdminRead<TermsStanding> | null;
  ui: AdminUi;
  locale?: Locale;
}) {
  const t = getDictionary(locale);
  const c = t.admin.payments.lookup;
  const removeCopy = { remove: t.admin.payments.remove, notNow: t.admin.common.notNow };
  if (!lookup || lookup.state !== "ok") {
    return (
      <div className="mt-sm">
        <ui.QueueUnavailable />
      </div>
    );
  }
  const found: SubjectLookup | null = lookup.data;
  if (found === null) {
    return (
      <p className="nf-body-sm mt-sm text-content-2">{c.unreadable}</p>
    );
  }
  if (found.state === "email-unavailable") {
    return (
      <p className="nf-body-sm mt-sm text-content-2">{c.emailOff}</p>
    );
  }
  if (found.state === "none") {
    return (
      <p className="nf-body-sm mt-sm text-content-2">{c.noMatch[found.by]}</p>
    );
  }

  const { subject } = found;
  const saved: SavedMethods | null = methods && methods.state === "ok" ? methods.data : null;

  return (
    <div className="mt-sm">
      <p className="nf-body font-semibold text-content">
        {subject.displayName ?? t.admin.money.noDisplayName}
        {subject.handle ? ` · @${subject.handle}` : ""}
      </p>
      {/* THE ID, UNCLIPPED: what an operator pastes into the money desk to
          find this person's wallet. */}
      <p className="font-mono text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)] [overflow-wrap:anywhere] [user-select:all]">
        {subject.userId}
      </p>

      <TermsRow standing={standing} c={c} />

      {saved === null ? (
        <div className="mt-sm">
          <ui.QueueUnavailable />
        </div>
      ) : (
        <>
          <h3 className="nf-h4 mt-group">{c.savedCards}</h3>
          {saved.cards.length === 0 ? (
            <p className="nf-body-sm mt-row text-content-2">{c.noCards}</p>
          ) : (
            <ul className="nf-rows mt-row">
              {saved.cards.map((card) => {
                const brand = card.cardType
                  ? card.cardType.charAt(0).toUpperCase() + card.cardType.slice(1)
                  : c.card;
                const describe = fill(c.ending, { what: brand, last4: card.last4 ?? "????" });
                return (
                  /* The words keep 12rem beside the glyph; the action wraps under
                     them on a phone instead of squeezing them to a word a line
                     (C1 sweep, 390). Same for the accounts and the terms rows. */
                  <li key={card.id} className="nf-row flex-wrap">
                    {/* The saved card's plated glyph. Never a card number beside it. */}
                    <IconPlate size="sm" className="shrink-0">
                      <UiIcon name="credit-card" size={20} />
                    </IconPlate>
                    <span className="min-w-[12rem] flex-1 basis-0">
                      <span className="nf-body-sm block font-semibold text-content">
                        {describe}
                        {card.bank ? ` · ${card.bank}` : ""}
                      </span>
                      <span className="nf-caption block">
                        {card.expMonth && card.expYear
                          ? fill(c.expires, { month: String(card.expMonth).padStart(2, "0"), year: card.expYear })
                          : c.noExpiry}
                        {card.isDefault && !card.removedAt ? c.isDefault : ""}
                        {!card.reusable ? c.notChargeable : ""}
                        {c.saved}
                        {ui.when(card.createdAt)}
                      </span>
                    </span>
                    {card.removedAt ? (
                      <ui.StatusChip label={fill(c.removedOn, { when: ui.when(card.removedAt) })} tone="neutral" />
                    ) : (
                      <RemoveSavedMethod kind="card" id={card.id} describe={describe} copy={removeCopy} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="nf-h4 mt-group">{c.bankAccounts}</h3>
          {saved.accounts.length === 0 ? (
            <p className="nf-body-sm mt-row text-content-2">{c.noAccounts}</p>
          ) : (
            <ul className="nf-rows mt-row">
              {saved.accounts.map((account) => {
                const describe = fill(c.ending, { what: account.bankName, last4: account.accountNumberMasked.slice(-4) });
                return (
                  <li key={account.id} className="nf-row flex-wrap">
                    {/* The bank account's glyph: the column, not a card. */}
                    <IconPlate size="sm" className="shrink-0">
                      <UiIcon name="bank" size={20} />
                    </IconPlate>
                    <span className="min-w-[12rem] flex-1 basis-0">
                      <span className="nf-body-sm block font-semibold text-content">
                        {account.bankName}
                        {" · "}
                        <span className="nf-numeric">{account.accountNumberMasked}</span>
                      </span>
                      <span className="nf-caption block">
                        {account.accountName}
                        {account.isDefault && !account.removedAt ? c.isDefault : ""}
                        {c.filed}
                        {ui.when(account.createdAt)}
                      </span>
                    </span>
                    {account.removedAt ? (
                      <ui.StatusChip
                        label={fill(c.removedOn, { when: ui.when(account.removedAt) })}
                        tone="neutral"
                      />
                    ) : (
                      <RemoveSavedMethod kind="account" id={account.id} describe={describe} copy={removeCopy} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/**
 * What this person agreed to, and when.
 *
 * THE FIRST QUESTION ASKED IN EVERY DISPUTE, and until `terms_acceptances`
 * existed the console could not answer it, because nothing had ever written it
 * down: the sign-up form carried a version string, the auth metadata carried
 * it onward, and `profiles` had no column to put it in.
 *
 * Three states, said apart rather than collapsed. A read that failed is not an
 * empty answer. An account with nothing on file is not an account that
 * refused: every account made before 22 September 2026 has nothing on file
 * because nothing was being recorded, and the row says exactly that instead of
 * implying somebody declined.
 */
function TermsRow({
  standing,
  c,
}: {
  standing: AdminRead<TermsStanding> | null;
  c: Dictionary["admin"]["payments"]["lookup"];
}) {
  if (!standing || standing.state !== "ok") {
    return <p className="nf-body-sm mt-row text-content-2">{c.termsUnread}</p>;
  }
  if (standing.data.nothingOnFile) {
    return <p className="nf-body-sm mt-row text-content-2">{c.termsNone}</p>;
  }
  return (
    <ul className="nf-rows mt-row">
      {standing.data.accepted.map((accepted) => (
        <li key={`${accepted.document}-${accepted.version}`} className="nf-row flex-wrap">
          <span className="min-w-[12rem] flex-1 basis-0">
            <span className="nf-body-sm block font-semibold text-content">
              {fill(accepted.document === "privacy" ? c.acceptedPrivacy : c.acceptedTerms, { version: accepted.version })}
            </span>
            <span className="nf-body-sm block text-content-2">
              {new Date(accepted.acceptedAt).toISOString().slice(0, 10)} · {accepted.source}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
