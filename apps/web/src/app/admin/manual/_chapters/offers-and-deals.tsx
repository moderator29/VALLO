import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { A, ScreenshotSlot, type ManualBody } from "./parts";

/**
 * Chapter 20, from the retired staff manual's "The Offers and Deals desk"
 * page (16 November 2026), read again against the desk itself:
 * `app/admin/offers/page.tsx` and `[id]/page.tsx` (the door is
 * `requireAdmin("agreements")`), the figures and their definitions in
 * `app/admin/offers/model.ts` (METRICS, RESPONSE_DEFINITION,
 * ACCEPTANCE_DEFINITION, NO_REVENUE_NOTE, read here as words because a
 * chapter keeps its prose in one place), the window in `reads.ts` (seven
 * days), the table in `OffersTable.tsx`, the deal in `DealView.tsx`, and the
 * intervention in `Intervention.tsx` and `adminIntervene`
 * (`lib/offers/actions.ts`, a reason of at least ten characters,
 * `admin_sale_offer_intervene`).
 */

const FIGURES: DocTableRow[] = [
  { id: "submitted", cells: { figure: "Submitted", means: "Offers sent in the last 7 days." } },
  { id: "new", cells: { figure: "New", means: "Open offers the seller has not acted on or opened since they arrived." } },
  { id: "awaiting", cells: { figure: "Awaiting seller", means: "Open offers where the next move is the seller's." } },
  { id: "negotiating", cells: { figure: "Negotiating", means: "Open offers with more than one version." } },
  { id: "agreed", cells: { figure: "Terms agreed", means: "Offers where both sides confirmed the same version. Not sales." } },
  { id: "withdrawn", cells: { figure: "Withdrawn", means: "Offers the buyer withdrew." } },
  { id: "expired", cells: { figure: "Expired", means: "Offers that passed their stated expiry with no answer." } },
  { id: "completed", cells: { figure: "Completed", means: "Deals where both sides recorded completion." } },
  { id: "disputed", cells: { figure: "Disputed", means: "Deals with a concern open in the cases desk." } },
  { id: "response", cells: { figure: "Median response", means: "Median hours from an offer arriving to the seller's first action, over offers that have had one." } },
  { id: "acceptance", cells: { figure: "Acceptance rate", means: "Terms agreed divided by offers that reached an answer (agreed or declined). Open, withdrawn and expired offers are not counted." } },
];

const ACTIONS: DocTableRow[] = [
  { id: "note", cells: { action: "Add a staff note", does: "Recorded on the deal. Neither party is changed.", when: "Always." } },
  { id: "flag", cells: { action: "Flag a dispute", does: "Opens or links a case in the cases desk.", when: "When no dispute is flagged." } },
  { id: "resolve", cells: { action: "Resolve the dispute", does: "Closes the flag once the case is decided.", when: "When a dispute is flagged." } },
  { id: "cancel", cells: { action: "Cancel the deal", does: "Ends the deal and keeps the full history. Agreed terms are never edited.", when: "Only while the offer is open or its terms are agreed." } },
];

