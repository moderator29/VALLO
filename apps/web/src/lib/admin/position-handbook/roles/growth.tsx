import Link from "next/link";
import { A, TodayNote } from "../parts";
import type { RoleWords } from "../types";

/**
 * THE FIVE DEPARTMENT POSITIONS: Business Development Director, Social Media
 * Manager, Marketing Manager, Content Manager and Technical Administrator.
 *
 * Each has its own desk and its own chapter of the staff manual (13, 14, 9, 10
 * and 11), read from the desks' own code on 15 November 2026. The steps below
 * use the real tab and control names those chapters record. Four of these five
 * positions hold no access to listings, support, moderation or member data,
 * and their handbooks say so plainly. On 16 November 2026 the Search desk
 * (`/admin/search`) was added for Marketing and Content, read from
 * `app/admin/search` and `lib/admin/search-alias-actions.ts`.
 */

export const BUSINESS_DEVELOPMENT_EXECUTIVE: RoleWords = {
  who: "the Business Development Director",
  keeps:
    "Supply is what makes Vallo worth opening. Every landlord, agent, hotel and restaurant on it is there because somebody persuaded them, and that somebody is you.",
  purpose: (
    <p>
      Vallo is only useful where there is something real to find on it. This job brings in the people who list:
      landlords, agents, hotels, shortlet hosts and restaurants. You find them, you approach them, you keep every
      prospect and partnership in one place with the next follow-up date, and you review the listings and the identity
      checks your pipeline produces before they go live. You hold no admin role, and a partnership earns its place on
      Vallo the same way a listing does.
    </p>
  ),
  glance: [
    "Your access areas are Business development, Listing approval and KYC review. They open the Business development desk, Listings, Verification, Applications, property cases and review calls.",
    "Everything a prospect tells you goes in the pipeline record, never in a personal notebook or a chat outside Vallo.",
    "Never review a listing from somebody you brought on yourself without a second person's eyes on it first.",
    "A contact needs an outcome. Write what was said in What happened, and the result in the outcome.",
    "Move a stage only when the position has really changed. The pipeline is a record, not a hope.",
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
      <Link href="/admin/manual/business-development" className={A}>
        chapter 13 of the staff manual
      </Link>{" "}
      end to end, then{" "}
      <Link href="/admin/manual/product-guide" className={A}>
        chapter 15
      </Link>
      . You cannot sell a product you cannot describe.
    </>,
    <>
      Open{" "}
      <Link href="/admin/business-development" className={A}>
        Business development
      </Link>
      . Read This week, the listing approval count, Follow-ups due this week, Add a prospect and the Pipeline table.
    </>,
    <>
      Read{" "}
      <Link href="/admin/manual/queues" className={A}>
        chapter 3
      </Link>
      , the listings and identity parts. You review both.
    </>,
    <>Learn what Vallo charges and what it does not: Vallo charges renters no fee, and asks for no inspection fee.</>,
    <>Add one real prospect and log one contact, with your lead watching.</>,
  ],
  firstWeek: [
    <>Open the desk every morning and clear Follow-ups due this week. An overdue follow-up is a prospect going cold.</>,
    <>Add every prospect you have in your head or your phone into the pipeline. If it is not in the pipeline it does not exist.</>,
    <>Review three listings from your pipeline, with a second person reading your reasons.</>,
    <>
      Review three identity checks on{" "}
      <Link href="/admin/kyc" className={A}>
        Verification
      </Link>
      : the document, the selfie and the name against the account.
    </>,
    <>Download the pipeline spreadsheet once, so you know what it holds and that it is recorded when you do.</>,
    <>Give your lead the first weekly report: who you are talking to, what is close, what is stuck.</>,
  ],
  alone: [
    "Add a prospect, log a contact with its outcome, set or clear a follow-up date, write a note, and edit a prospect's details.",
    "Move a prospect's stage, where the position has really changed.",
    "Approve, publish, send back or reject a listing, with a reason the lister reads.",
    "Approve or refuse an identity check on the KYC desk, with a reason the member reads.",
    "Restrict a member on a property case where the evidence supports it, with the reason and the evidence attached.",
    "Download the pipeline as a spreadsheet. The download is recorded with your name.",
  ],
  withSomebody: [
    "A listing from somebody you brought onto Vallo yourself: a second person's eyes before you decide it.",
    "A restriction decision you are not sure of, or a partner who pushes back hard on one: the COO.",
    "A listing you believe is a scam: reject it, report it to moderation, and tell your lead the same day.",
    "A document you believe is forged: the Compliance Officer, through the Escalate button, and the applicant is never told why.",
    "A fee, a discount or a commercial term you were asked for and cannot find written down: the COO.",
  ],
  never: [
    "Your own listing, or one from somebody you know personally.",
    "A fee rate, a discount or any commercial promise that is not written down. There is no fee you may set and no payment you may arrange.",
    "A refund, a payout or anything about money.",
    "Keeping a prospect's details on your own phone, in a chat app, or in a personal spreadsheet.",
  ],
  tasks: [
    {
      id: "prospect",
      title: "Add a prospect",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/business-development" className={A}>
            Business development
          </Link>{" "}
          and find <strong>Add a prospect</strong>.
        </>,
        <>Fill the business name, the person, the category and how to reach them. The form is short on purpose.</>,
        <>Set the stage. <strong>New</strong> means you have a contact route and have not spoken yet.</>,
        <>Set the next follow-up date before you leave the form. A prospect with no date is a prospect nobody will call.</>,
        <>Press the create control. The prospect appears in the Pipeline table, and the record is written with your name.</>,
      ],
    },
    {
      id: "contact",
      title: "Log a contact and set the follow-up",
      steps: [
        <>Find the prospect: search by business, person, phone number or place, or filter by stage.</>,
        <>Open the row. The record shows how to reach them, the stage, the next follow-up and the history.</>,
        <>
          Log the contact. Write what was said in <strong>What happened</strong>, and the result in the{" "}
          <strong>outcome</strong>. A contact without an outcome is not a record of anything.
        </>,
        <>Set the next follow-up date, or clear it where there is nothing more to do.</>,
        <>Move the stage only where the position really changed: Contacted, Interested, Meeting scheduled, Negotiation, Proposal sent, Agreement pending, Onboarded or Rejected.</>,
        <>Where it will not go ahead, choose Rejected and log a note saying why. A clear no is worth more than an open maybe.</>,
      ],
      note: (
        <p>
          The table puts overdue follow-ups first, then today, then by date. In the record, the phone number starts a
          call on a phone. Everything the prospect tells you belongs here, not in a notebook.
        </p>
      ),
    },
    {
      id: "listing",
      title: "Review a listing from your pipeline",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/listings" className={A}>
            Listings
          </Link>
          , Waiting tab.
        </>,
        <>
          Check first whether you brought this lister on. Where you did, ask a colleague to read it with you before you
          decide.
        </>,
        <>Read the photographs, the description, the price and every fee, and who each fee is paid to.</>,
        <>Check the owner&apos;s written mandate where an agent or firm is listing.</>,
        <>
          <strong>Approve</strong>, <strong>ask for more</strong> with the reason chips and your words, or{" "}
          <strong>reject</strong> with a reason of at least eight characters.
        </>,
        <>Log in the pipeline record that the listing was reviewed, so the relationship history is complete.</>,
      ],
    },
    {
      id: "identity",
      title: "Review an identity check",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/kyc" className={A}>
            Verification
          </Link>{" "}
          and the person waiting.
        </>,
        <>Open the document in the console&apos;s own viewer. Never download it.</>,
        <>Compare the document, the selfie and the name against the account. All three have to agree.</>,
        <>
          <strong>Approve</strong>, or <strong>refuse</strong> with a reason of at least twelve characters that says
          what to send instead.
        </>,
        <>
          Where you believe a document is forged, do not say so to the member. Press <strong>Escalate</strong>, choose{" "}
          <strong>Identity or fraud</strong>, and let the Compliance Officer decide.
        </>,
      ],
    },
    {
      id: "pitch",
      title: "What to say to a business, and what not to",
      steps: [
        <>Say what Vallo is: a Nigeria-first place to find and deal in property, and to find somewhere to stay or eat.</>,
        <>Say that a person reviews every listing before it goes live, and that renters pay Vallo no fee.</>,
        <>Say what the fees in force actually are. Read them, do not remember them.</>,
        <>
          Where they ask for a term you cannot find written down, say you will come back to them, and ask the COO. Never
          invent a discount.
        </>,
        <>
          Where they ask you to promise a payment carries no risk, offer the true line instead: Vallo uses regulated
          payment partners to process eligible payments, and Vallo does not hold customer funds.
        </>,
        <>Log what you promised, word for word, in the pipeline record.</>,
      ],
      note: (
        <TodayNote>
          Payment for rentals is not open on Vallo, and sales are never paid on Vallo. Stays and hotel rooms pay by
          card, and a restaurant table is free for a diner to book.
        </TodayNote>
      ),
    },
  ],
  standards: [
    { what: "Follow-ups", good: "Nothing overdue at the end of a day. Every open prospect has a date." },
    { what: "The record", good: "Every contact logged with what was said and the result, the same day." },
    { what: "Stages", good: "A stage you can defend from the record. No prospect sitting in Negotiation for a month with no note." },
    { what: "Listing review", good: "Decided inside the queue's promise, and never your own lister without a second reader." },
    { what: "Identity review", good: "Document, selfie and name compared every time, with a refusal that says what to send instead." },
    { what: "Honesty", good: "Nothing you promised a partner is outside what is written down." },
  ],
  wordsUsed: [
    "\"A person at Vallo reviews every listing before it goes live.\"",
    "\"Vallo charges renters no fee, and asks for no inspection fee.\"",
    "\"Vallo uses regulated payment partners to process eligible payments. Vallo does not hold customer funds.\"",
    "\"I will come back to you on that.\" Where a term is not written down.",
    "\"We cannot publish this yet because X. Here is what would fix it.\"",
    "\"Once it is live, people find your listing on Search and in VALLO Intelligence, the one search across Vallo.\" Never a number of people who will.",
  ],
  wordsNever: [
    "Never a fee, a discount or a commission that is not written down.",
    "Never that a payment, a tenant or a listing is covered or carries no risk.",
    "Never a date by which a feature will open, or by which a prospect will be listing on Vallo.",
    "Never a member's name or detail to a prospect, as an example or otherwise.",
  ],
  privacy: [
    "A prospect's details belong in the pipeline record. Never in your own phone, a chat app or a personal spreadsheet.",
    "You hold KYC review, which means identity documents. Open them in the console's viewer, for one decision, and never download one.",
    "Never name one member or one listing to another business, even as an example of what works.",
    "The pipeline download holds real businesses and real people. The download is recorded; do not keep the file.",
    "Never review your own listing, your own application, or one from anybody you know personally.",
  ],
  copilotCannot: [
    "It will not approve a listing, decide an identity check, or restrict anybody.",
    "It can add a prospect or log a contact for your confirmation. Nothing is saved until you press Confirm.",
  ],
  copilotAsk: [
    "Which follow-ups are due this week?",
    "Summarise my pipeline",
    "What can I tell a prospect about fees?",
  ],
  contacts: [
    { what: "A restriction you are unsure of, or a partner pushing back on one", who: "Chief Operating Officer" },
    { what: "A commercial term you cannot find written down", who: "Chief Operating Officer" },
    { what: "A listing you believe is a scam", who: "Head of Trust and Safety, the same day" },
    { what: "A document you believe is forged", who: "Compliance Officer, through the Escalate button" },
    { what: "A fee rate, or what a lister pays", who: "Finance Officer" },
    { what: "A second reader for a listing from your own pipeline", who: "Listings Reviewer, or the Head of Trust and Safety" },
  ],
};

