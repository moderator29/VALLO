import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocFlow } from "@/components/docs/DocFlow";
import { DocTable } from "@/components/docs/DocTable";
import { A, type ManualBody } from "./parts";
import { aboutVallo } from "./role-shared";

/**
 * Chapter 12. Read from `app/admin/support-lead`, `lib/admin/support-lead`,
 * `lib/admin/support-queue.ts` (what the team load reads) and
 * `lib/admin/desk-entries` on 10 November 2026: the tabs, the assign verb, the
 * review scores, the policy note moves and the refusals each action returns.
 * When those change, this chapter changes.
 */
export const SUPPORT_LEAD: ManualBody = {
  intro: (
    <p>
      This chapter is for the Customer Support Lead. You lead the support team: who is working which tickets, what has been
      escalated, how good the answers are, what the numbers say, and the replies and policy the team answers from. You
      also hold the Support access area, so you can do everything an agent does. You report to the COO. Read the Support
      chapters of this manual too; this one adds what is yours alone.
    </p>
  ),
  glance: [
    "Your desk is Support lead, in the Support group. Its tabs are Team, Escalations, Quality and coaching, Figures, and Replies and policy.",
    "You see tickets as counts and references. The conversation stays in the Support desk, which you open with the Open the ticket link.",
    "You can hand an unassigned ticket to a member of the support team. A hold frees itself after thirty minutes without a touch.",
    "Quality reviews score tone, accuracy, speed and policy from 1 to 5 and name the ticket by its reference only. They are about the answer, not the person.",
    "A policy note or a canned reply is a draft until the COO or an admin approves it. The team works from approved ones only.",
    "You decide nothing about money, identity checks, restrictions or access. You send those to the desk that does, with the reason they will read first.",
  ],
  sections: [
    ...aboutVallo({
      who: "the Customer Support Lead",
      keeps:
        "Support is where Vallo's promises are tested on the worst day of a member's week. A team that answers on time, with the right words, and knows when to hand something on, is how a member decides whether to trust us again. You are the person who makes that possible for everyone else.",
    }),
    {
      id: "the-desk",
      title: "The desk and its tabs",
      body: (
        <>
          <p>
            Open{" "}
            <Link href="/admin/support-lead" className={A}>
              Support lead
            </Link>
            . It opens on Team.
          </p>
          <DocTable
            caption="The Support lead desk, tab by tab"
            columns={[
              { key: "tab", label: "Tab" },
              { key: "use", label: "What it is for" },
              { key: "when", label: "When you use it" },
            ]}
            rows={[
              { id: "team", cells: { tab: "Team", use: "Open tickets, how many nobody is holding, how many are past their promised time, how many are escalated and the oldest. Who holds what. The tickets nobody holds, each with a way to hand it to a colleague. Rota notes.", when: "First thing, and through the day." } },
              { id: "escalations", cells: { tab: "Escalations", use: "Tickets waiting on another desk, and the escalation matrix: for each kind of problem, who it goes to and how fast.", when: "Daily." } },
              { id: "quality", cells: { tab: "Quality and coaching", use: "Average scores per agent, the form to review an answered ticket, recent reviews, and coaching notes.", when: "Weekly." } },
              { id: "figures", cells: { tab: "Figures", use: "The promised times, finishing time, what members write about (the repeated-issue tracker), where recent tickets stand, and the help pages that fail.", when: "Weekly, and for your report." } },
              { id: "library", cells: { tab: "Replies and policy", use: "Canned replies, policy notes and knowledge-base gaps, each with approval where it matters.", when: "As needed." } },
            ]}
          />
        </>
      ),
    },
    {
      id: "team",
      title: "Running the team's day",
      body: (
        <>
          <DocFlow
            label="A ticket nobody is holding"
            steps={[
              { icon: "headset", title: "See it", outcome: "On Team, under Nobody holding, with its reference and its clock.", href: "/admin/support-lead" },
              { icon: "user", title: "Choose", outcome: "A colleague who is on and has room." },
              { icon: "circle-check", title: "Assign", outcome: "The ticket is handed to them and the banner says so." },
              { icon: "flag", title: "Watch", outcome: "If its clock turns red, speak to them." },
            ]}
          />
          <ol role="list">
            <li>
              Read the four counts. <strong>Past promised time</strong> is the one to act on first. The promise is four
              hours when a member was asked to pay outside Vallo or something is unsafe, a day for a listing not as
              described, and three days for matters that need judgement.
            </li>
            <li>
              Read <strong>Who is holding what</strong>. A colleague with many open and several late needs help, not a
              reminder.
            </li>
            <li>
              Under <strong>Nobody holding</strong>, each ticket shows its reference with a Copy button, its clock and its
              topic. Choose a colleague in <em>Hand to</em> and press <strong>Assign</strong>, or press{" "}
              <strong>Open the ticket</strong> and take it yourself in the Support desk.
            </li>
            <li>
              The database decides who may be handed a ticket. If somebody is working it right now, you are told so and
              nothing changes; it frees up after thirty minutes without a touch.
            </li>
            <li>
              Use <strong>Rota notes</strong> for who is on, from when, and who they ask. Colleagues&apos; names only. No
              personal details, no phone numbers.
            </li>
          </ol>
          <DocCallout tone="note" title="You do not read the conversation here">
            Team shows references, topics and clocks. To read what a member wrote, open the ticket in the Support desk, as
            any agent does, and only when you need to.
          </DocCallout>
        </>
      ),
    },
    {
      id: "escalations",
      title: "Escalations and the matrix",
      body: (
        <>
          <p>
            The Escalations tab lists tickets that were handed to another desk and have not been returned. For each, check
            that the receiving desk has what it needs and that the member has been told what happens next. If a ticket has
            sat longer than that desk&apos;s promise, speak to the desk&apos;s lead.
          </p>
          <p>
            The <strong>escalation matrix</strong> is your list of rules. Each card says: when (for example <em>a member
            says money left their bank and has not arrived</em>), what to do, who to send it to (Finance, Trust and Safety,
            Operations, Compliance, the COO or Technical) and how fast. Keep it short enough to read in the middle of a
            busy day, and update it whenever a ticket taught you something.
          </p>
          <DocTable
            caption="A starting matrix, to adapt"
            columns={[
              { key: "when", label: "When" },
              { key: "who", label: "Send to" },
              { key: "how", label: "How fast" },
            ]}
            rows={[
              { id: "money", cells: { when: "Money has not arrived, or a refund has not come back", who: "Finance, with the booking", how: "Same day" } },
              { id: "danger", cells: { when: "A member says they are in danger", who: "Head of Trust and Safety and the COO", how: "At once" } },
              { id: "scam", cells: { when: "Someone was asked to pay outside Vallo", who: "Trust and Safety", how: "Within the four hour promise" } },
              { id: "bug", cells: { when: "Many members report the same thing broken", who: "Technical and the COO", how: "At once" } },
            ]}
          />
        </>
      ),
    },
    {
      id: "quality",
      title: "Quality reviews and coaching",
      body: (
        <>
          <ol role="list">
            <li>
              Pick an answered ticket in the Support desk and read it. Come back to <strong>Quality and coaching</strong>.
            </li>
            <li>
              Enter its reference, choose the agent whose answer you reviewed (never yourself), and score four things from 1
              to 5: <strong>tone</strong> (warm, plain, respectful), <strong>accuracy</strong> (right and complete),{" "}
              <strong>speed</strong> (inside the promised time) and <strong>policy</strong> (followed the approved policy
              and the house money wording).
            </li>
            <li>
              Write what would have been better, about the answer, never the person. Do not copy the member&apos;s words.
              Press <strong>Save review</strong>.
            </li>
            <li>
              The table above shows each agent&apos;s average and their lowest area, with the lowest overall first. Three or
              four reviews is the least you should act on.
            </li>
            <li>
              For one agent&apos;s growth, add a <strong>coaching note</strong>: the focus, what you observed with a
              specific example, what better looks like, the support you will give and the date you will look again. Mark it
              followed up when you have.
            </li>
          </ol>
          <DocCallout tone="warning" title="Reviews are about the answer">
            Say what was good first. Share the review with the agent within a week, in person if you can. A score is a
            conversation, not a verdict.
          </DocCallout>
        </>
      ),
    },
    {
      id: "figures",
      title: "Figures, and the repeated-issue tracker",
      body: (
        <ul role="list">
          <li>
            <strong>Promised times.</strong> Read only. The same promises as the public standards page, and the clocks the
            Support desk runs. Changing them is the COO&apos;s decision.
          </li>
          <li>
            <strong>Finishing time.</strong> The median time recent finished tickets took from filing to last activity, or
            Not available when there are none to measure.
          </li>
          <li>
            <strong>What members write about.</strong> The most common ticket topics in the last thirty days with counts
            and share. When one topic rises, ask why: is a page unclear (tell the Content Manager), is something broken
            (tell Technical), or is a policy confusing (write a note)?
          </li>
          <li>
            <strong>Where tickets stand now.</strong> Counts by status for the tickets filed in thirty days.
          </li>
          <li>
            <strong>Help pages that fail.</strong> The pages members said did not help. If it says page feedback is not
            switched on, say so; do not read an empty list as good news.
          </li>
        </ul>
      ),
    },
    {
      id: "library",
      title: "Canned replies, policy notes and knowledge-base gaps",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>Canned reply.</strong> A name, a topic, a language and the reply. Warm and plain; says what we know,
              what happens next and when; never promises an outcome another desk decides; uses the house money wording. It
              has a Copy button. Send it for approval; once approved the team may use it, always edited to fit the person.
            </li>
            <li>
              <strong>Policy note.</strong> A title and the policy: what the team does and says, and when to escalate. Save
              it as a draft. The COO or an admin presses <strong>Approve</strong>; the person who wrote it never does. To
              change an approved note, take it back to draft with a reason; the banner has an Undo; then approve it again.
              Retire a note that is out of date; the banner has an Undo.
            </li>
            <li>
              <strong>Knowledge-base gap.</strong> A question the team keeps answering that the help pages do not. Write the
              question, the answer you give today and roughly how often. The Content Manager reads this list. Mark it
              answered when the page is live.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "rhythm",
      title: "Your day, week and month",
      body: (
        <DocTable
          caption="The rhythm of the Customer Support Lead"
          columns={[
            { key: "when", label: "When" },
            { key: "what", label: "What you do" },
          ]}
          rows={[
            { id: "day", cells: { when: "Every day", what: "Open My desk, then Support lead. Past promised time? Nobody holding? Escalations waiting? Brief the team." } },
            { id: "week", cells: { when: "Every week", what: "Review a sample of answered tickets. Give feedback. Read the repeated-issue tracker. Update the rota. Write your weekly report." } },
            { id: "month", cells: { when: "Every month", what: "Review the policy notes and canned replies for anything out of date. Tell the COO what the month's tickets say about the product." } },
          ]}
        />
      ),
    },
    {
      id: "weekly-report",
      title: "Your weekly report",
      body: (
        <p>
          Your{" "}
          <Link href="/admin/my-desk/weekly" className={A}>
            weekly report
          </Link>{" "}
          is prefilled with quality reviews written, coaching notes, policy notes written and approved, canned replies
          written and knowledge-base gaps logged. Add what the desk cannot count: the pattern behind the tickets, how the
          team is, and what you need from the COO.
        </p>
      ),
    },
    {
      id: "copilot",
      title: "Using the Copilot",
      body: (
        <>
          <p>
            The Copilot can read the team&apos;s load, quality scores, the repeated-issue tracker and the policy library,
            and draft a canned reply, a coaching note or a policy note. It sees references and counts, never a ticket&apos;s
            text, and never an agent&apos;s name in the quality scores. It saves nothing and sends nothing to a member.
          </p>
          <ul role="list">
            <li>&ldquo;Who is holding the most open tickets?&rdquo;</li>
            <li>&ldquo;Which tickets are past their promised time?&rdquo;</li>
            <li>&ldquo;What are members writing about most this month?&rdquo;</li>
            <li>&ldquo;Draft a canned reply for a member whose deposit has not shown yet. Warm, plain, no promises.&rdquo;</li>
            <li>&ldquo;Draft a coaching note: first replies are long and slow. Offer a shorter structure.&rdquo;</li>
          </ul>
        </>
      ),
    },
    {
      id: "situations",
      title: "Common situations, with a model answer",
      body: (
        <DocTable
          caption="Situations and what to do"
          columns={[
            { key: "situation", label: "Situation" },
            { key: "answer", label: "What to do" },
          ]}
          rows={[
            { id: "late", cells: { situation: "Three tickets are late and the team is stretched.", answer: "Take the oldest yourself. Hand one to a colleague with room. If it will not clear today, tell the COO what you need, with the counts." } },
            { id: "refund", cells: { situation: "A member demands a refund now.", answer: "Be kind and clear. You cannot decide it. Escalate to Finance with the booking and write to the member what will happen next and when. Never promise the outcome." } },
            { id: "danger", cells: { situation: "A member says they are in danger.", answer: "Head of Trust and Safety and the COO at once, then stay with the member in the ticket until a person has taken it." } },
            { id: "agent", cells: { situation: "An agent made a mistake that cost a member time.", answer: "Fix it first, apologise to the member, then coach the agent about the process, privately, with an example and what better looks like." } },
            { id: "pressure", cells: { situation: "You are asked to approve your own policy note.", answer: "You cannot. Ask the COO or an admin to read and approve it." } },
            { id: "spike", cells: { situation: "One topic doubled this week.", answer: "Ask whether it is a page, a bug or a policy. Tell the Content Manager, Technical or the COO accordingly, with the counts." } },
          ]}
        />
      ),
    },
    {
      id: "never",
      title: "What you must never do, and when to escalate",
      body: (
        <>
          <ul role="list">
            <li>Never promise an outcome another desk decides: a refund, a payout, a ruling, a restoration.</li>
            <li>Never ask a member for a password, a card number or a one-time code.</li>
            <li>Never copy a member&apos;s words or details into a review, a coaching note or a policy.</li>
            <li>Never use an unapproved canned reply or policy as if it were approved.</li>
            <li>Never act on money, identity checks, restrictions or access from this desk.</li>
          </ul>
          <DocTable
            caption="Where to take it"
            columns={[
              { key: "what", label: "What" },
              { key: "who", label: "Who" },
              { key: "how", label: "How fast" },
            ]}
            rows={[
              { id: "money", cells: { what: "Money that has not arrived, or a refund that has not come back", who: "Finance, with the booking", how: "Same day" } },
              { id: "danger", cells: { what: "A member says they are in danger", who: "Head of Trust and Safety and the COO", how: "At once" } },
              { id: "late", cells: { what: "A pattern of late tickets you cannot clear", who: "The COO", how: "Same day" } },
            ]}
          />
        </>
      ),
    },
    {
      id: "glossary",
      title: "Glossary",
      body: (
        <DocTable
          caption="Words used on this desk"
          columns={[
            { key: "word", label: "Word" },
            { key: "means", label: "Means" },
          ]}
          rows={[
            { id: "hold", cells: { word: "Hold", means: "A colleague has taken a ticket. It frees after thirty minutes without a touch." } },
            { id: "lane", cells: { word: "Lane", means: "Where a ticket is: new, waiting on us, waiting on the member, escalated or done." } },
            { id: "clock", cells: { word: "Clock", means: "How long the member has waited, against the promise." } },
            { id: "esc", cells: { word: "Escalation", means: "Handing a ticket to another desk that can decide it." } },
            { id: "macro", cells: { word: "Canned reply", means: "A tested reply the team edits to fit the person." } },
            { id: "qa", cells: { word: "Quality review", means: "A score from 1 to 5 on four things for one answered ticket." } },
            { id: "gap", cells: { word: "Knowledge-base gap", means: "A question the help pages do not answer well." } },
          ]}
        />
      ),
    },
  ],
};
