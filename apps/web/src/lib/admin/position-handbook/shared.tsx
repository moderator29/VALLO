import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { CONTACT_EMAIL } from "@/lib/support-email";
import { RESPONSE_COMMITMENTS, RESPONSE_ORDER } from "@/lib/trust/standards";
import { A, FounderToName } from "./parts";
import type { HandbookSection, RoleWords } from "./types";

/**
 * THE SECTIONS EVERY POSITION HANDBOOK SHARES, BEYOND THE MANUAL'S OWN.
 *
 * The staff manual already writes five of them once, for its role chapters:
 * what Vallo is and why it exists, who the members are, the promises to
 * members, the money wording and what is never said, and the privacy rules
 * (`app/admin/manual/_chapters/role-shared.tsx`). A handbook draws those from
 * that module rather than restating them, because two copies of the same
 * promise is how the two come to disagree. This file writes the four a
 * handbook needs and the manual's role chapters do not: signing in to the
 * console, the audit log, escalation, and where to get help.
 *
 * Each takes the role's own words as its subject, the way `role-shared.tsx`
 * does, so the shared part is written once and the role's part is passed in.
 *
 * The facts are read from the console's own code and the manual chapters that
 * were read from it on 15 November 2026: `lib/admin/guard.ts` (the door and the
 * access areas), chapter 1 (signing in, the twelve-hour confirmation),
 * chapter 5 (the audit log, append-only), chapter 6 (the Escalate button, the
 * routing, the clock and the overdue bump), chapter 7 (My desk and the
 * copilot) and `lib/trust/standards.ts` (the answer times Vallo publishes).
 */

const CLOCK: DocTableRow[] = RESPONSE_ORDER.map((grade) => ({
  id: grade,
  cells: { promise: RESPONSE_COMMITMENTS[grade].label, covers: RESPONSE_COMMITMENTS[grade].covers },
}));

/** Signing in to the console, and what is true of the door for every position. */
export function signingIn(role: RoleWords): HandbookSection {
  return {
    id: "signing-in",
    title: "Signing in to the console",
    body: (
      <>
        <ol role="list">
          <li>
            <strong>Sign in with your own Vallo account</strong> at{" "}
            <Link href="/sign-in" className={A}>
              the sign-in page
            </Link>
            . Never a shared account, and never somebody else&apos;s. An account with no console access gets the
            site&apos;s ordinary &quot;not found&quot; at every console address, so the console does not confirm it
            exists to anybody who cannot use it.
          </li>
          <li>
            <strong>Confirm it is you.</strong> The console asks for your Vallo account password once per sign-in
            session and again after twelve hours. An account with no password is emailed a code. Five wrong tries lock
            the door for fifteen minutes. A super admin confirms with a security key instead.
          </li>
          <li>
            <strong>Acknowledge the staff handbook.</strong> Read the{" "}
            <Link href="/admin/handbook" className={A}>
              staff handbook
            </Link>{" "}
            and press Acknowledge. Until you do, you can read the handbook, this page and the staff manual, and nothing
            else. You are asked again whenever the handbook changes.
          </li>
          <li>
            <strong>Open{" "}
            <Link href="/admin/my-desk" className={A}>
              My desk
            </Link>
            .</strong>{" "}
            It is the first button in your frame. It tells you who you are here, what needs you today, your tasks and
            the announcements addressed to you.
          </li>
        </ol>
        <p>
          As {role.who} you see a short staff frame, not the operator&apos;s rail: My desk, Console, Handbook, Your
          role, Staff manual and Help and support, then one button for each desk your access opens. Every desk asks the
          database again when it opens, so typing the address of a desk you do not hold gets the same refusal as
          pressing a button you cannot see.
        </p>
        <DocCallout tone="warning" title="Your account is the door">
          Use a strong password you use nowhere else, and never sign in on a shared device. Every sign-in and every
          confirmation at the console door is recorded, with the network and a fingerprint of the browser. A device not
          seen on your account in sixty days tells you and every super admin. If you think your account has been
          reached by somebody else, tell the founder at once.
        </DocCallout>
      </>
    ),
  };
}

/** What the audit log keeps about this role's work. */
export function auditLog(role: RoleWords): HandbookSection {
  return {
    id: "audit-log",
    title: "The audit log, and what is written about your work",
    body: (
      <>
        <p>
          Every decision in the console writes one row: who acted, what they did, which record, and the state before
          and after, with your reason or note. {role.who.charAt(0).toUpperCase() + role.who.slice(1)} is no exception.
          The log can only be added to: updating, deleting or emptying it is refused by the database for everybody,
          admins and the founder included. The one change it accepts is removing a person&apos;s name from their own
          rows when they delete their account, and the record itself stays.
        </p>
        <ul role="list">
          <li>Every decision you make, with your reason as you wrote it.</li>
          <li>Every time you open a sensitive record: a person&apos;s file, an identity document, a check&apos;s files.</li>
          <li>Every item you take off a queue and every one you hand back.</li>
          <li>Every export you download.</li>
          <li>Every sign-in and every confirmation at the console door.</li>
          <li>Acknowledging the handbook, with the version and the time.</li>
        </ul>
        <p>
          Your lead reads each queue&apos;s backlog and every staff member&apos;s decisions over the last thirty days on{" "}
          <Link href="/admin/oversight" className={A}>
            Team oversight
          </Link>
          . Write every reason as though it will be read back to you a year from now, because it can be. You can read
          the log yourself at{" "}
          <Link href="/admin/audit" className={A}>
            the audit log
          </Link>{" "}
          where your access opens it.
        </p>
      </>
    ),
  };
}