export const SOCIAL_MEDIA_MANAGER: RoleWords = {
  who: "the Social Media Manager",
  keeps:
    "What Vallo posts is the first thing most people ever see of it. A post that overpromises costs the trust that the review desks spend all day building.",
  purpose: (
    <p>
      This job plans and prepares everything Vallo says on social media: the calendar, the drafts, the campaigns and
      the media library. The desk does not post to any platform. You write and prepare a post in the console, send it
      for approval, post it yourself on the real platform once it is approved, and record what actually went out so
      the calendar stays the true record. This role has no access to listings, support, moderation or any
      member&apos;s data.
    </p>
  ),
  glance: [
    "Your access area is Social media. It opens the Social media desk and nothing else.",
    "The desk never posts to a platform. You post by hand, then mark it as posted with the link.",
    "Only a draft can be edited. A post awaiting approval has to be sent back to Draft first.",
    "Nothing about a member, a payment, a legal matter or an internal decision goes out without approval.",
    "This role has no access to listings, support, moderation or any member's data. If a post needs a real figure, ask the desk that owns it.",
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
      <Link href="/admin/manual/social-media" className={A}>
        chapter 14 of the staff manual
      </Link>{" "}
      end to end, then{" "}
      <Link href="/admin/manual/product-guide" className={A}>
        chapter 15
      </Link>
      .
    </>,
    <>
      Open{" "}
      <Link href="/admin/social-media" className={A}>
        Social media
      </Link>
      . It opens on this week&apos;s calendar: Monday to Friday, with four posting slots a day.
    </>,
    <>Read the other three tabs: Drafts and campaigns, Media library, and Report.</>,
    <>Read ten posts that already went out, and the reasons behind any that were sent back.</>,
    <>Write one draft, send it for approval, and watch what the approver sees.</>,
  ],
  firstWeek: [
    <>Fill next week&apos;s calendar: what is going out, on which platform, in which slot.</>,
    <>Take one post the whole way: draft, approval, posted by hand, marked as posted with its link.</>,
    <>Tidy the media library so a picture is easy to find, and remove nothing that is attached to a post.</>,
    <>Write down, for yourself, the three sentences about money you are allowed to use, and the ones you are not.</>,
    <>Read the Report tab and write your first weekly report from it, plus what each platform&apos;s own dashboard shows.</>,
  ],
  alone: [
    "Write a draft: platform, category, format, planned date, slot, campaign, caption and files.",
    "Upload an image or a short video to the media library, where Vallo may use it.",
    "Send a draft for approval.",
    "Approve or send back a post, as anybody holding the Social media area may.",
    "Post an approved post by hand on the platform, and mark it as posted with the link and the time.",
    "Cancel a post that will not go out.",
  ],
  withSomebody: [
    "Anything that could be read as a company statement on a legal, safety or financial matter: the COO, before it is posted.",
    "A real figure for a post: the desk that owns it (Finance, Trust and Safety, Marketing).",
    "A member's photograph, review or story: their written permission first, through the desk that holds the relationship.",
    "A campaign that belongs to Marketing: the Marketing Manager briefs it.",
  ],
  never: [
    "Posting anything that has not been approved.",
    "Anything about a named member, a payment, a legal matter or an internal decision.",
    "A figure you have not been given by the desk that owns it.",
    "A promise that a payment is covered or carries no risk.",
    "Using a picture or a video Vallo may not use.",
  ],
  tasks: [
    {
      id: "calendar",
      title: "Plan the week",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/social-media" className={A}>
            Social media
          </Link>
          . The Calendar tab shows Monday to Friday with four slots a day: 8am to 11am, 11am to 2pm, 2pm to 6pm and 6pm
          to 9pm.
        </>,
        <>Decide what each slot is for, by platform and category, before you write anything.</>,
        <>Leave room. A calendar with nothing spare has nowhere to put the thing that matters on Thursday.</>,
        <>Create the drafts for the week, with their planned dates and slots.</>,
        <>Send them for approval early, not on the morning they are due.</>,
      ],
    },
    {
      id: "post",
      title: "One post, from draft to posted",
      steps: [
        <>
          On the <strong>Drafts and campaigns</strong> tab, write a new draft. A draft needs a platform, a category and
          a planned date. The caption can come later.
        </>,
        <>Attach files from the media library. Upload first, then choose the file in the draft.</>,
        <>
          Press <strong>Send for approval</strong>. The post now waits for a decision and can no longer be edited.
        </>,
        <>
          Where it is <strong>sent back</strong>, it returns to Draft with a written reason. Fix exactly that and send
          it again.
        </>,
        <>Once approved, post it by hand on the platform itself, in its own app or browser tab.</>,
        <>
          Come back and <strong>mark it as posted</strong>, with the link to the live post and the time it went out.
          Only an approved post can be marked.
        </>,
        <>Where it will not go out, cancel it. There is an Undo on the banner for a few seconds.</>,
      ],
      note: (
        <p>
          The calendar is only the true record of what went out if you mark things as posted the same day. A calendar
          full of approved posts nobody marked tells the company nothing.
        </p>
      ),
    },
    {
      id: "media",
      title: "Keep the media library",
      steps: [
        <>Upload images as JPEG, PNG, WebP or GIF, and videos as MP4, MOV or WebM, inside the size the desk allows.</>,
        <>Name a file for what is in it, not for the camera&apos;s number.</>,
        <>Use only pictures and video Vallo may use: its own, or a member&apos;s with their written permission.</>,
        <>A file attached to a post cannot be removed. Take it off the post first.</>,
        <>Never upload a photograph of a member, a document or anything from a case.</>,
      ],
    },
    {
      id: "wording",
      title: "Check a post's wording before you send it",
      steps: [
        <>Read it as a member with little money and a patchy connection would read it.</>,
        <>Check every figure. Where you did not get it from the desk that owns it, take it out.</>,
        <>Check the money wording: Vallo never holds customer money, and no post promises that a payment is covered.</>,
        <>Check there is no date, no &quot;soon&quot;, and no promise about when anything will be ready.</>,
        <>Check it names no member, no listing and no internal decision.</>,
        <>Check there is no em dash in it. Short sentences and commas.</>,
      ],
    },
    {
      id: "report",
      title: "Report what went out",
      steps: [
        <>
          Open the <strong>Report</strong> tab: this week&apos;s figures, and what was posted this month by platform and
          by category.
        </>,
        <>Add what each platform&apos;s own dashboard shows you, and say which dashboard it came from.</>,
        <>Report only what you can see. A figure you cannot read is not available, never zero.</>,
        <>File it as your weekly report, and tell your lead what is working and what is not.</>,
      ],
    },
  ],
  standards: [
    { what: "The calendar", good: "Next week is planned before this week ends, and every slot has a purpose." },
    { what: "Approval", good: "Nothing posted that was not approved. Drafts sent early enough to be read properly." },
    { what: "Marking as posted", good: "Every post marked the same day, with its link. The calendar is the true record." },
    { what: "Wording", good: "No figure you were not given, no promise of safety, no date, no member named." },
    { what: "The library", good: "A picture is findable in under a minute, and Vallo may use every file in it." },
    { what: "Reporting", good: "Honest figures with their source named, every week." },
  ],
  wordsUsed: [
    "\"A person reviews every listing on Vallo before it goes live.\" True, and the strongest thing we can say.",
    "\"Vallo charges renters no fee.\"",
    "\"Find a home, a stay or a table in Nigeria.\" Plain, and what the product does.",
    "\"Vallo uses regulated payment partners to process eligible payments.\"",
  ],
  wordsNever: [
    "Never that a payment, a listing or a person is covered, insured or carries no risk.",
    "Never that Vallo holds, keeps or looks after anybody's money.",
    "Never a date, a launch, or any form of \"soon\".",
    "Never a member's name, photograph or words without written permission, and never a case.",
  ],
  privacy: [
    "You hold no member data and you should never be given any. If somebody sends you a member's details for a post, refuse and tell your lead.",
    "Never post a photograph that shows a member's face, a document, a plate number or a house number without permission.",
    "A screenshot of the console never goes out, in any form, for any campaign.",
    "A review or a story from a member goes out only with their written permission, obtained by the desk that holds the relationship.",
    "Never answer a member's complaint in a platform's comments. Point them at the contact form.",
  ],
  copilotCannot: [
    "It will not post anything anywhere, and it cannot approve a post.",
    "It saves a draft for your confirmation. Nothing is posted, and nothing is saved until you press Confirm.",
  ],
  copilotAsk: [
    "What is on the calendar this week?",
    "Which posts are overdue?",
    "Draft a post for Friday",
  ],
  contacts: [
    { what: "Anything that reads as a company statement on a legal, safety or financial matter", who: "Chief Operating Officer, before it is posted" },
    { what: "A real figure for a post", who: "The desk that owns it: Finance Officer, Head of Trust and Safety or Marketing Manager" },
    { what: "A campaign's posts", who: "Marketing Manager" },
    { what: "Copy and wording", who: "Content Manager" },
    { what: "A member complaining in public comments", who: "Customer Support Lead" },
    { what: "Your access, or a desk that will not open", who: "The founder's super admin account, through the COO" },
  ],
};

