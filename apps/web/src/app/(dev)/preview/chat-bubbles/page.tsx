import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { ThreadView, type ThreadBubble } from "@/app/(app)/messages/[id]/ThreadView";
import { callMarkerView } from "@/lib/calls/screen";
import { PERSON } from "../_fixtures/people";
import { CONVERSATION_ID, RENTAL_CONTEXT } from "../f5/fixtures";

/**
 * THE PROOF HARNESS FOR THE CHAT BUBBLES, TICKS AND CALL ROWS: the real thread
 * with short and long messages, runs from one side, a reply (which reads
 * everything of mine before it), a photo, and every call row. Invented names.
 *
 *   ?calls=off   no call rows' words (rows still render as bubbles never do)
 */
export const dynamic = "force-dynamic";

const day = "2026-10-28T";
const row = (id: string, mine: boolean, body: string, time: string, extra: Partial<ThreadBubble> = {}): ThreadBubble => ({
  id,
  mine,
  body,
  timeLabel: time,
  imageUrl: null,
  createdAt: `${day}${time}:00+01:00`,
  ...extra,
});
const call = (id: string, body: string, mine: boolean, time: string): ThreadBubble => {
  const view = callMarkerView({ body, mine })!;
  return row(id, mine, body, time, { call: { callId: `call-${id}`, view } });
};

const THREAD: ThreadBubble[] = [
  row("m1", false, "Hii", "20:29"),
  row("m2", true, "Hello", "20:29", { read: true }),
  row("m3", true, "Is the apartment still available from the first of next month? I would like to see it this weekend.", "20:30", { read: true }),
  row("m4", true, "Ok", "20:30", { read: true }),
  call("c1", "Voice call, missed", false, "20:31"),
  call("c2", "Video call, cancelled", true, "20:31"),
  call("c3", "Voice call, 21 min 9 s", false, "21:09"),
  call("c4", "Video call, declined", true, "21:12"),
  row("m5", false, "Yes it is. Saturday or Sunday works for me.", "21:14"),
  row("m6", true, "Saturday at two", "21:15"),
  row("m7", true, "Photo of the gate", "21:15", { imageUrl: "/brand/photos/bedroom-01.jpg" }),
  row("m8", true, "Thanks", "21:16"),
  row("m9", true, "On my way", "21:20", { state: "sending" }),
];

export default async function PreviewChatBubbles() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <div className="flex h-dvh flex-col">
      <ThreadView
        sheetCopy={{ unsafe: t.trustVisible.unsafe }}
        live={false}
        conversationId={CONVERSATION_ID}
        meId={PERSON.id}
        counterpartName="Sarah"
        counterpartTier="none"
        inspected={false}
        messages={THREAD}
        context={RENTAL_CONTEXT}
        role="guest"
        threadCopy={t.threads}
        locale={locale}
        scamCopy={t.memberKit.scam}
        calls={{ copy: t.calls, enabled: true, words: t.chatPolish.calls }}
      />
    </div>
  );
}
