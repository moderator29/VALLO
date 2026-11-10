import type { ReactNode } from "react";
import { CountUp } from "@/components/motion/CountUp";
import { IconPlate } from "@/components/ui/IconPlate";
import { StatusChip } from "@/components/ui/StatusChip";
import { Disclosure } from "@/components/app/Disclosure";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { ButtonLink } from "@/components/ui/Button";
import { NAIRA, describeDifference, differenceOf, formatPct, nairaFull } from "@/lib/offers/format";
import {
  OTHER_COSTS_NOT_ITEMISED,
  REQUIREMENT_FIX_LABEL,
  REQUIREMENT_STATE_WORD,
  offerChip,
  requirementChip,
} from "@/lib/offers/words";
import type { CostLine, Eligibility, OfferRow, PriceBlock } from "@/lib/offers/types";
import "./offers.css";

/** The state of an offer as a chip with a word. The viewer's side decides "Awaiting you". */
export function OfferStateChip({ row, size = "sm" }: { row: Pick<OfferRow, "state" | "turn" | "viewerSide">; size?: "xs" | "sm" | "md" }) {
  const { chip, word } = offerChip(row);
  return (
    <StatusChip state={chip} size={size}>
      {word}
    </StatusChip>
  );
}

/** A naira figure that never breaks across a line, so the sign is never orphaned. */
export function Naira({ minor, className }: { minor: number; className?: string }) {
  return <span className={["nf-ofr-money", className ?? ""].filter(Boolean).join(" ")}>{nairaFull(minor)}</span>;
}

/** Where the offer and the asking price sit on a thin track, so the gap reads at a glance. Decorative: the words carry the meaning. */
export function GapBar({ amountMinor, askingMinor }: { amountMinor: number; askingMinor: number }) {
  const lo = Math.min(amountMinor, askingMinor) * 0.9;
  const hi = Math.max(amountMinor, askingMinor) * 1.1;
  const span = hi - lo || 1;
  const offerAt = ((amountMinor - lo) / span) * 100;
  const askAt = ((askingMinor - lo) / span) * 100;
  const left = Math.min(offerAt, askAt);
  const width = Math.abs(offerAt - askAt);
  const dir = amountMinor > askingMinor ? "above" : amountMinor < askingMinor ? "below" : "at";
  return (
    <div className="nf-ofr-gapbar" data-dir={dir} aria-hidden="true" data-testid="gap-bar">
      <span className="nf-ofr-gapbar__track" />
      {width > 0 ? <span className="nf-ofr-gapbar__fill" style={{ left: `${left}%`, width: `${width}%`, transformOrigin: offerAt < askAt ? "left center" : "right center" }} /> : null}
      <span className="nf-ofr-gapbar__ask" style={{ left: `${askAt}%` }} />
      <span className="nf-ofr-gapbar__offer" style={{ left: `${offerAt}%` }} />
      <span className="nf-ofr-gapbar__key nf-ofr-gapbar__key--ask" style={{ left: `${askAt}%` }}>Asking</span>
      <span className="nf-ofr-gapbar__key nf-ofr-gapbar__key--offer" style={{ left: `${offerAt}%` }}>Offer</span>
    </div>
  );
}

/** The star figure: tabular, counts in once on first view (the kit's CountUp, off under reduced motion, Calm and Off), sign never orphaned. */
export function HeroMoney({ minor, className }: { minor: number; className?: string }) {
  const cls = ["nf-ofr-figures__hero", "nf-ofr-money", className ?? ""].filter(Boolean).join(" ");
  if (minor % 100 !== 0) return <p className={cls}>{nairaFull(minor)}</p>;
  return (
    <p className={cls} data-testid="hero-money">
      <CountUp value={minor / 100} prefix={NAIRA} />
    </p>
  );
}

/**
 * The offer, the asking price and the gap between them. The gap is an amount, a
 * percentage and a word (Above asking, Below asking, At asking), with an arrow
 * shape, so colour is never the only signal. A thin bar shows where the offer
 * sits against the asking price.
 */
export function OfferFigures({
  amountMinor,
  askingMinor,
  label = "Offer",
  atAskingPrice = false,
  bar = true,
}: {
  amountMinor: number;
  askingMinor: number;
  label?: string;
  /** The buyer left the figure blank and it resolved to the asking price. */
  atAskingPrice?: boolean;
  bar?: boolean;
}) {
  const diff = differenceOf(amountMinor, askingMinor);
  return (
    <div className="nf-ofr-figures" data-testid="offer-figures">
      <p className="nf-ofr-figures__label">{label}</p>
      <HeroMoney minor={amountMinor} />
      <div className="nf-ofr-figures__meta">
        <span className="nf-ofr-diff" data-dir={diff.direction} data-testid="offer-difference">
          {diff.direction !== "at" ? <UiIcon name={diff.direction === "above" ? "arrow-up" : "arrow-down"} size={14} /> : <UiIcon name="check" size={14} />}
          <span>{diff.word}</span>
          {diff.direction !== "at" ? (
            <span className="nf-ofr-money">
              {nairaFull(diff.absMinor)} ({formatPct(diff.pct)})
            </span>
          ) : null}
        </span>
        <span>
          Asking price <Naira minor={askingMinor} />
        </span>
      </div>
      {bar ? <GapBar amountMinor={amountMinor} askingMinor={askingMinor} /> : null}
      <span className="sr-only">{describeDifference(diff)}</span>
      {atAskingPrice ? <p className="nf-ofr-figures__label">Left blank, so this is the asking price.</p> : null}
    </div>
  );
}

