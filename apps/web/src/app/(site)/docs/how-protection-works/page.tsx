import type { Metadata } from "next";
import { formatMoney } from "@vallo/i18n/core";
import { JsonLd } from "@/components/site/JsonLd";
import { breadcrumbLd } from "@/lib/site/structured-data";
import { DocCallout, DocCrossLink, DocHeader, DocSection, DocSummary } from "@/components/docs/DocArticle";
import { DocFlow, type DocFlowStep } from "@/components/docs/DocFlow";
import { DocHelpPanel } from "@/components/docs/DocShell";
import { DocTable, type DocTableTone } from "@/components/docs/DocTable";
import { DocToc } from "@/components/docs/DocToc";
import {
  PROTECTED_HOW,
  PROTECTED_NOT_OPEN,
  PROTECTED_PAYER_DEFAULT,
  PROTECTED_STAGE_LABEL,
  SALE_NEVER_PAID_ON_VALLO,
  protectedFeeBand,
  protectedFeeRange,
  protectedPartnerLine,
  protectedPayoutFee,
} from "@/lib/money/copy";
import {
  MONEY_IN_BAND_ONE_BPS,
  MONEY_IN_BAND_ONE_CAP_MINOR,
  MONEY_IN_BAND_ONE_MAX_MINOR,
  MONEY_IN_BAND_TWO_BPS,
  MONEY_IN_BAND_TWO_MAX_MINOR,
  MONEY_IN_FEE_PAYER,
  MONEY_IN_FIXED_MINOR,
  MONEY_OUT_LARGE_MINOR,
  MONEY_OUT_SMALL_MAX_MINOR,
  MONEY_OUT_SMALL_MINOR,
  protectedQuote,
} from "@/lib/money/protected-fees";
import { bpsAsPercentText } from "@/lib/money/percent";
import type { ProtectedStage } from "@/lib/money/protected-journey";
import { PROTECTED_FUNDS_WORDING_FULL, PROTECTED_PROVIDER_NAME, THIRD_PARTIES_LINE, VALLO_NEVER_HOLDS_PROMISE } from "@/lib/money/protected-wording";
import { SITE_CARD } from "@/lib/site/site-card";
import { UiIcon } from "@/design-system/icons/UiIcon";
import "./how.css";

/**
 * HOW PROTECTION WORKS (BUILD 7.7, "How your money is protected"; spec two,
 * I, custody explanation). The trust page for the protected rail, on the
 * docs kit, inside the docs frame. Written to be read by a nervous person:
 * the custodian in the provider's own words, the flow, what each state means,
 * the fees (computed from lib/money/protected-fees.ts, never typed), what it
 * does not cover, and the dispute process. It says plainly that protected
 * payment is not open yet, and names no date. Every sentence is in
 * lib/money/copy.ts (`PROTECTED_HOW`); the provider's and the custodian's
 * names are the constants in protected-wording.ts. The screens' "How
 * protection works" link lands here.
 */

const PATH = "/docs/how-protection-works";
const UPDATED = "2026-11-10";
const H = PROTECTED_HOW;

export const metadata: Metadata = {
  title: H.title,
  description: H.summary,
  alternates: { canonical: PATH },
  openGraph: { type: "article", siteName: "Vallo", title: H.title, description: H.summary, images: [SITE_CARD] },
};

const naira = (minor: number) => formatMoney(minor, "en", "NGN");
const percent = (bps: number) => `${bpsAsPercentText(bps)}%`;

const SECTIONS = [
  { id: "who-holds-the-money", title: H.who.title },
  { id: "how-it-moves", title: H.flow.title },
  { id: "states", title: H.states.title },
  { id: "which-deals", title: H.deals.title },
  { id: "fees", title: H.fees.title },
  { id: "limits", title: H.limits.title },
  { id: "if-something-goes-wrong", title: H.dispute.title },
  { id: "what-vallo-does", title: H.does.title },
];

const FLOW_ICONS = ["file-check", "bank", "send", "shield-check", "key", "hand-coins"] as const;
const FLOW_LINKS: (string | undefined)[] = ["/docs/agreements-and-paying", undefined, undefined, "#states", undefined, "#states"];

