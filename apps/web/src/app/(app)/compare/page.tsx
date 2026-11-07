import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { State } from "@/components/ui/State";
import { loadListingsByIds } from "@/lib/listings/supabase-repository";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { COMPARE_MAX, idsFromQuery } from "@/lib/compare/ids";
import { comparable, compareTable } from "@/lib/saved/compare";
import { CompareView } from "./CompareView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).catalogue.compare.page.title, robots: { index: false, follow: true } };
}

/**
 * /compare (backlog row 7): up to four published places side by side, read
 * from the ids in the address so the page can be sent to somebody. Every fact
 * is the listing's own (`lib/saved/compare.ts`); a place that is no longer
 * published, or is a stay or a restaurant, is left out and counted in a line.
 */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.catalogue.compare;
  const { ids: idsParam } = await searchParams;
  const ids = idsFromQuery(idsParam).slice(0, COMPARE_MAX);

  const found = ids.length > 0 && isSupabaseConfigured() ? await loadListingsByIds(await createClient(), ids) : new Map();
  const listings = ids.map((id) => found.get(id)).filter((l) => l !== undefined).filter(comparable);
  const left = ids.length - listings.length;

  const table = compareTable(
    listings,
    locale,
    {
      moveIn: copy.moveIn,
      rent: copy.rent,
      beds: copy.beds,
      baths: copy.baths,
      size: copy.size,
      parking: copy.parking,
      type: copy.type,
      power: copy.power,
      availableFrom: copy.availableFrom,
      from: copy.from,
    },
    t.moveIn,
  );

  return (
    <div className="nf-cat-surface mx-auto max-w-5xl">
      <PageFrame  title={copy.page.title}>
      <div>
      <p className="nf-body-sm px-gutter text-[var(--nf-content-secondary)]">{copy.page.lede}</p>

      {left > 0 && ids.length > 0 ? (
        <p className="nf-caption mt-sm px-gutter text-[var(--nf-content-muted)]" role="status" data-testid="compare-missing">
          {copy.page.missing.replace("{count}", String(left))}
        </p>
      ) : null}

      <div className="mt-md px-gutter pb-xl">
        {listings.length >= 2 ? (
          <CompareView
            table={table}
            initial={listings.map((l) => l.id)}
            copy={{
              open: copy.open,
              openLabel: copy.openLabel,
              title: copy.title,
              pick: copy.page.pick,
              pickLimit: t.experienceDiscover.saved.pickSwap,
              tooFew: copy.tooFew,
              notStated: copy.notStated,
              view: copy.view,
              close: copy.close,
              verified: t.common.verified,
              lower: t.experienceDiscover.saved.lower,
            }}
          />
        ) : (
          <State
            kind="empty"
            title={listings.length === 1 ? copy.page.oneTitle : copy.page.emptyTitle}
            body={listings.length === 1 ? copy.page.oneBody : copy.page.emptyBody}
            primary={{ href: "/search", label: listings.length === 1 ? copy.page.browse : copy.page.emptyAction }}
            data-testid="compare-empty"
          />
        )}
      </div>
      </div>
    </PageFrame>
    </div>
  );
}