export const OFFERS_AND_DEALS: ManualBody = {
  intro: (
    <p>
      The{" "}
      <Link href="/admin/offers" className={A}>
        Offers and deals
      </Link>{" "}
      desk follows every offer on a home for sale, from the first offer to the end of the deal. Vallo records offers and
      takes none of the money. This chapter says what the figures mean, how to read a deal, the three things staff may
      do, and what you may say to a member.
    </p>
  ),
  glance: [
    "It opens to the Agreement approval area and to admins, the same door as the Agreements desk.",
    "Every figure shows its definition. There is no money total, because Vallo does not receive the purchase price.",
    "You read terms, versions, activity and the state of each document. You never see a buyer's identity data or a document's contents here.",
    "You can add a note, flag or resolve a dispute, and cancel a deal. Nobody can change a figure, a version or who agreed to what.",
  ],
  sections: [
    {
      id: "overview",
      title: "The overview figures",
      body: (
        <>
          <p>
            The desk opens on the last 7 days. Each figure is a count with its definition printed under it. A figure
            with no definition is not shown.
          </p>
          <DocTable
            caption="The overview figures and what each means"
            columns={[
              { key: "figure", label: "Figure" },
              { key: "means", label: "What it counts" },
            ]}
            rows={FIGURES}
          />
          <DocCallout tone="note" title="No revenue here">
            Vallo takes no money for a purchase. The value of agreed offers is not Vallo revenue, and the desk never shows
            it as a total. Never present it as revenue in a report.
          </DocCallout>
        </>
      ),
    },
    {
      id: "deals-table",
      title: "The deals table",
      body: (
        <>
          <p>
            Under the figures is every deal. The table only reads. Every row opens the deal on its own page.
          </p>
          <ul role="list">
            <li>
              <strong>Filter</strong> by state: All, Open, Terms agreed, Declined, Withdrawn, Expired or Cancelled. Two more
              filters show only disputed deals, or only deals with no signed sale mandate on record.
            </li>
            <li>
              <strong>Search</strong> by reference, property, buyer, seller or agent. Press / to jump to the search box.
            </li>
            <li>
              <strong>Sort</strong> by the offer&apos;s figure, when it was submitted, or its last activity.
            </li>
          </ul>
          <ScreenshotSlot desk="the Offers and deals desk" />
        </>
      ),
    },
    {
      id: "inspect",
      title: "Reading a deal",
      body: (
        <>
          <p>A deal&apos;s page shows:</p>
          <ul role="list">
            <li>
              <strong>Terms now:</strong> the current offer against the asking price, how the buyer means to pay, the
              stage, whether a sale mandate is on record, and whether the buyer is eligible. You see the outcome of that
              check only, never the buyer&apos;s identity data.
            </li>
            <li>
              <strong>Versions:</strong> every version in order, who proposed it, what changed, and whether each side
              confirmed it.
            </li>
            <li>
              <strong>Documents:</strong> the state of each document asked for: requested, uploaded, under review,
              approved, rejected or more information needed. States only. You do not open the files here.
            </li>
            <li>
              <strong>Activity:</strong> every step on the deal, newest first, with who took it.
            </li>
          </ul>
          <DocCallout tone="warning" title="Messages and documents">
            Private messages and the contents of documents are not on this desk. A concern about a deal is worked on the{" "}
            <Link href="/admin/cases" className={A}>
              cases desk
            </Link>
            , where only the reported item is read, under the Trust and Safety rules. Do not look for another way in.
          </DocCallout>
        </>
      ),
    },
    {
      id: "intervene",
      title: "Intervening",
      body: (
        <>
          <p>
            Press <strong>Intervene</strong> on the deal. Choose one of the actions below and write the reason, in at
            least 10 characters. The reason is kept in the audit log with your name and the time.{" "}
            <strong>Open the cases desk</strong> beside it opens the deal&apos;s case, or the cases desk when there is
            none.
          </p>
          <DocTable
            caption="What staff may do on a deal"
            columns={[
              { key: "action", label: "Action" },
              { key: "does", label: "What it does" },
              { key: "when", label: "When it is offered" },
            ]}
            rows={ACTIONS}
          />
          <p>
            There is no control to change an amount, a version or who agreed to what, on purpose. The record of what the
            two sides agreed must stay exactly as they agreed it.
          </p>
        </>
      ),
    },
    {
      id: "what-to-say",
      title: "What you may say to a member",
      body: (
        <ul role="list">
          <li>Terms agreed is not a sale.</li>
          <li>
            Vallo takes no money for a purchase and does not confirm title. Tell a buyer to have their own solicitor look
            at the title.
          </li>
          <li>Uploaded, under review and approved are different states. None of them is a check of title.</li>
          <li>Making an offer costs nothing, and no purchase money passes through Vallo.</li>
        </ul>
      ),
    },
  ],
};
