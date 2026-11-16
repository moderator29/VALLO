import Link from "next/link";
import { A, TodayNote } from "../parts";
import type { RoleWords } from "../types";

/**
 * THE FIVE DESK ROLES THAT DECIDE ONE ITEM AT A TIME: Moderator, Support
 * Agent, KYC Reviewer, Listings Reviewer and Agreements Officer.
 *
 * Every step below was read from the console's own code and from the staff
 * manual chapters that were read from it on 15 November 2026: chapter 3 for
 * the queues (the real control names, the reason lengths each action
 * enforces, the clocks), chapter 4 for who may decide what, chapter 5 for
 * what a member sees, and chapter 6 for escalation. Nothing here is invented:
 * where the code names no rota, no number and no person, the handbook says so.
 */

export const MODERATOR: RoleWords = {
  who: "the Moderator",
  keeps:
    "You are the person who reads what members report. A listing taken down an hour after it was reported, with a reason the author can read, is the difference between a platform people trust and one they warn each other about.",
  purpose: (
    <p>
      Vallo lets anybody post a listing, a message, a post or a profile, and most people are honest. A few are not.
      Your job is to read what members report and what the automatic scan holds back, decide what stays up, and write
      the reason the person reads. You work one item at a time, oldest first, inside the time the queue shows. You do
      not chase fraud across the platform and you do not build cases for weeks: you decide the item in front of you,
      consistently, and hand up anything bigger than it.
    </p>
  ),
  glance: [
    "Your access area is Reports and moderation. It opens the Reports, Flags and Held lanes of the Unified queue, Blocked terms, Cases and the Circle desk.",
    "Take an item before you work it. A claim frees itself after thirty minutes without a touch.",
    "A dismissal needs a reason of at least eight characters. Taking content down needs a reason the author reads word for word.",
    "The same content gets the same decision, whoever reported it and whoever posted it.",
  ],
  firstDay: [
    <>
      Sign in, confirm it is you, and acknowledge the{" "}
      <Link href="/admin/handbook" className={A}>
        staff handbook
      </Link>
      . Nothing opens until you do.
    </>,
    <>
      Open{" "}
      <Link href="/admin/my-desk" className={A}>
        My desk
      </Link>
      . Check that your name, your position and your access area read correctly. If they do not, tell your lead before
      you decide anything.
    </>,
    <>
      Read{" "}
      <Link href="/admin/manual/queues" className={A}>
        chapter 3 of the staff manual
      </Link>{" "}
      (Working a queue) and{" "}
      <Link href="/admin/manual/decisions" className={A}>
        chapter 4
      </Link>{" "}
      (What you may decide alone), end to end.
    </>,
    <>
      Open{" "}
      <Link href="/admin/queue?tab=reports" className={A}>
        the Reports tab of the Unified queue
      </Link>{" "}
      and read ten decided items without touching anything. Look at the reason each moderator wrote. That is the
      standard you are copying.
    </>,
    <>
      Read{" "}
      <Link href="/admin/blocked-terms" className={A}>
        Blocked terms
      </Link>
      , so you know what the scan is holding and why.
    </>,
    <>
      Take one report with your lead beside you. Say out loud what you looked at before you press anything, then
      decide it and read your reason back as the reporter will read it.
    </>,
    <>Press Escalate once, on a real item, so you have done it before the day you need it in a hurry.</>,
  ],
  firstWeek: [
    <>Work the Reports lane every day, oldest first. Aim to leave nothing past its time.</>,
    <>
      Work the Held lane: content the automatic scan stopped. Let it through or take it down, and write the reason the
      author reads.
    </>,
    <>
      Open five cases on{" "}
      <Link href="/admin/cases" className={A}>
        Cases
      </Link>{" "}
      and follow one from assignment to resolution, so you know what a case is for and when a report becomes one.
    </>,
    <>
      Ask your lead to read five of your reasons and tell you what would have been better. Do this every week for your
      first month.
    </>,
    <>
      Learn the fraud shapes by heart: a request to pay outside Vallo, an inspection fee, a listing copied from
      another site, an agent who will only talk on a messaging app, a price far under everything near it.
    </>,
    <>
      Read{" "}
      <Link href="/admin/manual/records" className={A}>
        chapter 5
      </Link>
      , so you know exactly what the member sees of your decision.
    </>,
  ],
  alone: [
    "Resolve or dismiss a report. A dismissal needs a reason of at least eight characters, and you may write a separate line for the person who reported, which is the only part that reaches them.",
    "Review a message flag the scanner raised.",
    "Let held content through, which needs no reason, or take it down, which needs a reason the author reads word for word.",
    "Write internal notes on a case for your colleagues.",
    "Act on content in a case you are assigned: hold it, remove it or restore it, each with a reason, each reversible.",
    "Restrict a member for up to thirty days on a case in your module, with a reason of at least ten characters that the member reads.",
  ],
  withSomebody: [
    "A report about a member of staff: hand it to the Head of Trust and Safety without acting on it.",
    "A restriction longer than thirty days, or with no end: the Head of Trust and Safety, or an admin.",
    "An appeal against a restriction: somebody other than whoever made the decision, which means never you if it was yours.",
    "A change to the blocked terms list: propose it to your lead with the examples that made you ask.",
  ],
  never: [
    "A report you filed, one about you, or one about your own post, story, comment or bio. The console refuses it, and so should you.",
    "A refund, a cancellation or anything to do with money. Hand it to the Money desk.",
    "An identity document or an identity check. That is the verification desk.",
    "Suspending a member, stopping an agent trading, or granting anybody access.",
  ],
  tasks: [
    {
      id: "report",
      title: "Decide a report",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/queue?tab=reports" className={A}>
            the Reports tab
          </Link>
          . It is ordered by when each row falls due, not by age, so work from the top.
        </>,
        <>Press <strong>Take</strong> on the oldest row. Your name goes on it so a colleague does not work it too.</>,
        <>
          Read the whole thing: what the reporter wrote, the content itself, the thread or listing around it, and the
          account&apos;s history on the case.
        </>,
        <>Press <strong>Start review</strong>.</>,
        <>
          Decide. <strong>Resolve</strong> it where the report is right and you have acted on the content.{" "}
          <strong>Dismiss</strong> it where it is not, with a reason of at least eight characters.
        </>,
        <>
          Write the line for the reporter, where there is something to say. Only that line reaches them. Your internal
          notes never do.
        </>,
        <>
          Where the content has to come down, act on it from the case rather than the report, so the record holds the
          evidence and the action together.
        </>,
      ],
      note: (
        <p>
          If a colleague decided it first, your press changes nothing and the desk tells you it was decided elsewhere.
          That is the desk working, not a fault.
        </p>
      ),
    },
    {
      id: "held",
      title: "Decide content the scan held",
      steps: [
        <>
          Open the <strong>Held</strong> lane of the{" "}
          <Link href="/admin/queue" className={A}>
            Unified queue
          </Link>
          .
        </>,
        <>Take the oldest item and read it in full, with whatever it was replying to.</>,
        <>
          Press <strong>Let through</strong> where the scan was wrong. No reason is needed, and nobody is told.
        </>,
        <>
          Press <strong>Take down</strong> where it was right, with a reason the author reads word for word. Say what
          rule it broke, in one sentence, without insulting anybody.
        </>,
        <>
          Where the same word keeps holding honest posts, note the examples and tell your lead. The blocked terms list
          is changed by a person, not by you alone.
        </>,
      ],
    },
    {
      id: "case",
      title: "Work a case",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/cases" className={A}>
            Cases
          </Link>
          . Each case is one thing reported, with its own timeline, evidence and deadline: critical in four hours, high
          in a day, medium in three days, low in seven. Three or more reports raise it one level.
        </>,
        <>Assign it to yourself, which puts it under review.</>,
        <>
          Write internal notes as you go: what you looked at, what it showed. A colleague picking this up at midnight
          should need nothing but your notes.
        </>,
        <>
          Where you need something from the member, set the case to <strong>awaiting information</strong> and message
          them from the case. They get a notice from Vallo Trust and Safety that never names the reporter.
        </>,
        <>Act on the content: hold, remove or restore, with a reason. Every action can be reversed.</>,
        <>
          Where the case needs it, <strong>restrict</strong> the member with a reason of at least ten characters. They
          are told at once with your reason and can appeal from their account standing page.
        </>,
        <>
          <strong>Resolve</strong> it with an outcome and a note. Linked reports close with it, and you choose whether
          the people who reported are told the outcome in plain words.
        </>,
      ],
    },
    {
      id: "fraud",
      title: "Report a fraud pattern",
      steps: [
        <>Decide the item in front of you first. Do not leave it open while you look for others.</>,
        <>
          Press <strong>Escalate</strong> at the top of the page, with the case attached, and choose{" "}
          <strong>Identity or fraud</strong>.
        </>,
        <>
          Write what you saw, how many times, and what the items have in common: the same phone number, the same
          photographs, the same wording, the same bank name. Never paste an account number or a document.
        </>,
        <>Tell your lead the same day as well. Two routes for the same thing is the right amount here.</>,
      ],
    },
  ],
  standards: [
    { what: "Speed", good: "Nothing in your lane past the time the queue shows. Anything unsafe or about money already lost is answered within four hours." },
    { what: "Consistency", good: "The same content gets the same decision, whoever reported it and whoever posted it. A colleague reading your decision would have made it too." },
    { what: "Reasons", good: "One or two short sentences a stranger understands, naming the rule and not the person's character." },
    { what: "Notes", good: "A colleague can pick up your case cold and need nothing from you." },
    { what: "Claims", good: "You hold only what you are working on. Nothing sits claimed by you while you are away." },
    { what: "Care", good: "A member who reported harm is taken seriously even where the evidence is thin, and is never made to feel accused." },
  ],
  wordsUsed: [
    "\"We have looked at this and taken the content down because it broke our rules on X.\" Name the rule, not the person.",
    "\"We have looked at this and the content stays up. We did not find that it broke our rules.\" Honest and short beats a long apology.",
    "\"Thank you for telling us. We take this seriously.\" To anybody who reports harm, always.",
    "\"It is being reviewed.\" To a member asking why something is slow. Nothing more.",
    "\"Vallo charges renters no fee, and never asks for an inspection fee. If somebody asked you for one, tell us and we will look at it.\"",
  ],
  wordsNever: [
    "Never say or hint who reported something. Not the name, not the city, not \"another agent\".",
    "Never tell a member you suspect them of fraud. A person who is warned destroys evidence.",
    "Never say a decision came from the system or the scan. A person decided it, and that person is you.",
    "Never promise what another desk decides: a refund, a payout, an account restored.",
  ],
  privacy: [
    "You read messages between members when a flag or a report brings one to you. Read the ones your item needs and no others. Every opening is recorded.",
    "Never repeat what one member said to another, to anybody, including the other party in the case.",
    "Internal notes are for colleagues. Write them as though the member will one day read them in a court, because the record can be produced.",
    "Content you take down may be distressing. You are not expected to sit with it alone: tell your lead, who rotates reviewers off that work.",
    "Never screenshot content, a profile or a thread onto your own phone, for evidence or for anything else. The case holds the evidence.",
  ],
  copilotCannot: [
    "It will not decide a report, release held content, restrict anybody or resolve a case. It has no tool that does.",
    "It will not show you the words of a case in a module your access area does not open.",
  ],
  copilotAsk: [
    "What is older than 24 hours in moderation?",
    "Summarise the open reports by category",
    "How do I take held content down, and what does the author see?",
  ],
  contacts: [
    { what: "A decision you cannot make, or two rules that seem to conflict", who: "Head of Trust and Safety" },
    { what: "A report about a member of staff", who: "Head of Trust and Safety, without acting on it" },
    { what: "Anything about money, a refund or a payment", who: "Finance Officer, through the Escalate button" },
    { what: "An identity you doubt, or a document that may be forged", who: "Compliance Officer, through the Escalate button as Identity or fraud" },
    { what: "Distressing material, or needing a break from it", who: "Head of Trust and Safety" },
    { what: "Your access, or a desk that will not open", who: "The founder's super admin account, through your lead" },
  ],
};

