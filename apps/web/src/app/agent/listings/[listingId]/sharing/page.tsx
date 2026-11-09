import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { AgentShell } from "@/components/agent/AgentShell";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { resolveSessionClaims } from "@/lib/actions/session";
import { isNotLive } from "@/lib/features/degrade";
import { getLocale } from "@/lib/locale";
import { reportReadFault } from "@/lib/observability/read-error";

import { SharingForm } from "./SharingForm";

export const metadata: Metadata = { title: "Good for sharing", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * `/agent/listings/<id>/sharing` (Vallo Roommates): the lister says whether a
 * property suits people sharing it, and for how many. Groups searching
 * together on Vallo Roommates see it on the listing ("Good for sharing, up to
 * N people") and in their shortlist. Only these two facts change, so a
 * published listing is not sent back for review.
 */
export default async function SharingPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const words = t.roommates.lister;

  const claims = await resolveSessionClaims();
  const row =
    claims.state === "signed-in"
      ? await claims.supabase.from("listings").select("id, title, bedrooms, shared_living_ok, max_occupants").eq("id", listingId).maybeSingle()
      : null;
  if (row?.error && !isNotLive(row.error)) await reportReadFault("read.roommates.lister-sharing", row.error);
  const listing = (row?.data ?? null) as { id: string; title: string; bedrooms: number | null; shared_living_ok?: boolean; max_occupants?: number | null } | null;
  const notOpen = Boolean(row?.error && isNotLive(row.error));

  return (
    <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
      {!listing || notOpen ? (
        <EmptyState
          icon="home-search"
          title={words.title}
          body={notOpen ? t.roommates.notOpen : words.notYours}
          action={
            <ButtonLink href="/agent/listings" variant="primary">
              {words.back}
            </ButtonLink>
          }
        />
      ) : (
        <div className="mx-auto flex max-w-md flex-col gap-group py-lg" data-testid="listing-sharing">
          <div>
            <h1 className="nf-h2">{words.title}</h1>
            <p className="mt-inline nf-body-sm text-[var(--nf-content-secondary)]">{words.lede}</p>
          </div>
          <SharingForm
            listingId={listing.id}
            listingTitle={listing.title}
            bedrooms={listing.bedrooms}
            initialOk={listing.shared_living_ok === true}
            initialMax={listing.max_occupants ?? null}
            words={words}
          />
        </div>
      )}
    </AgentShell>
  );
}
