import type { ReactNode } from "react";
import { StatusChip } from "@/components/ui/StatusChip";
import { Disclosure } from "@/components/app/Disclosure";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ButtonLink } from "@/components/ui/Button";
import { describeDifference, differenceOf, formatPct, nairaFull } from "@/lib/offers/format";
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

/**
 * The offer, the asking price and the gap between them. The gap is an amount, a
 * percentage and a word (Above asking, Below asking, At asking), with an arrow
 * shape, so colour is never the only signal.
 */
export function OfferFigures({
  amountMinor,
  askingMinor,
  label = "Offer",
  atAskingPrice = false,
}: {
  amountMinor: number;
  askingMinor: number;
  label?: string;
  /** The buyer left the figure blank and it resolved to the asking price. */
  atAskingPrice?: boolean;
}) {
  const diff = differenceOf(amountMinor, askingMinor);
  return (
    <div className="nf-ofr-figures" data-testid="offer-figures">
      <p className="nf-ofr-figures__label">{label}</p>
      <p className="nf-ofr-figures__hero nf-ofr-money">{nairaFull(amountMinor)}</p>
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
      <span className="sr-only">{describeDifference(diff)}</span>
      {atAskingPrice ? <p className="nf-ofr-figures__label">Left blank, so this is the asking price.</p> : null}
    </div>
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
            <span className="nf-ofr-req__name">{req.label}</span>
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
    <dl className="nf-ofr-facts">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