export const SUPPORT_AGENT: RoleWords = {
  who: "the Support Agent",
  keeps:
    "You are the only person at Vallo most members ever speak to. A clear first reply, in words they understand, is often the whole of their opinion of us.",
  purpose: (
    <p>
      Members write to Vallo when something has gone wrong or they do not understand what they are looking at. Your job
      is to answer them: resolve what you can resolve yourself, hand the rest to the desk that can decide it, and keep
      the member told while it is away. You do not decide refunds, you do not decide identity, and you do not decide
      what happens to content. You explain how Vallo works, honestly, and you make sure nothing sits unanswered.
    </p>
  ),
  glance: [
    "Your access area is Support. It opens the Support desk, the Tickets tab of the Unified queue, cases to read and note, and the page-feedback list.",
    "A ticket's clock runs from the member's oldest unanswered message. Once we have written last, no clock runs.",
    "Safety tickets and ones handed to Money or Safety run on a four hour clock. Verification runs on three days. Everything else runs on a day.",
    "Never promise an outcome another desk decides, and never ask a member for a password, a card number or a one-time code.",
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
      Open{" "}
      <Link href="/admin/my-desk" className={A}>
        My desk
      </Link>{" "}
      and check your position and access area read correctly.
    </>,
    <>
      Read{" "}
      <Link href="/admin/manual/queues" className={A}>
        chapter 3 of the staff manual
      </Link>
      , the Support tickets part, twice.
    </>,
    <>
      Read{" "}
      <Link href="/admin/manual/product-guide" className={A}>
        chapter 15, Vallo feature by feature
      </Link>
      . You cannot explain a product you do not know, and most tickets are questions, not complaints.
    </>,
    <>
      Open{" "}
      <Link href="/admin/support" className={A}>
        Support
      </Link>{" "}
      and read twenty answered tickets in the Done lane. Notice the length: short, warm, specific.
    </>,
    <>Read every saved reply, start to finish, so you know what exists before you write anything from scratch.</>,
    <>
      Answer three tickets with your lead reading each reply before it goes. Say what you are about to promise, and
      check that it is ours to promise.
    </>,
  ],
  firstWeek: [
    <>Work the lanes in this order each day: Escalated, Waiting on us, New, then Mine.</>,
    <>Learn the keys: j and k move between tickets, n opens the next one nobody holds, c takes it, r replies, m opens saved replies, e hands it to another desk, and ? lists them all.</>,
    <>
      Hand one ticket to each of the three desks (Money, Safety, Verification) so you have done it, and watch what
      comes back.
    </>,
    <>
      Learn the money sentences by heart. Vallo never holds a member&apos;s money, a card payment goes to the
      lister&apos;s bank through the payment processor in the same transaction, and a refund goes back to the card or
      account that paid.
    </>,
    <>
      Read{" "}
      <Link href="/admin/doc-feedback" className={A}>
        Pages that fail
      </Link>{" "}
      and tell the Content Manager the three questions you answered most that a help page should have answered.
    </>,
    <>Ask your lead for a quality review of five of your replies, against tone, accuracy, speed and policy.</>,
  ],
  alone: [
    "Reply to a ticket, set its status honestly, and resolve or close it. Closing always needs a note saying what was done.",
    "Hand a ticket to Money, Safety or Verification with a reason of at least eight characters, and keep talking to the member meanwhile.",
    "Write internal notes for colleagues, which never reach the member.",
    "Read a case to answer the member who asked about it, and note what you told them.",
    "Use and adjust a saved reply. Read it before it goes: your first name is on it.",
  ],
  withSomebody: [
    "Anything about money that has not arrived, or a refund that has not come back: hand it to Money with the booking attached.",
    "A member who says they are in danger: escalate as Safety and Urgent at once, and follow what the safety runbook says.",
    "A question about a policy nobody has written down: ask the Customer Support Lead, who writes the policy note and has it approved.",
    "A member who wants a decision reversed: the desk that made it, through the Escalate button.",
  ],
  never: [
    "A refund, a cancellation, or declining a refund request. Those are admin decisions made on the stay's own page.",
    "Approving or refusing an identity document, a check or an application.",
    "Taking content down, restricting a member or resolving a case.",
    "Telling a member what another desk will decide, or when.",
    "Asking a member for a password, a card number, a one-time code or a bank log-in. Vallo never asks, and neither do you.",
  ],
  tasks: [
    {
      id: "ticket",
      title: "Answer a ticket",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/support" className={A}>
            Support
          </Link>
          . Work Escalated, then Waiting on us, then New. Late tickets are at the top of each lane.
        </>,
        <>Press <strong>Take</strong> (or c). Replying takes an unheld ticket for you. The database refuses a reply on a ticket a colleague holds.</>,
        <>Read the whole thread, and the record it is about, before you type a word.</>,
        <>
          Press <strong>Reply</strong> (or r). Open the saved replies (m) and start from one where it fits. Read it and
          change it: your name is on it, not the template&apos;s.
        </>,
        <>
          Answer the question that was asked, say what happens next, and say who is doing it. Two short paragraphs
          beats one long one.
        </>,
        <>
          Set the status honestly: waiting on the member, waiting on us, or resolved.{" "}
          <strong>Send and resolve</strong> does both in one step where the answer finishes it.
        </>,
        <>Closing needs a note saying what was done. Write it for the colleague who reopens this in a month.</>,
      ],
    },
    {
      id: "handoff",
      title: "Hand a ticket to another desk",
      steps: [
        <>Decide which desk it belongs to: <strong>Money</strong> for anything about a payment or a refund, <strong>Safety</strong> for harm, threats or anything that may be a crime, <strong>Verification</strong> for identity and documents.</>,
        <>Press <strong>Hand to another desk</strong> (or e), choose the desk, and write the reason in at least eight characters. They read it first, so put the question in the first line.</>,
        <>
          Tell the member on the thread that it has gone to the team that can decide it, and that you will come back to
          them. Do not say what they will decide.
        </>,
        <>Keep the ticket in your view. The other desk hands it back with what it found, and you are the one who writes to the member.</>,
        <>
          Never hand a ticket to Compliance. If you suspect a compliance matter, hand it to Safety and say why: the
          people who receive it decide whether Compliance hears of it, so nothing you write can tip a person off.
        </>,
      ],
    },
    {
      id: "money-question",
      title: "Answer a question about money",
      steps: [
        <>Find the payment or booking first, by its reference, on{" "}
          <Link href="/admin/lookup" className={A}>
            Lookup
          </Link>
          . Never answer from what the member says the amount was.
        </>,
        <>
          Say what is true: Vallo uses regulated payment partners to process eligible payments, and Vallo does not hold
          customer money. On a card payment the lister&apos;s share goes to their bank account through the payment
          processor in the same transaction.
        </>,
        <>A refund goes back to the card or account that paid. Say that, and say the desk that decides it is looking.</>,
        <>Hand it to Money with the booking attached. Do not say an amount, a date or a yes.</>,
        <>Write back to the member when Money answers, in your own words, with what was decided and why.</>,
      ],
      note: (
        <TodayNote>
          Payment for rentals is not open on Vallo, and sales are never paid on Vallo. Stays and hotel rooms pay by
          card, and a restaurant table is free to book.
        </TodayNote>
      ),
    },
    {
      id: "cannot-find",
      title: "A member who cannot find something",
      steps: [
        <>Ask what they typed, and where: Search, or VALLO Intelligence.</>,
        <>
          Type the same words into{" "}
          <Link href="/intelligence" className={A}>
            VALLO Intelligence
          </Link>{" "}
          yourself, and read the chips under Search understood.
        </>,
        <>
          A place they did not mean, a budget or a bedroom count is the usual cause. Tell them which chip to tap to
          remove it, or a shorter way to say it.
        </>,
        <>
          Where a word or a nickname is not understood, note it on the ticket and tell the Content Manager, who can add
          it as an alias.
        </>,
        <>Where nothing on Vallo matches, say so plainly. Never promise that a listing will appear.</>,
      ],
      note: (
        <p>
          You cannot see what a member searched, and no desk shows it. Work only from what they tell you. Chapter 15 of
          the staff manual says how VALLO Intelligence works.
        </p>
      ),
    },
    {
      id: "danger",
      title: "A member who says they are in danger",
      steps: [
        <>Stop what you are doing. This comes before every other ticket in your lane.</>,
        <>
          Press <strong>Escalate</strong>, choose <strong>Safety</strong> and <strong>Urgent</strong>. It tells the
          super admin at once and raises a critical alert.
        </>,
        <>Write what the member said, in their words, and what you have already done. Nothing else.</>,
        <>Reply to the member: that you have passed it to the team who deal with this, and that they will be contacted. Do not advise, do not promise, do not ask for detail you do not need.</>,
        <>Tell the Head of Trust and Safety and the Customer Support Lead the same hour.</>,
      ],
    },
  ],
  standards: [
    { what: "First reply", good: "Inside the clock the ticket carries, and sooner on anything unsafe. Four hours where somebody was asked to pay outside Vallo or has lost money." },
    { what: "Accuracy", good: "Every fact in your reply came from a record you opened, not from memory." },
    { what: "Tone", good: "A worried person is calmer after reading it. Short sentences, no jargon, no blame." },
    { what: "Resolution", good: "The member does not have to write again to find out what happened." },
    { what: "Honesty", good: "You never promised an outcome that was not yours, and you never said a date nobody can keep." },
    { what: "Closing notes", good: "Every closed ticket says what was done, in a sentence a colleague can act on." },
  ],
  wordsUsed: [
    "\"Vallo charges renters no fee.\" True, and worth saying early.",
    "\"Vallo does not hold your money. Your payment goes to the lister through our payment partner.\"",
    "\"A refund goes back to the card or account that paid it.\"",
    "\"I have passed this to the team who decide it. I will write to you as soon as they answer.\"",
    "\"We never ask for a password, a card number or a one-time code. If anybody asks you for one, it is not us.\"",
    "\"Vallo asks for no inspection fee. If somebody asked you for one, tell us and we will look at it.\"",
    "\"Try VALLO Intelligence from the menu, or Ctrl K on a computer, and type it the way you would say it.\"",
  ],
  wordsNever: [
    "Never \"your money is with us\", \"we are holding it\" or anything about a balance or a wallet.",
    "Never \"you will get your refund\" before the desk that decides it has decided.",
    "Never a time nobody can keep: \"by tomorrow\", \"within the hour\", \"soon\".",
    "Never a personal phone number, a WhatsApp number or an email of your own. Everything stays on the ticket.",
  ],
  privacy: [
    "A ticket shows you a real person's booking, address and payment. Open only what the ticket needs. Every opening of a person's file is recorded.",
    "Never confirm to one member anything about another, including whether they have an account.",
    "Never take a conversation off the platform, and never accept a payment or a gift from a member.",
    "A saved reply never carries anybody's name or reference. Fill those in yourself, each time.",
    "If a member sends you a photograph of a document in the ticket, do not copy it anywhere. Hand the ticket to Verification and say it is attached.",
  ],
  copilotCannot: [
    "It will not send a message to a member. It drafts a reply for you to read, change and send yourself.",
    "It will not decide a refund, a restriction or an identity check, and it cannot hand a ticket over for you.",
  ],
  copilotAsk: [
    "Summarise the oldest waiting tickets",
    "Draft a reply to the oldest ticket",
    "What can I tell a member about where their refund goes?",
  ],
  contacts: [
    { what: "A ticket you cannot answer, or a policy nobody has written", who: "Customer Support Lead" },
    { what: "Money that has not arrived, or a refund that has not come back", who: "Finance Officer, by handing the ticket to Money" },
    { what: "A member in danger, or a threat", who: "Head of Trust and Safety and the COO, at once" },
    { what: "An identity or a document", who: "KYC Reviewer, by handing the ticket to Verification" },
    { what: "A help page that is wrong or missing", who: "Content Manager" },
    { what: "Your workload, or a lane you cannot clear", who: "Customer Support Lead" },
  ],
};

