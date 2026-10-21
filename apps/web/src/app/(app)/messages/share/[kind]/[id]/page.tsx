import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { PageHeader } from "@/components/app/PageHeader";
import { resolveSession } from "@/lib/actions/session";
import { getLocale } from "@/lib/locale";
import { isFeatureEnabled } from "@/lib/flags";
import { loadConversationSummaries } from "@/lib/messages/live";
import { getMyBookings } from "@/lib/bookings/queries";
import { getSavedListings } from "@/lib/saved/queries";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { InboxEmpty } from "../../../Inbox";
import { resolveCard } from "../../../[id]/cards";
import { ShareIntoThread, ShareToThread, type ShareItem, type ShareThread } from "../../SharePicker";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceInbox.share.title };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /messages/share/<kind>/<id>: the share picker.
 *
 *   /messages/share/listing/<listingId>   send this listing to a thread
 *   /messages/share/booking/<bookingId>   send this booking to a thread
 *   /messages/share/into/<conversationId> send one of my things into this thread
 *
 * The first two are the "Share to chat" destination a listing page or a
 * booking row links to, and the forward control on a card in a thread. The
 * third is the options sheet's entry inside a conversation. Two segments
 * rather than one on purpose: the shell treats `/messages/<one>` as an
 * immersive thread and drops the gutter and the header, and this screen is
 * neither.
 *
 * Everything listed is the reader's own, under RLS: their inbox, their
 * bookings, their saved places, and the properties they have chatted about.
 */
export default async function SharePage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (!UUID_RE.test(id)) notFound();
  if (kind !== "listing" && kind !== "booking" && kind !== "stay" && kind !== "into") notFound();

  const session = await resolveSession();
  const inbox = getDictionary(await getLocale()).experienceInbox;
  const words = inbox.share;
  const back =
    kind === "into"
      ? `/messages/${id}`
      : kind === "listing"
        ? `/listing/${id}`
        : kind === "stay"
          ? `/stay/${id}`
          : `/bookings/${id}`;

  if (session.state !== "signed-in") {
    const next = returnHref(`/messages/share/${kind}/${id}`, "", "message");
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={words.title} fallback={back} />
        <InboxEmpty
          title={words.signedOutTitle}
          body={words.signedOutBody}
          action={{ href: authHref(next, "sign-in"), label: words.signIn }}
        />
      </div>
    );
  }

  if (!(await isFeatureEnabled("messaging"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={words.title} fallback={back} />
        <InboxEmpty
          title={words.pausedTitle}
          body={words.pausedBody}
          action={{ href: back, label: words.back }}
        />
      </div>
    );
  }

  const locale = await getLocale();

  if (kind === "into") {
    /* The thread itself, under RLS, for the name in the heading. */
    const threads = await loadConversationSummaries(session.supabase, session.user);
    const target = threads.find((thread) => thread.id === id);
    if (!target) notFound();

    const [bookings, saved, chatted] = await Promise.all([
      getMyBookings(locale),
      getSavedListings(),
      session.supabase
        .from("conversations")
        .select("listing_id, listings(id, title, area, city)")
        .not("listing_id", "is", null)
        .order("last_message_at", { ascending: false })
        .limit(30),
    ]);

    const items: ShareItem[] = [];
    const seen = new Set<string>();
    const push = (item: ShareItem) => {
      const key = `${item.ref.kind}:${item.ref.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };

    if (bookings && bookings !== "unavailable") {
      for (const booking of [...bookings.upcoming, ...bookings.completed]) {
        push({
          ref: { kind: "booking", id: booking.id },
          title: booking.title,
          line: booking.dateRange,
          icon: "calendar-booking",
        });
      }
    }
    for (const entry of saved) {
      if (!UUID_RE.test(entry.listing.id)) continue;
      push({
        ref: { kind: "listing", id: entry.listing.id },
        title: entry.listing.title,
        line: [entry.listing.area, entry.listing.city].filter(Boolean).join(", "),
        icon: "heart",
      });
    }
    for (const row of chatted.data ?? []) {
      const listing = row.listings;
      if (!listing) continue;
      push({
        ref: { kind: "listing", id: listing.id },
        title: listing.title,
        line: [listing.area, listing.city].filter(Boolean).join(", "),
        icon: "chat-bubble",
      });
    }

    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={words.intoTitle} fallback={back} />
        <ShareIntoThread conversationId={id} counterpartName={target.counterpartName} items={items} copy={words.picker} />
      </div>
    );
  }

  const ref = { kind, id } as const;
  const [card, summaries] = await Promise.all([
    resolveCard(session.supabase, ref, locale),
    loadConversationSummaries(session.supabase, session.user),
  ]);
  if (!card) notFound();

  const threads: ShareThread[] = summaries.map((thread) => ({
    id: thread.id,
    counterpartName: thread.counterpartName,
    counterpartVerified: thread.counterpartVerified,
    counterpartTier: thread.counterpartTier,
    counterpartKind: thread.counterpartKind,
    listingTitle: thread.listingTitle,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={words.title} subtitle={card.title} fallback={back} />
      <ShareToThread card={card} target={ref} threads={threads} copy={words.picker} thread={inbox.thread} />
    </div>
  );
}
