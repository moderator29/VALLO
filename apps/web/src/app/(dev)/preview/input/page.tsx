import { getDictionary } from "@vallo/i18n";
import { ThreadView, type ThreadBubble } from "@/app/(app)/messages/[id]/ThreadView";
import { PERSON } from "../_fixtures/people";
import { CONVERSATION_ID } from "../f5/fixtures";
import { ChromePreview } from "../f1/ChromePreview";
import { PillDeck } from "./PillDeck";
import { CodeDeck, FieldsDeck } from "./FieldsDeck";
import { Composer } from "@/components/social/feed/Composer";
import { ReplyBox } from "@/app/(app)/support/messages/[id]/ReplyBox";

/**
 * THE PROOF HARNESS FOR THE INPUT WORK (founder, 14 November 2026): the quick
 * pill, paste and the keyboard pass, on the real components with invented
 * rows. Nothing here is read from a database and nothing is sent.
 *
 *   /preview/input                 the quick pill under the real shell: above
 *                                  the dock on a phone, bottom centre on a desk
 *   ?stage=plain                   the pill on a page with no dock
 *   ?stage=thread                  the real thread: copy a message from its
 *                                  menu and the pill sits above the composer;
 *                                  paste into the composer
 *   ?stage=feed                    the feed's post box: paste a long text, a
 *                                  link or a picture into it
 *   ?stage=support                 a ticket reply box, the same
 *   ?stage=code                    the code cells in the auth frame, with Paste
 *   ?stage=fields                  the shared fields: a code with its Paste
 *                                  button, cleaned pastes, keyboards
 */
export const dynamic = "force-dynamic";

const DAY = "2026-11-14T09:16:00.000Z";

const THREAD: ThreadBubble[] = [
  { id: "m1", mine: false, body: "Good morning. The two bedroom on Admiralty Way is still open.", timeLabel: "10:16", imageUrl: null, createdAt: DAY },
  { id: "m2", mine: true, body: "Good morning. Is the service charge inside the rent?", timeLabel: "10:18", imageUrl: null, createdAt: "2026-11-14T09:18:00.000Z", read: true },
  { id: "m3", mine: false, body: "It is separate, paid once a year. I can send the breakdown.", timeLabel: "10:19", imageUrl: null, createdAt: "2026-11-14T09:19:00.000Z" },
  { id: "m4", mine: true, body: "Please do. I would like to see it on Saturday morning.", timeLabel: "10:21", imageUrl: null, createdAt: "2026-11-14T09:21:00.000Z", read: true },
  { id: "m5", mine: false, body: "Saturday at ten works. I will book the gate for you.", timeLabel: "10:22", imageUrl: null, createdAt: "2026-11-14T09:22:00.000Z" },
];

type Params = { stage?: string | string[] };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PreviewInput({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const t = getDictionary("en");
  const stage = first(params.stage) ?? "dock";

  if (stage === "thread") {
    return (
      <div className="flex h-dvh flex-col">
        <ThreadView
          sheetCopy={{ unsafe: t.trustVisible.unsafe }}
          live={false}
          conversationId={CONVERSATION_ID}
          meId={PERSON.id}
          meName="Seyi Omojuni"
          counterpartName="Nora Ginna"
          counterpartTier="none"
          listing={null}
          inspected={false}
          messages={THREAD}
          context={{ kind: "direct" }}
          threadCopy={t.threads}
          locale="en"
          sinceLine="On Vallo since 9 October 2026"
          calls={{ copy: t.calls, enabled: false, words: t.chatPolish.calls }}
          viewerCopy={t.chatPolish.viewer}
        />
      </div>
    );
  }

  if (stage === "feed") {
    return (
      <main className="mx-auto max-w-xl p-md">
        <Composer signedIn />
      </main>
    );
  }

  if (stage === "support") {
    return (
      <main className="mx-auto max-w-xl p-md">
        <ReplyBox ticketId="00000000-0000-4000-8000-0000000000aa" copy={t.experienceInbox.support.reply} />
      </main>
    );
  }

  if (stage === "code") {
    return (
      <main id="main" className="nf-auth nf-slate">
        <div className="mx-auto w-full max-w-md p-md">
          <CodeDeck />
        </div>
      </main>
    );
  }

  if (stage === "fields") {
    return (
      <main className="mx-auto max-w-xl p-md">
        <FieldsDeck />
      </main>
    );
  }

  if (stage === "plain") {
    return (
      <main className="mx-auto max-w-2xl p-md">
        <PillDeck />
      </main>
    );
  }

  return (
    <ChromePreview t={t} route="/home">
      <PillDeck />
    </ChromePreview>
  );
}
