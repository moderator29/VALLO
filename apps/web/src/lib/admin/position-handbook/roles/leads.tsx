import Link from "next/link";
import { A, TodayNote } from "../parts";
import type { RoleWords } from "../types";

/**
 * THE FIVE ROLES THAT RUN A FUNCTION: Head of Trust and Safety, Compliance
 * Officer, Finance Officer, Operations Manager and Customer Support Lead.
 *
 * Read from the console's own code and the staff manual chapters read from it
 * on 15 November 2026: chapter 2 for the desks each area opens, chapter 3 for
 * the queues, chapter 4 for the two-person rules in the compliance lanes,
 * chapter 5 for the audit log and Team oversight, chapter 6 for escalation and
 * chapter 12 for the support lead's desk. Where the code names no rota and no
 * person, the handbook says so rather than guessing.
 */

export const TRUST_SAFETY_LEAD: RoleWords = {
  who: "the Head of Trust and Safety",
  keeps:
    "Members feel how Vallo is run through your team. Your own decisions are the standard every reviewer copies, so write them as though they will be.",
  purpose: (
    <p>
      Four queues decide whether Vallo is a place people warn each other about: moderation, listings, verification and
      support. This job runs all four day to day. You make sure nothing sits past its time, you decide what your
      reviewers cannot, you keep decisions the same across people, and you write down the rules you apply so the next
      reviewer applies them too. You also look after the people who read distressing material, and you report fraud
      patterns and safety incidents up.
    </p>
  ),
  glance: [
    "Your access areas are Listing approval, KYC review, Reports and moderation and Support. They open the review queues, Cases in your modules, Appeals, the Trust overview, Verification, Listings and the Support desk.",
    "Your job is consistency as much as speed. Two reviewers reading the same item should reach the same decision.",
    "An appeal is decided by somebody other than whoever made the decision, so you cannot decide an appeal against your own.",
    "Look after reviewers who handle distressing material, and rotate them off it when they need a break.",
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
      . You are the person your team asks, so you read all of it, not only your chapters.
    </>,
    <>
      Open{" "}
      <Link href="/admin/oversight" className={A}>
        Team oversight
      </Link>{" "}
      and read each queue&apos;s backlog and its oldest item. That is the state you have inherited.
    </>,
    <>
      Open{" "}
      <Link href="/admin/trust" className={A}>
        Trust overview
      </Link>{" "}
      and read the numbers across cases and restrictions.
    </>,
    <>
      Read twenty decisions across moderation, listings and verification, and write down where two reviewers decided
      the same thing differently. That list is your first piece of work.
    </>,
    <>Meet each reviewer, and ask each one what they are unsure about. Write the answers down.</>,
  ],
  firstWeek: [
    <>Clear anything past its time, yourself, before you ask anybody else to.</>,
    <>
      Work the{" "}
      <Link href="/admin/appeals" className={A}>
        Appeals
      </Link>{" "}
      list. Each one is a decision of ours a member thinks is wrong, and some of them are.
    </>,
    <>Write the first two rules your team was applying differently, in plain words, and send them to the COO for approval.</>,
    <>Set the rota for who works which queue, and who is on the Held lane, which is the hardest to sit in.</>,
    <>Read five decisions from each reviewer and give each of them the notes, against tone, accuracy, speed and the rule.</>,
    <>Give the COO your first weekly report: the backlogs, the patterns, the people, and what you need.</>,
  ],
  alone: [
    "Everything a Moderator, a Listings Reviewer, a KYC Reviewer or a Support Agent may decide alone, on any item that is not yours.",
    "Decide an appeal, where you did not make the decision being appealed.",
    "Restrict a member for up to thirty days on a case in your modules, with a reason of at least ten characters.",
    "Assign work, take an item back from a reviewer, and set who works which queue.",
    "Write the internal rules your team applies, and send each for approval.",
  ],
  withSomebody: [
    "A restriction longer than thirty days, or with no end, and suspending a member: an admin.",
    "An appeal against your own decision: another reviewer, never you.",
    "A document you believe is forged, or a sanctions match: the Compliance Officer.",
    "A rule that changes what members experience: the COO approves it before your team works to it.",
    "Anything that may be a crime, or that could harm a member if it waited: the COO and the CEO, the same hour.",
  ],
  never: [
    "A case, report, listing, document or appeal where you are a party or know one.",
    "A refund, a cancellation or anything about money.",
    "Granting or ending anybody's access. You recommend; the founder's super admin account decides.",
    "A fee rate or a switch.",
  ],
  tasks: [
    {
      id: "morning",
      title: "The morning round",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/oversight" className={A}>
            Team oversight
          </Link>
          . Read each queue&apos;s backlog and its oldest item.
        </>,
        <>
          Open the{" "}
          <Link href="/admin/queue" className={A}>
            Unified queue
          </Link>{" "}
          and filter to items that are late and items nobody holds.
        </>,
        <>Move people to where the queue is. Say it in the team announcement so nobody is guessing.</>,
        <>Clear anything urgent yourself rather than waiting for somebody to pick it up.</>,
        <>
          Open{" "}
          <Link href="/admin/escalations" className={A}>
            Escalations
          </Link>{" "}
          and press <strong>I have seen this</strong> on everything waiting on you, then take what is yours.
        </>,
      ],
    },
    {
      id: "appeal",
      title: "Decide an appeal",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/appeals" className={A}>
            Appeals
          </Link>
          .
        </>,
        <>Check who made the decision being appealed. If it was you, hand the appeal to another reviewer.</>,
        <>Read the original decision, its reason, and the evidence it was made on.</>,
        <>Read what the member says is wrong. Decide on the evidence, not on how the appeal is written.</>,
        <>
          Where you overturn it, the restriction is lifted and the member is told. Where you uphold it, say why in words
          the member can read without feeling accused twice.
        </>,
        <>Where the original decision was wrong because the rule was unclear, write the rule down and fix it for everybody.</>,
      ],
    },
    {
      id: "consistency",
      title: "Keep decisions consistent",
      steps: [
        <>Each week, read five decisions from each reviewer across the queues they work.</>,
        <>Score each against four things: the rule applied, the evidence read, the reason written, and the time taken.</>,
        <>Give the reviewer the notes, privately, naming what would have been better rather than what was wrong with them.</>,
        <>Where two reviewers decided the same shape of item differently, write the rule down and send it to the COO.</>,
        <>
          Put the approved rule where the team reads it, and tell them it is in force from a named day. A rule nobody
          was told about is not a rule.
        </>,
      ],
    },
    {
      id: "wellbeing",
      title: "Look after the people reading the worst of it",
      steps: [
        <>Know who is on the Held lane and the safety cases this week. Keep the list in front of you.</>,
        <>Ask each of them, by name, how it is going. Not in a group.</>,
        <>Rotate anybody off that work when they ask, and before they ask where you can see it.</>,
        <>Never leave one person on child safety or violent content for a whole week.</>,
        <>
          Where somebody needs more than a rotation, tell the COO. What support Vallo offers beyond that is not written
          down.
        </>,
      ],
      note: (
        <TodayNote>
          There is no written welfare programme for reviewers in the console or the documents. What exists is the
          rotation you set and the conversation you have.
        </TodayNote>
      ),
    },
    {
      id: "report",
      title: "Report up",
      steps: [
        <>
          Each week, read{" "}
          <Link href="/admin/trust" className={A}>
            Trust overview
          </Link>{" "}
          and the backlogs.
        </>,
        <>Write the COO a short report: what is growing, what is late, which fraud patterns you saw, and what you need.</>,
        <>File it as your weekly report as well, so it is on the record.</>,
        <>
          Anything serious does not wait for the week: press <strong>Escalate</strong>, choose <strong>Safety</strong>{" "}
          and <strong>Urgent</strong>, which tells the super admin at once.
        </>,
      ],
    },
  ],
  standards: [
    { what: "Backlog", good: "Nothing in any of your four queues past the time Vallo publishes for it." },
    { what: "Consistency", good: "The same shape of item gets the same decision across reviewers, and where it did not, a written rule followed within the week." },
    { what: "Appeals", good: "Each appeal decided by somebody who did not make the decision, inside three days." },
    { what: "Coaching", good: "Every reviewer has had five decisions read and the notes given, every week." },
    { what: "People", good: "Nobody has been on distressing material for a whole week without a break." },
    { what: "Reporting", good: "The COO hears a pattern from you before they hear it from a member." },
  ],
  wordsUsed: [
    "\"We have looked at this again and we are lifting the restriction. Thank you for appealing.\" Say it plainly when we were wrong.",
    "\"We have looked at this again and the decision stands, because X.\" Name the evidence, once.",
    "\"The rule is X, from today. Here is why.\" To your team, in writing, every time.",
    "\"Thank you for telling us. We take this seriously.\" To anybody who reports harm.",
  ],
  wordsNever: [
    "Never name the reviewer who made a decision to the member, and never name the reporter to anybody.",
    "Never tell a member they are suspected of anything.",
    "Never blame your team to a member, or a member to your team.",
    "Never promise a member an outcome another desk decides.",
  ],
  privacy: [
    "You can open more than anybody on your team. Open it for the item in front of you and nothing else: every opening is recorded with your name.",
    "Reading a reviewer's decisions is about the decision, not the person. Keep the notes about the work.",
    "Never discuss one reviewer's quality with another.",
    "Never repeat what one member said about another, including to the other party in a case.",
    "A pattern report names counts and shapes, never members.",
  ],
  copilotCannot: [
    "It will not decide a case, an appeal, a restriction or any queue item.",
    "It will not score your reviewers for you, and it does not see their quality notes.",
  ],
  copilotAsk: [
    "Which cases are overdue?",
    "What is the biggest backlog across my queues?",
    "Summarise open appeals",
  ],
  contacts: [
    { what: "Anything that may be a crime, or that could harm a member if it waited", who: "Chief Operating Officer and the Chief Executive Officer, the same hour" },
    { what: "A forged document, a sanctions match, or a compliance worry", who: "Compliance Officer" },
    { what: "A rule that changes what members experience", who: "Chief Operating Officer, for approval" },
    { what: "A restriction longer than thirty days, or a suspension", who: "An admin" },
    { what: "Money, a refund or a payment", who: "Finance Officer" },
    { what: "Staff access for your team", who: "The founder's super admin account, recommended through the COO" },
  ],
};