const STATE_TONE: Record<Exclude<ProtectedStage, "expired" | "failed">, DocTableTone> = {
  awaiting_transfer: "pending",
  confirming: "pending",
  protected: "info",
  release_processing: "active",
  released: "success",
  disputed: "pending",
  refund_processing: "active",
  refunded: "success",
  requires_review: "pending",
};

const EXAMPLES_MINOR = [150_000_00, 1_800_000_00, 4_500_000_00];

export default function HowProtectionWorksPage() {
  const flow: DocFlowStep[] = H.flow.steps.map((step, i) => ({
    icon: FLOW_ICONS[i] ?? "info",
    title: step.title,
    outcome: step.outcome,
    ...(FLOW_LINKS[i] ? { href: FLOW_LINKS[i] } : {}),
  }));
  const payer = MONEY_IN_FEE_PAYER === "seller" ? H.fees.lister : PROTECTED_PAYER_DEFAULT;
  const bandTwoFrom = naira(MONEY_IN_BAND_ONE_MAX_MINOR + 100);

  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Vallo", path: "/" },
          { name: "Documentation", path: "/docs" },
          { name: H.title, path: PATH },
        ])}
      />
      <article className="grid gap-xl" data-testid="how-protection-works">
        <DocHeader
          category={{ icon: "hand-coins", label: H.category }}
          title={H.title}
          updated={UPDATED}
          related={[
            { href: "/docs/paying-on-vallo", label: H.related.paying },
            { href: "/docs/refunds-and-cancellations", label: H.related.refunds },
          ]}
        >
          <p>{H.summary}</p>
        </DocHeader>

        <DocCallout tone="not-live" title={H.notOpenTitle}>
          <p data-testid="how-not-open">{PROTECTED_NOT_OPEN}</p>
        </DocCallout>

        <DocSummary items={[...H.glance]} />

        <DocToc sections={SECTIONS} />

        <div className="grid gap-xl">
          <DocSection id="who-holds-the-money" number={1} title={H.who.title}>
            <p>{H.who.lead}</p>
            <figure className="nf-how-custody" data-testid="how-custodian">
              <span className="nf-how-custody__plate" aria-hidden="true">
                <UiIcon name="bank" size={22} />
              </span>
              <blockquote className="nf-how-custody__words">
                <p>{PROTECTED_FUNDS_WORDING_FULL}</p>
              </blockquote>
            </figure>
            <p>{protectedPartnerLine(PROTECTED_PROVIDER_NAME)}</p>
            <p>{H.who.vallo}</p>
            <p>{THIRD_PARTIES_LINE}</p>
            <p>{VALLO_NEVER_HOLDS_PROMISE}</p>
          </DocSection>

          <DocSection id="how-it-moves" number={2} title={H.flow.title}>
            <DocFlow label={H.flow.label} steps={flow} end={H.flow.end} />
          </DocSection>

          <DocSection id="states" number={3} title={H.states.title}>
            <DocTable
              caption={H.states.caption}
              captionHidden
              columns={[
                { key: "state", label: H.states.columns.state, kind: "state" },
                { key: "means", label: H.states.columns.means },
                { key: "you", label: H.states.columns.you },
              ]}
              rows={(Object.keys(H.states.rows) as (keyof typeof H.states.rows)[]).map((key) => ({
                id: key,
                cells: {
                  state: { state: PROTECTED_STAGE_LABEL[key], tone: STATE_TONE[key] },
                  means: H.states.rows[key].means,
                  you: H.states.rows[key].you,
                },
              }))}
            />
          </DocSection>

          <DocSection id="which-deals" number={4} title={H.deals.title}>
            <DocTable
              caption={H.deals.caption}
              captionHidden
              columns={[
                { key: "deal", label: H.deals.columns.deal },
                { key: "how", label: H.deals.columns.how },
                { key: "release", label: H.deals.columns.release },
              ]}
              rows={[
                { id: "rent", icon: "key", cells: { deal: H.deals.names.rent, how: H.deals.rent, release: H.deals.keys } },
                { id: "stays", icon: "bed", cells: { deal: H.deals.names.stays, how: H.deals.stays, release: H.deals.checkIn } },
                { id: "sale", icon: "land-plot", cells: { deal: H.deals.names.sale, how: H.deals.sale, release: H.deals.none } },
              ]}
            />
            <p>{SALE_NEVER_PAID_ON_VALLO}</p>
            <p>{H.deals.approval}</p>
          </DocSection>

          <DocSection id="fees" number={5} title={H.fees.title}>
            <p>{H.fees.lead}</p>
            <p>{H.fees.schedule}</p>
            <DocTable
              caption={H.fees.caption}
              captionHidden
              columns={[
                { key: "amount", label: H.fees.columns.amount, numeric: true },
                { key: "fee", label: H.fees.columns.fee },
                { key: "who", label: H.fees.columns.who },
              ]}
              rows={[
                {
                  id: "band-one",
                  cells: {
                    amount: protectedFeeRange(null, naira(MONEY_IN_BAND_ONE_MAX_MINOR)),
                    fee: protectedFeeBand(percent(MONEY_IN_BAND_ONE_BPS), naira(MONEY_IN_FIXED_MINOR), naira(MONEY_IN_BAND_ONE_CAP_MINOR)),
                    who: payer,
                  },
                },
                {
                  id: "band-two",
                  cells: {
                    amount: protectedFeeRange(bandTwoFrom, naira(MONEY_IN_BAND_TWO_MAX_MINOR)),
                    fee: protectedFeeBand(percent(MONEY_IN_BAND_TWO_BPS), naira(MONEY_IN_FIXED_MINOR), null),
                    who: payer,
                  },
                },
              ]}
            />
            <p>{H.fees.aboveBand}</p>
            <DocTable
              caption={H.fees.examplesCaption}
              columns={[
                { key: "amount", label: H.fees.exampleColumns.amount, numeric: true },
                { key: "fee", label: H.fees.exampleColumns.fee, numeric: true },
                { key: "payer", label: H.fees.exampleColumns.payer, numeric: true },
                { key: "lister", label: H.fees.exampleColumns.lister, numeric: true },
              ]}
              rows={EXAMPLES_MINOR.flatMap((amount) => {
                const q = protectedQuote(amount);
                return q
                  ? [
                      {
                        id: String(amount),
                        cells: {
                          amount: naira(amount),
                          fee: naira(q.moneyInFeeMinor),
                          payer: naira(q.buyerPaysMinor),
                          lister: naira(q.sellerReceivesMinor),
                        },
                      },
                    ]
                  : [];
              })}
            />
            <p>
              {H.fees.payout} {protectedPayoutFee(naira(MONEY_OUT_SMALL_MINOR), naira(MONEY_OUT_SMALL_MAX_MINOR), naira(MONEY_OUT_LARGE_MINOR))}
            </p>
            <p>{H.fees.identity}</p>
          </DocSection>

          <DocSection id="limits" number={6} title={H.limits.title}>
            <ul data-testid="how-limits">
              {H.limits.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </DocSection>

          <DocSection id="if-something-goes-wrong" number={7} title={H.dispute.title}>
            <ol>
              {H.dispute.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <DocCallout tone="note">
              <p>{H.dispute.timing}</p>
            </DocCallout>
            <p>
              <DocCrossLink href="/docs/refunds-and-cancellations">{H.related.refunds}</DocCrossLink>
            </p>
          </DocSection>

          <DocSection id="what-vallo-does" number={8} title={H.does.title}>
            <DocTable
              caption={H.does.caption}
              captionHidden
              columns={[
                { key: "what", label: H.does.columns.what },
                { key: "vallo", label: H.does.columns.vallo, kind: "yesno" },
              ]}
              rows={H.does.rows.map((row, i) => ({ id: `does-${i}`, cells: { what: row.what, vallo: { yes: row.yes } } }))}
            />
            <p>
              <DocCrossLink href="/terms">{H.related.terms}</DocCrossLink>
            </p>
          </DocSection>
        </div>

        <DocHelpPanel href="/contact" />
      </article>
    </div>
  );
}
