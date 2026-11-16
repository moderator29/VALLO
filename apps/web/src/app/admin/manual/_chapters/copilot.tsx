import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { COPILOT_LIMITS } from "@/lib/admin/copilot/capabilities";
import { COPILOT_COMMANDS, type CopilotCommand } from "@/lib/admin/copilot/commands";
import { MANUAL_AREA_LABEL } from "@/lib/admin/manual/chapters";
import { A, type ManualBody } from "./parts";

/**
 * Chapter 18: THE AI COPILOT (the founder, 16 November 2026: "update staff
 * handbook and manual, update it all to follow the current flow and info").
 *
 * Read from the copilot's own code on 16 November 2026:
 * `components/admin/copilot/AdminCopilot.tsx` (the round button on every desk
 * and the "Ask the AI copilot" button on the console's front page),
 * `CopilotChat.tsx` (Copy, Ask again, Stop, the steps, the next questions,
 * History and Settings), `ProposalCard.tsx` (the card, its own button, the
 * typed word), `lib/admin/copilot/commands.ts` (the quick commands, drawn
 * here from that list so the table cannot drift), `proposals.ts` (fifteen
 * minutes, one person), `act.ts` (once only, the desk's own action, the audit
 * row "made through the copilot"), `lib/admin/copilot/tools/desk-actions.ts`,
 * `lib/admin/copilot/tools/propose.ts` and
 * `lib/admin/copilot/tools/super-admin.ts` (what a card can do and the typed words),
 * `capabilities.ts` (`COPILOT_LIMITS`, drawn here as it stands) and
 * `engine.ts` (the super admin's limits), and the chat history SQL
 * (`copilot_threads_2026-11-16.sql`, applied live on 16 November 2026: owner
 * only; `private.copilot_threads_cleanup()` removes conversations idle for
 * ninety days, and is not on a schedule yet, so the chapter does not promise
 * the deletion happens on the day). History, pins and renaming were read
 * again from `CopilotChat.tsx` the same day. When any of those changes, this
 * chapter changes with it.
 */

const GROUP_ORDER: readonly CopilotCommand["group"][] = ["Today", "Your desks", "Do something", "Platform", "Chat"];

function whoSees(command: CopilotCommand): string {
  if (command.superAdmin) return "The super admin";
  if (!command.scopes) return "Everybody";
  return command.scopes.map((scope) => MANUAL_AREA_LABEL[scope]).join(", ");
}

function whatItDoes(command: CopilotCommand): string {
  if (command.action === "new") return "Starts a new conversation.";
  if (command.action === "history") return "Opens your saved conversations.";
  if (command.action === "settings") return "Opens the copilot's settings.";
  if (command.template) return `Starts the sentence "${command.template.trim()}" for you to finish.`;
  return `Asks "${command.prompt ?? command.hint}"`;
}

const COMMANDS: DocTableRow[] = GROUP_ORDER.flatMap((group) =>
  COPILOT_COMMANDS.filter((command) => command.group === group).map((command) => ({
    id: command.key,
    cells: { command: `/${command.key}`, group, does: whatItDoes(command), who: whoSees(command) },
  })),
);

const DESK_WORK: DocTableRow[] = [
  {
    id: "reply",
    cells: {
      work: "Reply to a support ticket",
      who: "Support",
      card: "Shows the reply word for word under \"What the member will read\". Send reply sends it and keeps the ticket open; Send and resolve sends it and marks the ticket resolved. The member gets a notice in the app.",
    },
  },
  {
    id: "status",
    cells: {
      work: "Change a ticket's status",
      who: "Support",
      card: "Reopen, Mark waiting on the member, Resolve or Close. Closing needs a note of at least eight characters, which stays in the audit trail.",
    },
  },
  {
    id: "escalation",
    cells: {
      work: "Take a step on an escalation",
      who: "Everybody",
      card: "Mark as seen, Add a note, Ask the raiser, Resolve, Decline or Reopen. Resolve, Decline and Reopen need a note of at least ten characters. Only the steps open to you on that escalation right now are offered.",
    },
  },
  {
    id: "alert",
    cells: {
      work: "Take or resolve a risk alert",
      who: "Operations",
      card: "I have this marks the alert as yours. Resolve alert closes it with your note. Anybody with Operations access may take or resolve an alert, on the desk or on the card.",
    },
  },
  {
    id: "flag",
    cells: {
      work: "Clear or escalate a message flag",
      who: "Reports and moderation",
      card: "Shows the flagged message. Clear flag leaves the message as it was. Escalate flag sends it on for a closer look.",
    },
  },
  {
    id: "tasks",
    cells: {
      work: "Tasks",
      who: "Everybody",
      card: "Add a task to your own list, or comment on one of your tasks. It never hands a task to a colleague.",
    },
  },
  {
    id: "announcement",
    cells: {
      work: "Post a staff announcement",
      who: "The COO and admins",
      card: "Title, message, who it is for and whether it is pinned. It reaches staff only, never a member.",
    },
  },
  {
    id: "coo",
    cells: {
      work: "Raise an escalation to the COO desk, or recommend a staff access change",
      who: "Admins raise; the COO recommends",
      card: "The recommendation is a note for the super admin. It grants and takes away nothing.",
    },
  },
  {
    id: "bd",
    cells: {
      work: "Add a prospect, or log a contact, follow-up or note",
      who: "Business development",
      card: "Adds the prospect to the pipeline, or records the contact against it.",
    },
  },
  {
    id: "social",
    cells: {
      work: "Save a draft social post",
      who: "Social media",
      card: "Saves it on the content calendar as a draft. Nothing is posted and nothing is sent for approval.",
    },
  },
  {
    id: "drafts",
    cells: {
      work: "Drafts to copy",
      who: "Support, Trust and Safety, Marketing, Content, Technical, Support lead",
      card: "A ticket reply to send from the ticket, a case note, a creative brief, a report reading, an article outline, an announcement, an incident update, status page wording, a post-incident review, a canned reply, a coaching note or a policy note. A draft card has Copy draft and Open in the desk, and nothing else. Nothing is saved, posted or sent.",
    },
  },
];