export const COMPLIANCE_OFFICER: RoleWords = {
  who: "the Compliance Officer",
  keeps:
    "Vallo can only operate while it keeps its duties to the regulators. You are the person who keeps them, and the only one whose decisions no commercial target may outrank.",
  purpose: (
    <p>
      Vallo has duties under Nigerian law: to know who is trading on it, to screen against sanctions lists, to notice
      transactions that do not make sense, and to report what must be reported to the NFIU. This job owns all of it.
      You work the compliance desk, you decide what is reported and file it on time, you set the standard the KYC
      reviewers apply, and you keep the registers a regulator may ask for. You are independent on purpose: nothing
      commercial outranks a compliance decision, and you have a direct line to the board.
    </p>
  ),
  glance: [
    "Your access areas are KYC review and Compliance. They open the Compliance desk, Verification, Applications and the audit log export.",
    "Every decision on the Compliance desk needs a second member of staff. Nobody approves their own proposal.",
    "Never tell a person, or anybody who might tell them, that they are the subject of a report. Tipping off is an offence, not a policy.",
    "Nothing on this desk reaches the member. A hold shows only a neutral line that names no check, list or report.",
    "Independence: no commercial target and no colleague's deadline outranks a compliance decision.",
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
      <Link href="/admin/manual/decisions" className={A}>
        chapter 4
      </Link>{" "}
      in full, and the compliance rows twice. Every lane here needs two people.
    </>,
    <>
      Open{" "}
      <Link href="/admin/compliance" className={A}>
        Compliance
      </Link>{" "}
      and read each lane: suspicious transaction reports, threshold reports, politically exposed persons, sanctions
      screening and beneficial ownership.
    </>,
    <>
      Read the{" "}
      <Link href="/admin/kyc/guide" className={A}>
        reviewer guide
      </Link>
      . You set the standard the reviewers apply, so you have to know what it says.
    </>,
    <>Read the sanctions lists in force and the date each was put in force.</>,
    <>Confirm with the CEO who the second approver is for each lane, and write it down.</>,
  ],
  firstWeek: [
    <>Work every lane, oldest first. A filing deadline is not a queue position.</>,
    <>
      Read five KYC decisions from each reviewer and tell them where their standard differs from the one you are
      setting.
    </>,
    <>Check that every sanctions list is current, and review every match waiting.</>,
    <>
      Export the registers you would hand a regulator today from{" "}
      <Link href="/admin/audit" className={A}>
        the audit log
      </Link>
      , and record what was sent and when, so you know the export works before you need it.
    </>,
    <>Write down, for yourself, the decision trail you would want if a regulator asked about any case open today.</>,
    <>Agree with the CEO, in writing, how a case involving a member of staff reaches them.</>,
  ],
  alone: [
    "Propose a decision in any lane: a report to the NFIU, a threshold filing, a politically exposed person's clearance, a sanctions match, a release of a hold.",
    "Everything a KYC Reviewer may decide: documents, identity checks and applications, on a person you have no interest in.",
    "Set the verification standard the KYC reviewers apply, and write it down.",
    "Export the audit log and the registers a regulator asks for, and record what was sent.",
    "Decide that a case is not reportable, with your reasons written down.",
  ],
  withSomebody: [
    "Every decision on the Compliance desk: one member of staff decides with written reasons and a second approves. Nobody approves their own proposal.",
    "Ending a compliance hold on an account: one proposes the release, a second approves.",
    "A sanctions match, or putting a new list in force: one proposes, a second approves.",
    "A case involving a member of staff, or one that may need the authorities: the CEO directly, in writing.",
  ],
  never: [
    "A match, a report or a check about yourself, or about anybody you know. The database refuses it.",
    "Approving your own proposal in any lane.",
    "Telling the subject of a report, or anybody who might tell them, that a report exists.",
    "Letting a commercial deadline change a compliance decision, whoever asks.",
  ],
  tasks: [
    {
      id: "str",
      title: "Decide whether a transaction is reported",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/compliance" className={A}>
            Compliance
          </Link>{" "}
          and the suspicious transaction lane.
        </>,
        <>Read the transaction, the account behind it, and the pattern around it. Open what the case needs and nothing else.</>,
        <>Write your reasons in full, in the record. They are the decision, not a note about it.</>,
        <>Propose the outcome: reportable, or not reportable.</>,
        <>Ask the second approver to read it and approve or reject. They cannot be you.</>,
        <>Where it is reportable, file it to the NFIU inside the deadline, and record what was sent and when.</>,
        <>Tell nobody outside the two of you. Not the subject, not their agent, not support.</>,
      ],
      note: (
        <p>
          A filing deadline does not move because a queue is busy. Where you cannot meet one, escalate to the CEO
          before it passes, not after.
        </p>
      ),
    },
    {
      id: "sanctions",
      title: "Review a sanctions match",
      steps: [
        <>Open the sanctions lane and the match waiting.</>,
        <>Compare the name, the date of birth and any other identifier against the list entry. A name alone is rarely a match.</>,
        <>Record what you compared and what it showed.</>,
        <>Propose the outcome. A second approver approves or rejects it.</>,
        <>Where it is a match, follow what the law requires and tell the CEO. The member is told nothing.</>,
        <>Where a new list has to be put in force, propose it; a second approves before it is live.</>,
      ],
    },
    {
      id: "pep",
      title: "Clear a politically exposed person",
      steps: [
        <>Open the lane and the person waiting.</>,
        <>Record the source of funds, in the person&apos;s own evidence, not in your summary of it.</>,
        <>Write what makes them exposed and what the risk is.</>,
        <>Propose the clearance. A second approves it.</>,
        <>Where you cannot clear them, record why, and the hold stays. The member sees only a neutral line.</>,
      ],
    },
    {
      id: "standard",
      title: "Set the verification standard",
      steps: [
        <>
          Read five recent decisions from each KYC reviewer on{" "}
          <Link href="/admin/kyc" className={A}>
            Verification
          </Link>
          .
        </>,
        <>Write down where two reviewers would have decided the same document differently.</>,
        <>Write the standard in plain words, with examples, and have it approved as a policy note.</>,
        <>Tell the reviewers it is in force from a named day, and read five more decisions a week later.</>,
        <>
          Where the{" "}
          <Link href="/admin/kyc/guide" className={A}>
            reviewer guide
          </Link>{" "}
          is now wrong, say so to the COO so it is corrected.
        </>,
      ],
    },
    {
      id: "regulator",
      title: "Answer a regulator",
      steps: [
        <>Write down what was asked, by whom, and the date, before you touch a record.</>,
        <>Tell the CEO the same day. A regulator&apos;s enquiry is not a desk matter.</>,
        <>
          Export only what was asked for, from{" "}
          <Link href="/admin/audit" className={A}>
            the audit log
          </Link>{" "}
          and the registers. Every export is recorded.
        </>,
        <>Record what was sent, when, and to whom.</>,
        <>Keep your own file of the exchange. It is evidence that Vallo answered.</>,
      ],
    },
  ],
  standards: [
    { what: "Deadlines", good: "Every filing inside its deadline, with the date it was sent recorded. None missed, ever." },
    { what: "Two people", good: "No decision in any lane without a second approver who is not you." },
    { what: "Reasons", good: "Written reasons a regulator could read cold and follow." },
    { what: "Lists", good: "Every sanctions list current, and every match reviewed, not left waiting." },
    { what: "Tipping off", good: "Nobody outside the decision knows a report exists. Not once." },
    { what: "Independence", good: "No decision changed because somebody commercial asked." },
  ],
  wordsUsed: [
    "\"It is being reviewed.\" The whole of what anybody outside the decision is told.",
    "\"I need a second approver on this before it can go further.\" Say it early, every time.",
    "\"That decision is mine and it does not change because of a deadline.\" To anybody who pushes.",
    "\"I am telling the CEO today.\" For a staff case or a regulator's enquiry.",
  ],
  wordsNever: [
    "Never that a person is the subject of a report, a check or a list, to them or to anybody near them.",
    "Never the name of a list, a provider or a register, in anything a member can read.",
    "Never a reason on a hold beyond the neutral line the console shows.",
    "Never a promise about when a hold will lift.",
  ],
  privacy: [
    "This desk holds the most sensitive records on the platform. Open a record for one decision, write what you compared, and close it.",
    "Never copy an identity number, a BVN, a NIN or an account number into a note, an escalation or an email.",
    "Never discuss a case with a colleague who is not the second approver, including your own team.",
    "Never decide a match, a report or a check about yourself or anybody you know.",
    "An export is recorded. Export what was asked for, not a copy for yourself.",
  ],
  copilotCannot: [
    "It will not propose, approve or file anything in any lane.",
    "It counts what is waiting. It does not read the content of a compliance case out to you or to anybody.",
  ],
  copilotAsk: [
    "What is overdue in compliance?",
    "How many sanctions hits are waiting?",
    "What does a threshold report need before it can be filed?",
  ],
  contacts: [
    { what: "A case involving a member of staff, or one that may need the authorities", who: "Chief Executive Officer, directly and in writing" },
    { what: "A regulator's enquiry", who: "Chief Executive Officer, the same day" },
    { what: "A second approver for a lane", who: "The second approver agreed with the CEO for that lane" },
    { what: "Where money and compliance meet", who: "Chief Financial Officer" },
    { what: "A forged document found by a reviewer", who: "You are the destination. Decide it." },
    { what: "Your access, or a desk that will not open", who: "The founder's super admin account" },
  ],
};

