import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageHeader } from "@/components/app/PageHeader";
import { PageScene } from "@/components/app/PageScene";
import { EmptyState } from "@/components/app/Screen";
import { EmptyActions } from "@/components/app/EmptyActions";
import { Unreachable } from "@/components/app/Unreachable";
import { resolveSession } from "@/lib/actions/session";
import { loadNotificationPage } from "@/lib/notify/inbox";
import { Reveal } from "@/components/site/Reveal";
import { toNotificationItem, type NotificationItem } from "@/lib/notify/links";
import { LiveNotifications } from "./LiveNotifications";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { loadUnreadCounts } from "@/lib/messages/unread";
import { sectionClock } from "@/lib/notify/sections";
import { withNext } from "@/lib/auth/next-link";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceInbox.notifications.title };
}

/**
 * Notifications.
 *
 * Signed in on a configured platform, the inbox is the caller's real rows under
 * RLS, day-grouped, with realtime arrivals and read state persisted through the
 * read_at column grant.
 *
 * The other two states used to render a hardcoded list of five invented
 * notifications, unlabelled, to anyone at all: a visitor who had never booked
 * anything was told "Booking confirmed, Lekki Palm Grove Shortlet is locked in"
 * and "Your wallet is ready". That is the exact thing owner rules 13 and 22
 * forbid, on a surface whose entire value is that it can be believed. Both are
 * now honest, designed screens with a way onward.
 *
 * Deleting the seeded list also removed the "Offers" filter chip, which no
 * notification kind could ever match (docs/DEAD_ENDS.md M3, first half).
 */
export default async function NotificationsPage() {
  const locale = await getLocale();
  const copy = getDictionary(locale).experienceInbox.notifications;
  const session = await resolveSession();

  if (session.state === "signed-in") {
    /* B11: the conversations still waiting on this person, so a message row
       stays in "Needs you" until the thread is read, not the row. */
    const [page, unread] = await Promise.all([
      loadNotificationPage(session.supabase),
      loadUnreadCounts(session.supabase),
    ]);

    /* A failed read is a fault and says so. It used to arrive here as an
       empty list and render "You are all caught up", which is the one thing
       this screen must never say when it does not know. */
    if (page.state === "error") {
      return (
        <div className="mx-auto max-w-2xl">
          <div className="relative">
            <PageScene art="bell-badge" />
            <PageHeader variant="large" title={copy.title} />
          </div>
          <Reveal>
            <Unreachable
              noun="notifications"
              icon="bell-badge"
              action={{ label: copy.unreachable.action, href: "/notifications" }}
            />
          </Reveal>
        </div>
      );
    }

    const initial: NotificationItem[] = page.rows.map(toNotificationItem);

    /* The header belongs to the client component here, because the mark-all
       control has to sit in it and only that component knows what is unread. */
    return (
      /* Pull down to refresh: rows that arrived while the live connection was
         down are taken up by the list (`adoptFresh`). */
      <PullToRefresh className="mx-auto max-w-2xl">
        <LiveNotifications
          initial={initial}
          initialMore={page.more}
          userId={session.user.id}
          openThreads={unread ? [...unread.byConversation.keys()] : []}
          now={sectionClock()}
          copy={copy}
          locale={locale}
        />
      </PullToRefresh>
    );
  }

  if (session.state === "unconfigured") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="relative">
          <PageScene art="bell-badge" />
          <PageHeader variant="large" title={copy.title} />
        </div>
        <Reveal>
          <Unreachable
            noun="notifications"
            icon="bell-badge"
            action={{ label: copy.unreachable.action, href: "/notifications" }}
          />
        </Reveal>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative">
        <PageScene art="bell-badge" />
        <PageHeader variant="large" title={copy.title} />
      </div>
      <Reveal>
        {/* One empty state, one action treatment. This was a `MomentScreen`
            with two hand-written `nf-btn` anchors at intrinsic width, beside a
            sibling branch whose single action was full width. A confirmation
            component was doing an empty state's job, which is the reason there
            were nine of them. */}
        <EmptyState
          icon="bell-badge"
          title={copy.signedOut.title}
          body={copy.signedOut.body}
          action={
            <EmptyActions
              primary={{ label: copy.signedOut.action, href: withNext("/sign-in", "/notifications") }}
              /* "Keep exploring" pointed at /search, which is the product
                 changing the subject when it cannot answer the question, and it
                 is the same non sequitur "Explore places" was on the wallet.
                 The quiet action belongs to the screen it is on: the one thing
                 somebody can genuinely do here without an account is decide
                 what they want to be told about, and the on-device
                 notifications card does that signed out. */
              secondary={{
                label: copy.signedOut.secondary,
                href: "/settings#settings-notifications",
              }}
            />
          }
        />
      </Reveal>
    </div>
  );
}