export const KYC_REVIEWER: RoleWords = {
  who: "the KYC Reviewer",
  keeps:
    "A badge on Vallo means a person looked at a real document and said yes. You are that person, and the badge is worth exactly as much as your care.",
  purpose: (
    <p>
      Before an agent, an owner or a firm can trade on Vallo, somebody has to read their documents and decide whether
      the person is who they say. That is this job. You work the verification desk one person at a time: you compare
      the document against the application, you record each rung of the ladder you passed, and you approve, refuse
      with a reason, or ask for more. You decide identity. You do not decide listings, money or content.
    </p>
  ),
  glance: [
    "Your access areas are KYC review. They open Verification, the reviewer guide, Applications and review calls on those.",
    "One row per person, not per file. Open the person to see their ladder, their documents, their identity checks and the consent they gave.",
    "Approving a document needs no reason. Refusing one needs a reason of at least twelve characters, which the person reads word for word.",
    "An identity check with no government record behind it cannot be approved. Refuse it with a reason, or wait for a new check.",
    "Documents open in the console's own viewer, never a raw link, and every opening is recorded with your name.",
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
      Read the{" "}
      <Link href="/admin/kyc/guide" className={A}>
        reviewer guide
      </Link>{" "}
      end to end. Read it before your first decision, and again whenever you are unsure.
    </>,
    <>
      Read{" "}
      <Link href="/admin/manual/queues" className={A}>
        chapter 3
      </Link>
      , the identity part, and{" "}
      <Link href="/admin/manual/decisions" className={A}>
        chapter 4
      </Link>
      .
    </>,
    <>
      Open{" "}
      <Link href="/admin/kyc" className={A}>
        Verification
      </Link>{" "}
      and open one person, with your lead, to see the ladder, the documents and the identity check side by side.
    </>,
    <>Learn what a Nigerian driver&apos;s licence, a national identity card, an international passport and a voter card actually look like, and where each one carries its number.</>,
    <>
      Decide three documents with your lead reading your reason before it goes. A refusal is read word for word by the
      person, so it has to say what to do next.
    </>,
  ],
  firstWeek: [
    <>Work the desk daily, oldest first. Applications and documents sit under a three day promise.</>,
    <>
      Work the Agents tab of the{" "}
      <Link href="/admin/queue?tab=agents" className={A}>
        Unified queue
      </Link>{" "}
      as well, which is the same applications ordered by when each falls due.
    </>,
    <>Hold one review call, where a case needs you to see the person, and record the attendance and the outcome. A call verifies nothing by itself.</>,
    <>Learn the forgery shapes: a font that does not match, an edge that has been cut, a date that disagrees with the number, a photograph taken of a screen, the same document on two accounts.</>,
    <>
      Escalate one case as Identity or fraud, to have done it. A document you believe is forged goes to the Compliance
      Officer, and the applicant is never told why.
    </>,
    <>Ask the Compliance Officer to read five of your decisions and tell you where your standard differs from theirs.</>,
  ],
  alone: [
    "Approve or refuse an identity document. A refusal needs a reason of at least twelve characters, sent to the person word for word.",
    "Approve or refuse an identity check, with the selfie match and liveness beside it. A refusal needs a reason of at least twelve characters.",
    "Ask a person for a selfie holding their ID, saying what you need and why, in at least twelve characters.",
    "Approve, send back, or refuse an agent, owner or firm application. A refusal needs a reason of at least eight characters.",
    "Record each rung of the verification ladder you passed, one at a time.",
  ],
  withSomebody: [
    "A document you believe is forged, or a match on a sanctions or fraud list: the Compliance Officer, and the applicant is not told why.",
    "A person who may be politically exposed: the Compliance Officer, whose lane decides it with a second member of staff.",
    "A business's verification and publishing: an admin records it. You do the identity work behind it.",
    "A standard you are not sure of: the Compliance Officer sets the standard this desk applies.",
  ],
  never: [
    "Your own application, document or check, or that of anybody you know. The database refuses it, and you should leave it before it has to.",
    "A listing. Even where the same person owns it.",
    "A refund, a payout or anything about money.",
    "Telling an applicant that they are the subject of a check or a report. Tipping off is an offence.",
  ],
  tasks: [
    {
      id: "document",
      title: "Decide an identity document",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/kyc" className={A}>
            Verification
          </Link>{" "}
          and open the oldest person waiting.
        </>,
        <>Open each document in the console&apos;s own viewer. Never a raw link, and never download it.</>,
        <>
          Compare it with the application: the name, the number, the date of birth, the expiry and the photograph must
          agree. A middle name missing is a question; a different surname is a refusal.
        </>,
        <>Look at the document itself: the fonts, the edges, the background pattern, whether it is a photograph of a screen.</>,
        <>
          <strong>Approve</strong> where everything agrees. No reason is needed.
        </>,
        <>
          <strong>Refuse</strong> where it does not, with a reason of at least twelve characters that says what is
          wrong and what to send instead. The person reads it word for word.
        </>,
        <>
          Where you need more, <strong>ask for a selfie with the ID</strong>, saying what you need and why.
        </>,
        <>Record the rung on the ladder. One rung at a time, and only the rungs you actually looked at.</>,
      ],
      note: (
        <p>
          Open only the documents your task needs. Every opening is written to the audit log with your name, and a
          reviewer who opened six files to decide one will be asked why.
        </p>
      ),
    },
    {
      id: "check",
      title: "Decide an identity check",
      steps: [
        <>Open the person and find the identity check: the result of a government record check, with the selfie match and the liveness result.</>,
        <>Read what came back. A check where no government record came back cannot be approved.</>,
        <>Compare the selfie with the document photograph yourself. The match score is evidence, not a decision.</>,
        <>
          <strong>Approve</strong>, or <strong>refuse</strong> with a reason of at least twelve characters.
        </>,
        <>Where no record came back, refuse with a reason, or wait for a new check. Never approve to clear the queue.</>,
      ],
    },
    {
      id: "application",
      title: "Decide an application",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/agents" className={A}>
            Applications
          </Link>
          , or the Agents tab of the Unified queue.
        </>,
        <>Read the whole application: who they say they are, what they say they do, and the documents filed with it.</>,
        <>Check the business details against the documents, and the documents against each other.</>,
        <>
          <strong>Approve</strong>, <strong>send back</strong> with a note saying exactly what is missing, or{" "}
          <strong>refuse</strong> with a reason of at least eight characters.
        </>,
        <>Where the application is for somebody you know, leave it and say why in the notes.</>,
      ],
    },
    {
      id: "forged",
      title: "A document you believe is forged",
      steps: [
        <>Do not refuse it with the real reason. Do not write &quot;this looks forged&quot; where the applicant will read it.</>,
        <>
          Press <strong>Escalate</strong>, choose <strong>Identity or fraud</strong>, and attach the person&apos;s
          record with the link the form adds.
        </>,
        <>Write what you saw: which document, which field, what is wrong with it. Never paste the number itself.</>,
        <>Leave the case open and leave the applicant where they are. The Compliance Officer decides what happens next, including whether anybody is told.</>,
        <>Tell nobody else, inside or outside Vallo. Tipping off is an offence, not a policy.</>,
      ],
    },
  ],
  standards: [
    { what: "Speed", good: "Documents, checks and applications decided inside three days. Nothing older than that in your queue at the end of a week." },
    { what: "Care", good: "Every field compared, every time. The number, the name, the date and the photograph." },
    { what: "Reasons", good: "A refusal says what was wrong and what to send instead, in words a person acts on without writing back." },
    { what: "The ladder", good: "Every rung you record is a rung you looked at. Nothing is passed to move a person along." },
    { what: "Restraint", good: "You opened only the files your decision needed." },
    { what: "Independence", good: "No commercial pressure and no colleague's deadline changed one of your decisions." },
  ],
  wordsUsed: [
    "\"We could not accept this document because the name on it does not match the name on the account. Please send a document in the account's name.\" Say what, and say what next.",
    "\"We need a photograph of you holding your ID, so we can see that the document belongs to you.\"",
    "\"Your application has been approved.\" Nothing more is needed.",
    "\"It is being reviewed.\" To anybody asking why it is slow.",
  ],
  wordsNever: [
    "Never \"this looks fake\", \"we think you are lying\" or anything a person could read as an accusation. Refuse on the facts.",
    "Never tell an applicant why their case went to Compliance, or that it did.",
    "Never write that somebody is now safe, protected or guaranteed by anything.",
    "Never name the register, the list or the provider a check ran against in a message to the applicant.",
  ],
  privacy: [
    "Identity documents are the most sensitive data on the platform. Open them in the console's viewer, for one task, and close them.",
    "Never download, photograph, screenshot or email a document, for any reason, including your own notes.",
    "Never copy an identity number, a BVN or a NIN into a note, an escalation or a ticket. Reference the record instead.",
    "Never review your own application or that of anyone you know personally. Leave it and say why.",
    "What you learn about a person's address, age or family from a document is for the decision and nothing else.",
  ],
  copilotCannot: [
    "It will not approve or refuse a document, a check or an application.",
    "It never shows you a document or the contents of one. It counts people and pending documents, and says who has waited longest.",
  ],
  copilotAsk: [
    "Who has waited longest for verification?",
    "How many documents are pending?",
    "How do I tell a forged ID?",
  ],
  contacts: [
    { what: "A document you believe is forged, or a sanctions match", who: "Compliance Officer, through the Escalate button as Identity or fraud" },
    { what: "The standard this desk applies", who: "Compliance Officer" },
    { what: "A politically exposed person", who: "Compliance Officer" },
    { what: "A business's verification and publishing", who: "An admin, through the Escalate button" },
    { what: "A listing you noticed while reviewing a person", who: "Listings Reviewer" },
    { what: "Your access, or a desk that will not open", who: "The founder's super admin account, through the Compliance Officer" },
  ],
};

