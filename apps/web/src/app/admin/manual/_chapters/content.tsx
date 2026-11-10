import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocFlow } from "@/components/docs/DocFlow";
import { DocTable } from "@/components/docs/DocTable";
import { A, type ManualBody } from "./parts";
import { aboutVallo } from "./role-shared";

/**
 * Chapter 10. Read from `app/admin/content`, `lib/admin/content` and
 * `lib/admin/desk-entries` on 10 November 2026: the tabs, the item moves and
 * their approval, the checklists and the cross-desk reads (feed counts and
 * Pages that fail, as counts only). When those change, this chapter changes.
 */
export const CONTENT: ManualBody = {
  intro: (
    <p>
      This chapter is for the Content Manager. You write and look after Vallo&apos;s own words: guides, announcements,
      articles, brand material and the help pages members rely on. You send each piece through an approval step before it
      goes out, keep the calendar honest, watch what members say did not help, and tell other desks what is ready. You
      report to the COO.
    </p>
  ),
  glance: [
    "Your desk is Content, in the Departments group. Its tabs are Items, Calendar, Requests, Style and SEO, Translations, Publishing, Help gaps and Feed.",
    "An item moves draft, in review, approved, published. Only a draft is edited. Approval is by the COO or an admin, never by the person who wrote it.",
    "The desk holds text and links only. Images and video live in the Social media library.",
    "Feed moderation is shown to you as counts. You cannot open the queue, and the decisions stay with moderation.",
    "Nothing on the desk publishes anything: you record where a piece went live and the link.",
    "Every action shows one banner, and those that can be reversed carry Undo.",
  ],
  sections: [
    ...aboutVallo({
      who: "the Content Manager",
      keeps:
        "Words are how Vallo keeps its promises out loud. A help article that is clear saves a member a worry and our support desk a ticket; a vague one costs both. When you write plainly and say only what is true, you are doing the most visible part of keeping faith with members.",
    }),
    {
      id: "the-desk",
      title: "The desk and its tabs",
      body: (
        <>
          <p>
            Open{" "}
            <Link href="/admin/content" className={A}>
              Content
            </Link>
            .
          </p>
          <DocTable
            caption="The Content desk, tab by tab"
            columns={[
              { key: "tab", label: "Tab" },
              { key: "use", label: "What it is for" },
              { key: "when", label: "When you use it" },
            ]}
            rows={[
              { id: "items", cells: { tab: "Items", use: "Guides, announcements, articles, brand notes and campaign copy in three columns (drafts; in review and approved; published), the approval step, and the form for a new item.", when: "Every day." } },
              { id: "calendar", cells: { tab: "Calendar", use: "Items by the week they are planned for, with an earlier and a later month, and the items with no date yet.", when: "Planning, and the Monday check." } },
              { id: "requests", cells: { tab: "Requests", use: "An inbox of what other departments ask for, who is waiting, how urgent, and by when.", when: "Every day." } },
              { id: "style", cells: { tab: "Style and SEO", use: "The style guide (rules with examples) and an SEO checklist for each article.", when: "While writing and before publishing." } },
              { id: "translations", cells: { tab: "Translations", use: "For each piece, where it stands in English, Hausa, Yoruba and Igbo: not started, drafting, reviewed, live.", when: "Weekly." } },
              { id: "publishing", cells: { tab: "Publishing", use: "The publishing checklist, and drafts of staff announcements.", when: "Before anything goes live." } },
              { id: "gaps", cells: { tab: "Help gaps", use: "Pages members say did not help (from Pages that fail), the knowledge-base gaps support keeps, and the gaps you are working.", when: "Weekly." } },
              { id: "feed", cells: { tab: "Feed", use: "Counts only: open reports, held posts, stories and comments, open feed and Circle cases.", when: "Daily glance." } },
            ]}
          />
        </>
      ),
    },
    {
      id: "item-flow",
      title: "Taking a piece from idea to published",
      body: (
        <>
          <DocFlow
            label="One item, start to finish"
            steps={[
              { icon: "file-text", title: "Draft", outcome: "Title, kind, summary, text and a planned date.", href: "/admin/content" },
              { icon: "file-search", title: "Check", outcome: "SEO checklist and style rules run." },
              { icon: "clipboard-list", title: "Send for approval", outcome: "The COO or an admin reads it." },
              { icon: "circle-check", title: "Approved", outcome: "Ready to publish." },
              { icon: "link", title: "Publish", outcome: "You put it live and record the link." },
              { icon: "history", title: "Look after", outcome: "Retire it when it goes out of date." },
            ]}
          />
          <ol role="list">
            <li>
              <strong>Create the draft.</strong> On Items, under <em>New item</em>, choose the kind, write a clear title, a
              sentence of summary, and the text (Markdown, up to twenty thousand characters). Add a planned date and, for a
              brand note, the link to the source. Press <strong>Create draft</strong>.
            </li>
            <li>
              <strong>Check it.</strong> On Style and SEO add an SEO checklist for the article and tick each box as it is
              true. On Publishing add a publishing checklist. These do not block the item, they make sure you looked.
            </li>
            <li>
              <strong>Send for approval.</strong> Press <strong>Send for approval</strong>. Anything that touches a legal,
              safety or financial matter goes to the COO first, in person, before it reaches the button.
            </li>
            <li>
              <strong>Act on a send-back.</strong> A draft sent back shows the reason. Edit it and send it again.
            </li>
            <li>
              <strong>Publish it.</strong> When an approved item goes live on its channel, press{" "}
              <strong>Mark as published</strong>, paste the live link, and choose the date if it was not today. The link is
              required for a guide, an announcement, an article and campaign copy. The item now reads Published and its
              link has a Copy button.
            </li>
            <li>
              <strong>Retire it.</strong> A draft or a published item that is out of date can be retired. The banner has an
              Undo that brings it back as a draft which needs approval again.
            </li>
          </ol>
          <DocCallout tone="note" title="Approval is two people">
            The person who wrote an item never approves it, even if they are an admin. If you are the only person who knows
            enough to check it, ask a colleague to read it before the approver does.
          </DocCallout>
        </>
      ),
    },
    {
      id: "requests-and-style",
      title: "Requests, the style guide and the checklists",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>Requests.</strong> When another department needs words, log the ask on Requests: what is needed,
              the details, who asked, how urgent, who to speak to (a name or a desk, never a phone number) and the date it
              is needed. Mark it delivered when it ships. Answer an urgent one the same day, even if the answer is a date.
            </li>
            <li>
              <strong>Style and tone.</strong> One card per rule. Write the rule, an example of what to do and what not to
              do, and where it applies. When a colleague asks how we say something, send them the card&apos;s Copy text.
            </li>
            <li>
              <strong>SEO checklist.</strong> For each article: the phrase a person would search; a title that says what the
              page is; a description under a hundred and sixty characters; one main heading and clear sub-headings; links to
              two related Vallo pages that open; plain alt text on each image; a short readable address. The card counts the
              ticked boxes.
            </li>
            <li>
              <strong>Publishing checklist.</strong> Facts confirmed with the desk that owns them; money wording right;
              no promise of safety or protection for a payment; approved; links open; languages ready; date and
              channel agreed; staff told if they will get questions.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "translations",
      title: "Translations: English, Hausa, Yoruba and Igbo",
      body: (
        <>
          <p>
            Make one Translation card for each piece that needs more than English. Set each language to Not started,
            Drafting, Reviewed or Live. A piece is Live in a language only when a fluent person has read it. If the Hausa
            is not ready, the piece goes out in English and says so; it never goes out in a machine translation nobody has
            read. Put the name of the translator and the reviewer in the notes. Mark the card complete when all four
            languages the piece needs are Live.
          </p>
        </>
      ),
    },
    {
      id: "help-gaps",
      title: "Help gaps: where members are not being helped",
      body: (
        <>
          <ol role="list">
            <li>
              Open <strong>Help gaps</strong>. The first panel lists the pages members marked as not helpful in the last
              thirty days, worst first, with the counts. Each page has a Copy button for its address.
            </li>
            <li>
              The second panel is the Customer Support Lead&apos;s list of questions the team keeps answering. It is read
              only; the Lead marks a gap answered once you publish.
            </li>
            <li>
              For each page or question you will fix, add a Help gap card with what is missing and a date to fix it by.
              Mark it fixed when the new text is live.
            </li>
          </ol>
          <p>
            If the first panel says page feedback is not switched on, the feature is waiting on the lead to apply a
            database change. Say so in your report; do not read the empty list as good news.
          </p>
        </>
      ),
    },
    {
      id: "feed",
      title: "The Feed tab, and where your part stops",
      body: (
        <>
          <p>
            Feed shows open reports, posts, stories and story comments held for review, and open feed and Circle cases, as
            counts. A count that could not be read says Not available. You use these to notice that something is unusual
            and to tell the Head of Trust and Safety. You do not decide anything about a post or a person, and you cannot
            open the queue. Content that looks harmful or illegal goes to the Head of Trust and Safety the same hour, with
            the link and no commentary.
          </p>
        </>
      ),
    },
    {
      id: "rhythm",
      title: "Your day, week and month",
      body: (
        <DocTable
          caption="The rhythm of the Content Manager"
          columns={[
            { key: "when", label: "When" },
            { key: "what", label: "What you do" },
          ]}
          rows={[
            { id: "day", cells: { when: "Every day", what: "Open My desk, then Content. Any request urgent? Any item sent back? Anything past its planned date? Glance at Feed counts." } },
            { id: "week", cells: { when: "Every week", what: "Run the calendar for the week. Update Translations. Read Help gaps and pick the worst. Retire what is stale. Write your weekly report." } },
            { id: "month", cells: { when: "Every month", what: "Review the style guide against what went out. Check every published item still says what is true. Plan next month on the Calendar." } },
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
          is prefilled with items started, approved and published, requests received, help gaps logged and checklists
          run. Change any figure that is wrong and it is marked as yours. Add what the desk cannot count: what you learned
          from the pages members found unhelpful, and what you need from other desks.
        </p>
      ),
    },
    {
      id: "copilot",
      title: "Using the Copilot",
      body: (
        <>
          <p>
            The Copilot can read the calendar, requests, checklists, translation status and help gaps, give the feed
            counts, and draft an outline, a first version or a staff announcement. It saves nothing, publishes nothing and
            approves nothing: a draft appears as a card for you to read, change and add. Check every fact it states against
            the desk that owns it.
          </p>
          <ul role="list">
            <li>&ldquo;What is overdue on the calendar?&rdquo;</li>
            <li>&ldquo;Which requests are urgent?&rdquo;</li>
            <li>&ldquo;Which help pages are failing members this month?&rdquo;</li>
            <li>&ldquo;Draft an outline for a help article on how deposits work. Plain words, no promises.&rdquo;</li>
            <li>&ldquo;Draft a short staff announcement that the new deposits article is live.&rdquo;</li>
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
            { id: "fact", cells: { situation: "A department wants an article out today and cannot confirm a fact.", answer: "Publish what is confirmed and leave out the rest, or hold. Write in the request card what is missing and who owns it. An article with a wrong fact costs more than a late one." } },
            { id: "safe", cells: { situation: "A draft promises that payments carry no risk.", answer: "Change it to what is true and checkable: who processes the payment and what the member can see. Vallo never holds customer money. Do not promise safety or protection without a named check behind it." } },
            { id: "yoruba", cells: { situation: "The Yoruba translation is late.", answer: "Ship in English, mark Yoruba Drafting, and tell the requester. Do not use an unread translation." } },
            { id: "oldlink", cells: { situation: "A published article has a dead link.", answer: "Fix it now if you can, and note it on the card. If it points to a page owned by another desk, tell them." } },
            { id: "harm", cells: { situation: "A feed post looks harmful or illegal.", answer: "Do not engage. Send the link to the Head of Trust and Safety the same hour. You see counts, not the decision." } },
            { id: "refuse", cells: { situation: "You are asked to publish a statement on a legal matter.", answer: "Not without the COO. Send the draft with a line on what it commits Vallo to." } },
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
            <li>Never publish anything about a member, a payment, a legal matter or an internal decision without the approval this role asks for.</li>
            <li>Never describe Vallo as holding anyone&apos;s money.</li>
            <li>Never copy a member&apos;s details into an article, an example or a request.</li>
            <li>Never act on a moderation case, a listing or a ticket. You read counts and write words.</li>
            <li>Never store media here. Images and video belong in the Social media library.</li>
          </ul>
          <DocTable
            caption="Where to take it"
            columns={[
              { key: "what", label: "What" },
              { key: "who", label: "Who" },
              { key: "how", label: "How fast" },
            ]}
            rows={[
              { id: "legal", cells: { what: "A draft that touches a legal, safety or financial matter", who: "The COO", how: "Before it is sent for approval" } },
              { id: "harm", cells: { what: "Feed content that looks harmful or illegal", who: "The Head of Trust and Safety", how: "The same hour" } },
              { id: "fact", cells: { what: "A fact you cannot confirm", who: "The desk that owns it", how: "Before publishing" } },
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
            { id: "item", cells: { word: "Item", means: "One guide, announcement, article, brand note or piece of campaign copy." } },
            { id: "approval", cells: { word: "Approval", means: "A second person's yes, recorded with their name and the date." } },
            { id: "seo", cells: { word: "SEO", means: "Writing so that the people searching for an answer can find the page." } },
            { id: "alt", cells: { word: "Alt text", means: "A plain description of an image for people who cannot see it." } },
            { id: "retire", cells: { word: "Retire", means: "Take out of use without deleting. It can be put back." } },
            { id: "gap", cells: { word: "Help gap", means: "A question members have that a page does not answer well." } },
            { id: "markdown", cells: { word: "Markdown", means: "A simple way of marking headings and lists with plain characters." } },
          ]}
        />
      ),
    },
  ],
};
