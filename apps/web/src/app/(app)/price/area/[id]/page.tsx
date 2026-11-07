import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { ButtonLink } from "@/components/ui/Button";
import { Section, Stack } from "@/components/app/Screen";
import { DiscoveryEmpty } from "@/components/app/search/DiscoveryEmpty";
import { PageFrame } from "@/components/app/PageFrame";
import { listStates } from "@/lib/places/queries";
import { shareById } from "@/lib/price-check/queries";
import { AreaShareCard } from "@/components/share/AreaShareCard";
import { shareLines, shareMonth } from "@/lib/price-check/share-card";
import { Disclaimer } from "@/components/app/price/ResultPanel";
import { shareCardCopy } from "@/components/app/price/share-copy";
import "@/app/css/price-check.css";

/**
 * `/price/area/[id]`. WHERE A SHARE CARD LANDS.
 *
 * ---------------------------------------------------------------------------
 * THE DESTINATION IS THE HALF OF A SHARE THAT USUALLY GETS SKIPPED.
 *
 * Stage one shipped a share enum, a share table, a check constraint and a
 * server action with nowhere for a card to go. A link with no destination is
 * not a share, and a card that cannot be opened cannot be checked by anybody
 * against the rule it is supposed to obey.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS ON THIS PAGE, AND WHAT CANNOT BE.
 *
 * An area, a type, a bedroom count, a range and the count the range came from.
 * NO ADDRESS, and not because this page politely declines to print one: the
 * row it reads has no address, latitude, longitude or listing id column, the
 * scope enum has no label for a property, and a check constraint refuses an
 * area string shaped like a street address. There is nothing here to print.
 *
 * THE FIGURES ARE FROZEN AND THE PAGE SAYS SO. A card that silently
 * recalculated would be a record of nothing, which is the same reasoning saved
 * checks are frozen under. It carries the month it was made, so a reader who
 * meets it a year from now can see how old it is rather than trusting a number
 * with no date on it.
 *
 * ---------------------------------------------------------------------------
 * A STRANGER ARRIVES HERE AND `/price` IS OPEN TO THEM.
 *
 * `price` is deliberately not in `proxy.ts`'s `PRODUCT_SEGMENTS`, which
 * `lib/price-check/route-openness.test.ts` holds in place with the reasoning,
 * and this route inherits that because the proxy decides on the FIRST path
 * segment. A forwarded card that bounced its reader to a sign-in wall would be
 * the one thing worse than a card nobody can open.
 *
 * ---------------------------------------------------------------------------
 * THE DISCLAIMER TRAVELS WITH THE FIGURE.
 *
 * Rule 3 of `PRICE_CHECK_DISCLAIMER`: it goes with any figure that leaves the
 * product, and a share card is the definition of a figure that has left. The
 * reader of this page may never have seen `/price` at all, so the page does
 * not assume they have read anything.
 */

type Params = { params: Promise<{ id: string }> };

/**
 * THE TITLE AND THE CARD ARE A READ, NEVER A GUESS.
 *
 * `/price` declares STATIC metadata and says why: a title built from a query
 * string would put somebody's own neighbourhood into a page title and into
 * whatever crawls it, and a machine-readable tag is a claim the product has to
 * be able to stand behind. This route is the other case. What it names is a
 * STORED ROW that somebody deliberately published, and every word of it is
 * already on the page, so reading it is neither a guess nor a disclosure.
 *
 * A row that cannot be read gets a title and NO OPEN GRAPH BLOCK at all.
 * `opengraph-image.tsx` refuses in the same breath, so nothing unfurls a card
 * that does not exist.
 *
 * `metadata` and `generateMetadata` may not both be exported from one route,
 * which is why the static one is gone rather than kept as a fallback.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const [locale, share] = await Promise.all([getLocale(), shareById(id)]);
  const t = getDictionary(locale);
  if (share === null) {
    /* A CARD THAT IS NOT THERE GETS NO TITLE AND NO IMAGE. An Open Graph tag
       is a claim, and there is nothing to claim about a row we could not
       read. `opengraph-image.tsx` refuses in the same breath, so nothing
       crawls a card that does not exist. */
    return { title: t.priceCheck.share.missingTitle };
  }
  const states = await listStates();
  const stateName = states.find((row) => row.code === share.stateCode)?.name ?? share.stateCode;
  const lines = shareLines(share, shareCardCopy(t), locale, stateName);
  return {
    title: lines.headline,
    description: `${lines.range}. ${lines.basis} ${lines.footer}`,
    openGraph: {
      title: lines.headline,
      description: `${lines.range}. ${lines.basis}`,
      type: "website",
    },
  };
}