export const LISTINGS_REVIEWER: RoleWords = {
  who: "the Listings Reviewer",
  keeps:
    "Every listing on Vallo passed a person before it went live. You are that person. A listing goes live only when you would be comfortable sending a member of your own family to view it.",
  purpose: (
    <p>
      In too many Nigerian property searches, nobody can be sure that a listing is real or that the price is the price.
      Vallo answers that by having a person read every property before it goes live. That is this job. You read the
      photographs, the description, the price and every fee, and the evidence that the lister is allowed to let or sell
      the place, and you approve it, send it back for changes, or reject it, with a reason the lister reads.
    </p>
  ),
  glance: [
    "Your access area is Listing approval. It opens Listings, the Listings tab of the Unified queue, property cases and review calls on a listing.",
    "Read the whole listing before you decide. Nothing is approved on a summary.",
    "A send-back needs your reason, and the listing waits with the lister. A rejection needs a reason of at least eight characters, and they can edit and send it again.",
    "Approving is not publishing. The console publishes only when every publishing rule passes, and tells you which one held it back.",
    "Check that every fee a renter will pay is declared, and that nothing asks for an inspection fee.",
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
      <Link href="/admin/manual/queues" className={A}>
        chapter 3
      </Link>
      , the listings part, and{" "}
      <Link href="/admin/manual/decisions" className={A}>
        chapter 4
      </Link>
      .
    </>,
    <>
      Open{" "}
      <Link href="/admin/listings" className={A}>
        Listings
      </Link>
      , Waiting tab, and read ten decided listings: five approved, five sent back. Read the reasons.
    </>,
    <>Look at twenty live listings as a member sees them, on a phone. You are deciding what a stranger will believe.</>,
    <>
      Read{" "}
      <Link href="/admin/manual/product-guide" className={A}>
        chapter 15
      </Link>
      , so you know what Vallo charges, what it does not, and what a renter actually pays.
    </>,
    <>Decide three listings with your lead reading each reason before it goes.</>,
  ],
  firstWeek: [
    <>Work the Waiting tab every day, oldest first. A listing that is not as described sits under a one day promise.</>,
    <>Learn to spot a copied photograph: a watermark, a different season, a kitchen that appears on three listings, an image too good for the rest of the set.</>,
    <>Learn what an owner&apos;s written mandate looks like, and why an agent or firm listing cannot publish without one.</>,
    <>Follow one approved listing through to live, and read the publishing rules that held it or let it through.</>,
    <>Reject one listing you believe is a scam, report it to moderation, and tell your lead the same day.</>,
    <>Ask your lead to read five of your reasons and say what would have been better.</>,
  ],
  alone: [
    "Approve a listing. The console then tries to publish it and tells you if a rule holds it back.",
    "Ask for more: pick the reason chips that fit and add your own words. A reason is required, and the lister reads it word for word.",
    "Reject a listing, with a reason of at least eight characters. The lister can edit and send it again.",
    "Note what you found on a property case, and act on property content within a case assigned to you.",
    "Hold a review call on a listing where you need to see the person behind it.",
  ],
  withSomebody: [
    "A listing from somebody a colleague brought onto Vallo: a second person's eyes before it is decided.",
    "A listing you believe is a scam: reject it, report it to moderation, and tell your lead the same day.",
    "An owner's mandate you doubt: the Business Development Director, who holds the relationship, and your lead.",
    "A restriction on a member longer than thirty days: the Head of Trust and Safety, or an admin.",
  ],
  never: [
    "Your own listing, or one from somebody you know personally.",
    "An identity document or an identity check. Note what you saw and hand it to Verification.",
    "A fee rate, a switch or anything that changes what every listing pays.",
    "A refund, a payout or anything about money.",
  ],
  tasks: [
    {
      id: "listing",
      title: "Review a listing",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/listings" className={A}>
            Listings
          </Link>
          , Waiting tab, and open the oldest row.
        </>,
        <>Read the photographs first. Look for images that belong to another listing, a different season, or a watermark.</>,
        <>Read the costs, line by line, and who each one is paid to. Every fee a renter will pay has to be declared. Nothing may ask for an inspection fee.</>,
        <>Read the description against the photographs and the address. A three bedroom in the words and two in the pictures is a send-back.</>,
        <>Check the lister: their verification, and the owner&apos;s written mandate where an agent or a firm is listing.</>,
        <>
          <strong>Approve</strong> where you would send your own family to view it. The console tries to publish it at
          once and tells you if a publishing rule holds it back, and the lister is told what is missing.
        </>,
        <>
          <strong>Ask for more</strong> where it is nearly right: pick the reason chips and add your words. The listing
          waits with the lister.
        </>,
        <>
          <strong>Reject</strong> where it is wrong, with a reason of at least eight characters. Say what, and say what
          would fix it.
        </>,
      ],
      note: (
        <p>
          You cannot review your own listing. A listing that is a draft, already rejected, or back with the lister
          cannot be decided until it returns.
        </p>
      ),
    },
    {
      id: "mandate",
      title: "Check the evidence behind an agent or firm listing",
      steps: [
        <>Open the listing and find the owner&apos;s written mandate.</>,
        <>Read who gave it, to whom, for which property, and for how long. The names must match the account and the listing.</>,
        <>Where the mandate is missing, out of date, or for a different property, ask for more and say exactly what is needed.</>,
        <>Where you doubt the mandate itself, escalate as a listing or property matter. Do not tell the lister you doubt them.</>,
        <>Record what you looked at in the notes, so the next reviewer does not do it again.</>,
      ],
    },
    {
      id: "duplicate",
      title: "A copied or duplicate listing",
      steps: [
        <>Search the address and the price on{" "}
          <Link href="/admin/lookup" className={A}>
            Lookup
          </Link>{" "}
          to find the other listing.
        </>,
        <>Compare the photographs and the words. Note which came first.</>,
        <>Reject the copy with a reason that names the problem without accusing anybody of theft.</>,
        <>
          Report it to moderation from the listing, so there is a case, and tell your lead where the same lister has
          done it more than once.
        </>,
      ],
    },
    {
      id: "scam",
      title: "A listing you believe is a scam",
      steps: [
        <>Reject it. Do not leave it waiting while you investigate.</>,
        <>Write a reason that says what is wrong with the listing, never what you suspect about the person.</>,
        <>Report it to moderation from the listing, which opens a case.</>,
        <>
          Press <strong>Escalate</strong>, choose <strong>Identity or fraud</strong> or a listing and property matter,
          and attach the listing. Tell your lead the same day.
        </>,
        <>Never contact the lister yourself beyond the reason on the rejection.</>,
      ],
    },
  ],
  standards: [
    { what: "Speed", good: "Nothing in the Waiting tab past its promise. A listing reported as not as described is answered within a day." },
    { what: "Thoroughness", good: "Photographs, costs, description, address and mandate, every time. Nothing approved on a summary." },
    { what: "Reasons", good: "A send-back or rejection the lister can act on without writing back to ask what you meant." },
    { what: "Consistency", good: "Two reviewers reading the same listing would reach the same decision." },
    { what: "Fees", good: "No live listing you approved carries an undeclared fee, and none asks for an inspection fee." },
    { what: "Independence", good: "You reviewed no listing of your own and none from anybody you know." },
  ],
  wordsUsed: [
    "\"We cannot publish this yet because the photographs do not show the rooms the description names. Please add photographs of each bedroom.\"",
    "\"Every charge a renter pays has to be listed, with who it is paid to. Please add the service charge and the agency fee.\"",
    "\"Vallo asks for no inspection fee, and a listing cannot ask for one.\"",
    "\"We need the owner's written mandate for this property before an agent listing can go live.\"",
  ],
  wordsNever: [
    "Never say or hint that you think the lister is lying. Reject on the listing, not on the person.",
    "Never tell a lister their listing is safe, approved for ever, or guaranteed anything.",
    "Never give a date when a listing will go live.",
    "Never name the member who reported a listing.",
  ],
  privacy: [
    "A listing carries a real address and often a real person's phone number. Use them for the review and nothing else.",
    "Never contact a lister or an owner outside the console, on any number you found in a listing.",
    "Never share a listing's documents, including a mandate, outside the record.",
    "Where a listing shows a tenant's or a neighbour's face or name in a photograph, ask for it to be removed before publishing.",
  ],
  copilotCannot: [
    "It will not approve, send back or reject a listing.",
    "It summarises the queue and shows the review facts and quality checks for one listing. The reading is still yours.",
  ],
  copilotAsk: [
    "Summarise the oldest waiting listings",
    "Which listings have failed a quality check?",
    "What has to be true before a listing can publish?",
  ],
  contacts: [
    { what: "A decision you cannot make, or two rules that conflict", who: "Head of Trust and Safety" },
    { what: "A listing you believe is a scam", who: "Head of Trust and Safety, the same day, after rejecting and reporting it" },
    { what: "An owner's mandate you doubt", who: "Business Development Director, and your lead" },
    { what: "An identity or a document", who: "KYC Reviewer" },
    { what: "A fee, or what a renter pays", who: "Finance Officer" },
    { what: "Your access, or a desk that will not open", who: "The founder's super admin account, through your lead" },
  ],
};