/** How this role escalates: the button, where it goes, and the clock. */
export function escalation(role: RoleWords, escalate: readonly string[]): HandbookSection {
  return {
    id: "escalation",
    title: "How to escalate",
    body: (
      <>
        <p>
          When you are unsure, escalate rather than guess. A slower right answer is better than a quick wrong one. Do
          the part that is yours first (read the record, write down what you looked at), then hand it up.
        </p>
        <ol role="list">
          <li>
            Open the record the issue is about and press <strong>Escalate</strong>. It is at the top of every admin
            page. The page you are on is attached as a link, shown as &quot;Attached: this page&quot;. The same form is
            a page of its own at{" "}
            <Link href="/admin/escalations/new" className={A}>
              Raise an escalation
            </Link>
            .
          </li>
          <li>
            Choose <strong>what kind of issue</strong> it is. The kind decides the team it goes to: a listing or
            property matter, identity or fraud, money, safety, support, operations or technical, staff access, or
            something else. You do not need to know who is on which team.
          </li>
          <li>
            Choose <strong>how urgent</strong> it is. Each urgency shows on the form how soon somebody answers. Choose
            urgent only when harm or loss is happening now: an urgent escalation also tells the super admin at once and
            raises a critical alert, and a team that sees urgent used for small things learns to ignore it.
          </li>
          <li>
            Write a <strong>short title</strong>, <strong>what happened</strong> (what you saw and what you have
            already done) and <strong>what you need from them</strong> (the decision or the action).
          </li>
          <li>
            Read the line that says where it will go and how soon they aim to answer. If it should go somewhere else,
            choose &quot;Send it somewhere else&quot;. Then press <strong>Send escalation</strong>. You get a reference
            such as ESC-000123, and the people it went to are told in the console and by email.
          </li>
        </ol>
        <p>
          Nothing is sent to a team with nobody on it: it goes to the COO, and if there is no COO to the super admin.
          The form tells you before you send. An escalation that passes its time and is still open moves up by itself,
          from the team to the COO and from the COO to the super admin, and each move is written on its timeline. While
          a question is waiting on you, nothing moves up, so answer the question the same day. Everything you raised
          and everything waiting on you is on{" "}
          <Link href="/admin/escalations" className={A}>
            Escalations
          </Link>
          , with a count beside it in the menu. The super admin and the COO also see what waits on them as Waiting
          on you on the console&apos;s front page. Your copilot can mark an escalation as seen, add a note, ask the
          raiser, resolve, decline or reopen it, each on a card you press. The whole procedure is{" "}
          <Link href="/admin/manual/escalation" className={A}>
            chapter 6 of the staff manual
          </Link>
          .
        </p>
        <p>What this position is expected to hand up, from its own job description:</p>
        <ul role="list">
          {escalate.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <DocCallout tone="warning" title="Two rules that hold on every escalation">
          <ul role="list">
            <li>
              <strong>Never tell a member you suspect them.</strong> A person who is warned can destroy evidence or
              move money. If they ask why something is taking long, say it is being reviewed and nothing more.
            </li>
            <li>
              <strong>Never paste an identity number, a bank detail or a document</strong> into an escalation. No NIN,
              no BVN, no account number, no card number, no photograph of a document. The attached link carries the
              record, and only the people who may open that record can read it. The form refuses a long number.
            </li>
          </ul>
        </DocCallout>
      </>
    ),
  };
}

/** Where to get help, and who to go to for this role. */
export function gettingHelp(role: RoleWords): HandbookSection {
  return {
    id: "getting-help",
    title: "Who to go to, and where to get help",
    body: (
      <>
        <p>
          Vallo names positions, not people. Ask for the position, and the person holding it today will be whoever
          holds it. {role.who.charAt(0).toUpperCase() + role.who.slice(1)} takes most questions to these:
        </p>
        <DocTable
          caption="Who to go to, by position"
          columns={[
            { key: "what", label: "What it is about" },
            { key: "who", label: "Who to go to" },
          ]}
          rows={role.contacts.map((contact, index) => ({
            id: `contact-${index}`,
            cells: { what: contact.what, who: contact.who },
          }))}
        />
        <p>Four places answer most questions without anybody&apos;s time:</p>
        <ul role="list">
          <li>
            <Link href="/admin/manual" className={A}>
              The staff manual
            </Link>
            , for how a desk works, chapter by chapter.
          </li>
          <li>
            <Link href="/admin/handbook" className={A}>
              The staff handbook
            </Link>
            , for the rules you acknowledged. Where the handbook and anything else disagree, the handbook is the rule.
          </li>
          <li>
            <Link href="/admin/copilot" className={A}>
              Your copilot
            </Link>
            , for a question in plain words at any hour.
          </li>
          <li>
            <Link href="/admin/my-desk" className={A}>
              My desk
            </Link>
            , for your tasks, the announcements sent to you, and the Help and support button in your frame.
          </li>
        </ul>
        <p>
          Members reach Vallo through the contact form, which lands on the Support desk, or by writing to{" "}
          {CONTACT_EMAIL}. That is the one address Vallo uses. Neither is a line for staff: use the Escalate button.
        </p>
        <FounderToName>
          <ul role="list">
            <li>Who holds each position today, and how to reach them outside the console.</li>
            <li>Who is on call out of hours, for which areas, and the rota.</li>
            <li>How a hand-over between shifts is recorded.</li>
          </ul>
        </FounderToName>
      </>
    ),
  };
}

/** The answer times Vallo publishes, for the standards section of every handbook. */
export function publishedClock(): HandbookSection["body"] {
  return (
    <DocTable
      caption="The answer times Vallo publishes"
      columns={[
        { key: "promise", label: "Promise" },
        { key: "covers", label: "What it covers" },
      ]}
      rows={CLOCK}
    />
  );
}
