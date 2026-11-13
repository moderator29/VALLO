import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { HostShell } from "@/components/host/HostShell";
import { readTransferScreen } from "@/lib/business-transfer/queries";
import { TransferWorkspace } from "./TransferWorkspace";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceHost.screens.transfer, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * /host/transfer: the route out of the business precondition, and it is two
 * doors rather than one.
 *
 * WHY THIS SCREEN EXISTS. `public.businesses.owner_id` cascades onto
 * `auth.users` and the account purge deliberately does not delete that row, so
 * without a precondition a hotel would keep selling rooms with a tombstone
 * behind it. Owning a business a stranger can still transact against now
 * blocks a deletion, and a precondition with no route out is a dead end
 * wearing an explanation. This is that route.
 *
 * THE TWO DOORS, AND BOTH ARE REAL.
 *
 *   HAND IT OVER. An offer to another Vallo account, PENDING until they
 *   accept it. Nothing moves before they do, because an ownership transfer
 *   nobody consented to is its own kind of fault.
 *
 *   CLOSE IT. Unpublish the rooms, settle the diary, take it off the market.
 *   Every one of those controls already exists and this screen links to the
 *   one that matches what is actually in the way for each business, rather
 *   than to a page that says a business can be closed.
 *
 * NOTHING HERE SAYS EMAIL US.
 */
export default async function TransferBusinessPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const session = await resolveSession();

  if (session.state !== "signed-in") {
    const next = returnHref("/host/transfer", "", "list");
    return (
      <HostShell logoLabel={t.a11y.logoHome}>
        <EmptyState
          heading="h1"
          icon="hotel"
          title={t.hostWorkspace.transfer.signedOutTitle}
          body={t.hostWorkspace.transfer.signedOutBody}
          action={
            <ButtonLink href={authHref(next, "sign-in")} variant="primary" size="lg">
              {t.common.signIn}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }

  const screen = await readTransferScreen();

  return (
    /* The body's page frame carries the one way back; the bar keeps the
       host's destinations. */
    <HostShell logoLabel={t.a11y.logoHome} chromeBack={false} nav>
      <TransferWorkspace
        businesses={screen.businesses}
        outgoing={screen.outgoing}
        incoming={screen.incoming}
        partial={screen.partial}
      />
    </HostShell>
  );
}