export const FINANCE_OFFICER: RoleWords = {
  who: "the Finance Officer",
  keeps:
    "Every number Vallo says about itself has to be traceable to a record. You are the person who can trace it, and the person who says so when it does not add up.",
  purpose: (
    <p>
      Money moves through Vallo every day, and Vallo never holds any of it. This job watches that money: the
      settlements, the refunds, the disputes and the reconciliation against the payment processor. You read the Money
      and Payments desks daily, you chase every difference until it is explained, you decide the claims left from the
      retired Guarantee within your limits, and you produce the exports month-end and the accountants need. Every
      figure you report can be traced to a record in the console.
    </p>
  ),
  glance: [
    "Your access areas are Guarantee claims and Finance. They open Money, Payments, Chargebacks, Fees to read, and Record retention to read.",
    "Vallo never holds customer money. Never describe a balance, a wallet or a store of value, and never arrange a payment outside the payment processor.",
    "Making a refund and cancelling a stay are admin decisions, not yours. You read the record and chase the difference.",
    "A reconciliation difference you cannot explain within a day goes to the CFO.",
    "Every figure you report can be traced to a record. A figure you cannot read is reported as not available, never as zero.",
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
      , the Money section, and{" "}
      <Link href="/admin/manual/queues" className={A}>
        chapter 3
      </Link>
      , the refunds section.
    </>,
    <>
      Open{" "}
      <Link href="/admin/money" className={A}>
        Money
      </Link>{" "}
      and read every panel: cautions, refunds, the refund clock, the reconciliation job and the record of the retired
      Guarantee.
    </>,
    <>
      Open{" "}
      <Link href="/admin/payments" className={A}>
        Payments
      </Link>{" "}
      and read a week of payment attempts and how each ended.
    </>,
    <>Learn the money wording exactly. Vallo uses regulated payment partners to process eligible payments, and Vallo does not hold customer funds.</>,
    <>Run one reconciliation read with the CFO beside you, and find out what a normal difference looks like.</>,
  ],
  firstWeek: [
    <>Read Money and Payments every morning. This desk is a daily habit, not a weekly task.</>,
    <>
      Work{" "}
      <Link href="/admin/chargebacks" className={A}>
        Chargebacks
      </Link>
      : open one, move it through its states, and add the notes. The lister is told at each move.
    </>,
    <>Reconcile a full day against the processor, line by line, and explain every difference or escalate it.</>,
    <>
      Read{" "}
      <Link href="/admin/fees" className={A}>
        Fees
      </Link>{" "}
      so you know every rate in force, and remember that changing one is an admin decision.
    </>,
    <>Produce a month-end export as practice, and check every figure against a record.</>,
    <>Agree with the CFO what counts as a difference you escalate, and by when.</>,
  ],
  alone: [
    "Read every money desk: settlements, refunds, the refund clock, reconciliation and the Guarantee record.",
    "Open a chargeback, move it through its states and add notes. Each move is recorded and the lister is told.",
    "Decide a claim made before the Guarantee was retired, within the limits the CFO set, and record the payout reference.",
    "Export the payments history for month-end and for the accountants. Every export is recorded.",
    "Decline a guest's refund request where the money policy says so, with a reason the guest reads.",
  ],
  withSomebody: [
    "A reconciliation difference you cannot explain within a day: the CFO.",
    "A claim above the limit the CFO set: the CFO decides it.",
    "A refund, a cancellation, or a part refund: an admin, on the booking's own page.",
    "A fee rate change: an admin lowers one, a super admin raises one.",
    "Destroying money records past retention: a super admin, after typing the confirmation phrase.",
  ],
  never: [
    "Holding, moving or arranging money outside the payment processor. There is no account you may pay from.",
    "Asking for, accepting or passing on money from a member, a lister or anybody else, for any reason.",
    "Describing a balance, a wallet, a store of value or escrow to anybody.",
    "Reporting a number you cannot trace to a record, or filling a gap with a guess.",
  ],
  tasks: [
    {
      id: "daily",
      title: "The daily money round",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/money" className={A}>
            Money
          </Link>
          . Read the reconciliation job first: whether it ran, when, and what it found.
        </>,
        <>Read the refund clock: refunds past their due date, and refunds due within twenty four hours. Each links to its stay.</>,
        <>
          Open{" "}
          <Link href="/admin/payments" className={A}>
            Payments
          </Link>{" "}
          and read yesterday&apos;s outcomes. A rise in failures is a platform question, not a money one: tell
          Operations.
        </>,
        <>
          Open{" "}
          <Link href="/admin/chargebacks" className={A}>
            Chargebacks
          </Link>{" "}
          and check which have evidence due soonest.
        </>,
        <>Write down anything you could not explain, and escalate it the same day if it is still unexplained.</>,
      ],
    },
    {
      id: "reconcile",
      title: "Reconcile against the processor",
      steps: [
        <>Open the reconciliation panel on Money and read what the job found.</>,
        <>Take each difference one at a time. Find the payment in Payments, and the booking behind it.</>,
        <>Write what the difference is, in naira, and what you think caused it.</>,
        <>Where you can explain it, record the explanation on the record so nobody asks twice.</>,
        <>
          Where you cannot, press <strong>Escalate</strong>, choose <strong>Money</strong>, attach the payment&apos;s own
          page, and send it to the CFO the same day.
        </>,
        <>Never close a difference by adjusting a number. The record is the record.</>,
      ],
    },
    {
      id: "chargeback",
      title: "Work a chargeback",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/chargebacks" className={A}>
            Chargebacks
          </Link>{" "}
          and the dispute with the nearest evidence deadline.
        </>,
        <>Read the payment, the booking and the thread behind it.</>,
        <>Gather what the record already holds. Never ask a member for a card number or a bank log-in.</>,
        <>Move the dispute to its next state and add a note saying what you sent and when.</>,
        <>Watch the deadline. A dispute lost on a deadline is money gone that the record could have kept.</>,
        <>Tell the CFO where a pattern of disputes points at one lister or one kind of booking.</>,
      ],
    },
    {
      id: "monthend",
      title: "Month-end and the accountants",
      steps: [
        <>Export the payments history for the period from the Money desk. The export is recorded with your name.</>,
        <>Check the totals against the desk&apos;s own figures before you send anything.</>,
        <>Where a figure cannot be read, write &quot;not available&quot; and say why. Never write zero.</>,
        <>Send what was asked for, and nothing more. An export holds real people&apos;s payments.</>,
        <>Record what was sent, to whom, and when.</>,
      ],
      note: (
        <TodayNote>
          Payment for rentals is not open on Vallo, and sales are never paid on Vallo. What settles through the desk
          today is stays, hotel rooms and restaurant fees.
        </TodayNote>
      ),
    },
  ],
  standards: [
    { what: "Daily read", good: "Money and Payments read every working morning, with anything unexplained written down." },
    { what: "Reconciliation", good: "Every difference explained or escalated within one day. None carried over a week." },
    { what: "Traceability", good: "Every figure you reported can be opened in the console by somebody else." },
    { what: "Chargebacks", good: "No dispute lost on a deadline. Evidence sent and noted before the date." },
    { what: "Claims", good: "Each old claim decided inside your limit, with the payout reference recorded." },
    { what: "Wording", good: "Nothing you wrote suggests Vallo holds, keeps or looks after anybody's money." },
  ],
  wordsUsed: [
    "\"Vallo uses regulated payment partners to process eligible payments. Vallo does not hold customer funds.\"",
    "\"A refund goes back to the card or account that paid it.\"",
    "\"That figure is not available just now.\" Where it cannot be read, say so.",
    "\"I cannot explain this difference, so I am escalating it today.\"",
  ],
  wordsNever: [
    "Never a balance, a wallet, a float, a store of value or escrow.",
    "Never \"we are holding your money\" or \"your money is with us\".",
    "Never a date a refund will arrive, and never a promise that one will.",
    "Never a number you have not traced to a record.",
  ],
  privacy: [
    "The money desks hold real payments by real people. Open a payment for a question in front of you and nothing else.",
    "Never export more than was asked for, and never keep a copy of an export.",
    "Never put a card number, an account number or a bank detail in a note, an escalation or an email. Reference the payment.",
    "Never ask a member for a card number, a bank log-in or a one-time code, for any reason.",
    "A figure in a report is a count, not a person. Where a count is so small that a reader could name the member, say \"a few\".",
  ],
  copilotCannot: [
    "It will not move money: no refund, no payout, no transfer. It has no tool that does.",
    "It reads counts and amounts. It never shows a card number or a saved payment method.",
  ],
  copilotAsk: [
    "Is reconciliation clean?",
    "Which chargebacks have evidence due soonest?",
    "How did payments do this week?",
  ],
  contacts: [
    { what: "A reconciliation difference you cannot explain within a day", who: "Chief Financial Officer" },
    { what: "A claim above your limit", who: "Chief Financial Officer" },
    { what: "A refund, a cancellation or a part refund", who: "An admin, on the booking's own page" },
    { what: "A rise in failed payments", who: "Operations Manager, and the Technical Administrator" },
    { what: "Where money and compliance meet", who: "Compliance Officer" },
    { what: "A fee rate", who: "An admin to lower one, a super admin to raise one" },
  ],
};

