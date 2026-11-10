"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Locale } from "@vallo/i18n/core";
import { BrandIcon } from "@/design-system/icons/BrandIcon";
import type { TieredObjectName } from "@/design-system/icons/object-assets";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { MovementTotals, MovementView } from "@/lib/money/member-wallet";
import type { BalanceFigures } from "@/lib/money/funds";
import {
  ACTION_LABEL,
  ACTIVITY_EMPTY,
  BALANCE_TITLE,
  FIGURE_LABEL,
  HELD_BY,
  HELD_BY_HREF,
  MORE_OPTIONS,
  MORE_OPTIONS_LABEL,
  NOT_CONNECTED_FIGURE,
  NOT_CONNECTED_LINE,
  PROTECTED_SUB_NOT_CONNECTED,
  PROTECTED_TITLE,
  RECENT_LABEL,
  SEE_ALL,
  SPACE_BANNER,
  STALE_NOTE,
  TOTALS_LABEL,
  UNREACHABLE_FIGURE,
  UNREACHABLE_LINE,
  WAITING_COPY,
  WAITING_STEPS,
  confirmedAgo,
} from "@/lib/money/balance-copy";
import { MoneyFigure } from "../kit";
import { StepPath } from "../StepPath";
import { MoneyExplainer } from "../MoneyExplainer";
import { WalletCard } from "./WalletCard";
import { WALLET_LINKS, WalletCapsules, WalletHeader, WalletTabs, type WalletLinks } from "./WalletChrome";
import { MovementList, MovementsEmpty } from "./WalletRows";
import "@/app/css/money-wallet.css";

/**
 * THE WALLET OVERVIEW (D81; the founder's brief of 8 October and his
 * governing reference, the right-hand phone).
 *
 * Header (back, Wallet, the settings gear), Overview and Transactions, the
 * card (Available, the figure, Money in and Money out), where the rest of the
 * money is, "Your payments are protected" with the one custody line, a short
 * preview of recent activity with See all, the "Pay for your space" banner
 * (the only piece from the left-hand phone), More options (receipts,
 * payouts, refunds, settings) and, at the very bottom, exactly two capsules:
 * Withdraw and Send.
 *
 * One layout for every state (D78): not connected draws the whole screen with
 * no figure, not even a zero, and one short line on the card. Connected,
 * every figure arrives from the server and this component adds nothing up.
 */

/** Rows the overview previews; the rest are on the Transactions screen. */
export const OVERVIEW_ROWS = 4;

const TOOL_ART: Record<(typeof MORE_OPTIONS)[number]["href"], TieredObjectName> = {
  "/receipts": "doc-search",
  "/payouts": "banknotes-stack",
  "/refunds": "sync-arrows",
  "/wallet/settings": "wallet-card",
};