export const MARKETING_MANAGER: RoleWords = {
  who: "the Marketing Manager",
  keeps:
    "A campaign that brings in people who then find a real listing and a real answer is worth ten that bring in people who leave. Honest numbers are how you tell the difference.",
  purpose: (
    <p>
      This job plans Vallo&apos;s campaigns and promotions, tracks what each one brings in, and keeps campaign budgets
      honest. You plan the campaign in the console, build the tracked link so sign-ups can be traced back to it, send
      it for approval before it goes live, and log the real numbers from the real dashboards as they come in. Every
      figure you report is either read from the console or logged by you with its source. The desk never connects to an
      advertising platform.
    </p>
  ),
  glance: [
    "Your access area is Marketing. It opens the Marketing desk, the account deletion reasons and Search (what people look for in VALLO Intelligence, and the search aliases), and nothing else.",
    "A campaign goes live only after it is approved, and spends only what its approved budget says.",
    "Every number you log carries its source. Never round a figure up, and never fill a gap with a guess.",
    "This role has no access to listings, support, moderation or any member's data.",
    "A budget change after approval goes to the COO before anything more is committed.",
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
      <Link href="/admin/manual/marketing" className={A}>
        chapter 9 of the staff manual
      </Link>{" "}
      end to end, then{" "}
      <Link href="/admin/manual/product-guide" className={A}>
        chapter 15
      </Link>
      .
    </>,
    <>
      Open{" "}
      <Link href="/admin/marketing" className={A}>
        Marketing
      </Link>{" "}
      and read all nine tabs: Campaigns, Calendar, Tracked links, Results, Acquisition, Referrals, Briefs and tests,
      Audience and market, and the Monthly report.
    </>,
    <>Read the live and ended campaigns, their approval state, and their budget against logged spend.</>,
    <>Build one tracked link and copy it, so you have done it before a campaign needs it.</>,
    <>Read the Acquisition tab: new accounts, listings created and referrals over the last eight weeks, from Vallo&apos;s own records.</>,
  ],
  firstWeek: [
    <>Plan one campaign properly: objective, channel, audience, dates, and the budget where you are authorised.</>,
    <>Save its tracked link on the campaign, so the link shows on its card.</>,
    <>Send it to the COO for approval, and act on any reason it comes back with.</>,
    <>Log last week&apos;s numbers on Results, each with its source, and read the spend per logged sign-up.</>,
    <>Write one creative brief for the Social Media Manager and one for the Content Manager.</>,
    <>Read the Calendar for channel clashes, and fix any two campaigns using the same channel on overlapping dates.</>,
    <>
      Read{" "}
      <Link href="/admin/search" className={A}>
        Search
      </Link>{" "}
      over 30 days: the places people ask for, and the searches that found nothing. It is the plainest record of demand
      Vallo has.
    </>,
  ],
  alone: [
    "Plan a campaign as a draft: name, channel, audience, dates and, where authorised, a budget.",
    "Build and save a tracked link with its source, medium and campaign tags.",
    "Log a result against a campaign: spend, impressions, clicks, sign-ups, listings created or referrals, each with its source.",
    "Read the acquisition and referral figures the console already holds.",
    "Write a creative brief, a segment note, a market note, and the A and B test log.",
    "Draft the monthly report from your campaigns and logged results.",
    "Add, change, switch off or switch back on a search alias on the Search desk. Each change is written to the audit log with your name.",
  ],
  withSomebody: [
    "A campaign going live: the COO or an admin approves it first.",
    "The monthly report: it goes through the same approval step.",
    "A change to a budget after approval, or spend that would pass it: the COO, before it is committed.",
    "Anything that could be read as a company statement on a legal, safety or financial matter: the COO, before it goes out.",
    "A real figure about money, safety or supply: the desk that owns it.",
  ],
  never: [
    "Running a campaign that has not been approved, or spending past its approved budget.",
    "A figure you did not read from the console or log with its source.",
    "A member's name or a payment in any campaign.",
    "A promise that a payment is covered or carries no risk.",
    "Editing an approved budget downwards to hide an overspend. That reopens approval, and hiding it is the fault.",
  ],
  tasks: [
    {
      id: "campaign",
      title: "Run a campaign, step by step",
      steps: [
        <>
          On{" "}
          <Link href="/admin/marketing" className={A}>
            Campaigns
          </Link>
          , create a draft: the name, the channel, the audience, the dates and, where you are authorised, the budget.
        </>,
        <>
          On <strong>Tracked links</strong>, build the link with its source, medium and campaign tags, and save the tags
          on the campaign so the link shows on its card.
        </>,
        <>
          Check the <strong>Calendar</strong> for a clash: two campaigns on the same channel on overlapping dates is a
          warning the desk shows you.
        </>,
        <>Send it for approval. The COO or an admin reads it.</>,
        <>Once approved, move it to Live on its start date, and use only the tracked link.</>,
        <>
          Each week, log the numbers on <strong>Results</strong>, each with its source, and read the spend per logged
          sign-up.
        </>,
        <>End it on its end date, and tell it in the monthly report.</>,
      ],
    },
    {
      id: "results",
      title: "Log results honestly",
      steps: [
        <>Open each platform&apos;s own dashboard and read the figures there.</>,
        <>
          On <strong>Results</strong>, log each number against its campaign, with the source written beside it.
        </>,
        <>Where a figure is not available, say so. Never write zero for something you could not read.</>,
        <>Never round a figure up to a nicer number. The next person will trace it.</>,
        <>Read the totals and the spend per logged sign-up, and write one sentence about what it means.</>,
      ],
    },
    {
      id: "overbudget",
      title: "A campaign over its budget",
      steps: [
        <>Stop adding spend on the platform. Do that first, before any message.</>,
        <>Do not edit the budget down. That hides it, and it reopens approval anyway.</>,
        <>
          Message the COO: the campaign, the approved budget, what is logged, and why it went over. Ask for a decision
          before anything more is committed.
        </>,
        <>
          Where nobody answers and spend is still running, press <strong>Escalate</strong>, choose{" "}
          <strong>Money</strong>, and attach the campaign.
        </>,
        <>Log what was decided on the campaign, so the record explains itself later.</>,
      ],
    },
    {
      id: "brief",
      title: "Brief the social and content desks",
      steps: [
        <>
          Open <strong>Briefs and tests</strong> and write the brief: what the campaign is for, who it is for, what you
          need made, and by when.
        </>,
        <>Give them the facts, and say which desk each figure came from. Never ask them to find a number.</>,
        <>Say plainly what may not be said: no promise of safety, no date, no member named.</>,
        <>Tell the Social Media Manager or the Content Manager that it is there. A brief nobody was told about is not a brief.</>,
        <>Retire the brief once the work is out, and log what the test showed in the A and B log.</>,
      ],
    },
    {
      id: "search",
      title: "Read what people search for",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/search" className={A}>
            Search
          </Link>{" "}
          and choose Last 30 days.
        </>,
        <>Read Places searched and What the words pointed at: where people look, and for what.</>,
        <>Read Searches that found nothing. Never plan a campaign that sends people to look for something on that list.</>,
        <>
          Where people type a nickname or a spelling search does not understand, add an alias under{" "}
          <strong>Aliases</strong>, then try it yourself in VALLO Intelligence. Agree it with the Content Manager first,
          so the two of you do not undo each other.
        </>,
        <>In a report, a count here is searches, not people who will rent or book. Say so.</>,
      ],
      note: (
        <p>
          A word shows on the desk only once three different visits searched it, and no search is tied to a person.
          Never try to work out who searched for something.
        </p>
      ),
    },
    {
      id: "monthly",
      title: "The monthly report",
      steps: [
        <>In the last days of the month, open the <strong>Monthly report</strong> tab and draft it from your campaigns and logged results.</>,
        <>Read the Acquisition and Referrals tabs, and put the console&apos;s own figures beside your logged ones.</>,
        <>Say what you do not know. A report that admits a gap is worth more than one that fills it.</>,
        <>Send it for approval, and act on any reason it comes back with.</>,
        <>File the same month&apos;s summary as a weekly report entry, so the record is in one place.</>,
      ],
    },
  ],
  standards: [
    { what: "Approval", good: "No campaign live without approval, and no spend past an approved budget." },
    { what: "Tracking", good: "Every campaign has a saved tracked link, so its sign-ups can be traced back to it." },
    { what: "Numbers", good: "Every logged figure carries its source. Nothing rounded, nothing guessed, nothing reported as zero that was unreadable." },
    { what: "Cadence", good: "Campaigns read daily, results logged weekly, the report built and sent monthly." },
    { what: "Briefs", good: "Social and content never have to find a fact themselves." },
    { what: "Wording", good: "No campaign promises safety, names a member, or gives a date." },
  ],
  wordsUsed: [
    "\"A person reviews every listing on Vallo before it goes live.\"",
    "\"Vallo charges renters no fee.\"",
    "\"That figure is not available, so I have left it out.\"",
    "\"This is over budget. I have stopped the spend and I need a decision.\"",
  ],
  wordsNever: [
    "Never that a payment or a person on Vallo is covered, insured or carries no risk.",
    "Never that Vallo holds anybody's money.",
    "Never a date, a launch or any form of \"soon\".",
    "Never a member's name, a listing's address or a payment in a campaign.",
  ],
  privacy: [
    "You hold no member data and you should never be given any. If somebody sends you a member's details for a campaign, refuse and tell the COO.",
    "A campaign figure is a count. Where a count is so small that a reader could guess who it is, say \"a few\".",
    "Account deletion reasons are counts and shares here. The free-text notes are for a super admin alone, and never go in a report.",
    "Never put a real member's review, photograph or words in a campaign without their written permission.",
    "A tracked link carries no personal data. Never add anything to one that identifies a person.",
  ],
  copilotCannot: [
    "It will not launch a campaign, change a budget, or send anything out.",
    "It reads campaigns and performance as counts, never budgets or names, and it drafts a brief or a reading for you to add. Nothing is saved until you add it.",
  ],
  copilotAsk: [
    "Which campaigns end this week?",
    "How did referrals do over the last eight weeks?",
    "Build a tracked link for the December push on Instagram",
  ],
  contacts: [
    { what: "A campaign, a budget change or the monthly report", who: "Chief Operating Officer, for approval" },
    { what: "Anything that reads as a company statement on a legal, safety or financial matter", who: "Chief Operating Officer, before it goes out" },
    { what: "A real figure about money", who: "Finance Officer" },
    { what: "A real figure about supply or partners", who: "Business Development Director" },
    { what: "Campaign posts and creative", who: "Social Media Manager and the Content Manager" },
    { what: "What members cannot find", who: "Content Manager and the Customer Support Lead" },
  ],
};