export const OPERATIONS_MANAGER: RoleWords = {
  who: "the Operations Manager",
  keeps:
    "When the platform works, nobody notices you. When it does not, you are the person who notices first and says what we are doing about it.",
  purpose: (
    <p>
      Vallo runs on scheduled jobs, notifications, bookings and a support team, and any of them can quietly stop
      working. This job keeps the whole thing running day to day. You watch the operations and alerts desks and act on
      anything red, you unstick bookings and reservations, you lead the support team and approve agreements when that
      desk is busy, and you keep the runbooks current so the next person does not start cold.
    </p>
  ),
  glance: [
    "Your access areas are Support, Agreement approval and Operations. They open a wide set: Operations, Alerts, Bookings, Visits, Reservations, Restaurant fees, the Crash log, Call usage, Provider checks, Team oversight, Support and Agreements.",
    "Read Operations and Alerts every morning and act on anything red.",
    "You can read alerts. Closing one is an admin decision.",
    "A written note after every incident: what happened, what we did, what changes.",
    "Cancelling and refunding a booking is an admin decision on the booking's own page, not yours.",
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
      </Link>{" "}
      and{" "}
      <Link href="/admin/manual/escalation" className={A}>
        chapter 6
      </Link>
      . You are on the receiving end of a lot of escalations.
    </>,
    <>
      Open{" "}
      <Link href="/admin/operations" className={A}>
        Operations
      </Link>{" "}
      and read every scheduled job, when it last ran, and what it did.
    </>,
    <>
      Open{" "}
      <Link href="/admin/alerts" className={A}>
        Alerts
      </Link>{" "}
      and read everything open. Ask an admin to close what is already dealt with.
    </>,
    <>
      Open{" "}
      <Link href="/admin/oversight" className={A}>
        Team oversight
      </Link>{" "}
      and read each queue&apos;s backlog.
    </>,
    <>Read the runbooks that exist, and write down which incidents have none.</>,
  ],
  firstWeek: [
    <>Make the morning round a habit: Operations, Alerts, the Crash log, then the backlogs.</>,
    <>
      Work{" "}
      <Link href="/admin/bookings" className={A}>
        Bookings
      </Link>
      ,{" "}
      <Link href="/admin/bookings/visits" className={A}>
        Visits
      </Link>{" "}
      and{" "}
      <Link href="/admin/bookings/reservations" className={A}>
        Reservations
      </Link>
      . Find what is stuck, late or disputed, and unstick it.
    </>,
    <>Approve two agreements, so you can cover that desk when it is busy.</>,
    <>Write one runbook for an incident that had none. Short steps, real button names.</>,
    <>
      Read{" "}
      <Link href="/admin/operations/providers" className={A}>
        Provider checks
      </Link>{" "}
      and run one, so you know how to tell a provider&apos;s fault from ours.
    </>,
    <>Give the COO a first note: what is fragile, what has no runbook, and what you need.</>,
  ],
  alone: [
    "Read every operations desk: jobs, alerts, bookings, visits, reservations, restaurant fees, crashes, call usage and provider checks.",
    "Accept or decline a restaurant reservation on the restaurant's behalf where it cannot. The guest is told.",
    "Settle a seating a restaurant and a diner disagree about.",
    "Everything a Support Agent may decide: reply, status, close with a note, hand off.",
    "Approve an agreement or send it back with a reason of at least ten characters.",
    "Write and update runbooks, and set who is doing what today.",
  ],
  withSomebody: [
    "Closing or acknowledging an alert: an admin.",
    "Cancelling a booking, refunding it, or refunding part of a payment: an admin, on its own page.",
    "An outage, a data incident or a payment failure affecting many members: the COO and the CEO at once.",
    "Anything that needs infrastructure, a key or the database changed: the people who hold that access, through the COO.",
    "A change to the agreements review threshold or a risk signal: the COO.",
  ],
  never: [
    "An agreement you are a party to, or one belonging to anybody you know.",
    "A refund, a cancellation or a fee change.",
    "A key, a password or a credential. You never see one, and never paste one anywhere.",
    "Granting anybody access.",
  ],
  tasks: [
    {
      id: "morning",
      title: "The morning round",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/operations" className={A}>
            Operations
          </Link>
          . Read every job: on time, late, last run failed, or no run seen.
        </>,
        <>
          Open{" "}
          <Link href="/admin/alerts" className={A}>
            Alerts
          </Link>
          . Read everything open, and act on anything red.
        </>,
        <>
          Open{" "}
          <Link href="/admin/crashes" className={A}>
            the Crash log
          </Link>{" "}
          and look for anything new since yesterday.
        </>,
        <>
          Open{" "}
          <Link href="/admin/oversight" className={A}>
            Team oversight
          </Link>{" "}
          and move people to where the queue is.
        </>,
        <>Post one short announcement to the team: what is on fire, what is not, and who is where.</>,
      ],
    },
    {
      id: "incident",
      title: "Run an incident",
      steps: [
        <>Say out loud that it is an incident, and write it down. An unnamed problem gets worked on by nobody.</>,
        <>
          Press <strong>Escalate</strong>, choose <strong>Operations or technical</strong> and the right urgency. An
          outage affecting many members is Urgent, which tells the super admin at once.
        </>,
        <>Ask the Technical Administrator to declare it in the incident log, with a severity, so there is one record.</>,
        <>Decide who is doing what, and say it in one place. One owner for the incident.</>,
        <>Post an update every time the position changes, even where the change is &quot;still looking&quot;.</>,
        <>
          When it is over, write the note: what happened, what we did, what changes. Then write or correct the runbook,
          the same day, while you still remember.
        </>,
      ],
    },
    {
      id: "booking",
      title: "Unstick a booking",
      steps: [
        <>
          Find it on{" "}
          <Link href="/admin/bookings" className={A}>
            Bookings
          </Link>
          , or by reference on{" "}
          <Link href="/admin/lookup" className={A}>
            Lookup
          </Link>
          .
        </>,
        <>Read what state it is in, and what the last thing to happen was.</>,
        <>Check the payment behind it on Payments, so you know whether this is a money question.</>,
        <>
          Where it needs cancelling or refunding, that is an admin decision on the booking&apos;s own page. Hand it over
          with what you found, through the Escalate button if nobody is about.
        </>,
        <>Tell Support what to say to the member, so they hear one answer and not two.</>,
      ],
    },
    {
      id: "reservation",
      title: "Work a restaurant reservation",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/bookings/reservations" className={A}>
            Reservations
          </Link>
          . These are table requests waiting on the restaurant.
        </>,
        <>Where the restaurant has not answered and the date is close, accept or decline on its behalf. The guest is told.</>,
        <>
          Where a restaurant and a diner disagree about a seating, open{" "}
          <Link href="/admin/restaurant-fees" className={A}>
            Restaurant fees
          </Link>{" "}
          and settle it on the evidence.
        </>,
        <>Note what you decided and why. The restaurant may ask.</>,
      ],
      note: (
        <TodayNote>
          A restaurant table is free for a diner to book. The restaurant fees desk records what a restaurant owes for
          seated tables; it charges nobody.
        </TodayNote>
      ),
    },
    {
      id: "runbook",
      title: "Write a runbook",
      steps: [
        <>Start from a real incident that has just finished. A runbook written cold is a guess.</>,
        <>Write how you knew: which panel, which count, which alert.</>,
        <>Write the steps in order, with the real button names and the real screens.</>,
        <>Write who to tell, by position, and when.</>,
        <>Write what to say to members, so Support is not inventing it at midnight.</>,
        <>Ask the Technical Administrator to keep it with the others on the Technical desk, and read it again after the next incident.</>,
      ],
    },
  ],
  standards: [
    { what: "The morning round", good: "Done every working day, before anything else, with anything red acted on." },
    { what: "Jobs", good: "No scheduled job late or failing for more than a day without an owner and a note." },
    { what: "Incidents", good: "One owner, an update every time the position changes, and a written note the same day it ends." },
    { what: "Runbooks", good: "Every incident that happened twice has a runbook, and every runbook has been read since the last incident." },
    { what: "Backlogs", good: "No queue past its published time at the end of a day without you knowing why." },
    { what: "Calm", good: "Your team knows what to do during an incident because you said it once, clearly." },
  ],
  wordsUsed: [
    "\"This is an incident. I am the owner. Here is what we know.\" In writing, to the team, early.",
    "\"Still looking, nothing new.\" An honest update beats silence.",
    "\"It is being reviewed.\" To a member, through Support.",
    "\"That is an admin decision and I have handed it over with what I found.\"",
  ],
  wordsNever: [
    "Never a time by which something will be fixed. Say what you know and when you will say more.",
    "Never blame a provider, a colleague or a member in anything a member can read.",
    "Never \"nothing is wrong\" while a member is telling you something is.",
    "Never paste a key, a token or a credential into an incident note or an escalation.",
  ],
  privacy: [
    "Bookings and payments carry real people's addresses and amounts. Open what the question needs.",
    "The crash log can carry a member's identifier. Use it to fix the crash, not to look at the person.",
    "An incident note names counts and shapes, never members.",
    "Never read a support thread for curiosity. Your access to Support is for covering the desk.",
    "Never put a member's name in a team announcement.",
  ],
  copilotCannot: [
    "It will not close an alert, cancel a booking, refund anything or approve an agreement.",
    "It reads open alerts, job health, visits and bookings. The decisions stay with you and with admins.",
  ],
  copilotAsk: [
    "Any critical alerts open?",
    "Is any scheduled job stale?",
    "What is the biggest backlog across desks?",
  ],
  contacts: [
    { what: "An outage, a data incident or a payment failure affecting many members", who: "Chief Operating Officer and the Chief Executive Officer, at once" },
    { what: "Anything needing infrastructure, a key or the database changed", who: "The people who hold that access, through the COO" },
    { what: "Platform health, errors and the incident log", who: "Technical Administrator" },
    { what: "A refund, a cancellation or an alert to close", who: "An admin" },
    { what: "Money that does not reconcile", who: "Finance Officer" },
    { what: "Support team load and quality", who: "Customer Support Lead" },
  ],
};

