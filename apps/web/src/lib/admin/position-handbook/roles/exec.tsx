import Link from "next/link";
import { A, TodayNote } from "../parts";
import type { RoleWords } from "../types";

/**
 * THE THREE EXECUTIVE POSITIONS: Chief Financial Officer, Chief Operating
 * Officer and Chief Executive Officer.
 *
 * Each holds a wide set of access areas, so each handbook's desk table is
 * long. The point of these three handbooks is not how to work a queue, which
 * the desk handbooks cover: it is what the position decides, what it must not
 * decide for somebody else, and what it is accountable for. Read from the
 * console's own code and the staff manual chapters read from it on 15 November
 * 2026, and from `lib/admin/staff-positions.ts`.
 */

export const CFO: RoleWords = {
  who: "the Chief Financial Officer",
  keeps:
    "Vallo's whole money story rests on one fact: it never holds customer money. Protecting that fact, in what we build and in what we say, is this job before anything else.",
  purpose: (
    <p>
      This job owns Vallo&apos;s finances, its money model and its financial controls, and answers for them to the
      board. You sign off month-end, you set the limits inside which finance staff decide claims, you own the
      relationship with the payment processor and the auditors, and you work with the Compliance Officer wherever money
      and compliance meet. The no-custody rule is yours to protect: nothing Vallo says or builds may suggest it holds
      anybody&apos;s money.
    </p>
  ),
  glance: [
    "Your access areas are Agreement approval, Guarantee claims, Finance and Compliance. They open Money, Payments, Chargebacks, Fees, Record retention, Agreements, the Compliance desk and the audit log export.",
    "The no-custody rule is yours to protect. Vallo never holds customer money, and we say so exactly.",
    "Every compliance decision still needs a second member of staff, including yours.",
    "Anything that would change the money model, or a material loss, goes to the CEO and the board.",
    "Refunds, cancellations and fee rises are admin and super admin decisions, not a finance scope.",
  ],
  firstDay: [
    <>
      Sign in, confirm it is you, and acknowledge the{" "}
      <Link href="/admin/handbook" className={A}>
        staff handbook
      </Link>
      .
    </>,
    <>
      Read{" "}
      <Link href="/admin/manual/desks" className={A}>
        chapter 2
      </Link>
      ,{" "}
      <Link href="/admin/manual/decisions" className={A}>
        chapter 4
      </Link>{" "}
      and{" "}
      <Link href="/admin/manual/product-guide" className={A}>
        chapter 15
      </Link>
      . The last one is how the product makes money today.
    </>,
    <>
      Open{" "}
      <Link href="/admin/money" className={A}>
        Money
      </Link>{" "}
      and{" "}
      <Link href="/admin/payments" className={A}>
        Payments
      </Link>{" "}
      and read a full week, end to end.
    </>,
    <>
      Read{" "}
      <Link href="/admin/fees" className={A}>
        Fees
      </Link>
      : every rate in force, and who may change it.
    </>,
    <>Read the money wording the product uses, and satisfy yourself that every surface says it exactly.</>,
    <>Write down the limits inside which the Finance Officer decides, and tell them.</>,
  ],
  firstWeek: [
    <>Reconcile one full period yourself, with the Finance Officer, so you know what the data actually supports.</>,
    <>
      Read{" "}
      <Link href="/admin/chargebacks" className={A}>
        Chargebacks
      </Link>{" "}
      and the pattern across them.
    </>,
    <>
      Read{" "}
      <Link href="/admin/retention" className={A}>
        Record retention
      </Link>
      , and agree with a super admin who destroys what, and when.
    </>,
    <>Meet the Compliance Officer and agree in writing how money and compliance questions reach each other.</>,
    <>Give the board a first note: what the money model is today, what the controls are, and where the gaps are.</>,
  ],
  alone: [
    "Read every money desk, and sign off month-end.",
    "Set the limits within which finance staff decide claims left from the retired Guarantee, and decide the claims above them.",
    "Approve an agreement or send it back, as the Agreement approval area allows.",
    "Export the money history and the audit log, each export recorded with your name.",
    "Propose a decision in a compliance lane, with written reasons.",
  ],
  withSomebody: [
    "Every compliance decision: a second member of staff approves, and it is never you approving your own proposal.",
    "Anything that would change the money model, or a material loss: the CEO and the board.",
    "A fee rise: a super admin. Lowering a rate is any admin.",
    "Destroying money records past retention: a super admin, after typing the confirmation phrase against the count shown.",
    "A refund, a cancellation or a part refund: an admin, on the booking's own page.",
  ],
  never: [
    "Holding, moving or arranging money outside the payment processor. There is no Vallo account to pay from.",
    "An agreement or a claim you are a party to.",
    "Approving your own compliance proposal.",
    "Letting a commercial target change a compliance decision, or asking anybody else to.",
    "Describing a balance, a wallet, a store of value or escrow, anywhere, to anybody.",
  ],
  tasks: [
    {
      id: "monthend",
      title: "Sign off month-end",
      steps: [
        <>Ask the Finance Officer for the period export and the reconciliation record.</>,
        <>Read the reconciliation: what differed, what was explained, and what was escalated.</>,
        <>Check that no difference is carried forward unexplained. One that is, is the finding.</>,
        <>Trace three figures yourself, at random, from the report back to a record in the console.</>,
        <>Sign off, and write what you relied on. A sign-off with no record of what was read is not a control.</>,
      ],
    },
    {
      id: "limits",
      title: "Set the limits finance decides inside",
      steps: [
        <>Decide the amount above which a claim comes to you, and write it down.</>,
        <>Decide what counts as a reconciliation difference that must be escalated, and by when.</>,
        <>Tell the Finance Officer, in writing, and put it where they can read it again.</>,
        <>Read a month of decisions against those limits and adjust them once, not every week.</>,
      ],
      note: (
        <TodayNote>
          These limits are not held as a setting in the console. They are a written instruction from this position to
          the Finance Officer, and the handbook says so rather than inventing a figure.
        </TodayNote>
      ),
    },
    {
      id: "model",
      title: "Protect the money model",
      steps: [
        <>Know the sentence: Vallo uses regulated payment partners to process eligible payments, and Vallo does not hold customer funds.</>,
        <>Read any new surface that mentions money before it ships, and say no to anything that implies custody.</>,
        <>
          Where a colleague asks for a promise that a payment carries no risk, offer the true line instead: who
          processes the payment, and what a member can see.
        </>,
        <>
          Where something has already shipped that implies custody, press <strong>Escalate</strong>, choose{" "}
          <strong>Money</strong>, and tell the CEO the same day.
        </>,
      ],
    },
    {
      id: "auditors",
      title: "Work with the processor and the auditors",
      steps: [
        <>Write down what was asked, by whom, and the date.</>,
        <>
          Export only what was asked for, from{" "}
          <Link href="/admin/money" className={A}>
            Money
          </Link>{" "}
          and{" "}
          <Link href="/admin/audit" className={A}>
            the audit log
          </Link>
          . Every export is recorded.
        </>,
        <>Record what was sent, to whom, and when.</>,
        <>Tell the CEO where an auditor's question suggests a control is missing rather than a number wrong.</>,
      ],
    },
  ],
  standards: [
    { what: "Month-end", good: "Signed off with a written record of what was read and three figures traced by hand." },
    { what: "Reconciliation", good: "Nothing unexplained carried into a new period." },
    { what: "The money model", good: "No surface on Vallo implies custody. Where one did, it was changed the same week." },
    { what: "Limits", good: "Finance staff know, in writing, what they decide and what comes to you." },
    { what: "Compliance", good: "No decision of yours approved by you. Independence kept visibly." },
    { what: "The board", good: "The board hears a material loss or a model change from you first." },
  ],
  wordsUsed: [
    "\"Vallo uses regulated payment partners to process eligible payments. Vallo does not hold customer funds.\"",
    "\"Trace it to a record, or report it as not available.\"",
    "\"That is a change to the money model, so it goes to the board.\"",
    "\"I cannot approve my own proposal. Who is the second approver?\"",
  ],
  wordsNever: [
    "Never a balance, a wallet, a float or escrow.",
    "Never that a payment is covered, insured or carries no risk.",
    "Never a figure that is not in a record.",
    "Never a date by which a payment feature will open.",
  ],
  privacy: [
    "Your access reaches the compliance lanes and the money desks. Open a record for a decision and nothing else: every opening is recorded.",
    "Never discuss a compliance case with anybody but the second approver and the CEO.",
    "Never export more than was asked for, and never keep a copy outside the console.",
    "Never put a card number, an account number or an identity number in a note, an email or a board paper.",
    "A board paper names counts, not members.",
  ],
  copilotCannot: [
    "It will not move money, approve an agreement, decide a claim or file a compliance report.",
    "It reads the money and compliance figures as counts and amounts. It never shows a saved payment method.",
  ],
  copilotAsk: [
    "Is reconciliation clean?",
    "How did payments do this month?",
    "What is overdue in compliance?",
  ],
  contacts: [
    { what: "A change to the money model, or a material loss", who: "Chief Executive Officer and the board" },
    { what: "Where money and compliance meet", who: "Compliance Officer" },
    { what: "A fee rise, or destroying records past retention", who: "A super admin" },
    { what: "A refund, a cancellation or a part refund", who: "An admin" },
    { what: "Daily money work and reconciliation", who: "Finance Officer" },
    { what: "A payment failure affecting many members", who: "Operations Manager and the Technical Administrator" },
  ],
};