export default async function AreaSharePage({ params }: Params) {
  const { id } = await params;
  const [locale, share] = await Promise.all([getLocale(), shareById(id)]);
  const t = getDictionary(locale);
  const copy = t.priceCheck.share;

  if (share === null) {
    /*
     * ONE SENTENCE FOR THREE DIFFERENT CAUSES, AND IT SAYS SO.
     *
     * A card that was never minted, an id that was mistyped and a database we
     * could not reach all arrive here as null, and this page cannot tell them
     * apart. Naming one of the three would be a claim about our own data that
     * nobody checked, which is the same fault as a refusal that was really an
     * outage. So the copy says what is true of all three and offers the one
     * thing that always works: run a check of your own.
     */
    return (
      <PageFrame title={t.priceCheck.title} fallback="/price" width="narrow">
        {/* Stage 5: the object settles, the reason is the true one, and the
            one way onward is a check of their own. */}
        <DiscoveryEmpty
          object="doc-search"
          title={copy.missingTitle}
          body={copy.missingBody}
          primary={{ href: "/price", label: copy.checkYours }}
          data-testid="nf-pc-share-missing"
        />
      </PageFrame>
    );
  }

  const states = await listStates();
  const stateName = states.find((row) => row.code === share.stateCode)?.name ?? share.stateCode;
  const lines = shareLines(share, shareCardCopy(t), locale, stateName);
  const madeOn = shareMonth(share.createdAt, locale);

  return (
    <PageFrame title={t.priceCheck.title} subtitle={copy.pageLead} fallback="/price" width="narrow">
      <Stack>
        <Section>
          {/* THE SHARE CARD FRAME (spec section 10), the same card the unfurl
              image draws. ALL FIGURES AT ONE SIZE and the midpoint is not
              drawn at all; THE COUNT THE FIGURE CAME FROM is on it, always,
              never behind a tap, because this is the artefact most likely to
              be read by somebody who never saw the screen it came from. */}
          <h1 className="sr-only">{lines.headline}</h1>
          <AreaShareCard lines={lines} chip={copy.cardChip} testId="nf-pc-share-card" />
        </Section>

        <Section>
          {/* THE FIGURES ARE FROZEN AND THE PAGE SAYS WHEN. A card that
              silently updated would be a record of nothing. */}
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">
            {madeOn === null ? copy.frozen : `${copy.madeOn.replace("{month}", madeOn)} ${copy.frozen}`}
          </p>
          {/* RULE 3 OF THE DISCLAIMER: it travels with any figure that leaves
              the product, and this page IS the figure having left. */}
          <Disclaimer />
        </Section>

        <Section>
          <div className="flex flex-col gap-row">
            <ButtonLink href="/price" variant="primary" full glow>
              {copy.checkYours}
            </ButtonLink>
            {/* The area, not the address, which is the only thing this card
                knows and the only thing a search can honestly be filtered by
                from here. */}
            <ButtonLink
              href={`/search?state=${encodeURIComponent(share.stateCode)}${
                share.area === null ? "" : `&area=${encodeURIComponent(share.area)}`
              }`}
              variant="ghost"
              full
            >
              {copy.seeListings}
            </ButtonLink>
          </div>
        </Section>
      </Stack>
    </PageFrame>
  );
}