const SUPER_ADMIN: DocTableRow[] = [
  { id: "listing", cells: { what: "Decide a listing waiting in review", buttons: "Approve and publish, Reject, or Send back for changes", word: "SEND, to reject or send back. None to approve." } },
  { id: "agent", cells: { what: "Decide an agent application", buttons: "Approve, Reject, or Ask for changes", word: "APPROVE to approve. SEND to reject or ask for changes." } },
  { id: "identity", cells: { what: "Decide an identity check", buttons: "Approve identity, or Refuse identity with a reason the member reads", word: "APPROVE, or REFUSE." } },
  { id: "held", cells: { what: "Release or remove held content", buttons: "Release, or Remove (the author is told)", word: "REMOVE to remove. None to release." } },
  { id: "switch", cells: { what: "Turn a platform switch on or off", buttons: "Turn on, or Turn off", word: "ON, or OFF." } },
  { id: "restrict", cells: { what: "Restrict a member, or lift a restriction", buttons: "Restrict, or Lift it", word: "RESTRICT to restrict. None to lift." } },
  { id: "grant", cells: { what: "Grant or take away staff access", buttons: "Grant access, or Remove access", word: "GRANT, or REVOKE. Nobody can take their own access away here." } },
  { id: "refund", cells: { what: "Refund all or part of a paid booking", buttons: "Refund, with the amount in naira on the button", word: "REFUND. The desk refuses more than was paid." } },
];

