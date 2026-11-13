import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { listingById } from "@/lib/listings/listing-by-id";
import { proofFactsOf, proofLines } from "@/lib/trust/proof-strip";
import { readListingCredentials } from "@/lib/trust/credentials-read";
import { readListingRecord } from "@/lib/trust/record-read";
import { doorHonestyLine, readDoorHonesty } from "@/lib/tenancy/door";
import { marketOf } from "@/lib/listings/market";
import { PageHeader } from "@/components/app/PageHeader";
import { Section, Stack, TYPE } from "@/components/app/Screen";
import { ValloRecord } from "@/components/app/trust/ValloRecord";
import { TrustFacts } from "@/components/app/listing/TrustFacts";
import { earnedTrust, withEarnedTrust } from "@/components/app/listing/earned-trust";
import { ListingAgentCard } from "@/components/app/listing/ListingAgentCard";
import { ReplyTimeLine } from "@/components/app/listing/ReplyTimeLine";
import { PhotographedLine } from "@/components/app/listing/PhotographedLine";
import { CautionRecordLine } from "@/components/app/listing/CautionRecordLine";

/**
 * "WHY TRUST THIS SPACE?", AS ITS OWN PAGE (D25, north star 16.6).
 *
 * The listing page carried two jobs: deciding whether the space suits you, and
 * deciding whether the people and the facts behind it can be believed. The
 * second job is answered completely here, with its own back destination (the
 * space it belongs to), its own loading (`loading.tsx`), its own error
 * (`error.tsx`) and its own empty state (TrustFacts' dated-nothing line). The
 * listing page keeps a summary and the door to this one, so nothing a person
 * needs to act is a tap away: the price, the fees and every dated fact stay on
 * the listing page too.
 *
 * EVERY CHECK OPENS (13 November 2026). Each dated fact is a row; tapping it
 * says when, who did it, what was looked at and what it does not prove. The
 * rows are in two groups, the space and the person who listed it, because
 * "identity seen" and "title document seen" are claims about different
 * things. With nothing dated the page says so and then explains how a space
 * earns each check, so the answer to the question is never one bare sentence.
 *
 * EVERY FACT IS A DATE AND EVERY ABSENCE IS SILENT. Nothing here is a tick,
 * nothing is "not verified", and an example row reads as a plain unchecked
 * listing (`earnedTrust`, D24): no badge, no date, no rating, no record.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await listingById(id);
  if (!listing) notFound();
  const t = getDictionary(await getLocale());
  return {
    title: `${t.experienceDetail.trust.title} ${listing.title}`,
    /* A page of dated checks about one listing is not a search result. */
    robots: { index: false, follow: true },
  };
}

export default async function SpaceTrustPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const raw = await listingById(id);
  if (!raw) notFound();
  const listing = withEarnedTrust(raw);
  const trust = earnedTrust(raw);
  const copy = t.experienceDetail.trust;
  const isRental = marketOf(listing) === "tenancy";

  /* The same reads the listing page makes, and the same refusal on an example
     row: it has no credentials, no record and no tenancy reviews to read. */
  const [credentials, record, door] = await Promise.all([
    listing.isDemo ? Promise.resolve([]) : readListingCredentials(listing.id),
    listing.isDemo ? Promise.resolve(null) : readListingRecord(listing.id),
    listing.isDemo ? Promise.resolve(null) : readDoorHonesty(listing.id),
  ]);
  const proof = proofLines({ ...proofFactsOf(listing), credentials });
  const doorLine = door === null ? null : doorHonestyLine(door, t.trustVisible.tenancy);
  const messageHref = `/messages/new?listing=${listing.id}`;
  const nothingDated = !trust.inspectedAt && !trust.addressCheckedAt && proof.length === 0;

  return (
    <div className="nf-cat-surface mx-auto w-full max-w-2xl pb-section" data-testid="space-trust">
      <PageHeader title={copy.title} subtitle={listing.title} subtitleHref={`/listing/${listing.id}`} fallback={`/listing/${listing.id}`} />

      <Stack className="nf-trust-page">
        <Section className="nf-trust-page__lead">
          <div>
            {/* Every dated fact as a row that opens, split by what was looked
                at, under the one sentence the page is read by. With nothing
                dated: the plain statement, the one person
                who can answer (never on an example row, which has nobody to
                message), and how a space earns each check. */}
            <TrustFacts
              listingId={listing.id}
              trust={trust}
              strip={null}
              proofCount={proof.length}
              lines={proof}
              locale={locale}
              t={t}
              variant="full"
              askHref={nothingDated && !listing.isDemo ? messageHref : null}
            />
          </div>
        </Section>

        {doorLine && (
          <Section title={t.catalogue.detail.reviews} divided>
            <p className={TYPE.body} data-testid="door-honesty">{doorLine}</p>
          </Section>
        )}

        <Section title={copy.whoLists} divided>
          <ListingAgentCard
            verified={trust.verified}
            t={t}
            messageHref={messageHref}
            name={listing.listerName ?? null}
            listingRole={listing.listerRole ?? null}
          />
          {!listing.isDemo && <ReplyTimeLine listingId={listing.id} locale={locale} className="mt-2xs" />}
          <ValloRecord record={record} t={t} locale={locale} className="mt-row" />
          {/* Both render nothing until their record supports a line. */}
          {!listing.isDemo && <PhotographedLine listingId={listing.id} locale={locale} />}
          {!listing.isDemo && isRental && (
            <CautionRecordLine listingId={listing.id} listerName={null} locale={locale} />
          )}
        </Section>
      </Stack>
    </div>
  );
}