export const COO: RoleWords = {
  who: "the Chief Operating Officer",
  keeps:
    "Every desk's quality is yours, not only its speed. Members feel the difference between a queue that is empty and a queue that was decided well.",
  purpose: (
    <p>
      This job runs the operation: trust and safety, support, listings, agreements and the day-to-day platform. You lead
      the team leads and set their targets, you watch the backlog and the response times across every desk and move
      people to where the queue is, you take the escalations the leads cannot decide, and you recommend access changes
      to the super admin as the team changes. You are accountable for every desk&apos;s quality, not only its speed.
    </p>
  ),
  glance: [
    "Your access areas are Listing approval, Reports and moderation, Support, Agreement approval and Operations. With them you open almost every working desk in the console.",
    "Escalations come to you when a team has nobody on it, and when one passes its time at the team level.",
    "You approve the policy notes and the marketing, social and content work that needs an approval step.",
    "You recommend staff access. Only the founder's super admin account grants or ends it.",
    "A serious incident, a legal matter or a regulator's enquiry goes to the CEO.",
  ],
  firstDay: [
    <>
      Sign in, confirm it is you, and acknowledge the{" "}
      <Link href="/admin/handbook" className={A}>
        staff handbook
      </Link>
      .
    </>,
    <>
      Read the whole{" "}
      <Link href="/admin/manual" className={A}>
        staff manual
      </Link>
      . Every chapter, because every desk is yours.
    </>,
    <>
      Open{" "}
      <Link href="/admin/overview" className={A}>
        the COO overview
      </Link>
      : escalations, access recommendations and the real backlog across listings, moderation, support, agreements and
      operations.
    </>,
    <>
      Open{" "}
      <Link href="/admin/oversight" className={A}>
        Team oversight
      </Link>{" "}
      and read every queue&apos;s backlog and oldest item.
    </>,
    <>Meet each lead and ask two questions: what is late, and what they need.</>,
    <>Write down the three things that would break first if the team grew by half.</>,
  ],
  firstWeek: [
    <>
      Work{" "}
      <Link href="/admin/escalations" className={A}>
        Escalations
      </Link>{" "}
      every day. Press <strong>I have seen this</strong> early, then take or route each one.
    </>,
    <>Set each lead a target that the console can measure, and tell them where it is measured.</>,
    <>Approve the policy notes waiting, or send each back with the reason.</>,
    <>Read ten decisions across four desks yourself. Quality is not a figure on a panel.</>,
    <>Recommend the access changes the team needs, and send them to the super admin.</>,
    <>Give the CEO a first note: what is late, what is fragile, and what you are changing.</>,
  ],
  alone: [
    "Everything the desk roles may decide, inside your access areas, on items that are not yours.",
    "Take, route, resolve or decline an escalation that is not one you raised.",
    "Approve a policy note, a campaign, a social post, a content item or a report that needs the COO's approval, or send it back with the reason.",
    "Set targets, set the rota, and move people between queues.",
    "Hand a task to anybody on staff from My desk, and post an announcement to all staff or to one access area.",
  ],
  withSomebody: [
    "Staff access: you recommend, the founder's super admin account grants or ends it.",
    "A serious incident, a legal matter or a regulator's enquiry: the CEO.",
    "A refund, a cancellation, an alert to close, a fee change or a switch: an admin, and a fee rise is a super admin.",
    "A compliance matter: the Compliance Officer, who is independent of you by design.",
    "Anything that would change the money model: the CFO and the CEO.",
  ],
  never: [
    "A case, listing, document, agreement or appeal where you are a party or know one.",
    "Resolving or declining an escalation you raised yourself.",
    "Overruling a compliance decision. Compliance is independent on purpose.",
    "Granting access to anybody, including yourself.",
  ],
  tasks: [
    {
      id: "round",
      title: "The daily round",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/overview" className={A}>
            the COO overview
          </Link>
          . Read escalations first, then the cross-desk backlog.
        </>,
        <>
          Open{" "}
          <Link href="/admin/escalations" className={A}>
            Escalations
          </Link>
          . Press <strong>I have seen this</strong> on everything waiting on you, then <strong>Take</strong> what is
          yours and <strong>Send to another team</strong> what is not, with the reason.
        </>,
        <>
          Open{" "}
          <Link href="/admin/oversight" className={A}>
            Team oversight
          </Link>{" "}
          and look for a queue whose oldest item is growing.
        </>,
        <>Move people, and say so once, in writing, where the whole team reads it.</>,
        <>Clear your own approvals so nothing waits on you overnight.</>,
      ],
    },
    {
      id: "escalation",
      title: "Decide an escalation that reached you",
      steps: [
        <>Read the brief: what happened, what is needed, the attached record, who has it, and the clock.</>,
        <>Press <strong>I have seen this</strong> at once, so the raiser stops wondering.</>,
        <>Press <strong>Take</strong>. One escalation, one owner, and now it is you.</>,
        <>Where you need more, ask the raiser a question. The clock waits on their answer and they are reminded daily.</>,
        <>Decide it, and <strong>Resolve</strong> with a closing note the raiser can act on, or <strong>Decline</strong> with the reason.</>,
        <>Where the same escalation keeps arriving, the rule is missing. Write it, approve it, and tell the team.</>,
      ],
      note: (
        <p>
          You cannot resolve or decline an escalation you raised yourself. Where one is yours and nobody else can take
          it, say so to the CEO rather than deciding both ends of it.
        </p>
      ),
    },
    {
      id: "approvals",
      title: "Approve what needs the COO",
      steps: [
        <>Read what is waiting: policy notes, campaigns, social posts, content items, monthly reports, access recommendations.</>,
        <>Read each one as a member or a regulator would, not as a colleague.</>,
        <>Check the money and safety wording first. Nothing may promise what another desk decides.</>,
        <>Approve, or send it back with the reason in writing. A send-back with no reason costs the team a day.</>,
        <>Where three come back for the same fault, that is a rule to write, not three corrections.</>,
      ],
    },
    {
      id: "access",
      title: "Recommend an access change",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/overview" className={A}>
            the COO overview
          </Link>{" "}
          and the access recommendations.
        </>,
        <>Write what the person needs, which position it matches, and why the work requires it.</>,
        <>Recommend the smallest set of areas that lets them do the job.</>,
        <>Send it to the super admin. Only the founder&apos;s super admin account grants or ends access.</>,
        <>Where somebody has left, recommend ending their access the same day.</>,
      ],
    },
    {
      id: "incident",
      title: "A serious incident",
      steps: [
        <>Name one owner, and make sure it is not three people.</>,
        <>Tell the CEO at once. An outage, a data incident or a payment failure affecting many members does not wait for a report.</>,
        <>Make sure one person is writing updates where the team reads them, and one is writing what members are told.</>,
        <>Ask the Technical Administrator for the incident log entry, so there is one record.</>,
        <>Afterwards, read the written note, and make the change it names actually happen.</>,
      ],
    },
  ],
  standards: [
    { what: "Backlog", good: "No desk past the time Vallo publishes for it, and you know why before anybody asks." },
    { what: "Escalations", good: "Seen the same hour, taken or routed the same day, resolved with a note the raiser can act on." },
    { what: "Approvals", good: "Nothing waiting on you overnight, and every send-back carries its reason." },
    { what: "Quality", good: "You read real decisions every week, not only panels." },
    { what: "People", good: "Every lead has a measurable target and knows where it is measured." },
    { what: "Access", good: "The smallest set of areas that does the job, and access ended the day somebody leaves." },
  ],
  wordsUsed: [
    "\"Here is the rule, from today, and here is why.\" In writing, to the whole team.",
    "\"I have seen this. I am taking it.\" The first thing a raiser needs.",
    "\"Sent back because X. Here is what would pass.\"",
    "\"That is a compliance decision and it is not mine to change.\"",
  ],
  wordsNever: [
    "Never a target that the console cannot measure.",
    "Never a promise to a member that a desk has not made.",
    "Never pressure on a compliance or a verification decision.",
    "Never a date by which a feature will open.",
  ],
  privacy: [
    "You can open nearly everything. Open it for the decision in front of you: every opening is recorded with your name.",
    "Never read a support thread, a case or a person's file out of curiosity.",
    "A team announcement names counts and shapes, never members.",
    "Quality notes about a person stay between you, them and their lead.",
    "Never put a member's name or a reference in a board note or an email.",
  ],
  copilotCannot: [
    "It will not decide an escalation, approve anything, or change anybody's access. It can leave an access recommendation for the super admin, which is a note, not a change.",
    "It reads the cross-desk backlog and the escalations. The deciding is yours.",
  ],
  copilotAsk: [
    "What is the biggest backlog across desks?",
    "List open escalations",
    "What needs my approval today?",
  ],
  contacts: [
    { what: "A serious incident, a legal matter or a regulator's enquiry", who: "Chief Executive Officer" },
    { what: "Staff access", who: "The founder's super admin account, by recommendation" },
    { what: "A compliance matter", who: "Compliance Officer, who is independent of you" },
    { what: "Anything that would change the money model", who: "Chief Financial Officer and the CEO" },
    { what: "A refund, a cancellation, an alert or a switch", who: "An admin" },
    { what: "Platform health and incidents", who: "Technical Administrator and the Operations Manager" },
  ],
};