export function BalanceScreen({
  figures,
  movements,
  live,
  locale,
  now,
  connected = true,
  reason,
  totals = null,
  links = WALLET_LINKS,
}: {
  figures: BalanceFigures | null;
  movements: MovementView[];
  live: boolean;
  locale: Locale;
  /** The server's clock at render, so "confirmed n minutes ago" is the same on both sides. */
  now: number;
  /** False while the provider's key is not connected: the whole wallet, with no figure. */
  connected?: boolean;
  /** Why it is not connected, for the record (`data-reason`), never shown. */
  reason?: string;
  /** Money in and Money out from completed movements, when the server could sum them. */
  totals?: MovementTotals | null;
  links?: WalletLinks;
}) {
  const router = useRouter();
  /* D76's hide toggle: for this visit only, never stored. */
  const [hidden, setHidden] = useState(false);
  const refresh = () => router.refresh();
  const canMove = connected && live && figures !== null;
  const availableAt = figures?.available.confirmedAt ?? null;
  const unreachable = connected && figures === null;
  const settingsHref = links.settings;
  const preview = movements.slice(0, OVERVIEW_ROWS);

  const hide = (node: ReactNode) =>
    hidden ? (
      <span className="nf-mfig nf-mfig--md" aria-label="Amount hidden">
        <span aria-hidden="true">₦ ••••</span>
      </span>
    ) : (
      node
    );

  return (
    <div
      className="nf-balance nf-mw"
      data-screen="overview"
      data-capsules=""
      data-testid={connected ? "balance-screen" : "balance-not-live"}
      data-live={live ? "true" : "false"}
      data-reason={reason}
    >
      <WalletHeader title={BALANCE_TITLE} back={links.home} settings={settingsHref} />
      <WalletTabs active="overview" links={links} />

      <div className="nf-mw-cols">
        <div className="nf-mw-col">
          <WalletCard
            caption={FIGURE_LABEL.available}
            figure={
              figures ? (
                hidden ? (
                  <span className="nf-mfig nf-mfig--hero nf-mfig--hidden" data-testid="balance-available">
                    <span className="nf-mfig__cur">₦</span>
                    <span aria-hidden="true">••••••</span>
                    <span className="sr-only">Amount hidden</span>
                  </span>
                ) : (
                  <MoneyFigure minor={figures.available.minor} locale={locale} currency={figures.currency} size="hero" testId="balance-available" />
                )
              ) : undefined
            }
            empty={connected ? UNREACHABLE_FIGURE : NOT_CONNECTED_FIGURE}
            line={!connected ? NOT_CONNECTED_LINE : unreachable ? UNREACHABLE_LINE : confirmedAgo(availableAt, now)}
            tone={!connected ? "neutral" : live && figures ? "done" : "waiting"}
            corner={
              figures ? (
                <button
                  type="button"
                  className="nf-mw-card__eye"
                  aria-pressed={hidden}
                  aria-label={hidden ? "Show amount" : "Hide amount"}
                  onClick={() => setHidden((h) => !h)}
                  data-testid="balance-hide"
                >
                  <UiIcon name={hidden ? "eye-off" : "eye"} size={18} />
                </button>
              ) : null
            }
            action={
              unreachable ? (
                <button type="button" className="nf-mw-add" onClick={refresh} data-testid="balance-retry">
                  <span className="nf-mw-add__plus" aria-hidden="true">
                    <UiIcon name="history" size={14} />
                  </span>
                  <span>Try again</span>
                </button>
              ) : (
                <Link href={links.add} className="nf-mw-add" data-testid="balance-action-add">
                  <span className="nf-mw-add__plus" aria-hidden="true">
                    <UiIcon name="plus" size={14} />
                  </span>
                  <span>{ACTION_LABEL.add}</span>
                </Link>
              )
            }
            totals={
              <div className="nf-mw-card__totals" data-testid="balance-totals">
                {(["in", "out"] as const).map((way) => (
                  <div key={way} className="nf-mw-total" data-way={way}>
                    <span className="nf-mw-total__label">
                      <UiIcon name={way === "in" ? "arrow-down" : "arrow-up"} size={14} />
                      {TOTALS_LABEL[way]}
                    </span>
                    {totals && figures ? (
                      <span className="nf-mw-total__value">
                        {hide(<MoneyFigure minor={way === "in" ? totals.inMinor : totals.outMinor} locale={locale} size="md" kobo="auto" />)}
                      </span>
                    ) : (
                      <span className="nf-mw-total__none">{connected ? "Not available" : "Not connected"}</span>
                    )}
                  </div>
                ))}
              </div>
            }
          />

          {!live && figures ? (
            <p className="nf-mw-panel nf-mw-note" role="status" data-order="strip">
              <UiIcon name="info" size={18} />
              <span>{STALE_NOTE}</span>
            </p>
          ) : null}

          {figures ? (
            /* Where the rest of the money is: the three figures the provider
               reports beside Available, each with its own word. */
            <dl className="nf-mw-strip" data-order="strip" data-testid="balance-where">
              {(["protected", "pending", "processing"] as const).map((k) => (
                <div key={k}>
                  <dt>{FIGURE_LABEL[k]}</dt>
                  <dd>{hide(<MoneyFigure minor={figures[k].minor} locale={locale} currency={figures.currency} size="row" kobo="auto" />)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <section className="nf-mw-section" aria-labelledby="nf-mw-recent" data-order="activity">
            <div className="nf-mw-section__head">
              <h2 id="nf-mw-recent" className="nf-mw-section__title">
                {RECENT_LABEL}
              </h2>
              {movements.length > 0 ? (
                <Link href={links.transactions} className="nf-mw-link" data-testid="balance-see-all">
                  {SEE_ALL}
                </Link>
              ) : null}
            </div>
            {preview.length === 0 ? (
              <MovementsEmpty title={ACTIVITY_EMPTY.title} body={ACTIVITY_EMPTY.body} testId="balance-activity-empty" />
            ) : (
              <MovementList movements={preview} locale={locale} onSettled={refresh} testId="balance-activity" />
            )}
          </section>
        </div>

        <div className="nf-mw-col">
          {/* The reference's "Your funds are protected", said as it is: the
              one custody line (ADR 0003) once the money is actually held. */}
          <Link href={HELD_BY_HREF} className="nf-mw-panel nf-mw-protect" data-order="protect" data-testid="balance-protected">
            <span className="nf-mw-protect__art" data-host-plate="" aria-hidden="true">
              <BrandIcon name="shield-tick" size={30} />
            </span>
            <span className="nf-mw-protect__text">
              <span className="nf-mw-protect__title">{PROTECTED_TITLE}</span>
              <span className="nf-mw-protect__sub" data-testid={connected && figures ? "balance-held-by" : undefined}>
                {connected && figures ? HELD_BY : PROTECTED_SUB_NOT_CONNECTED}
              </span>
            </span>
            <UiIcon name="chevron-right" size={18} className="nf-mw-chev" />
          </Link>

          {/* Sweep item 25 (9 November 2026): the banner describes rent paid
              from Wallet and held until the move-in, which is the protected
              rail. It is drawn only once Wallet is connected. */}
          {connected ? (
            <section className="nf-mw-banner" data-theme="dark" aria-labelledby="nf-mw-banner" data-order="banner" data-testid="balance-banner">
              <Image className="nf-mw-banner__photo" src="/brand/photos/villa-exterior-sunset-640.jpg" alt="" width={640} height={427} unoptimized aria-hidden="true" />
              <h2 id="nf-mw-banner" className="nf-mw-banner__title">
                {SPACE_BANNER.title}
              </h2>
              <p className="nf-mw-banner__body">{SPACE_BANNER.body}</p>
              <Link href={SPACE_BANNER.href} className="nf-mw-banner__cta">
                {SPACE_BANNER.action}
                <UiIcon name="chevron-right" size={16} />
              </Link>
            </section>
          ) : null}

          <section className="nf-mw-section" aria-labelledby="nf-mw-more" data-order="more">
            <div className="nf-mw-section__head">
              <h2 id="nf-mw-more" className="nf-mw-section__title">
                {MORE_OPTIONS_LABEL}
              </h2>
            </div>
            <nav className="nf-mw-panel nf-mw-tools" aria-labelledby="nf-mw-more" data-testid="balance-records">
              {MORE_OPTIONS.map((t) => (
                <Link key={t.href} href={t.href === "/wallet/settings" ? settingsHref : t.href} className="nf-mw-tool">
                  <span className="nf-mw-tool-art" data-host-plate="" aria-hidden="true">
                    <BrandIcon name={TOOL_ART[t.href]} size={28} />
                  </span>
                  <span className="nf-mw-tool__title">{t.title}</span>
                  <span className="nf-mw-tool__sub">{t.sub}</span>
                </Link>
              ))}
            </nav>
          </section>
        </div>
      </div>

      <WalletCapsules links={links} />

      {canMove && figures ? <BalanceExplainer figures={figures} locale={locale} /> : null}
    </div>
  );
}

/** The explainer's sample withdrawal: first step done, second in progress, the rest ahead. */
const EXPLAINER_STEP_STATE = ["done", "current", "upcoming"] as const;

/**
 * The first visit to a live wallet (PREMIUM-STANDARD reference 9). Three
 * panels, each a fragment of the real screen drawn from the member's own
 * Available figure. The words are the screen's own.
 */
function BalanceExplainer({ figures, locale }: { figures: BalanceFigures; locale: Locale }) {
  const availableMinor = figures.available.minor;
  const currency = figures.currency;
  const half = Math.floor(availableMinor / 2 / 100) * 100;
  return (
    <MoneyExplainer
      storageKey="nf-explainer-balance-v1"
      name="Wallet"
      testId="balance-explainer"
      panels={[
        {
          key: "held",
          title: "Held in your name",
          body: "Our licensed provider holds it in an account in your name, never Vallo. Vallo keeps the record of every movement.",
          screenTone: "platinum",
          screen: (
            <>
              <span className="nf-frag__label">{FIGURE_LABEL.available}</span>
              <MoneyFigure minor={availableMinor} locale={locale} currency={currency} size="lg" kobo="auto" />
            </>
          ),
          fragment: (
            <div className="nf-frag nf-frag--card">
              <span className="nf-frag__row">
                <span>Where your money is</span>
                <UiIcon name="chevron-right" size={16} />
              </span>
              <span className="nf-frag__split">
                <span>
                  <span className="nf-frag__label">{FIGURE_LABEL.protected}</span>
                  <MoneyFigure minor={figures.protected.minor} locale={locale} currency={currency} size="md" kobo="auto" />
                </span>
                <span>
                  <span className="nf-frag__label">{FIGURE_LABEL.pending}</span>
                  <MoneyFigure minor={figures.pending.minor} locale={locale} currency={currency} size="md" kobo="auto" />
                </span>
              </span>
            </div>
          ),
        },
        {
          key: "withdraw",
          title: "Withdraw when you want",
          screen: <span className="nf-frag__label">{ACTION_LABEL.withdraw}</span>,
          body: "Choose an amount, see every fee before you confirm, and slide to send it to your bank.",
          fragment: (
            <div className="nf-frag">
              <span className="nf-frag__pill">
                {FIGURE_LABEL.available} <MoneyFigure minor={availableMinor} locale={locale} currency={currency} size="row" kobo="auto" />
              </span>
              <MoneyFigure minor={half} locale={locale} currency={currency} size="lg" kobo="auto" />
              <span className="nf-frag__line">To a bank account in your name</span>
              <span className="nf-frag__chips" aria-hidden="true">
                <span className="nf-frag__chip">25%</span>
                <span className="nf-frag__chip" data-on="true">
                  50%
                </span>
                <span className="nf-frag__chip">Max</span>
              </span>
            </div>
          ),
        },
        {
          key: "steps",
          title: "Every step, shown",
          body: WAITING_COPY.withdrawal.body,
          fragment: (
            <StepPath
              compact
              label="Where a withdrawal is"
              steps={WAITING_STEPS.withdrawal.map((step, i) => ({ key: step, title: step, state: EXPLAINER_STEP_STATE[Math.min(i, 2)] ?? "upcoming" }))}
            />
          ),
        },
      ]}
    />
  );
}