export const CONTENT_MANAGER: RoleWords = {
  who: "the Content Manager",
  keeps:
    "Most members never write to support. They read a page and either understand or leave. The pages are yours, so their understanding is too.",
  purpose: (
    <p>
      This job plans, writes and publishes Vallo&apos;s own content: the guides, the announcements, the articles and the
      brand material, each through an approval step. You keep the editorial calendar, you write and edit in the
      console, you record the link once an item is published so the calendar is the true record, and you retire what
      has gone out of date. You keep the brand library everybody writes from. This role has no access to the moderation
      queue itself, to listings, support or any member&apos;s data.
    </p>
  ),
  glance: [
    "Your access area is Content. It opens the Content desk and Search (what people look for in VALLO Intelligence, and the search aliases), and nothing else.",
    "Nothing about a member, a payment, a legal matter or an internal decision is published without approval.",
    "You read the moderation counts on the Feed tab. The decisions stay with moderation.",
    "Images and video belong in the social media library. This desk holds text and links only.",
    "An article with a wrong fact costs more than a late one. Publish what is confirmed and hold the rest.",
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
      <Link href="/admin/manual/content" className={A}>
        chapter 10 of the staff manual
      </Link>{" "}
      end to end, then{" "}
      <Link href="/admin/manual/product-guide" className={A}>
        chapter 15
      </Link>
      . Chapter 15 is the source for most of what you will write.
    </>,
    <>
      Open{" "}
      <Link href="/admin/content" className={A}>
        Content
      </Link>{" "}
      and read every tab: Items, Calendar, Requests, Style and search, Translations, Publishing, Help gaps and Feed.
    </>,
    <>Read the style guide, rule by rule, with its examples.</>,
    <>Read five published items and five that were sent back, and the reasons.</>,
    <>Write one short draft and send it for approval, to see the step from both sides.</>,
  ],
  firstWeek: [
    <>Run the calendar for the week: what is being written, who owns it, and the date it is due.</>,
    <>Clear the Requests inbox, or answer each with a date. A request with no answer is a department blocked.</>,
    <>
      Read{" "}
      <Link href="/admin/doc-feedback" className={A}>
        Pages that fail
      </Link>{" "}
      through the Help gaps tab, and pick the worst page to rewrite first.
    </>,
    <>Update the Translations tab honestly: not started, drafting, reviewed or live, for English, Hausa, Yoruba and Igbo.</>,
    <>Retire two items that are out of date. Stale content is worse than no content.</>,
    <>
      Read{" "}
      <Link href="/admin/search" className={A}>
        Search
      </Link>{" "}
      with Help gaps: a help question that found nothing is a page to write, and a word search does not understand is
      an alias to add.
    </>,
    <>Write your weekly report from the calendar and the gaps.</>,
  ],
  alone: [
    "Create and edit an item: a guide, an announcement, an article, a brand note or campaign copy.",
    "Run the style and search checklists on a draft.",
    "Send an item for approval.",
    "Publish an approved item, and record its link.",
    "Retire an item that is out of date.",
    "Keep the brand library, the editorial calendar and the translation status.",
    "Add, change, switch off or switch back on a search alias on the Search desk. Each change is written to the audit log with your name.",
  ],
  withSomebody: [
    "Publishing anything: the COO or an admin approves it first.",
    "A draft that touches a legal, safety or financial matter: the COO, before it is even sent for approval.",
    "Feed content that looks harmful or illegal: the Head of Trust and Safety, the same hour.",
    "A fact you cannot confirm: the desk that owns it, and hold the article until they answer.",
    "A translation nobody has read: hold it. Ship in English and mark the language as drafting.",
  ],
  never: [
    "Publishing without approval.",
    "A member's name, photograph, review or words without their written permission.",
    "A figure you did not get from the desk that owns it.",
    "A promise that a payment is covered or carries no risk, or that Vallo holds anybody's money.",
    "A decision on the moderation queue. You read the counts; moderation decides.",
  ],
  tasks: [
    {
      id: "item",
      title: "An item from idea to published",
      steps: [
        <>
          On{" "}
          <Link href="/admin/content" className={A}>
            Items
          </Link>
          , create a draft: the title, the kind, the summary, the text and a planned date.
        </>,
        <>
          Run the <strong>style</strong> and <strong>search</strong> checklists on the Style and search tab, and fix
          what they name.
        </>,
        <>Check every fact against the desk that owns it. Where one is unconfirmed, leave it out or hold the item.</>,
        <>
          Press <strong>Send for approval</strong>. The COO or an admin reads it.
        </>,
        <>Where it is sent back, fix exactly what the reason names and send it again.</>,
        <>Once approved, publish it and <strong>record the link</strong>. The calendar is only the true record if you do.</>,
        <>Set a date to read it again. Then look after it: retire it when it goes out of date.</>,
      ],
      note: (
        <p>
          An article with a wrong fact costs more than a late one. Publish what is confirmed and leave out the rest,
          and write in the request card what is missing and who owns it.
        </p>
      ),
    },
    {
      id: "requests",
      title: "Work the requests inbox",
      steps: [
        <>
          Open the <strong>Requests</strong> tab: what other departments have asked for, who is waiting, how urgent, and
          by when.
        </>,
        <>Answer each one with a date, even where the date is in three weeks. A silence blocks somebody.</>,
        <>Where a request needs a fact the requester does not have, say so in the card and name who owns it.</>,
        <>Where two requests want the same page, say so and do it once.</>,
        <>Close the card when the item is published, with the link in it.</>,
      ],
    },
    {
      id: "gaps",
      title: "Close a help gap",
      steps: [
        <>
          Open the <strong>Help gaps</strong> tab: the pages members said did not help, the gaps support keeps, and the
          gaps you are working.
        </>,
        <>Pick the page with the most members saying it did not help, not the easiest one.</>,
        <>Ask the Customer Support Lead what members actually ask, in their own words. Write to that question.</>,
        <>Rewrite the page, run the checklists, and send it for approval.</>,
        <>Watch the page over the next month. A gap you closed that is still failing is still a gap.</>,
      ],
    },
    {
      id: "alias",
      title: "Teach search a word (an alias)",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/search" className={A}>
            Search
          </Link>{" "}
          and read Searches that found nothing and Most searched. Look for a word people really type that search does not
          understand: a local name for a place, a common misspelling, a Nigerian word for a thing.
        </>,
        <>
          Under <strong>Aliases</strong>, write it in <strong>When people type</strong> and what it means in{" "}
          <strong>Read it as</strong>. Each side is 1 to 60 characters.
        </>,
        <>
          Choose the <strong>Kind</strong>. Word reads one set of words as another (buka as restaurant). Place points a
          nickname at a place Vallo already knows (Lekki 1 as Lekki Phase 1); one that points anywhere else is ignored.
        </>,
        <>
          Press <strong>Save alias</strong>, wait up to five minutes, and search it yourself in VALLO Intelligence.
        </>,
        <>
          If it makes results worse, press <strong>Switch off</strong>. Nothing is deleted, and every change is written
          to the audit log with your name.
        </>,
        <>Say in your weekly report which aliases you added or switched off, and why.</>,
      ],
      note: (
        <p>
          An alias changes every member&apos;s search. Never use one to push a listing, a lister or a place up the results,
          and never put a person&apos;s name or a number into one.
        </p>
      ),
    },
    {
      id: "translations",
      title: "Keep the translations honest",
      steps: [
        <>
          Open the <strong>Translations</strong> tab. For each piece, mark where it stands in English, Hausa, Yoruba and
          Igbo: not started, drafting, reviewed or live.
        </>,
        <>Never mark a language live where nobody who speaks it has read it.</>,
        <>Where a translation is late, ship in English, mark the language drafting, and tell the requester.</>,
        <>Say on the page itself where a translation is not ready, rather than letting a member find out.</>,
      ],
      note: (
        <TodayNote>
          Not every page exists in all four languages. A language marked drafting is exactly that, and the honest thing
          is to say so.
        </TodayNote>
      ),
    },
    {
      id: "feed",
      title: "The Feed tab, and where your part stops",
      steps: [
        <>Glance at the Feed tab daily: counts of open reports, held posts, stories and comments, and open feed and Circle cases.</>,
        <>You read counts, nothing more. The content and the decisions are moderation&apos;s.</>,
        <>Where a count jumps, tell the Head of Trust and Safety. That is the whole of your part.</>,
        <>
          Where something you see looks harmful or illegal, press <strong>Escalate</strong>, choose{" "}
          <strong>Safety</strong>, and tell the Head of Trust and Safety the same hour.
        </>,
      ],
    },
  ],
  standards: [
    { what: "The calendar", good: "Every item has an owner and a date, and nothing is past its planned date without a note." },
    { what: "Approval", good: "Nothing published without it, and every send-back fixed on exactly what the reason named." },
    { what: "Links", good: "Every published item has its link recorded the same day." },
    { what: "Accuracy", good: "Every fact traced to the desk that owns it. No unconfirmed fact published." },
    { what: "Help gaps", good: "The worst failing page is being worked on, not the easiest one." },
    { what: "Translations", good: "No language marked live that nobody read, and members told where one is not ready." },
  ],
  wordsUsed: [
    "\"A person at Vallo reviews every listing before it goes live.\"",
    "\"Vallo charges renters no fee.\"",
    "\"Vallo uses regulated payment partners to process eligible payments. Vallo does not hold customer funds.\"",
    "\"This page is not available in Hausa yet.\" Say it on the page.",
  ],
  wordsNever: [
    "Never that a payment, a listing or a person is covered, insured or carries no risk.",
    "Never that Vallo holds, keeps or looks after anybody's money.",
    "Never a date, a launch or any form of \"soon\".",
    "Never a member's name, review or photograph without written permission.",
    "Never an em dash. Short sentences and commas.",
  ],
  privacy: [
    "You hold no member data and you should never be given any. If somebody sends you a member's details for an article, refuse and tell the COO.",
    "A member's review, story or photograph goes in content only with their written permission, obtained by the desk that holds the relationship.",
    "The Feed tab is counts. Never ask moderation to show you the content behind one.",
    "An example in a guide is made up or generic. Never a real listing, a real address or a real person.",
    "A help page never shows a screenshot of the console or of a member's account.",
  ],
  copilotCannot: [
    "It will not publish anything, approve anything, or post to the feed.",
    "It drafts an outline or a staff announcement for you to add. Nothing is saved or posted until you add it.",
  ],
  copilotAsk: [
    "What is overdue on the calendar?",
    "Which help pages are failing members?",
    "Draft an outline for a help article on deposits",
  ],
  contacts: [
    { what: "Publishing, and a draft that touches a legal, safety or financial matter", who: "Chief Operating Officer" },
    { what: "Feed content that looks harmful or illegal", who: "Head of Trust and Safety, the same hour" },
    { what: "What members actually ask", who: "Customer Support Lead" },
    { what: "A figure about money", who: "Finance Officer" },
    { what: "Campaign copy and briefs", who: "Marketing Manager" },
    { what: "Images and video", who: "Social Media Manager, who holds the media library" },
  ],
};