/** A section heading with its icon plate: the one heading language for a card. */
export function SectionHead({ icon, title, hint, trail }: { icon: UiIconName; title: string; hint?: string; trail?: ReactNode }) {
  return (
    <div className="nf-ofr-head">
      <IconPlate size="sm" tone="brand">
        <UiIcon name={icon} size={20} />
      </IconPlate>
      <div className="min-w-0">
        <h3 className="nf-ofr-head__title">{title}</h3>
        {hint ? <p className="nf-ofr-head__hint">{hint}</p> : null}
      </div>
      {trail}
    </div>
  );
}

/** A receipt: rows of label and figure on dashed dividers, with a total line only where the caller has a real one. */
export function Receipt({ rows, total }: { rows: { label: string; value: ReactNode }[]; total?: { label: string; value: ReactNode } }) {
  return (
    <dl className="nf-ofr-receipt" data-testid="receipt">
      {rows.map((row) => (
        <div key={row.label} className="nf-ofr-receipt__row">
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
      {total ? (
        <div className="nf-ofr-receipt__row nf-ofr-receipt__row--total">
          <dt>{total.label}</dt>
          <dd>{total.value}</dd>
        </div>
      ) : null}
    </dl>
  );
}

const BASIS_WORD: Record<CostLine["basis"], string> = {
  confirmed: "Confirmed",
  estimated: "Estimate",
  optional: "Optional",
  paid_to_third_party: "Paid directly to a third party",
};

/**
 * THE HONEST PRICE BLOCK (OFFERS_AND_DEAL_ROOM.md 4.2). The asking price is the
 * price. Extra costs appear only from real configured lines, each labelled.
 * A total appears only when every part of it is real, with the breakdown one tap
 * away. Otherwise the block says plainly that other costs apply and are not yet
 * itemised. It never adds an estimate to the asking price.
 */
export function PriceBlockView({ price, title = "Price" }: { price: PriceBlock; title?: string }) {
  const hasCosts = price.costs.length > 0;
  const total = price.totalIsComplete && price.totalMinor !== null ? price.totalMinor : null;
  return (
    <div data-testid="price-block">
      <p className="nf-ofr-figures__label">{title}</p>
      <p className="nf-ofr-figures__hero nf-ofr-money" data-testid="price-asking">
        {nairaFull(price.askingMinor)}
      </p>
      <p className="nf-ofr-figures__label">Asking price</p>
      {total !== null ? (
        <p className="nf-body mt-sm" data-testid="price-total">
          With the costs below: <Naira minor={total} className="font-semibold" />. Optional items are not included.
        </p>
      ) : (
        <p className="nf-body mt-sm text-[var(--nf-content-secondary)]" data-testid="price-not-itemised">
          {hasCosts ? "These costs are known so far. " : ""}
          {OTHER_COSTS_NOT_ITEMISED}
        </p>
      )}
      {hasCosts ? (
        <Disclosure inline label={total !== null ? "See how the total is made up" : "See the costs known so far"} data-testid="price-breakdown">
          <div>
            {price.costs.map((cost) => (
              <div className="nf-ofr-cost" key={cost.label}>
                <span>{cost.label}</span>
                <Naira minor={cost.amountMinor} className="font-semibold" />
                <span className="nf-ofr-cost__basis">{BASIS_WORD[cost.basis]}</span>
              </div>
            ))}
          </div>
        </Disclosure>
      ) : null}
    </div>
  );
}

/**
 * The requirements card (the shape the reference gets right): each requirement
 * with its own state in words and, where the member can act, one Fix control
 * that goes into the existing verification flow.
 */
export function EligibilityCard({ eligibility, onFix }: { eligibility: Eligibility; onFix?: () => void }) {
  return (
    <div data-testid="eligibility-card">
      {eligibility.requirements.map((req) => {
        const fixLabel = REQUIREMENT_FIX_LABEL[req.state];
        return (
          <div className="nf-ofr-req" key={req.key} data-testid={`req-${req.key}`}>
            <span className="nf-ofr-req__name">
              <span className="nf-ofr-req__mark" data-state={req.state} aria-hidden="true">
                {req.state === "met" ? (
                  <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
                    <path className="nf-ofr-req__tick" d="M3.5 8.4 6.6 11.4 12.5 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
                  </svg>
                ) : null}
              </span>
              {req.label}
            </span>
            <span className="nf-ofr-req__end">
              <StatusChip state={requirementChip(req.state)} size="sm">
                {REQUIREMENT_STATE_WORD[req.state]}
              </StatusChip>
              {fixLabel && req.fixHref ? (
                <ButtonLink
                  href={req.fixHref}
                  variant="secondary"
                  size="sm"
                  onClick={onFix}
                  data-testid={`fix-${req.key}`}
                  aria-label={`${fixLabel}: ${req.label}`}
                >
                  {fixLabel}
                </ButtonLink>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The red notice above a form that cannot be sent yet. It always says why. */
export function BlockedNotice({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  return (
    <div className="nf-ofr-notice" role="note" data-tone={tone} data-testid="offer-blocked">
      <UiIcon name={tone === "error" ? "alert-triangle" : "info"} size={20} />
      <div>{children}</div>
    </div>
  );
}

export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <Receipt rows={items} />
  );
}