export const CEO: RoleWords = {
  who: "the Chief Executive Officer",
  keeps:
    "Everything Vallo promises a member is a promise you are accountable for. Your access reaches every desk so that you can understand and decide, not so that you can do other people's jobs.",
  purpose: (
    <p>
      This job leads Vallo and is accountable for everything it does, to its members and to its regulators. You set
      direction and see that every desk runs to the standard members are promised. You receive the escalations the
      COO, the CFO and the Compliance Officer cannot decide, and you decide them. Your access reaches every desk: use
      it to understand and to decide, and leave the day-to-day decisions to the people whose job they are.
    </p>
  ),
  glance: [
    "Your access areas are every one a staff member can hold: Listing approval, KYC review, Reports and moderation, Support, Agreement approval, Guarantee claims, Finance, Compliance and Operations.",
    "Staff access is still granted and ended by the founder's super admin account, and switches are still changed by admins.",
    "Compliance is independent of you by design. You hear from the Compliance Officer directly; you do not overrule a compliance decision.",
    "Anything affecting the company's licence or its members' safety goes to the board.",
    "Every record you open is written to the audit log with your name, exactly as for everybody else.",
  ],
  firstDay: [
    <>
      Sign in, confirm it is you, and acknowledge the{" "}
      <Link href="/admin/handbook" className={A}>
        staff handbook
      </Link>
      . It applies to you as written.
    </>,
    <>
      Read the whole{" "}
      <Link href="/admin/manual" className={A}>
        staff manual
      </Link>
      , and{" "}
      <Link href="/admin/manual/product-guide" className={A}>
        chapter 15
      </Link>{" "}
      twice: it is what the product actually is today.
    </>,
    <>
      Open{" "}
      <Link href="/admin" className={A}>
        Overview
      </Link>
      ,{" "}
      <Link href="/admin/overview" className={A}>
        the COO overview
      </Link>{" "}
      and{" "}
      <Link href="/admin/oversight" className={A}>
        Team oversight
      </Link>
      .
    </>,
    <>
      Open{" "}
      <Link href="/admin/escalations" className={A}>
        Escalations
      </Link>{" "}
      and read what has reached the top in the last month.
    </>,
    <>Meet the COO, the CFO and the Compliance Officer, and agree in writing what each brings to you and how fast.</>,
  ],
  firstWeek: [
    <>Read the escalations that reached the super admin level, and ask why each got that far.</>,
    <>Read the money model, the fee rates in force, and the no-custody wording on every money surface.</>,
    <>Read five decisions on each of four desks, to see the standard rather than the panel.</>,
    <>
      Read{" "}
      <Link href="/admin/trust" className={A}>
        Trust overview
      </Link>{" "}
      and ask the Head of Trust and Safety what members are complaining about that nothing counts.
    </>,
    <>Agree with the board what it hears from you, and when.</>,
  ],
  alone: [
    "Everything any desk role may decide, on an item that is not yours and belongs to nobody you know.",
    "Decide an escalation that reached you, where you did not raise it.",
    "Set direction, targets and the standard each desk is held to.",
    "Approve what needs an admin's approval, inside your areas.",
  ],
  withSomebody: [
    "Staff access: the founder's super admin account grants and ends it.",
    "A fee rise, destroying records past retention, or moving an account to a new email address: a super admin, and some of those need two.",
    "Every compliance decision: a second member of staff, and never you approving a proposal you made.",
    "Anything affecting the company's licence or its members' safety: the board.",
    "A change to the money model: the CFO and the board.",
  ],
  never: [
    "Overruling a compliance decision, or asking the Compliance Officer to change one.",
    "Deciding a case, listing, document, agreement or appeal where you have any interest.",
    "Resolving an escalation you raised yourself.",
    "Using your access to read a member's file, a case or a thread out of curiosity. It is recorded, and it is still wrong.",
  ],
  tasks: [
    {
      id: "weekly",
      title: "The weekly read",
      steps: [
        <>
          Read{" "}
          <Link href="/admin" className={A}>
            Overview
          </Link>{" "}
          and{" "}
          <Link href="/admin/oversight" className={A}>
            Team oversight
          </Link>
          : what is late, and where.
        </>,
        <>Read the escalations that moved up a level this week, and ask the COO why each did.</>,
        <>
          Read{" "}
          <Link href="/admin/trust" className={A}>
            Trust overview
          </Link>{" "}
          and the money reconciliation state.
        </>,
        <>Read five real decisions, chosen by you, not shown to you.</>,
        <>Write one note to the whole team: what is good, what is not, and what changes.</>,
      ],
    },
    {
      id: "escalation",
      title: "Decide what reached you",
      steps: [
        <>Press <strong>I have seen this</strong> the same hour. Everybody below you is waiting on that.</>,
        <>Read the brief and the attached record. Do not ask for a summary of a summary.</>,
        <>Press <strong>Take</strong>, so there is one owner.</>,
        <>Decide, and resolve with a closing note that says what was decided and why.</>,
        <>Ask the one question that matters afterwards: why did this need me? Then fix that.</>,
      ],
    },
    {
      id: "licence",
      title: "Something that affects the licence or a member's safety",
      steps: [
        <>Write down what you know, when you knew it, and from whom.</>,
        <>Tell the board. That is the escalation, and it does not wait for a meeting.</>,
        <>Ask the Compliance Officer what the law requires, and let them decide the compliance part.</>,
        <>Decide what members are told, with the Head of Trust and Safety and the COO, and say it once, in plain words.</>,
        <>Afterwards, write what changed. A serious matter with no change written down will happen again.</>,
      ],
    },
    {
      id: "standard",
      title: "Hold the standard",
      steps: [
        <>Pick one desk a week and read its decisions yourself.</>,
        <>Ask the lead one question: what would you do differently with one more person?</>,
        <>Where a decision was wrong, ask whether the rule was written down. Usually it was not.</>,
        <>Have the rule written and approved, and tell the team it is in force from a named day.</>,
        <>Never fix a single decision yourself and leave the rule unwritten.</>,
      ],
    },
  ],
  standards: [
    { what: "Escalations", good: "Anything that reaches you is seen the same hour and decided the same day." },
    { what: "Standard", good: "You read real decisions every week, and a wrong one produces a written rule, not a correction." },
    { what: "Independence", good: "No compliance or verification decision was changed because you asked." },
    { what: "The board", good: "The board hears a licence or safety matter from you first, and promptly." },
    { what: "Restraint", good: "Your access was used to understand and to decide, not to do somebody else's job." },
    { what: "Honesty", good: "Nothing Vallo says about money, safety or dates is something we cannot keep." },
  ],
  wordsUsed: [
    "\"I have seen this. I am taking it.\"",
    "\"Why did this need me?\" After every escalation that reached you.",
    "\"Write the rule down and I will approve it.\"",
    "\"That is the Compliance Officer's decision and it stands.\"",
  ],
  wordsNever: [
    "Never a promise about a date, to a member, a partner or the press.",
    "Never that a payment or a person on Vallo is covered or carries no risk.",
    "Never pressure on a compliance, verification or moderation decision.",
    "Never a member's name in a company note.",
  ],
  privacy: [
    "Your access is the widest on the platform and the audit log treats you exactly like everybody else.",
    "Open a member's file, a case or a document only where a decision of yours needs it.",
    "Never ask a member of staff to show you something your own access does not open.",
    "A board paper, a company note and an investor note name counts, never members.",
    "Never contact a member directly about a case. The desk that owns it writes to them.",
  ],
  copilotCannot: [
    "It will not decide anything, grant access, move money or send a message to a member.",
    "It reads every desk's figures for you because your access does. It is not a way around a second approver.",
  ],
  copilotAsk: [
    "Give me the headline numbers",
    "List open escalations",
    "What is late across every desk this week?",
  ],
  contacts: [
    { what: "Anything affecting the company's licence or its members' safety", who: "The board" },
    { what: "A change to the money model, or a material loss", who: "Chief Financial Officer, then the board" },
    { what: "A compliance matter, or a case involving a member of staff", who: "Compliance Officer, directly" },
    { what: "The operation, the backlogs and the team", who: "Chief Operating Officer" },
    { what: "Staff access", who: "The founder's super admin account" },
    { what: "Platform health and a serious incident", who: "Operations Manager and the Technical Administrator" },
  ],
};
