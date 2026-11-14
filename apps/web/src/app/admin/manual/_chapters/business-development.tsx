import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocFlow } from "@/components/docs/DocFlow";
import { DocTable } from "@/components/docs/DocTable";
import { A, type ManualBody } from "./parts";
import { aboutVallo } from "./role-shared";

/**
 * Chapter 13. Read from `app/admin/business-development`,
 * `lib/admin/business-development` (actions, reads, pipeline) and the console
 * step-up screen on 14 November 2026: how the desk is reached, what each part
 * of it does, what each action records and refuses. When those change, this
 * chapter changes.
 */
export const BUSINESS_DEVELOPMENT: ManualBody = {
  intro: (
    <p>
      This chapter is for the Business Development Director. You bring in the landlords, agents, hotels, shortlet hosts
      and restaurants Vallo lists, and you review their listings before they go live. Your work lives on two desks:
      Business development, where every prospect is kept, and Listings, where a submitted listing is approved, sent back
      or rejected. You report to the COO.
    </p>
  ),
  glance: [
    "Your pipeline is kept in the console, on the Business development desk. It is the record: you do not need a separate tool for it.",
    "Every prospect has a stage, a next follow-up date and a history of what was said. What is due comes first in the table.",
    "Logging a contact needs its outcome. A first contact moves a new prospect to Contacted for you.",
    "Onboarded and a linked listing are two separate facts. A business can be onboarded with no listing yet.",
    "Listing review is on the Listings desk. A rejection or a request for changes always carries a reason the lister reads.",
    "The table downloads as a spreadsheet whenever you need to share or keep a copy.",
  ],
  sections: [
    ...aboutVallo({
      who: "the Business Development Director",
      keeps:
        "Every landlord, agent, hotel and restaurant you bring in is somebody a member will later deal with. What you tell a prospect about fees, review and timing has to match what the platform does, and a listing you approve is one a renter will rely on.",
    }),
    {
      id: "getting-in",
      title: "Getting to your desks",
      body: (
        <>
          <DocFlow
            label="From signing in to your desk"
            steps={[
              { icon: "user", title: "Sign in", outcome: "With your own Vallo account, the one that was given staff access." },
              { icon: "grid", title: "Open the console", outcome: "The console is the Vallo address followed by /admin.", href: "/admin" },
              { icon: "key", title: "Confirm with your security key", outcome: "Once each time you sign in, and again after twelve hours." },
              { icon: "document", title: "Read the handbook", outcome: "Acknowledge it once; a new version asks again.", href: "/admin/handbook" },
              { icon: "hand-coins", title: "Open Business development", outcome: "Your pipeline and the count of listings waiting on you.", href: "/admin/business-development" },
            ]}
          />
          <DocCallout tone="note" title="If your security key does not answer">
            Your key is the Face ID, fingerprint or screen lock of the device where you set it up. If that was your phone
            and you are on a computer, either open the console on the phone, or press Confirm on the computer and choose
            the option to use a phone or tablet, then scan the code with that phone. If the device is lost, ask a super
            admin to clear the key on the Staff desk so you can set up a new one.
          </DocCallout>
          <p>
            Where the desks are: on the console&apos;s first page, under Your desks. In the menu, Business development is in the
            Departments group, and{" "}
            <Link href="/admin/listings" className={A}>
              Listings
            </Link>{" "}
            is in the same group under Listing verification.
          </p>
        </>
      ),
    },
    {
      id: "the-desk",
      title: "What is on the Business development desk",
      body: (
        <DocTable
          caption="The Business development desk, part by part"
          columns={[
            { key: "part", label: "Part" },
            { key: "use", label: "What it is for" },
          ]}
          rows={[
            { id: "week", cells: { part: "This week", use: "Prospects added, contacts logged, follow-ups done and businesses onboarded in the last seven days, with the all-time figures under them." } },
            { id: "listings", cells: { part: "Listing approval", use: "How many listings are waiting on a review decision, and the button that opens the Listings desk." } },
            { id: "due", cells: { part: "Follow-ups due this week", use: "Every open prospect whose follow-up date has passed or falls in the next seven days, soonest first." } },
            { id: "add", cells: { part: "Add a prospect", use: "The short form that puts a new business into the pipeline." } },
            { id: "pipeline", cells: { part: "Pipeline", use: "The table of every prospect: search, stage filters, category filter, the record under each row, and the spreadsheet download." } },
          ]}
        />
      ),
    },
    {
      id: "add-a-prospect",
      title: "Adding a prospect",
      body: (
        <>
          <p>
            Add a business the moment you have a name and a way to reach them. You do not need everything; the rest is
            filled in from the record later.
          </p>
          <ol>
            <li>Type the business name and the person you are talking to.</li>
            <li>Choose the category: landlord, estate agent, hotel, shortlet operator, restaurant or other business.</li>
            <li>Give an email or a phone number. One of the two is required, because a prospect nobody can reach is not a prospect.</li>
            <li>Add the location if you know it, for example Lekki, Lagos.</li>
            <li>Press Add to pipeline. The prospect appears in the table at the stage New, assigned to you.</li>
          </ol>
        </>
      ),
    },
    {
      id: "stages",
      title: "The stages, and when to move one",
      body: (
        <>
          <DocTable
            caption="Pipeline stages"
            columns={[
              { key: "stage", label: "Stage" },
              { key: "means", label: "Use it when" },
            ]}
            rows={[
              { id: "new", cells: { stage: "New", means: "You have the business and a contact route, and have not spoken yet." } },
              { id: "contacted", cells: { stage: "Contacted", means: "You have reached out at least once. Logging a first contact sets this for you." } },
              { id: "interested", cells: { stage: "Interested", means: "They have said they want to hear more or to list." } },
              { id: "meeting", cells: { stage: "Meeting scheduled", means: "A call, visit or meeting has a date." } },
              { id: "negotiation", cells: { stage: "Negotiation", means: "You are discussing terms, fees or what they will list." } },
              { id: "proposal", cells: { stage: "Proposal sent", means: "They hold something in writing from Vallo and you are waiting on their answer." } },
              { id: "agreement", cells: { stage: "Agreement pending", means: "They have said yes and the last step (an account, a mandate, documents) is outstanding." } },
              { id: "onboarded", cells: { stage: "Onboarded", means: "The business is on Vallo and able to list. The date is recorded when you choose this stage." } },
              { id: "rejected", cells: { stage: "Rejected", means: "It will not go ahead, from their side or ours. Log a note saying why." } },
            ]}
          />
          <p>
            To move a prospect, open its row and choose the new stage. The change is saved at once and written into the
            history. Onboarded and Rejected prospects leave the Open view and stay under their own stage and under
            Everything.
          </p>
        </>
      ),
    },
    {
      id: "working-the-pipeline",
      title: "Keeping every prospect in the pipeline",
      body: (
        <>
          <DocFlow
            label="After every conversation"
            steps={[
              { icon: "search", title: "Find the prospect", outcome: "Search by business, person, phone number or place, or filter by stage." },
              { icon: "eye", title: "Open the row", outcome: "The record shows how to reach them, the stage, the next follow-up and the history." },
              { icon: "pencil", title: "Log what happened", outcome: "A contact with its outcome, a follow-up, or a note." },
              { icon: "history", title: "Set the next follow-up", outcome: "The date you will next act. Clear it when there is nothing more to do." },
              { icon: "trending-up", title: "Move the stage", outcome: "Only when the position has really changed." },
            ]}
          />
          <ul role="list">
            <li>
              <strong>The order of the table.</strong> Overdue follow-ups first, then today, then by date, then prospects
              with no date, newest first. Start at the top each morning.
            </li>
            <li>
              <strong>The marks.</strong> Overdue means the date has passed. Today and This week say how close a date is.
              A prospect with no date shows Not set: give every open prospect a date so none is forgotten.
            </li>
            <li>
              <strong>A contact needs an outcome.</strong> Write what was said in What happened, and the result in
              Outcome, for example interested and wants a call next week. A follow-up or a note needs no outcome.
            </li>
            <li>
              <strong>Calling and writing.</strong> In the record, the phone number starts a call on a phone and the
              email address opens a new message.
            </li>
            <li>
              <strong>Correcting details.</strong> Edit details changes the business name, the person, the category, the
              contact routes, the location and the standing notes. An email or a phone number must remain.
            </li>
          </ul>
          <DocCallout tone="note" title="The console is the record">
            Keep the pipeline here, not in a separate tool. The figures on this desk, your weekly report and the
            assistant on this desk read this table, so a prospect kept elsewhere is counted nowhere.
          </DocCallout>
        </>
      ),
    },
    {
      id: "onboarded-and-listings",
      title: "Onboarded, and the listing a business produced",
      body: (
        <>
          <p>
            Onboarded means the business is on Vallo and able to list. It does not mean a listing exists, and it does not
            mean one was approved. The desk reports the two apart so neither figure flatters the other.
          </p>
          <p>
            When a business you brought in submits a listing, link it: open the listing on the Listings desk, copy its
            ID from the page address, and paste it into Listing this business produced in the prospect&apos;s record.
            Saving an empty box removes the link. A link is never set for you.
          </p>
        </>
      ),
    },
    {
      id: "spreadsheet",
      title: "Downloading the pipeline",
      body: (
        <p>
          Download as a spreadsheet saves the rows you are looking at (after any search or filter) as a file a
          spreadsheet opens: business, contact, category, email, phone, location, stage, next follow-up, the last
          activity and its date, whether it is onboarded and whether a listing is linked. The file holds people&apos;s
          contact details, so share it only with colleagues who need it and delete copies you no longer use.
        </p>
      ),
    },
    {
      id: "listing-review",
      title: "Reviewing listings",
      body: (
        <>
          <p>
            Your second desk is{" "}
            <Link href="/admin/listings" className={A}>
              Listings
            </Link>
            . You review a submitted listing&apos;s photographs, description, price, fees and the mandate or ownership
            evidence behind it, then approve it, send it back for changes or reject it. Sending back and rejecting both
            need a written reason, and the lister reads it exactly as you wrote it.
          </p>
          <p>
            The steps are in{" "}
            <Link href="/admin/manual/queues" className={A}>
              Working a queue
            </Link>
            , and what you may decide on your own is in{" "}
            <Link href="/admin/manual/decisions" className={A}>
              What you may decide alone
            </Link>
            . You never review a listing of your own or of a business you have a personal interest in: pass it to
            another reviewer.
          </p>
        </>
      ),
    },
    {
      id: "reporting",
      title: "Your weekly report, and what is written down",
      body: (
        <>
          <p>
            Each week you report on the pipeline: who you are talking to, what is close and what is stuck. The form and
            what is filled in for you are in{" "}
            <Link href="/admin/manual/weekly-report" className={A}>
              Weekly report
            </Link>
            .
          </p>
          <p>
            Adding a prospect, changing its details, moving its stage, linking a listing and logging activity are each
            written to the audit log with your name and the time. The history under a prospect cannot be edited or
            removed, so write it as you would want it read back.
          </p>
        </>
      ),
    },
  ],
};
