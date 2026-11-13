import { State } from "@/components/ui/State";
import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { getMyBusinesses, getPrimaryAccommodation } from "@/lib/host/queries";
import { readDeclaration } from "@/lib/stays/arrival-queries";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState, TYPE } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { HostShell } from "@/components/host/HostShell";
import { PageFrame } from "@/components/app/PageFrame";
import { ArrivalChargesForm } from "@/components/stays/ArrivalChargesForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).afterTheGate.arrival.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * V-57. /host/arrival: a host declares every charge a guest could be asked
 * for on arrival at their property, each an amount or none. Its own route,
 * like /host/photos, so it stays open after the application is sent; the
 * property cannot be published until all five are answered.
 */
export default async function HostArrivalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.afterTheGate.arrival;
  const session = await resolveSession();
  if (session.state !== "signed-in") {
    return (
      <HostShell logoLabel={t.a11y.logoHome} fallback="/host">
        <EmptyState
          heading="h1"
          icon="hotel"
          title={copy.title}
          body={copy.lede}
          action={
            <ButtonLink href={authHref(returnHref("/host/arrival", "", "list"), "sign-in")} variant="primary" size="lg">
              {t.common.signIn}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }
  const params = await searchParams;
  const wanted = Array.isArray(params.business) ? params.business[0] : params.business;
  const businesses = (await getMyBusinesses()).filter((business) => business.kind !== "restaurant");
  const chosen = businesses.find((business) => business.id === wanted) ?? businesses[0] ?? null;
  const accommodation = chosen ? await getPrimaryAccommodation(chosen.id) : null;
  const existing = accommodation ? await readDeclaration({ accommodationId: accommodation.id }) : null;

  return (
    /* The frame's header carries the one way back (Grade 1 page frame); the
       bar keeps the host's destinations. */
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" chromeBack={false} nav>
      <PageFrame
        title={copy.title}
        subtitle={copy.lede}
        fallback="/host"
        tabs={
          businesses.length > 1 ? (
            <nav aria-label={copy.pickTitle} className="flex flex-wrap gap-xs">
              {businesses.map((business) => (
                <Link key={business.id} href={`/host/arrival?business=${business.id}`} className="nf-chip" aria-current={business.id === chosen?.id ? "page" : undefined}>
                  {business.name}
                </Link>
              ))}
            </nav>
          ) : undefined
        }
      >
        <div>
          {!accommodation ? (
            <State compact kind="empty" icon="hotel" title={copy.noStays} />
          ) : existing === undefined ? (
            <p className={TYPE.body}>{t.afterTheGate.tenancy.unavailableBody}</p>
          ) : (
            <ArrivalChargesForm target={{ accommodationId: accommodation.id }} existing={existing} copy={copy} />
          )}
        </div>
      </PageFrame>
    </HostShell>
  );
}
