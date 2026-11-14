import { getDictionary } from "@vallo/i18n";
import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { MessagesGroup } from "@/components/support/MessagesRow";
import { OfflineNote } from "@/components/support/OfflineNote";
import { RetryButton } from "@/components/support/RetryButton";
import { SupportHero } from "@/components/support/SupportHero";
import { NewQuerySkeleton, ThreadSkeleton, TicketListSkeleton } from "@/components/support/SupportSkeletons";
import { TicketListView } from "@/app/(app)/support/messages/ListView";
import { TicketThreadView } from "@/app/(app)/support/messages/[id]/ThreadView";
import { FiledView, NewQueryForm } from "@/app/(app)/support/new/NewQueryForm";
import { SupportSearch } from "@/app/(app)/support/SupportSearch";
import { buildSupportEntries } from "@/lib/support/search-entries";
import type { HelpArticle } from "@/lib/support/help-search";
import { FAQS, POPULAR_QUESTIONS } from "@/lib/support/help-articles";
import { popularArticles } from "@/lib/support/help-search";
import {
  MY_TICKETS,
  NOW,
  RECORDS,
  RESOLVED_MESSAGES,
  RESOLVED_TICKET,
  TICKETS,
  WAITING_ATTACHMENTS,
  WAITING_MESSAGES,
  WAITING_TICKET,
} from "./fixtures";

export const dynamic = "force-dynamic";

const SCREENS = [
  "home",
  "inbox",
  "inbox-empty",
  "inbox-error",
  "inbox-loading",
  "thread-waiting",
  "thread-resolved",
  "thread-loading",
  "new",
  "new-offline",
  "new-loading",
  "filed",
] as const;
type Screen = (typeof SCREENS)[number];

/**
 * The member support screens with fixture tickets, one per `?screen=`.
 *
 * The real views, fed invented rows (`./fixtures.ts`), so each state can be
 * screenshotted at phone width in both themes without a session. Buttons that
 * call a server action will refuse here (no session); the look is what this
 * proves, never the behaviour.
 */
export default async function SupportPreview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const screen = (SCREENS as readonly string[]).includes(String(params.screen)) ? (params.screen as Screen) : null;

  if (!screen) {
    return (
      <main className="nf-shell py-section">
        <h1 className="nf-h2">Support previews</h1>
        <ul className="mt-md flex flex-col gap-xs">
          {SCREENS.map((s) => (
            <li key={s}>
              <Link className="nf-link" href={`/preview/support?screen=${s}`}>
                {s}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return <div className="nf-shell py-section-tight">{render(screen)}</div>;
}

function render(screen: Screen) {
  const locale = "en" as const;
  switch (screen) {
    case "home":
      return (
        <div className="mx-auto max-w-2xl space-y-block">
          <SupportHero
            greeting="Hi Seyi, how can we help?"
            promise="A person replies within 1 day, and within 4 hours when money or safety is at stake."
            aiConsented
            signedIn
            copy={getDictionary(locale).experienceInbox.support.home}
          />
          <MessagesGroup tickets={MY_TICKETS} signedIn copy={getDictionary(locale).experienceInbox.support.home} locale={locale} />
          {/* The whole centre, as the real page passes it: help answers open
              in place, a chapter, a guide or a legal page is a door. */}
          <SupportSearch
            articles={buildSupportEntries().map((entry): HelpArticle =>
              entry.section === "help"
                ? { category: entry.trail, q: entry.title, a: entry.text }
                : { category: entry.trail, q: entry.title, a: entry.text, href: entry.href },
            )}
            popular={popularArticles(FAQS, POPULAR_QUESTIONS)}
          />
        </div>
      );
    case "inbox":
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader title="Messages" subtitle="Your support conversations" fallback="/support" />
          <TicketListView tickets={TICKETS} locale={locale} />
        </div>
      );
    case "inbox-empty":
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader title="Messages" subtitle="Your support conversations" fallback="/support" />
          <EmptyState
            icon="support-chat"
            title="No support conversations yet"
            body="When you write to the team while signed in, the ticket and every reply appear here. A ticket filed while signed out is answered by email instead."
            action={
              <ButtonLink href="/support/new" variant="primary" size="lg">
                Write to support
              </ButtonLink>
            }
          />
        </div>
      );
    case "inbox-error":
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader title="Messages" subtitle="Your support conversations" fallback="/support" />
          <EmptyState
            icon="support-chat"
            title="Your conversations could not be loaded"
            body="Nothing is lost. Check your connection and try again."
            action={<RetryButton />}
            secondary={
              <Link href="/contact" className="nf-link-quiet inline-flex min-h-11 items-center">
                Use the contact form instead
              </Link>
            }
          />
        </div>
      );
    case "inbox-loading":
      return (
        <LoadingShell label="Loading your support conversations" className="mx-auto w-full max-w-2xl">
          <TicketListSkeleton />
        </LoadingShell>
      );
    case "thread-waiting":
      return (
        <TicketThreadView
          ticket={WAITING_TICKET}
          messages={WAITING_MESSAGES}
          attachments={WAITING_ATTACHMENTS}
          locale={locale}
          now={NOW}
        />
      );
    case "thread-resolved":
      return (
        <TicketThreadView ticket={RESOLVED_TICKET} messages={RESOLVED_MESSAGES} attachments={[]} locale={locale} now={NOW} />
      );
    case "thread-loading":
      return (
        <LoadingShell label="Loading the conversation" className="mx-auto w-full max-w-2xl">
          <ThreadSkeleton />
        </LoadingShell>
      );
    case "new":
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader title="Report a problem" subtitle="A person reads every message" fallback="/support" />
          <NewQueryForm initialKind="problem" initialTopic="payment" records={RECORDS} copy={getDictionary(locale).experienceInbox.support.form} />
        </div>
      );
    case "new-offline":
      return (
        <div className="mx-auto max-w-2xl space-y-block">
          <PageHeader title="Write to support" subtitle="A person reads every message" fallback="/support" />
          <OfflineNote forceOffline />
        </div>
      );
    case "new-loading":
      return (
        <LoadingShell label="Loading the form" className="mx-auto w-full max-w-2xl">
          <NewQuerySkeleton />
        </LoadingShell>
      );
    case "filed":
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader title="Report a problem" fallback="/support" />
          <FiledView filed={{ reference: "VAL-SUP-04821", id: WAITING_TICKET.id }} topic="payment" copy={getDictionary(locale).experienceInbox.support.form} />
        </div>
      );
  }
}
