import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { ThreadView } from "@/app/(app)/messages/[id]/ThreadView";
import { InboxPane } from "@/components/app/messages/InboxPane";
import { MemberKeys } from "@/components/app/MemberKeys";
import { PERSON } from "../../_fixtures/people";
import { CONVERSATION_ID, INSPECTION, LISTING_ID, RENTAL_CONTEXT, RENTAL_THREAD } from "../../f5/fixtures";

/**
 * B17: the messages split from 64rem, from fixtures: the pane (fixture rows,
 * so no session is needed) beside a real ThreadView, inside the same
 * full-height column the shell gives a thread. Below 64rem the pane is gone.
 * The first row is the open thread.
 */
export const dynamic = "force-dynamic";

const ROWS = [
  { id: "preview/m2/split", name: "Michael T.", title: "Example 2 bedroom apartment", last: "Saturday by 2pm is fine. See you at the gate.", when: "09:52", unread: 0 },
  { id: "c2", name: "Amaka O.", title: "Example mini flat, Yaba", last: "Is the caution refundable?", when: "08:10", unread: 2 },
  { id: "c3", name: "Seyi A.", title: "Example shortlet, Lekki", last: "Thank you, see you then.", when: "Mon", unread: 0 },
  { id: "c4", name: "Tunde B.", title: null, last: "Hello", when: "12 Sep", unread: 0 },
];

export default async function PreviewSplit() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <div className="flex h-dvh flex-col">
      <MemberKeys />
      <div className="nf-msg-split">
        <InboxPane fixture={ROWS} currentId="preview/m2/split" label="Conversations" />
        <div className="nf-msg-split__thread">
          <ThreadView
            sheetCopy={{ unsafe: t.trustVisible.unsafe }}
            live={false}
            conversationId={CONVERSATION_ID}
            meId={PERSON.id}
            counterpartName="Michael T."
            counterpartTier="none"
            listing={{ id: LISTING_ID, title: "Example 2 bedroom apartment", area: "Lekki Phase 1", city: "Lagos", verified: false, approved: true, hue: 1 }}
            inspected={false}
            messages={RENTAL_THREAD}
            context={RENTAL_CONTEXT}
            inspection={INSPECTION}
            role="guest"
            threadCopy={t.threads}
            locale={locale}
            scamCopy={t.memberKit.scam}
          />
        </div>
      </div>
    </div>
  );
}