export const TECHNICAL_ADMINISTRATOR: RoleWords = {
  who: "the Technical Administrator",
  keeps:
    "Members do not see your work when it goes well. They see it when a booking is slow, a page will not load or a payment seems stuck. Vallo's promise to answer on time rests on a platform that is working, and on somebody knowing quickly when it is not.",
  purpose: (
    <p>
      This job watches how the platform is doing from the console, keeps the record of technical incidents, writes the
      runbooks and notes that let the next person act without starting cold, and reads deployment information where
      authorised. The desk is read only about the platform: it shows no key, password or credential, and it changes no
      infrastructure. Anything that needs a change goes to the people who hold that access, with the facts you saw.
    </p>
  ),
  glance: [
    "Your access area is Technical. It opens the Technical desk and nothing else.",
    "The desk is read only. It never shows, asks for or stores a key, a password or a credential, and you never paste one into an incident update.",
    "A figure you cannot read is reported as not available, never as zero.",
    "A calm health panel is not proof. If members report a problem the panel does not show, believe the members and open an incident.",
    "A suspected leak of a key goes to the COO immediately, and the detail never goes in the log.",
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
      <Link href="/admin/manual/technical" className={A}>
        chapter 11 of the staff manual
      </Link>{" "}
      end to end.
    </>,
    <>
      Open{" "}
      <Link href="/admin/technical" className={A}>
        Technical
      </Link>
      . It opens on Health. Read the four counts, every scheduled job, which services are set up, and the release code.
    </>,
    <>Read the Errors tab: error types by day over fourteen days, and the comparison with the week before.</>,
    <>Read the Incidents tab, and the last three incidents end to end, including what changed afterwards.</>,
    <>Read every runbook that exists, and write down which incidents have none.</>,
  ],
  firstWeek: [
    <>Read Health every morning. Make it the first thing you do.</>,
    <>Declare one real incident, post an update, and resolve it with a written summary. Doing it once beats reading about it.</>,
    <>Write one runbook for an incident that had none.</>,
    <>Read the Reminders tab and chase anything running out within thirty days.</>,
    <>Read the Releases tab and the release notes, and learn to say in one sentence what is running.</>,
    <>Agree with the Operations Manager who owns which part of an incident, in writing.</>,
  ],
  alone: [
    "Read the health panel, the error trends, the release information and the reminders.",
    "Declare an incident with a severity, post an update every time the position changes, and reopen one that was closed too early.",
    "Resolve an incident with a written summary of what happened and what was done.",
    "Write and update runbooks, release notes, on-call handover notes and post-incident reviews.",
    "Draft status page wording for approval.",
  ],
  withSomebody: [
    "Anything that needs infrastructure, a key or the database changed: the people who hold that access, through the COO, with the facts you saw.",
    "An outage, a data incident or a payment failure affecting many members: the COO and the CEO at once.",
    "Status page wording: it needs approval before it goes out.",
    "A provider you suspect rather than us: the Operations Manager, who can run the provider checks.",
  ],
  never: [
    "Pasting a key, a token, a password or a database credential anywhere in the console. The desk refuses text that looks like one, and so should you.",
    "Changing infrastructure, a key or the database. This desk has no such control.",
    "Writing the detail of a suspected leak in the incident log.",
    "Reporting a figure you could not read as zero.",
    "Opening a member's data. This role has no access to listings, support, moderation or any member's data.",
  ],
  tasks: [
    {
      id: "health",
      title: "The morning health read",
      steps: [
        <>
          Open{" "}
          <Link href="/admin/technical" className={A}>
            Technical
          </Link>
          . It opens on Health. If a reminder is due within thirty days, a box at the top says so.
        </>,
        <>
          Read the four counts: jobs late, jobs whose last run failed, open error types, open alerts. A count marked Not
          available could not be read, so say so rather than assume it is fine.
        </>,
        <>
          Read the scheduled jobs. <em>On time</em> means the newest run is inside its allowed gap and did not fail.{" "}
          <em>Late</em> means no run for longer than allowed. <em>No run seen</em> means nothing in fourteen days.
        </>,
        <>Read which services are set up. It never shows a key. To test a provider live, ask Operations to run the provider checks.</>,
        <>Read what is running: the environment, the release code and the runtime. That is all the console says about a deployment.</>,
        <>Open the Errors tab and compare the last seven days with the seven before.</>,
      ],
      note: (
        <p>
          Health shows what the console can read. A job that ran and did the wrong thing looks on time. Where members
          report a problem the panel does not show, believe the members and open an incident.
        </p>
      ),
    },
    {
      id: "incident",
      title: "Run an incident in the log",
      steps: [
        <>
          Open the <strong>Incidents</strong> tab and <strong>declare</strong> one: a title, a severity from 1 (worst)
          to 4 (minor), and what you know.
        </>,
        <>Post an <strong>update</strong> every time the position changes, including when the change is &quot;still looking&quot;.</>,
        <>Write what you knew, when, and what you did. The log is the record, not a summary of one.</>,
        <>Never paste a key, a token or a password into an update. The desk refuses text that looks like one.</>,
        <>
          <strong>Resolve</strong> it with a written summary of what happened and what was done. There is an Undo on the
          banner.
        </>,
        <>Reopen it where it comes back. A closed incident that is still happening is worse than an open one.</>,
        <>Within a few days of a serious one, write the post-incident review: what happened, why, what went well, what changes.</>,
      ],
    },
    {
      id: "runbook",
      title: "Write a runbook",
      steps: [
        <>Start from an incident that has just finished, while you still remember the order you did things in.</>,
        <>Write how you knew: which panel, which count, which alert.</>,
        <>Write the steps in order, with the real tab and control names.</>,
        <>Write who to tell, by position, and how fast.</>,
        <>Write what members are told, so Support is not inventing it at midnight.</>,
        <>Read it again after the next incident, and correct it the same day.</>,
      ],
    },
    {
      id: "handover",
      title: "Reminders, releases and the handover",
      steps: [
        <>
          Read the <strong>Reminders</strong> tab weekly: certificates, domains, dependencies, licences and plans, with
          when each runs out and where to renew.
        </>,
        <>Chase anything inside thirty days through the COO, because renewing is not yours to do.</>,
        <>
          Keep the <strong>Releases</strong> tab current: the environment, the short release code, and release notes in
          plain words.
        </>,
        <>
          Write the <strong>On call and status</strong> handover note at each handover: what is open, what to watch, and
          what was tried.
        </>,
        <>Draft status page wording there too, and send it for approval before it goes out.</>,
      ],
      note: (
        <TodayNote>
          Who is on call out of hours, and how to reach them, is not written down in the console or the documents.
          Until the founder names it, the handover note is the only record of who was watching.
        </TodayNote>
      ),
    },
    {
      id: "leak",
      title: "A key or credential may have leaked",
      steps: [
        <>Do not write the detail anywhere: not in the incident log, not in an escalation, not in a message.</>,
        <>
          Tell the COO immediately, by whatever route reaches a person fastest. Press <strong>Escalate</strong>, choose{" "}
          <strong>Staff access</strong> or <strong>Operations or technical</strong>, and{" "}
          <strong>Urgent</strong>, saying only that a credential may be exposed.
        </>,
        <>Say what the exposure is in general terms: which service, roughly when, how you noticed.</>,
        <>Let the people who hold that access rotate it. You do not, and the desk cannot.</>,
        <>Afterwards, write the post-incident review with what changed, still without the detail.</>,
      ],
    },
  ],
  standards: [
    { what: "The morning read", good: "Health and Errors read every working day, with anything late or failing written down." },
    { what: "Incidents", good: "Declared while it is happening, updated every time the position changes, resolved with a written summary." },
    { what: "Runbooks", good: "Every incident that happened twice has one, and each has been read since the last incident." },
    { what: "Honesty", good: "Nothing reported as zero that could not be read. Nothing described as fine that members say is not." },
    { what: "Secrets", good: "No key, token or credential anywhere in the log, an update, or an escalation. Not once." },
    { what: "Reminders", good: "Nothing runs out unnoticed. Anything inside thirty days has an owner." },
  ],
  wordsUsed: [
    "\"Not available.\" For any figure the console could not read.",
    "\"Still looking, nothing new.\" An honest update beats silence.",
    "\"This needs infrastructure changed, so I have handed it to the people who hold that access, with what I saw.\"",
    "\"A credential may be exposed.\" The whole of what goes in writing.",
  ],
  wordsNever: [
    "Never a key, a token, a password, a connection string or a credential, anywhere.",
    "Never a time by which something will be fixed.",
    "Never \"nothing is wrong\" while members are saying something is.",
    "Never a member's identifier in an incident note.",
  ],
  privacy: [
    "This role has no access to listings, support, moderation or any member's data, and it should stay that way.",
    "The error tables show types, places and counts. The message, the stack and the people affected stay in the crash log under Operations.",
    "Never put a member's identifier, email or booking reference in an incident update. Counts and shapes only.",
    "Never paste a key, a token or a credential into any field. The desk refuses it, and the refusal is a guard, not a hurdle.",
    "An incident is a company record. Write it as though a regulator will read it, because one may.",
  ],
  copilotCannot: [
    "It will not change infrastructure, rotate a key, or resolve an incident.",
    "It reads health, error trends, the incident log, runbooks and reminders, never a key or a secret, and it drafts an update for you to add.",
  ],
  copilotAsk: [
    "Is anything late or failing today?",
    "How are errors trending this week?",
    "Draft a status page update for the open incident",
  ],
  contacts: [
    { what: "An outage, a data incident or a payment failure affecting many members", who: "Chief Operating Officer and the Chief Executive Officer, at once" },
    { what: "A key or credential that may have leaked", who: "Chief Operating Officer, immediately, without the detail" },
    { what: "Anything needing infrastructure, a key or the database changed", who: "The people who hold that access, through the COO" },
    { what: "A provider you suspect rather than us", who: "Operations Manager" },
    { what: "Status page wording", who: "Chief Operating Officer, or an admin, for approval" },
    { what: "What members are reporting", who: "Customer Support Lead" },
  ],
};