export const AGREEMENTS_OFFICER: RoleWords = {
  who: "the Agreements Officer",
  keeps:
    "An agreement is the last gate before money moves. Nothing you approve should ever surprise either party, because they will both read what you approved.",
  purpose: (
    <p>
      When two parties on Vallo have agreed terms, somebody has to read the whole agreement before payment opens. That
      is this job. You read the amounts, the dates, the property and the parties, and you approve it or send it back
      with a reason both parties read. You also decide the claims left over from the Vallo Guarantee, which was retired
      on 9 November 2026. You read everything. Nothing is approved on a summary.
    </p>
  ),
  glance: [
    "Your access areas are Agreement approval and Guarantee claims. They open Agreements, its Risk settings, and the claims and caution rulings on the Money desk.",
    "Payment opens only after your approval. Until then, nothing moves.",
    "Sending an agreement back needs a reason of at least ten characters, which both parties read.",
    "You cannot decide an agreement or a claim you are a party to. The database refuses it.",
    "The Vallo Guarantee was retired on 9 November 2026. Do not describe it to anybody as something they can claim.",
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
      <Link href="/admin/manual/queues" className={A}>
        chapter 3
      </Link>
      , the agreements and claims parts, and{" "}
      <Link href="/admin/manual/decisions" className={A}>
        chapter 4
      </Link>
      .
    </>,
    <>
      Open{" "}
      <Link href="/admin/agreements" className={A}>
        Agreements
      </Link>{" "}
      and read five approved agreements and two sent back, with the reasons.
    </>,
    <>
      Read{" "}
      <Link href="/admin/agreements/settings" className={A}>
        Risk settings
      </Link>
      , so you know why an agreement arrived in review rather than passing through.
    </>,
    <>Learn the money wording by heart. Vallo never holds customer money, and nothing you write may suggest it does.</>,
    <>Approve one agreement with the COO reading it first.</>,
  ],
  firstWeek: [
    <>Clear the review queue daily. An agreement waiting is two people waiting.</>,
    <>Read every field of ten agreements until the shape is familiar: the parties, the property, the amounts, the dates, the signatures.</>,
    <>
      Decide one old Guarantee claim on the evidence filed, and record the payout reference once it is paid. Ask the
      CFO where it is near your limit.
    </>,
    <>Learn what the risk signals mean, and which ones send an agreement to review.</>,
    <>Ask the COO to read your first week of decisions and say where your standard differs from theirs.</>,
  ],
  alone: [
    "Approve an agreement both parties have confirmed, which opens payment.",
    "Send an agreement back with a reason of at least ten characters, which both parties read.",
    "Decide a claim made before the Guarantee was retired, on the evidence filed and within the published scope.",
    "Record the payout reference once a claim is paid.",
    "Read the risk settings and the signals behind a review.",
  ],
  withSomebody: [
    "A claim above your comfort, or one that looks coordinated with others: the CFO, before deciding.",
    "A change to the review threshold, a risk signal or the incident switch: the COO.",
    "A refund or a cancellation arising from an agreement: an admin, on the booking's own page.",
    "An agreement where you suspect fraud: the Compliance Officer, through the Escalate button, and never a word to either party.",
  ],
  never: [
    "An agreement or a claim you are a party to. The database refuses it.",
    "A payout, a refund or a cancellation. Those are decided elsewhere.",
    "Approving on a summary, a verbal assurance, or because a party is waiting.",
    "Describing the Guarantee to anybody as something they can claim today.",
  ],
  tasks: [
    {
      id: "agreement",
      title: "Review an agreement",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/agreements" className={A}>
            Agreements
          </Link>{" "}
          and open the oldest waiting.
        </>,
        <>Read the parties. Confirm each is who the account says, and that you are not one of them and know neither.</>,
        <>Read the property: the address, the unit, the description. It must be the property the agreement is about.</>,
        <>Read the amounts, every one, and what each is for. Add them up yourself.</>,
        <>Read the dates: the start, the end, and anything that must happen before payment.</>,
        <>Read the risk signals the desk shows, and why this agreement came to review.</>,
        <>
          <strong>Approve</strong> where the whole agreement is right. Payment opens.
        </>,
        <>
          <strong>Send it back</strong> where it is not, with a reason of at least ten characters. Both parties read it,
          so name the field and what it should say.
        </>,
      ],
      note: (
        <p>
          Never approve to unblock somebody. An agreement approved on a summary is read back to you when it goes wrong,
          and both parties will have your reason in writing.
        </p>
      ),
    },
    {
      id: "claim",
      title: "Decide a claim left from the retired Guarantee",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/money" className={A}>
            Money
          </Link>{" "}
          and find the claim.
        </>,
        <>Read the inspection report and its photographs, and the agreement behind it.</>,
        <>Decide against the published scope of the Guarantee as it stood when the claim was made. Nothing outside that scope is payable.</>,
        <>Where the amount is near your limit, or the claim looks coordinated with others, ask the CFO before deciding.</>,
        <>Decide, with a reason the claimant reads word for word.</>,
        <>Record the payout reference once finance has paid it.</>,
      ],
      note: (
        <TodayNote>
          The Vallo Guarantee was retired on 9 November 2026. Claims made before that date are still decided here;
          nothing new can be claimed, and nobody should be told that it can.
        </TodayNote>
      ),
    },
    {
      id: "risk",
      title: "Read the risk settings",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/agreements/settings" className={A}>
            Risk settings
          </Link>
          .
        </>,
        <>Read the review threshold: the amount above which every agreement comes to you.</>,
        <>Read the risk signals and what each one looks at.</>,
        <>Read the incident switch, which sends everything to review at once.</>,
        <>Change nothing without the COO. A threshold moved by one person changes what every member experiences.</>,
      ],
    },
  ],
  standards: [
    { what: "Speed", good: "No agreement waiting more than a day. Two people are waiting on each one." },
    { what: "Completeness", good: "Every field of every agreement read, every time. The amounts added up by hand." },
    { what: "Reasons", good: "A send-back names the field and what it should say, in words both parties act on." },
    { what: "Claims", good: "Each old claim decided on the evidence filed and inside the published scope, with the payout reference recorded." },
    { what: "Independence", good: "No agreement or claim decided where you are a party or know one." },
    { what: "Money wording", good: "Nothing you wrote suggests Vallo holds anybody's money." },
  ],
  wordsUsed: [
    "\"We cannot approve this yet because the rent in the agreement does not match the rent on the listing. Please confirm which is right.\"",
    "\"Payment opens once the agreement is approved.\" True, and the whole point of this desk.",
    "\"Vallo uses regulated payment partners to process eligible payments. Vallo does not hold customer money.\"",
    "\"The Vallo Guarantee was retired on 9 November 2026. This claim is being decided under the scope that applied when it was made.\"",
  ],
  wordsNever: [
    "Never that Vallo holds, keeps or looks after the money in an agreement.",
    "Never that a claim will be paid, before it is decided.",
    "Never offer the Guarantee to anybody as something available now.",
    "Never a date by which payment will arrive.",
  ],
  privacy: [
    "An agreement holds two people's full names, a property address and their money. Read it for the decision and nothing else.",
    "Never copy an amount, an address or a name out of an agreement into a note, a message or an escalation.",
    "Never discuss an agreement with one party about the other.",
    "A claim file carries an inspection report with photographs of somebody's home. It stays in the record.",
  ],
  copilotCannot: [
    "It will not approve an agreement, send one back, or decide a claim.",
    "It counts agreements waiting for review and shows the oldest. The reading is yours.",
  ],
  copilotAsk: [
    "What is the oldest agreement waiting?",
    "How many agreements have a mandate attached?",
    "What does the risk threshold do, and who changes it?",
  ],
  contacts: [
    { what: "A claim above your comfort, or one that looks coordinated", who: "Chief Financial Officer" },
    { what: "A change to the review threshold or a risk signal", who: "Chief Operating Officer" },
    { what: "A refund or a cancellation", who: "An admin, on the booking's own page" },
    { what: "Suspected fraud in an agreement", who: "Compliance Officer, through the Escalate button" },
    { what: "A reconciliation difference you noticed", who: "Finance Officer" },
    { what: "Your access, or a desk that will not open", who: "The founder's super admin account, through the COO" },
  ],
};
