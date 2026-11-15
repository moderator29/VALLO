/* Screenshot harness for the two shared parts of handoff 6.3: the count tabs
   and the action sheet, drawn from fixtures with no session, and the screens
   they were first applied to.

   `?s=tabs` (the default) the count tabs in both meanings; `sheet` the action
   sheet with every row kind (`&open=1` opens it at once, `&at=end` puts its
   trigger at the far edge); `inbox` the real inbox with every table open;
   `card` the listing card menu; `profile` the profile menu; `post` the post
   menu (`&mine=1` for your own post); `saved` the saved lists bar.
   Notifications is `/preview/fe-notifications`.

   Invented people and places only. Closed outside development by the preview
   layout's own guard. */
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Inbox, type InboxRow } from "@/app/(app)/messages/Inbox";
import { sheetWordsOf } from "@/components/social/sheet-words";
import { PERSON } from "../_fixtures/people";
import { INBOX } from "../f5/fixtures";
import { CardMenuDemo, PostMenuDemo, ProfileMenuDemo, SavedListsDemo, SheetDemo, TabsDemo } from "./SheetsPreview";

export const dynamic = "force-dynamic";

const EXTRA: InboxRow[] = [
  { id: "00000000-0000-4000-8000-00000000c011", counterpartName: "Ngozi Eze", listingTitle: null, lastMessage: "Thank you, see you then.", whenLabel: "2 Nov", unread: 12, isRequest: false, counterpartKind: "member", counterpartVerified: false, counterpartTier: "none", contextKind: "direct" },
  { id: "00000000-0000-4000-8000-00000000c012", counterpartName: "Chidi Okonkwo", listingTitle: "Studio flat, Yaba", lastMessage: "Can I come for a viewing on Saturday morning?", whenLabel: "Tue", unread: 0, isRequest: false, counterpartKind: "member", counterpartVerified: false, counterpartTier: "none", contextKind: "listing", archived: true },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string; open?: string; at?: string; mine?: string }> }) {
  const { s = "tabs", open, at, mine } = await searchParams;
  const t = getDictionary(await getLocale());

  if (s === "inbox") {
    return (
      <main id="main" className="nf-shell py-section-tight">
        <div className="mx-auto max-w-2xl">
          <Inbox
            rows={[...INBOX, ...EXTRA]}
            meId={PERSON.id}
            canMarkRead
            archiveOpen
            prefsOpen
            assistantOn
            inboxCopy={t.experienceInbox.inbox}
            plusCopy={t.inboxPlus}
            supportRows={[{ id: "t1", title: "Payments", reference: "VAL-SUP-00042", preview: "We have refunded your deposit.", whenLabel: "09:10", unread: true }]}
          />
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="nf-shell py-section-tight">
      <div className="mx-auto max-w-2xl">
        {s === "sheet" ? <SheetDemo open={open === "1"} end={at === "end"} /> : null}
        {s === "card" ? <CardMenuDemo /> : null}
        {s === "profile" ? <ProfileMenuDemo end={at === "end"} reportWords={t.experienceSocial.feed.report} /> : null}
        {s === "post" ? <PostMenuDemo mine={mine === "1"} words={sheetWordsOf(t)} /> : null}
        {s === "saved" ? <SavedListsDemo /> : null}
        {s === "tabs" ? <TabsDemo /> : null}
      </div>
    </main>
  );
}