export const CUSTOMER_SUPPORT_LEAD: RoleWords = {
  who: "the Customer Support Lead",
  keeps:
    "Members judge Vallo by the answer they get. You decide what that answer looks like, by who works what, what gets handed up, and what the team is allowed to say.",
  purpose: (
    <p>
      A support team with no lead answers each ticket differently. This job runs the team: who works which tickets, what
      is escalated and to whom, the quality of the answers, and the written policy the team answers from. You read the
      load every day, you work the escalation list, you review a sample of answers every week and give the agent the
      notes, and you write the policy notes and have them approved before the team relies on them.
    </p>
  ),
  glance: [
    "Your access areas are Support and Support lead. They open the Support desk and the Support lead desk: team load, escalations, quality reviews, the figures, saved replies and policy notes.",
    "A claim frees itself after thirty minutes without a touch, so a stuck ticket is never stuck for long.",
    "A policy note is a draft until the COO or an admin approves it. The team works from approved notes only.",
    "Reviews are about the answer, not the person. Score on tone, accuracy, speed and policy, and write what would have been better.",
    "Report only the figures the console can count: first response, time to resolve, and the backlog.",
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
      <Link href="/admin/manual/support-lead" className={A}>
        chapter 12 of the staff manual
      </Link>{" "}
      end to end, and{" "}
      <Link href="/admin/manual/queues" className={A}>
        chapter 3
      </Link>
      , the tickets part.
    </>,
    <>
      Open{" "}
      <Link href="/admin/support-lead" className={A}>
        Support lead
      </Link>{" "}
      and read every tab: the load, the escalations, the quality reviews, the figures, the replies and the policy
      notes.
    </>,
    <>
      Open{" "}
      <Link href="/admin/support" className={A}>
        Support
      </Link>{" "}
      and read the oldest ten tickets in every lane. That is the state you have inherited.
    </>,
    <>Read every saved reply and every policy note, and write down which are wrong or out of date.</>,
    <>Meet each agent and ask what they are unsure about. Write the answers down: those are your first policy notes.</>,
  ],
  firstWeek: [
    <>Read the load every morning: what is open, what is oldest, what is late, and who is holding it.</>,
    <>Work the escalation list daily, and hand each escalated ticket to the desk that can decide it.</>,
    <>Review five answered tickets per agent against tone, accuracy, speed and policy, and give each agent the notes.</>,
    <>Write the two policy notes the team most needs, and send them for approval.</>,
    <>
      Read{" "}
      <Link href="/admin/account-deletions" className={A}>
        Account deletions
      </Link>{" "}
      and the{" "}
      <Link href="/admin/doc-feedback" className={A}>
        Pages that fail
      </Link>{" "}
      list, for what support failures are costing us.
    </>,
    <>Give the COO your first figures: first response, time to resolve, the backlog, and what you need.</>,
  ],
  alone: [
    "Everything a Support Agent may decide, on any ticket: reply, status, resolve, close with a note, hand off.",
    "Take an unassigned ticket yourself, and ask a colleague to release one that is stuck.",
    "Hand an escalated ticket to the desk that can decide it, with the reason they read first.",
    "Review an answered ticket and write the agent the notes.",
    "Draft a saved reply or a policy note, and send it for approval.",
    "Report the support figures the console can count.",
  ],
  withSomebody: [
    "A policy note before the team relies on it: the COO or an admin approves it.",
    "Anything about money that has not arrived, or a refund that has not come back: finance, with the booking.",
    "A member who says they are in danger: the Head of Trust and Safety and the COO, immediately.",
    "A pattern of late tickets you cannot clear with the team you have: the COO.",
    "A saved reply that says something about money or safety: check it with that desk before it goes live.",
  ],
  never: [
    "A refund, a cancellation, or declining a refund request.",
    "Approving or refusing an identity document, a check or an application.",
    "Taking content down, restricting a member or resolving a case.",
    "Letting the team answer from a policy note nobody approved.",
    "Asking a member for a password, a card number or a one-time code, or letting an agent do it.",
  ],
  tasks: [
    {
      id: "load",
      title: "Read the load",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/support-lead" className={A}>
            Support lead
          </Link>{" "}
          and read the team&apos;s workload: open, oldest, late, and who holds what.
        </>,
        <>Take anything unassigned and late yourself rather than leaving it to be noticed.</>,
        <>Where a ticket is stuck with somebody, ask them to release it. Claims also free themselves after thirty minutes without a touch.</>,
        <>Move agents to the lane that is late, and say so in one place so nobody is guessing.</>,
        <>Write down anything you could not clear, with the reason, for the COO.</>,
      ],
    },
    {
      id: "escalations",
      title: "Work the escalation list",
      steps: [
        <>Open the escalations tab and read everything on it.</>,
        <>For each, decide the desk that can actually decide it: Money, Safety, Verification, Operations.</>,
        <>Hand it over with the reason they read first. Put the question in the first line.</>,
        <>Tell the agent what you did, so they can tell the member.</>,
        <>
          Where the ticket needs more than a hand-off, press <strong>Escalate</strong> at the top of the page and choose
          the kind of issue. The attached link carries the record.
        </>,
        <>Chase anything that passed its answer time. An escalation that goes quiet is yours to chase.</>,
      ],
    },
    {
      id: "quality",
      title: "Review answers and coach",
      steps: [
        <>Each week, take five answered tickets per agent, across lanes, not only the easy ones.</>,
        <>Score each on four things: tone, accuracy, speed and policy.</>,
        <>Write what would have been better, in the agent&apos;s words rather than yours. One or two points, not nine.</>,
        <>Give the notes privately, and name one thing they did well. That is not politeness, it is how a person hears the rest.</>,
        <>Where three agents made the same mistake, it is not a coaching matter. Write a policy note.</>,
      ],
      note: (
        <p>
          A quality review is about the answer, never the person. Nothing in a review goes in a team announcement.
        </p>
      ),
    },
    {
      id: "policy",
      title: "Write a policy note",
      steps: [
        <>Start from a real question the team keeps asking, or a mistake three agents made.</>,
        <>Write what is true, in plain words, with the sentence an agent can send to a member.</>,
        <>Where it touches money or safety, check it with the Finance Officer or the Head of Trust and Safety first.</>,
        <>Send it to the COO or an admin for approval. Until it is approved it is a draft and the team does not work from it.</>,
        <>Once approved, tell the team it is in force from a named day, and add the sentence to the saved replies.</>,
        <>Read it again a month later. A note nobody uses is wrong, not ignored.</>,
      ],
    },
    {
      id: "figures",
      title: "Report the figures",
      steps: [
        <>
          Open the figures tab on{" "}
          <Link href="/admin/support-lead" className={A}>
            Support lead
          </Link>
          . Read first response, time to resolve, and the backlog.
        </>,
        <>Report only what the console counts. A figure it cannot read is reported as not available, never as zero.</>,
        <>Add what the numbers do not show: who is carrying the load, what members are writing about, what is getting worse.</>,
        <>Send it to the COO weekly, and file it as your weekly report.</>,
      ],
    },
  ],
  standards: [
    { what: "The load", good: "Read every working morning. Nothing unassigned and late at the end of a day." },
    { what: "Escalations", good: "Every escalated ticket handed to the right desk the same day, and chased when it goes quiet." },
    { what: "Quality", good: "Five reviews per agent per week, with the notes given, every week." },
    { what: "Policy", good: "No agent guessing. Every repeated question has an approved note and a sentence to send." },
    { what: "Figures", good: "Honest numbers, with what they do not show said out loud." },
    { what: "People", good: "Every agent knows what they are good at and the one thing they are working on." },
  ],
  wordsUsed: [
    "\"That is a good question and nobody has written it down. I will write the note today.\"",
    "\"Here is the sentence to send.\" A policy note that gives the words saves an hour a week.",
    "\"This is in force from Monday.\" Name the day, every time.",
    "\"I am handing this to Money with the booking attached, and I will tell you what they say.\"",
    "\"Type it into VALLO Intelligence the way you would say it, then remove any chip under Search understood that is wrong.\" The first answer to a member who cannot find something.",
  ],
  wordsNever: [
    "Never score an agent as a person. Score the answer.",
    "Never let a draft note be quoted to a member as policy.",
    "Never promise a member an outcome another desk decides.",
    "Never a number you cannot trace to the console.",
  ],
  privacy: [
    "Reading a ticket for a quality review means reading a real person's problem. Read it for the review and nothing else.",
    "A quality review is private between you and the agent. It never goes in an announcement, and never names the member.",
    "A saved reply or a policy note never carries a member's name, reference or address.",
    "Account deletion reasons are counts and shares here. The free-text notes are for a super admin alone.",
    "Never contact a member outside the console, and never let an agent do it.",
  ],
  copilotCannot: [
    "It will not send a reply, close a ticket, or hand one over for you.",
    "It reads team load, quality scores, the repeated-issue tracker and the policy library as counts and references. It does not score an agent.",
  ],
  copilotAsk: [
    "Who is holding the most open tickets?",
    "What are members writing about most?",
    "Draft a saved reply for deposit questions",
  ],
  contacts: [
    { what: "A policy note that needs approval", who: "Chief Operating Officer, or an admin" },
    { what: "Money that has not arrived, or a refund that has not come back", who: "Finance Officer, with the booking" },
    { what: "A member who says they are in danger", who: "Head of Trust and Safety and the COO, immediately" },
    { what: "A pattern of late tickets you cannot clear", who: "Chief Operating Officer" },
    { what: "A help page that is wrong or missing", who: "Content Manager" },
    { what: "A word or a place nickname VALLO Intelligence does not understand", who: "Content Manager or Marketing Manager, who add aliases on the Search desk" },
    { what: "An identity or a document", who: "KYC Reviewer, by handing the ticket to Verification" },
  ],
};