export const COPILOT: ManualBody = {
  intro: (
    <p>
      The AI copilot is a helper inside the console. It reads your desks, answers in plain words, writes replies and
      notes, and does desk work for you on a card you press. This chapter says how to open it, how to read an answer,
      the quick commands, history and settings, how a card works, what it can do on each desk, the super admin&apos;s
      own powers, and what it never does.
    </p>
  ),
  glance: [
    "Open it from the round button on every desk, or from Ask the AI copilot on the console's front page.",
    "It reads only what you may read. A desk you do not hold is closed to it as it is to you.",
    "Every change is a card with a preview and its own button. Nothing happens until you press it.",
    "Cards that are hard to undo ask you to type a word first. A card lasts 15 minutes and works once.",
    "Everything done through it is in the audit log as done through the copilot, under your name.",
    "It never pays anybody out, never makes a transfer or a company payment, never deletes a record, and never messages a member unless you press Send.",
  ],
  sections: [
    {
      id: "what-it-is",
      title: "What it is, and what it reads",
      body: (
        <>
          <p>
            The copilot answers from the figures on your desks, this manual, your own{" "}
            <Link href="/admin/handbook/position" className={A}>
              position handbook
            </Link>{" "}
            and the public help pages. It knows your position and your access areas from the database, never from what
            the page says about you. It opens once you have acknowledged the{" "}
            <Link href="/admin/handbook" className={A}>
              staff handbook
            </Link>
            .
          </p>
          <ul role="list">
            <li>It reads only what your access opens. Ask it about a desk you do not hold and it says so and points to your lead.</li>
            <li>It does not decide for you. It sets out the facts, says what it would weigh, and links you to the item.</li>
            <li>
              Where its answer and the screen disagree, the screen is right. Where its answer and the staff handbook
              disagree, the handbook is the rule. Tell the founder either way.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "opening-it",
      title: "Opening it",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>On every desk</strong>, a round button sits at the corner of the page. Press it and the copilot
              opens over the page: full screen on a phone, at the side on a wide screen. That desk&apos;s copilot starts
              with that desk&apos;s questions.
            </li>
            <li>
              <strong>On the console&apos;s front page</strong>, a button reading Ask the AI copilot sits opposite the
              Console overview title. That copilot answers across every desk you hold.
            </li>
            <li>
              <strong>On its own page</strong> at{" "}
              <Link href="/admin/copilot" className={A}>
                Copilot
              </Link>
              , under My Desk in the menu. It has more room, and beside the chat a list of what it can do for you, desk
              by desk.
            </li>
          </ul>
          <p>Close it with Close, or by pressing a desk button inside an answer, which takes you to that page.</p>
        </>
      ),
    },
    {
      id: "asking",
      title: "Asking, and reading an answer",
      body: (
        <>
          <ol role="list">
            <li>Type your question in plain words, or press one of the suggested questions. Press Send.</li>
            <li>
              While it writes, a quiet line says what it is doing and the Send button becomes <strong>Stop</strong>.
              Press Stop to end the answer where it is.
            </li>
            <li>
              The answer comes in short bullets with the figures it read. Where it read a desk you may open, it ends
              with a button to that desk. A page it did not read this time is never offered.
            </li>
            <li>
              Under each answer is <strong>Copy</strong>, and under the newest one <strong>Ask again</strong>, which
              asks the same question afresh.
            </li>
            <li>
              The steps it took (what it read or prepared) are folded under the answer, as a line such as &quot;3
              steps&quot;. Press it to see them.
            </li>
            <li>
              Under the newest answer are two or three next questions, drawn from what it just read: after the support
              queue, reply to the oldest ticket; after the alerts, resolve the worst one. Press one to ask it.
            </li>
          </ol>
          <DocCallout tone="note" title="Never paste a personal number">
            Do not type an ID number, a BVN, a card number or an account number into the copilot. Link the record
            instead. A reply or a note carrying what looks like one is refused, and it asks you to write it again
            without it.
          </DocCallout>
        </>
      ),
    },
    {
      id: "commands",
      title: "Quick commands",
      body: (
        <>
          <p>
            Type <strong>/</strong> in the message box and the quick commands appear. Keep typing to narrow the list,
            use the arrow keys and Enter to choose, or press one. A command either asks a question for you, starts a
            sentence for you to finish, or does something in the chat.
          </p>
          <p>
            You see only the commands for desks you hold. The list is answered by the server from your access, never
            from what the browser says. An admin sees every desk&apos;s commands, and the Platform commands are the
            super admin&apos;s alone.
          </p>
          <DocTable
            caption="The quick commands, and who sees each"
            columns={[
              { key: "command", label: "Type" },
              { key: "group", label: "Group" },
              { key: "does", label: "What it does" },
              { key: "who", label: "Who sees it" },
            ]}
            rows={COMMANDS}
          />
        </>
      ),
    },
    {
      id: "history",
      title: "History",
      body: (
        <>
          <p>
            Press <strong>History</strong> at the top of the copilot to see your conversations, newest first, each with
            the desk it was on and when. Open one to carry on where you left off. Press the pin to keep one at the top
            of the list (pins are kept on this device), the pencil to rename it, or the bin to delete it. Press{" "}
            <strong>New chat</strong> to start afresh.
          </p>
          <ul role="list">
            <li>Each conversation is saved to your own account after every answer, so it is there on any device you sign in on.</li>
            <li>Only you can read your conversations. Nobody else can, not your lead, not an admin and not the super admin.</li>
            <li>
              A conversation untouched for 90 days after its last message is due to be cleared out. Do not rely on an
              old one still being there, and delete one yourself with the bin when you no longer need it.
            </li>
            <li>
              A card read back from history can no longer be pressed. It shows as expired. Ask again, or make the change
              on the desk.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "settings",
      title: "Settings",
      body: (
        <>
          <p>
            Press <strong>Settings</strong> at the top of the copilot. Your choices are kept on this device.
          </p>
          <DocTable
            caption="The copilot's settings"
            columns={[
              { key: "setting", label: "Setting" },
              { key: "what", label: "What it changes" },
            ]}
            rows={[
              { id: "length", cells: { setting: "How long answers run", what: "Short: the figure and the button. Balanced, the usual: a few lines, as it fits. Detailed: headings, every figure and next steps." } },
              { id: "steps", cells: { setting: "Show the steps it took", what: "On: what it read or prepared is folded under each answer. Off: the steps are hidden." } },
              { id: "save", cells: { setting: "Save conversations", what: "On: new conversations are kept in History. Off: they are not kept." } },
              { id: "enter", cells: { setting: "Enter sends", what: "On: Enter sends your message. Off: Enter starts a new line and the arrow button sends." } },
            ]}
          />
        </>
      ),
    },
    {
      id: "cards",
      title: "How a change happens: the card",
      body: (
        <>
          <p>
            The copilot never changes anything by itself. When you ask it to do something, it puts a card in the chat.
            The card says in plain words what will happen, lists what it will use, and shows a preview. Where somebody
            else will read words (a reply to a member, a note the raiser reads), the preview shows them exactly as they
            will arrive.
          </p>
          <ol role="list">
            <li>Read the card and the preview. If anything is wrong, press Dismiss, or Edit in the desk to do it yourself on the page.</li>
            <li>
              Where the change is hard to undo, the card asks you to type a word first, such as REFUND or RESTRICT. Its
              button stays off until the word is typed.
            </li>
            <li>
              Press the card&apos;s own button. It is named for what it does: Send reply, Resolve alert, Mark as seen,
              Clear flag. Nothing has happened until you press it.
            </li>
            <li>The card then says what was done, with a link to open it, or says why it could not be done. You can always do it on the desk instead.</li>
          </ol>
          <ul role="list">
            <li>A card lasts 15 minutes. After that it shows as expired and cannot be pressed. Ask again.</li>
            <li>A card works once. Pressing it a second time does nothing.</li>
            <li>A card is made for you. Nobody else can press it, even with the same link.</li>
            <li>
              Pressing it runs the desk&apos;s own action, with the desk&apos;s own rules. The server asks again who you
              are and what you hold. Anything the desk would refuse, the card refuses.
            </li>
            <li>
              Every change is written to the{" "}
              <Link href="/admin/manual/records" className={A}>
                audit log
              </Link>{" "}
              as done through the copilot, under your name, beside the desk&apos;s own record. If that line cannot be
              written, the card says so and Operations is alerted.
            </li>
            <li>A draft card has no button that changes anything. It has Copy draft and Open in the desk.</li>
          </ul>
        </>
      ),
    },
    {
      id: "desk-work",
      title: "Desk work it can do on a card",
      body: (
        <>
          <p>
            Each person can do only the work their own access areas open. The copilot on a desk you do not hold has no
            card for that desk.
          </p>
          <DocTable
            caption="Desk work the copilot can put on a card"
            columns={[
              { key: "work", label: "Work" },
              { key: "who", label: "Who" },
              { key: "card", label: "What the card does" },
            ]}
            rows={DESK_WORK}
          />
          <p>
            Some escalation steps are on the escalation&apos;s own page only: Take it, Send to another team and Give it
            to somebody. To raise a new escalation, use the Escalate button at the top of any page. See{" "}
            <Link href="/admin/manual/escalation" className={A}>
              Escalation and out of hours
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "super-admin",
      title: "The super admin's own powers",
      body: (
        <>
          <p>
            The super admin&apos;s copilot can also do what the super admin does from the panel. Each of these is
            offered to the super admin alone, asked again when the card is made, and asked again when it is pressed.
            Each runs the desk&apos;s own action with that desk&apos;s own rules.
          </p>
          <DocTable
            caption="The super admin's cards, and the word each asks for"
            columns={[
              { key: "what", label: "What" },
              { key: "buttons", label: "The buttons" },
              { key: "word", label: "The word to type" },
            ]}
            rows={SUPER_ADMIN}
          />
          <p>
            It offers one of these only when the super admin asked for that change in the same conversation, reads the
            item first, and offers one change at a time. The super admin&apos;s copilot also reads the whole platform in
            one answer, the{" "}
            <Link href="/admin/control" className={A}>
              Control room
            </Link>
            , who holds which access, and what changed.
          </p>
        </>
      ),
    },
    {
      id: "never",
      title: "What it never does",
      body: (
        <>
          <p>For every member of staff, in its own words:</p>
          <ul role="list">
            {COPILOT_LIMITS.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
          <p>For the super admin, whose copilot can do more, these still hold:</p>
          <ul role="list">
            <li>It never makes a payout or a transfer.</li>
            <li>It never makes a company payment. Those need all three founders.</li>
            <li>The only money it moves is a booking refund, on a card with REFUND typed first.</li>
            <li>It never deletes or destroys a record.</li>
            <li>It never sends a message to a member unless the person presses Send on the card.</li>
            <li>It never chains several changes in one answer.</li>
          </ul>
          <DocCallout tone="warning" title="You are still the one deciding">
            A card you press is your decision, recorded under your name. Read the preview as if you had written it. If
            you would not send it, change it on the desk or dismiss it.
          </DocCallout>
        </>
      ),
    },
  ],
};
