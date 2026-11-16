"use client";

import Link from "next/link";
import { plural, type Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { ButtonLink } from "@/components/ui/Button";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { SpaceCard } from "@/components/ui/space-card/SpaceCard";
import { PersonRowItem } from "@/components/social/find/PersonCards";
import type { IntelligenceKind, IntelligenceResult, ResultAction } from "@/lib/intelligence/contract";
import { countPhrase, fill, personCardOf, priceOf, whyParts, type IntelligenceCopy } from "./model";

/** Why it matched, as the engine said it, in small pills ("2 bedrooms", "Lekki", "under ₦5m"). */
function WhyPills({ why, label }: { why: string | undefined; label: string }) {
  const parts = whyParts(why);
  if (parts.length === 0) return null;
  return (
    /* Spans, not a list element: a row puts these inside its link. */
    <span className="nf-intel-why" role="list" aria-label={label} data-testid="intel-why">
      {parts.map((part) => (
        <span key={part} role="listitem" className="nf-intel-why__pill">
          {part}
        </span>
      ))}
    </span>
  );
}

export const KIND_ICON: Record<IntelligenceKind, UiIconName> = {
  place: "location",
  property: "house",
  stay: "bed",
  restaurant: "utensils",
  roommate: "house-duplex",
  person: "user",
  community: "circle-people",
  post: "feed",
  screen: "arrow-up-right",
  guide: "file-text",
  personal: "heart",
};

/** The list each kind draws in: cards, people rows, or plain rows. */
export function listClassFor(kind: IntelligenceKind): string {
  if (kind === "property" || kind === "stay") return "nf-intel-cards";
  if (kind === "person") return "nf-ppl__list nf-intel-people";
  return "nf-intel-rows";
}

/** What a result offers beyond opening it: only the engine's own actions that go somewhere. */
function extraActions(result: IntelligenceResult): ResultAction[] {
  return (result.actions ?? []).filter((a) => a.href && a.id !== "open" && a.id !== "follow" && a.id !== "view-profile").slice(0, 2);
}

function Actions({ result }: { result: IntelligenceResult }) {
  const actions = extraActions(result);
  if (actions.length === 0) return null;
  return (
    <div className="nf-intel-actions">
      {actions.map((action) => (
        <ButtonLink key={action.id} href={action.href!} size="sm" variant="secondary" data-testid={`intel-action-${action.id}`}>
          {action.label}
        </ButtonLink>
      ))}
    </div>
  );
}

/**
 * ONE RESULT, DRAWN FOR WHAT IT IS.
 *
 *   property, stay   the app's space card (`SpaceCard`), the shape the
 *                    search results and Home use: photo, title, place, the
 *                    price with its period, bedrooms, and the "why" line;
 *   person           the app's own people row (`PersonRowItem`): "You" on
 *                    the viewer's own row, Follow only where offered;
 *   everything else  a quiet row: a thumbnail or a brand-tinted icon tile,
 *                    the title, one muted line, a chevron. A screen reads
 *                    "Go to", a guide "Guide", the member's own "Yours".
 *
 * Every field is drawn only when the record has it; nothing is filled in.
 */
export function IntelResultItem({
  result,
  position,
  copy,
  locale,
  signedIn,
  onOpen,
  eager = false,
  grouped = false,
}: {
  result: IntelligenceResult;
  /** Where it sits in what the person sees, from 1, for the click event. */
  position: number;
  copy: IntelligenceCopy;
  locale: Locale;
  signedIn: boolean;
  onOpen: (result: IntelligenceResult, position: number) => void;
  eager?: boolean;
  /** Drawn under its kind's own heading ("Go to", "Guides"), so the row does not say it again. */
  grouped?: boolean;
}) {
  const open = () => onOpen(result, position);

  if (result.kind === "person") {
    return <PersonRowItem card={personCardOf(result, copy, locale)} signedIn={signedIn} openLabel={fill(copy.people.open, { name: result.title })} onOpen={open} />;
  }

  if (result.kind === "property" || result.kind === "stay") {
    const price = priceOf(result, copy, locale);
    const facts = [result.bedrooms !== undefined ? plural(result.bedrooms, copy.understood.bedrooms, locale) : null, countPhrase(result.count, copy, locale)].filter(
      (x): x is string => Boolean(x),
    );
    return (
      <li data-testid="intel-result" data-kind={result.kind}>
        <SpaceCard
          href={result.href}
          title={result.title}
          place={result.place ?? result.subtitle ?? null}
          photos={result.imageUrl ? [result.imageUrl] : []}
          photoSizes="(max-width: 640px) 100vw, 50vw"
          fallback={
            <span className="nf-intel-nophoto" aria-hidden="true">
              <UiIcon name={KIND_ICON[result.kind]} size={28} />
            </span>
          }
          marks={
            result.verified ? (
              <span className="nf-badge nf-badge--verified nf-sc__mark">
                <UiIcon name="verified" size={12} />
                {copy.verified}
              </span>
            ) : null
          }
          price={price ? { amount: <span className="nf-numeric">{price.amount}</span>, unit: price.unit } : null}
          facts={facts}
          factsIcon={result.kind === "stay" ? "bed" : "house"}
          reason={null}
          extra={
            <>
              {/* The record's own line ("Example listing. Not available."), said
                  plainly under the facts whenever the place took the place line. */}
              {result.subtitle && result.place && result.subtitle !== result.place ? (
                <p className="nf-sc__sub" data-testid="intel-result-sub">
                  {result.subtitle}
                </p>
              ) : null}
              <WhyPills why={result.why} label={copy.whyLabel} />
            </>
          }
          footer={extraActions(result).length > 0 ? <Actions result={result} /> : null}
          eager={eager}
          onOpen={open}
          className="nf-sc--live"
        />
      </li>
    );
  }

  const price = priceOf(result, copy, locale);
  const meta = [
    result.place && result.place !== result.subtitle ? result.place : null,
    price ? [price.amount, price.unit].filter(Boolean).join(" ") : null,
    countPhrase(result.count, copy, locale),
  ].filter((x): x is string => Boolean(x));
  const overline = grouped ? null : result.kind === "screen" ? copy.goTo : result.kind === "guide" ? copy.guide : result.kind === "personal" ? copy.yours : null;

  return (
    <li className="nf-intel-row" data-testid="intel-result" data-kind={result.kind}>
      <Link href={result.href} className="nf-intel-row__link" onClick={open}>
        {result.imageUrl ? (
          <span className="nf-intel-row__thumb" aria-hidden="true">
            <RemoteImage src={result.imageUrl} alt="" width={112} height={112} sizes="56px" loading={eager ? "eager" : "lazy"} />
          </span>
        ) : (
          <span className="nf-intel-tile" aria-hidden="true">
            <UiIcon name={KIND_ICON[result.kind]} size={20} />
          </span>
        )}
        <span className="nf-intel-row__text">
          {overline ? <span className="nf-intel-row__over">{overline}</span> : null}
          <span className="nf-intel-row__title">
            <span className="nf-intel-row__name">{result.title}</span>
            {result.verified ? <UiIcon name="verified" size={14} className="nf-intel-row__tick" /> : null}
          </span>
          {result.subtitle ? <span className="nf-intel-row__sub">{result.subtitle}</span> : null}
          {meta.length > 0 ? <span className="nf-intel-row__meta nf-numeric">{meta.join(" · ")}</span> : null}
          <WhyPills why={result.why} label={copy.whyLabel} />
        </span>
        <UiIcon name="chevron-right" size={18} className="nf-intel-row__chevron" />
      </Link>
      <Actions result={result} />
    </li>
  );
}
