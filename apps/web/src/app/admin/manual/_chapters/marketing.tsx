import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocFlow } from "@/components/docs/DocFlow";
import { DocTable } from "@/components/docs/DocTable";
import { A, type ManualBody } from "./parts";
import { aboutVallo } from "./role-shared";

/**
 * Chapter 9. Read from `app/admin/marketing`, `lib/admin/marketing` and
 * `lib/admin/desk-entries` on 10 November 2026: the tabs, the campaign and
 * approval moves, the tracked link builder, the figures the desk reads and
 * the refusals each action returns. When those change, this chapter changes.
 */
export const MARKETING: ManualBody = {
  intro: (
    <p>
      This chapter is for the Marketing Manager. You plan Vallo&apos;s campaigns and promotions, build the tracked links
      that show where sign-ups come from, log what each campaign brought in, keep budgets honest, and tell the COO each
      month what worked. Read it once from the top, then use it as a reference. It reports to the COO.
    </p>
  ),
  glance: [
    "Your desk is Marketing, in the Departments group of the sidebar. It holds nine tabs: Campaigns, Calendar, Tracked links, Results, Acquisition, Referrals, Briefs and tests, Audience and market, and Monthly report.",
    "A campaign is a draft until you send it for approval and the COO or an admin approves it. It goes live only when approved, and spends only what the approved budget says.",
    "Nothing connects to an ad platform or sends a message. You log the numbers from each platform's own dashboard, with the source in the note.",
    "A figure the console cannot read says Not available. It is never shown as zero, and you never write one as zero.",
    "You see no member's name, no listing, no ticket and no payment. Acquisition and referral figures are counts only.",
    "Every action you take shows one banner at the top of the screen, and the ones that can be reversed carry an Undo.",
  ],
  sections: [
    ...aboutVallo({
      who: "the Marketing Manager",
      keeps:
        "Marketing is the first thing most people meet. A true, plain campaign brings the right people in and sets honest expectations; a clever one that overpromises brings complaints to our support desk a week later. Your job is to be the person who makes the true thing attractive.",
    }),
    {
      id: "the-desk",
      title: "The desk and its nine tabs",
      body: (
        <>
          <p>
            Open{" "}
            <Link href="/admin/marketing" className={A}>
              Marketing
            </Link>
            . On a phone the tabs sit in a row you can slide sideways. The page opens on Campaigns.
          </p>
          <DocTable
            caption="The Marketing desk, tab by tab"
            columns={[
              { key: "tab", label: "Tab" },
              { key: "use", label: "What it is for" },
              { key: "when", label: "When you use it" },
            ]}
            rows={[
              { id: "campaigns", cells: { tab: "Campaigns", use: "Every campaign in three columns (planned and drafts, live and paused, ended), the approval state, budget against logged spend, and the form for a new one.", when: "Every day." } },
              { id: "calendar", cells: { tab: "Calendar", use: "Which campaigns run in each week of a month, and a warning when two use the same channel on overlapping dates.", when: "Planning, and before you add a campaign." } },
              { id: "links", cells: { tab: "Tracked links", use: "Builds a link with source, medium and campaign tags and copies it. Save the tags on a campaign to see the link on its card.", when: "Before any campaign goes out." } },
              { id: "results", cells: { tab: "Results", use: "Log a number (spend, impressions, clicks, sign-ups, listings created, referrals) against a campaign, see totals and the spend per logged sign-up.", when: "Weekly, from each platform's own dashboard." } },
              { id: "acquisition", cells: { tab: "Acquisition", use: "New accounts, listings created and referrals for the last eight weeks, from Vallo's own records.", when: "Weekly, and for the monthly report." } },
              { id: "referrals", cells: { tab: "Referrals", use: "People who signed up with a referral code per week, what became of them, and the referral campaigns' titles and dates.", when: "Weekly, and when planning a promotion." } },
              { id: "briefs", cells: { tab: "Briefs and tests", use: "Creative briefs for the Social Media Manager and the Content Manager, and the A/B test log.", when: "Before work is handed on, and after each test." } },
              { id: "audience", cells: { tab: "Audience and market", use: "Segment notes (who a campaign is for) and market notes (what you see in a city or a season).", when: "Whenever you learn something worth keeping." } },
              { id: "report", cells: { tab: "Monthly report", use: "A report builder that drafts the month from your campaigns and logged results, then the approval step for the finished report.", when: "In the last days of each month." } },
            ]}
          />
          <p>
            Beside the title is a link to the Social media desk. The Social Media Manager plans the posts that carry your
            campaigns; you do not need that access to brief them.
          </p>
        </>
      ),
    },
    {
      id: "campaign-flow",
      title: "Running a campaign, step by step",
      body: (
        <>
          <DocFlow
            label="A campaign from idea to the last number"
            steps={[
              { icon: "price-tag", title: "Plan", outcome: "A draft with a name, channel, audience, dates and, if you are authorised, a budget.", href: "/admin/marketing" },
              { icon: "link", title: "Tag", outcome: "A tracked link saved on the campaign.", href: "/admin/marketing?tab=links" },
              { icon: "clipboard-list", title: "Send for approval", outcome: "The COO or an admin reads it." },
              { icon: "check-circle", title: "Go live", outcome: "Approved, then moved to Live on its start date." },
              { icon: "bars", title: "Log", outcome: "Numbers from the platform, each with its source.", href: "/admin/marketing?tab=results" },
              { icon: "flag", title: "End and report", outcome: "Ended, and told in the monthly report." },
            ]}
          />
          <ol role="list">
            <li>
              <strong>Plan it.</strong> On Campaigns, under <em>New campaign</em>, write a name people on the team will
              recognise, the channel, the audience in a sentence, the start and end dates and the objective: what should
              be true when it is over. The budget is optional and you type it in naira. If you have no authority to commit
              a budget, leave it blank and say so in the notes. The campaign is saved as a draft and owned by you.
            </li>
            <li>
              <strong>Tag it.</strong> On Tracked links, pick the campaign, write the page the link points to, the source
              (where the link will sit, for example <em>instagram</em>), the medium (the kind of channel, for example{" "}
              <em>social</em>) and the campaign name. Add content and term only if you will test versions. The tags come
              out lower case with dashes. Press <strong>Copy link</strong> and the banner says it is copied. Press{" "}
              <strong>Save tags on the campaign</strong> so the link shows on the card, with its own Copy button.
            </li>
            <li>
              <strong>Send it for approval.</strong> On the campaign card, press <strong>Send for approval</strong>. It
              now reads Waiting for approval and you cannot edit it. If you must change something, an approver can send it
              back with a reason.
            </li>
            <li>
              <strong>Act on a send-back.</strong> A campaign sent back shows the reason on its card. Edit it, answer the
              reason, and send it again. A campaign changed after approval needs approval again: the approved version is
              what was agreed.
            </li>
            <li>
              <strong>Go live.</strong> Only an approved campaign can be moved to Live; the desk refuses otherwise, in so
              many words. Move it to Paused if you must stop it, and to Ended when it is over.
            </li>
            <li>
              <strong>Cancel, if you must.</strong> Cancelling shows a banner with <strong>Undo</strong>, which puts the
              campaign back as a draft that needs approval again. A cancelled campaign takes no new numbers.
            </li>
          </ol>
          <DocCallout tone="note" title="Who approves">
            The COO, the CEO or an admin approves. The person who made a campaign never approves it, whoever they are. An
            approver who is let into the desk only to approve can read every campaign and approve or send one back, and
            cannot create or change one.
          </DocCallout>
        </>
      ),
    },
    {
      id: "results",
      title: "Logging results and reading the totals",
      body: (
        <>
          <ol role="list">
            <li>
              Open <strong>Results</strong>. Choose the campaign, the date the number is for, what you are logging and the
              value. Spend is typed in naira; the desk stores it in kobo.
            </li>
            <li>
              In the note, write the source: <em>Instagram Insights, 8 November</em>. A number without a source is a
              number nobody can check, and the report builder repeats whatever is there.
            </li>
            <li>
              The totals table shows spend, budget, clicks, sign-ups and the spend per logged sign-up. If you logged spend
              but not sign-ups, the last column says Not available. It does not divide by guesswork.
            </li>
            <li>
              If you logged a wrong number, press <strong>Remove</strong> beside it. The banner offers{" "}
              <strong>Undo</strong>. A removed entry is kept on record but left out of every total.
            </li>
          </ol>
          <p>
            Logged spend above the approved budget turns the campaign&apos;s budget line to <em>over budget</em>. That is
            a signal to stop and tell the COO before anything more is committed; the desk will not stop you spending on the
            platform, because it cannot see the platform.
          </p>
        </>
      ),
    },
    {
      id: "figures",
      title: "Acquisition and referral figures",
      body: (
        <>
          <p>
            <strong>Acquisition</strong> shows, for each of the last eight Monday-start weeks in Lagos time, new accounts
            (internal and test accounts left out), listings created by a lister (example listings left out) and referrals
            attributed to an invite code. Each series is read on its own. If one cannot be read the table says Not
            available for that column and says so again underneath. Never fill it in.
          </p>
          <p>
            <strong>Referrals</strong> shows, per week, the people who signed up with a code, then how many of the last
            eight weeks&apos; referrals are not earned yet, earned and past review, or refused or taken back, and the
            titles, status and dates of the referral campaigns. Reward amounts and the Rewards Balance belong to Finance and
            are not on your desk. Use the numbers to judge whether a promotion is bringing people in, and ask Finance
            through the COO before you plan anything that changes what a reward costs.
          </p>
          <DocCallout tone="warning" title="What these figures cannot tell you">
            They are Vallo&apos;s own records. They do not say which campaign brought a person in. For that, use the
            tracked links and your logged results, and say plainly in a report when attribution is a guess.
          </DocCallout>
        </>
      ),
    },
    {
      id: "notes-and-briefs",
      title: "Briefs, tests, segments and market notes",
      body: (
        <>
          <p>
            These four small tools all work the same way. Each is a list of cards with a form underneath. A card has a
            reference you can copy (for example <em>CB-1A2B3C</em>), a Copy button for the whole text, and buttons to edit,
            mark done and retire. Retiring and marking done show a banner with Undo.
          </p>
          <ul role="list">
            <li>
              <strong>Creative brief.</strong> One page: the single message, the audience, the tone, what is needed, the
              call to action, what must not be said and the date it is needed. Write it so the Social Media Manager or the
              Content Manager can start without asking you anything. Mark it delivered when it is.
            </li>
            <li>
              <strong>A/B test.</strong> Write the question, version A, version B, what you measure and when it ends. When
              it finishes, record the result and what you will do next. A test that ended without a note is a test you will
              run again by accident.
            </li>
            <li>
              <strong>Audience segment.</strong> Renters, buyers, agents, landlords, hosts, restaurants, students: who they
              are, what worries them, roughly how many, where they are best reached.
            </li>
            <li>
              <strong>Market note.</strong> What you saw in a city or a season, where it came from and what it might mean.
              Separate fact from hunch in the first line.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "monthly-report",
      title: "The monthly performance report",
      body: (
        <>
          <ol role="list">
            <li>Open <strong>Monthly report</strong> in the last days of the month. Check the month shown.</li>
            <li>
              The builder drafts the month: each campaign that ran, with logged spend, clicks and sign-ups (or{" "}
              <em>not logged</em>), whether any campaign is over budget, and the account figure. Read every line against
              what you know.
            </li>
            <li>
              Add what worked, what did not and what you will do next month. Press <strong>Copy</strong> to take it
              elsewhere, or <strong>Save as draft report</strong>.
            </li>
            <li>
              On the saved report, press <strong>Send for approval</strong>. The COO or an admin approves or sends it back
              with a reason. Once approved it can be taken back to draft to edit, and then needs approval again.
            </li>
          </ol>
        </>
      ),
    },
    {
      id: "rhythm",
      title: "Your day, week and month",
      body: (
        <DocTable
          caption="The rhythm of the Marketing Manager"
          columns={[
            { key: "when", label: "When" },
            { key: "what", label: "What you do" },
          ]}
          rows={[
            { id: "day", cells: { when: "Every day", what: "Open My desk, then Campaigns. Anything sent back? Anything ending within seven days? Any campaign over budget? Answer the Copilot's summary with your own eyes." } },
            { id: "week", cells: { when: "Every week", what: "Log last week's numbers on Results with their sources. Read Acquisition and Referrals. Brief what is due. Update the A/B log. Write your weekly report." } },
            { id: "month", cells: { when: "Every month", what: "Build and send the monthly report. Retire finished briefs. Review segments and market notes. Plan next month on the Calendar." } },
          ]}
        />
      ),
    },
    {
      id: "weekly-report",
      title: "Your weekly report",
      body: (
        <>
          <p>
            Your{" "}
            <Link href="/admin/my-desk/weekly" className={A}>
              weekly report
            </Link>{" "}
            is prefilled with what the desk can count for the week: campaigns planned, approved and started, results
            logged, creative briefs written and A/B tests logged. You may change any figure, and a figure you change is
            marked as yours. Add what the desk cannot count: the reading of your numbers, what you are worried about, and
            what you need from others.
          </p>
        </>
      ),
    },
    {
      id: "copilot",
      title: "Using the Copilot",
      body: (
        <>
          <p>
            The Copilot button on your desk opens an assistant that can read this desk&apos;s counts and the figures
            above, build a tracked link, and draft a brief or the reading for your report. It never shows a budget amount or
            a member&apos;s name, saves nothing, sends nothing and approves nothing. A draft appears as a card; you read it,
            change it and add it yourself.
          </p>
          <ul role="list">
            <li>&ldquo;Which campaigns end this week?&rdquo;</li>
            <li>&ldquo;Show the campaign calendar for December.&rdquo;</li>
            <li>&ldquo;How did referrals do over the last eight weeks?&rdquo;</li>
            <li>&ldquo;Build a tracked link for the December push on Instagram, medium social.&rdquo;</li>
            <li>&ldquo;Draft a creative brief for a student rooms push in January. Tone warm and plain.&rdquo;</li>
          </ul>
          <p>
            If the Copilot says a figure is not available, believe it, and write the same in your report.
          </p>
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
            { id: "over-budget", cells: { situation: "A campaign shows over budget.", answer: "Stop adding spend on the platform. Message the COO: the campaign, the approved budget, what is logged, why. Ask for a decision before anything more is committed. Do not edit the budget down to hide it; that reopens approval." } },
            { id: "pressure", cells: { situation: "A colleague asks you to say a payment is safe in a promotion.", answer: "Say no kindly and offer the true line: what Vallo checks and who checks it, or how the payment partner handles the money. Vallo never holds customer money and does not use the words safe, protected or guaranteed without a named check behind them." } },
            { id: "no-source", cells: { situation: "You cannot find where a number came from.", answer: "Do not log it. Log what you can prove, or note that it is unknown. A missing number is honest; a doubtful one gets quoted." } },
            { id: "clash", cells: { situation: "Two campaigns clash on the same channel.", answer: "Check whether the audiences overlap. If they do, move one, or merge them. Tell the Social Media Manager so the calendar matches." } },
            { id: "lead", cells: { situation: "An agent writes to you asking for a refund of a promotion fee.", answer: "Money is not yours to decide. Thank them, give no promise, and pass it to the COO with the reference. Never say it will be refunded." } },
            { id: "complaint", cells: { situation: "A member complains about a promotion on social media.", answer: "Do not reply as Vallo. Pass it to the Social Media Manager and Support with the link. If it is about a safety or legal matter, the COO the same day." } },
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
            <li>Never act on money: no refunds, payouts, rewards or reversals. You do not have those tools and you do not ask a colleague to use theirs for you.</li>
            <li>Never copy a member&apos;s details into a campaign, a brief or a report.</li>
            <li>Never commit spend beyond an approved budget, or change a budget after approval without approval again.</li>
            <li>Never publish a promise on legal, safety or financial matters without the COO.</li>
            <li>Never describe Vallo as holding customer money.</li>
          </ul>
          <DocTable
            caption="Where to take it"
            columns={[
              { key: "what", label: "What" },
              { key: "who", label: "Who" },
              { key: "how", label: "How fast" },
            ]}
            rows={[
              { id: "budget", cells: { what: "Spend that would pass the approved budget", who: "The COO", how: "Before it is committed" } },
              { id: "statement", cells: { what: "A statement on a legal, safety or financial matter", who: "The COO", how: "Before it goes out" } },
              { id: "harm", cells: { what: "A member says a promotion led them into harm", who: "The Head of Trust and Safety and the COO", how: "At once" } },
              { id: "tech", cells: { what: "A tracked link or page that is broken", who: "The Technical Administrator", how: "The same day" } },
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
            { id: "utm", cells: { word: "UTM tag", means: "A label on the end of a link (source, medium, campaign) that lets analytics say where a visit came from." } },
            { id: "cpa", cells: { word: "Spend per logged sign-up", means: "Logged spend divided by logged sign-ups, shown only when both exist." } },
            { id: "attrib", cells: { word: "Attributed", means: "A person who signed up using someone's referral code." } },
            { id: "segment", cells: { word: "Segment", means: "A group of members who share a need, such as final-year students." } },
            { id: "ab", cells: { word: "A/B test", means: "Showing two versions to similar people to see which does better." } },
            { id: "kobo", cells: { word: "Kobo", means: "One hundredth of a naira. The desk stores money in kobo and shows naira." } },
            { id: "ref", cells: { word: "Reference", means: "The short code on a card, like CB-1A2B3C, that you can copy and quote." } },
          ]}
        />
      ),
    },
  ],
};
