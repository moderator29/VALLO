import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { HOTEL_COMMISSION_PERCENT, SEATED_TABLE_FEE } from "@/app/(site)/docs/facts";
import { FEE_PERCENT } from "@/lib/money/fee-schedule";
import { A, type ManualBody } from "./parts";

/**
 * Chapter 15: THE PRODUCT GUIDE FOR STAFF (the founder, 15 November 2026).
 *
 * What Vallo is, feature by feature, who each feature is for, what it gives a
 * business (B2B) and a person (B2C), what it costs, and what is and is not
 * open today. Written so that anybody on any desk can answer a member, a
 * prospect or a partner in the product's own words, and so each desk's
 * copilot answers from the same page (the manual is its knowledge base).
 *
 * Read from the published member documents (`app/(site)/docs`), the fee
 * schedule (`lib/money/fee-schedule.ts`, imported here so a figure cannot
 * drift), and the live switches, on 15 November 2026. Where a feature is
 * built but not open, this chapter says so plainly. When the product
 * changes, this chapter changes with it.
 */

const OPEN = { state: "Open", tone: "success" } as const;
const NOT_OPEN = { state: "Not open yet", tone: "pending" } as const;
const PART = { state: "Partly open", tone: "info" } as const;

const STATUS: DocTableRow[] = [
  { id: "search", cells: { feature: "Search, filters, the map, saved places and compare", status: OPEN, say: "Anybody with an account can search homes, land, shops, offices, stays and restaurants." } },
  { id: "listing", cells: { feature: "Listing a property, a stay or a restaurant", status: OPEN, say: "Free. A person at Vallo reviews the lister and the listing before it goes up." } },
  { id: "viewings", cells: { feature: "Viewings, in person or by video", status: OPEN, say: "Free. Vallo charges no inspection fee." } },
  { id: "messages", cells: { feature: "Messages and calls", status: OPEN, say: "A member can message any lister, host or restaurant from the listing." } },
  { id: "agreements", cells: { feature: "Agreements for rent and sale", status: OPEN, say: "Both sides confirm the same written terms. Paying the rent through Vallo is the part that is not open yet." } },
  { id: "stays", cells: { feature: "Booking and paying for a hotel room or a shortlet", status: OPEN, say: "Paid by card inside Vallo. The host's share goes to their bank through the payment processor." } },
  { id: "tables", cells: { feature: "Restaurant table bookings", status: OPEN, say: "Free for the diner. The bill is paid at the restaurant." } },
  { id: "roommates", cells: { feature: "Roommates", status: OPEN, say: "Profiles, room posts, groups, the schools and corps directory and the cost splitter." } },
  { id: "circle", cells: { feature: "Circle and Around", status: OPEN, say: "Communities and a local feed." } },
  { id: "assistant", cells: { feature: "The assistant", status: OPEN, say: "Answers questions and searches real listings, in four languages." } },
  { id: "offers", cells: { feature: "Offers and the Deal Room, for homes for sale", status: OPEN, say: "A buyer sends a written offer; the seller accepts, declines, counters or asks a question. Nothing is charged, and no purchase money passes through Vallo." } },
  { id: "price", cells: { feature: "Price Check", status: OPEN, say: "Shows what similar properties nearby are asking. It needs enough real listings near the spot to answer." } },
  { id: "rent-pay", cells: { feature: "Paying rent through Vallo", status: NOT_OPEN, say: "Do not promise it. Members can view, inspect and agree terms now." } },
  { id: "sale-pay", cells: { feature: "Paying for a property purchase through Vallo", status: { state: "Never", tone: "neutral" }, say: "Vallo does not take payment for a purchase at any stage." } },
  { id: "protected", cells: { feature: "Payment held by a licensed bank until the deal is done", status: NOT_OPEN, say: "Built and switched off. Do not describe it to members or prospects as available." } },
  { id: "wallet", cells: { feature: "Wallet", status: NOT_OPEN, say: "Vallo keeps no balance for anybody today." } },
  { id: "bill", cells: { feature: "Paying a restaurant bill through Vallo", status: NOT_OPEN, say: "Diners pay the restaurant directly." } },
  { id: "pro", cells: { feature: "The optional Pro plan", status: NOT_OPEN, say: "Nobody needs it to list, book, view or be paid." } },
  { id: "crypto", cells: { feature: "Paying with crypto", status: NOT_OPEN, say: "Not offered." } },
  { id: "rewards", cells: { feature: "Rewards and referrals", status: PART, say: "Invite links work. Whether rewards are paid depends on the campaign running; the screen says so." } },
];

const B2B: DocTableRow[] = [
  {
    id: "owners",
    cells: {
      who: "Owners and landlords",
      gets: "List your own property with no agency fee. Enquiries come to you. Free viewings booked in the app, a written agreement both sides confirm, and a tenancy file afterwards. An Ownership seen mark once a reviewer has seen your document.",
      asks: "Your name, phone number and where you live; a government ID or your NIN; whatever you hold on the property; a Nigerian bank account in your own name. About five minutes.",
    },
  },
  {
    id: "agents",
    cells: {
      who: "Agents",
      gets: "A profile people can read before they call, a verification ladder that sets you apart from an unknown number, enquiries and viewing requests in one inbox, viewing times you publish once, analytics on each listing, and a listing board you can print.",
      asks: "Everything an owner gives, plus proof of address dated within three months, and your fees stated in the open where a tenant can read them. About ten minutes.",
    },
  },
  {
    id: "firms",
    cells: {
      who: "Registered firms",
      gets: "One firm page with your staff under it, and the same tools as an agent for each of them. A colleague already on Vallo can admit a new member of staff.",
      asks: "What an agent gives, plus the registered name and RC number as the CAC holds them, the CAC certificate, and something showing each person works there. About fifteen minutes.",
    },
  },
  {
    id: "hotels",
    cells: {
      who: "Hotels and guest houses",
      gets: "Room types, rate plans and a calendar; bookings paid by card when the guest books; a calendar that can sync with other sites you sell on; an earnings statement you can download; guests who see every charge before they book.",
      asks: "Your identity, your business papers and the details of the place. A person at Vallo reviews them before you are published.",
    },
  },
  {
    id: "shortlets",
    cells: {
      who: "Shortlet and serviced apartment hosts",
      gets: "Nightly rates, cleaning charge, minimum stay and house rules set by you; requests you accept or decline, or bookings a guest can pay for at once if you choose that; gate details released only once a booking is confirmed; your share paid to your bank.",
      asks: "The same host setup as a hotel, sized for one place or a few.",
    },
  },
  {
    id: "restaurants",
    cells: {
      who: "Restaurants",
      gets: "Table requests with date, time and party size; you confirm or decline; a check-in code for each table; a count of how many tables a guest kept and missed; reminders sent to the diner; reviews only from diners who were seated.",
      asks: "Host setup as a restaurant: your papers, your hours, how many people each sitting takes, and your house rules.",
    },
  },
];

const B2C: DocTableRow[] = [
  { id: "renters", cells: { who: "Renters", gets: "The move-in total under every rent, not only the yearly figure. Light, water and the gate as filters. Who listed it, and what Vallo has confirmed about them. A free viewing in person or by video. A written agreement before any money moves. No fee from Vallo." } },
  { id: "buyers", cells: { who: "Buyers and investors", gets: "Homes, land, shops and offices for sale with the lister shown. The Ownership seen mark where a reviewer has seen an owner's document. Price Check to see what similar places nearby are asking. A written offer to the seller, with counteroffers kept as versions in a Deal Room. Vallo takes no payment for a purchase, and tells buyers to have their own solicitor look at the title." } },
  { id: "guests", cells: { who: "Guests", gets: "Hotels, shortlets and serviced apartments priced for their dates and party, with every charge at the door shown before they book. Card payment inside Vallo. A cancellation policy fixed on the booking. A check on arrival: is it as listed?" } },
  { id: "diners", cells: { who: "Diners", gets: "A table booked for free, up to 90 days ahead, for up to 50 people. A check-in code, reminders, and a conversation with the restaurant if they are running late." } },
  { id: "students", cells: { who: "Students, corps members and young professionals", gets: "Roommates: a profile, room posts, groups that search together, a directory of schools and of states of posting, checks a person can add (a school email code or a document), and a cost splitter." } },
  { id: "everyone", cells: { who: "Everybody", gets: "One account for all of it. English, Yoruba, Hausa and Igbo. The web, Android and iPhone. An assistant that answers questions and names only places that are really on Vallo. Communities in Circle and a local feed in Around." } },
];

const FEES: DocTableRow[] = [
  { id: "member", cells: { who: "A renter, buyer, guest or diner", pays: "Nothing to Vallo. They pay exactly the listed price." } },
  { id: "viewing", cells: { who: "Somebody viewing a property", pays: "Nothing. Vallo charges no inspection fee." } },
  { id: "list", cells: { who: "Anybody listing a property, a stay or a restaurant", pays: "Nothing to list." } },
  { id: "card", cells: { who: "A lister or host, when a card payment is made", pays: `About ${FEE_PERCENT.otherTotal}% in total, from their share: Vallo's service fee of ${FEE_PERCENT.vallo}% and the payment processor's fee of about ${FEE_PERCENT.otherProcessor}%. Shown to them in naira before they agree.` } },
  { id: "hotel", cells: { who: "A hotel, on a paid room booking", pays: `Vallo's commission of ${HOTEL_COMMISSION_PERCENT} percent of the booking, from the hotel's share.` } },
  { id: "restaurant", cells: { who: "A restaurant", pays: `${SEATED_TABLE_FEE} for each table seated from a Vallo booking, billed once a month. A no-show or a cancelled table costs nothing.` } },
  { id: "rent", cells: { who: "A lister, on a rent payment (not open yet)", pays: `About ${FEE_PERCENT.rentTotal}% in total when it opens: Vallo's ${FEE_PERCENT.vallo}% and the payment partner's fee of about ${FEE_PERCENT.rentPartner}%.` } },
];

const SAY_THIS: DocTableRow[] = [
  { id: "free", cells: { asked: "Is it free?", say: "Yes to join, search, message, view and list. Vallo earns only when a deal is paid through it, and that comes from the lister's or host's share, never added to the customer's price." } },
  { id: "why", cells: { asked: "Why should I list with you? I already post on WhatsApp and Instagram.", say: "Keep doing that. Vallo is one more place, and it is the one where people can see who you are, what Vallo has confirmed about you, and the full cost before they call. That means fewer time wasters and fewer questions asked twice." } },
  { id: "leads", cells: { asked: "How many customers will I get?", say: "I cannot promise a number, and nobody honest can. Vallo is new, so the first listers in each area are the ones people find. Listing costs nothing, so you lose nothing by being early." } },
  { id: "paid", cells: { asked: "How do I get paid?", say: "For a stay or a hotel room, the guest pays by card inside Vallo and your share goes to your own bank account through the payment processor. Vallo never holds your money. Paying rent through Vallo is not open yet, so today a rent is agreed on Vallo and you will be told when payment opens." } },
  { id: "review", cells: { asked: "Why do you ask for my ID?", say: "Because every lister on Vallo is reviewed by a person before they go up. It is what lets a stranger trust your listing. Your documents are seen only by the review team and are never shown to other members." } },
  { id: "agent", cells: { asked: "Are you cutting out agents?", say: "No. Vallo does not remove the agent. It removes the runaround: people see who they are dealing with and what they will pay before they call." } },
  { id: "safe", cells: { asked: "Can you promise I will not be scammed?", say: "No, and we never say so. What we do is review every lister and listing, show what has been confirmed and what has not, keep viewings free, and tell everybody to pay only inside Vallo after a viewing. A badge is not a promise." } },
  { id: "value", cells: { asked: "Can Vallo tell me what price to put on my property?", say: "No. Vallo does not put a price on anybody's property. Price Check shows what similar properties near a spot are currently asking on Vallo, how many it found, and how sure it is. If it has too few to be sure, it says so instead of guessing." } },
];

export const PRODUCT_GUIDE: ManualBody = {
  intro: (
    <p>
      This chapter is for everybody who works at Vallo, on any desk. It says what Vallo is, feature by feature, who
      each feature is for, what it gives a business and what it gives a person, what it costs, and what is open today
      and what is not. Use it to answer a member, a prospect or a partner in the product&apos;s own words. If something
      here and something you were told elsewhere disagree, this page and the product are right: say only what is on
      this page.
    </p>
  ),
  glance: [
    "Vallo is a marketplace for property, stays and restaurant tables in Nigeria, with Roommates, communities and a local feed on the same account.",
    "Every lister and every listing is reviewed by a person at Vallo before it goes up. That is the reason to choose Vallo, for both sides.",
    "It is free to join, search, message, view and list. Vallo earns only on a completed, paid deal, from the lister's or host's share.",
    "Vallo never holds customer money. Card payments go to the owner, agent or host through the payment processor.",
    "Open today: search, listing, viewings, messages, agreements, offers on homes for sale, stays and hotel rooms paid by card, table bookings, Roommates, Circle, Around, the assistant and Price Check.",
    "Not open yet: paying rent through Vallo, the wallet, paying a restaurant bill, the Pro plan. Never promise these.",
    "Never promise a number of customers, a price for somebody's property, a refund, or that a deal carries no risk. Say what Vallo does.",
  ],
  sections: [
    {
      id: "in-one-minute",
      title: "Vallo in one minute",
      body: (
        <>
          <p>
            Vallo is a marketplace for property, stays and restaurants in Nigeria. A person can rent or buy a home, a
            shop, an office or land; book a hotel room, a shortlet or a serviced apartment; and book a table at a
            restaurant. Owners, agents, firms, hotels, shortlet hosts and restaurants list on Vallo, and a person at
            Vallo reviews each of them, and each listing, before it goes up.
          </p>
          <p>
            Around that sit Roommates, for people who want to share a home; Circle, communities where people ask and
            answer about areas and property; Around, a feed of the places people live and work in; an assistant that
            answers questions; and Price Check, which shows what similar properties nearby are asking.
          </p>
          <p>
            The problem Vallo exists to fix is ordinary and stubborn: in too many property searches in Nigeria, nobody
            can be sure that a listing is real, that the price is the price, or that the person at the other end is who
            they say. Vallo does not remove the agent. It removes the runaround: you see who you are dealing with and
            what you will pay before you call anybody.
          </p>
          <DocCallout tone="note" title="The one sentence to remember">
            Everything on Vallo was listed by a real person who applied and was reviewed, the full cost is shown before
            anybody calls, and Vallo is free until a deal is paid.
          </DocCallout>
        </>
      ),
    },
    {
      id: "what-is-open",
      title: "What is open today, and what is not",
      body: (
        <>
          <p>
            This is the table to keep open while you talk to anybody. A feature marked Not open yet is built or
            planned, and no member can use it today. Do not offer it, do not give a date for it, and do not let a
            prospect sign up expecting it.
          </p>
          <DocTable
            caption="Every feature, whether it is open, and what you may say"
            columns={[
              { key: "feature", label: "Feature" },
              { key: "status", label: "Today", kind: "state" },
              { key: "say", label: "What you may say" },
            ]}
            rows={STATUS}
          />
          <DocCallout tone="warning" title="Vallo is new, and the catalogue is young">
            Most of the listings a visitor sees today are example listings, marked as examples, there to show how the
            platform works. Real listings are being added now. Say this plainly to a prospect: the first listers in
            each area are the ones people find. Never describe an example listing as a real property, and never tell a
            prospect how many customers they will get.
          </DocCallout>
        </>
      ),
    },
    {
      id: "for-businesses",
      title: "What Vallo gives a business (B2B)",
      body: (
        <>
          <p>
            A business on Vallo is anybody who lists: an owner or landlord, an agent, a registered firm, a hotel or
            guest house, a shortlet or serviced apartment host, or a restaurant. Each sets up a workspace on their own
            account. One account holds one side: an owner account cannot also be an agent account.
          </p>
          <DocTable
            caption="For each kind of business: what they get, and what Vallo asks of them"
            columns={[
              { key: "who", label: "Who" },
              { key: "gets", label: "What they get" },
              { key: "asks", label: "What Vallo asks for" },
            ]}
            rows={B2B}
          />
          <p>What every business gets, whichever kind they are:</p>
          <ul role="list">
            <li>
              <strong>Free listing.</strong> Not free for a trial period: listing is free. Nobody has to pay a monthly
              subscription to use Vallo.
            </li>
            <li>
              <strong>A page people can trust before they call.</strong> Who you are, what Vallo has confirmed about
              you, your listings, your reviews and how quickly you reply.
            </li>
            <li>
              <strong>Enquiries that have read the facts.</strong> The price, the move-in total, light, water and the
              gate are on the listing, so the first message is not the same five questions.
            </li>
            <li>
              <strong>Photos and video.</strong> Up to 15 photos and videos on a listing, in any mix; a video can be up
              to 60 seconds.
            </li>
            <li>
              <strong>One announcement.</strong> An approved listing is announced once in the place it sits in on
              Around, the local feed.
            </li>
            <li>
              <strong>Clear money.</strong> Before publishing, the lister sees the price a customer pays and what they
              receive after Vallo&apos;s commission, in naira.
            </li>
            <li>
              <strong>A workspace.</strong> Listings, enquiries, viewing times, bookings, the calendar, earnings and
              reviews in one place, on a phone or a computer.
            </li>
          </ul>
          <DocCallout tone="note" title="What a business agrees to">
            Charge nothing that is not on the listing. Add no charge without a stated reason. Keep every payment for a
            deal inside Vallo. Describe the place as it is: a guest is asked on arrival whether it is as listed.
          </DocCallout>
        </>
      ),
    },
    {
      id: "for-people",
      title: "What Vallo gives a person (B2C)",
      body: (
        <>
          <DocTable
            caption="For each kind of person: what they get"
            columns={[
              { key: "who", label: "Who" },
              { key: "gets", label: "What they get" },
            ]}
            rows={B2C}
          />
          <p>
            A person needs an account to see inside Vallo, and must be 18 or over. An account is free. Looking, saving,
            messaging and asking to view never cost anything.
          </p>
        </>
      ),
    },
    {
      id: "feature-by-feature",
      title: "Feature by feature",
      body: (
        <>
          <h3 className="nf-h4">Search, filters and the map</h3>
          <p>
            Type a city, an area or the kind of place. Tiles narrow it to rentals, homes, apartments, shortlets, villas,
            shops, offices, land and more. Sort by recommended, top rated or price. Light, water and the gate are
            filters, not small print. Switch to the map, save a place with the heart, save a search, and put up to four
            places side by side to compare.
          </p>
          <h3 className="nf-h4">Reading a listing</h3>
          <p>
            A rent is priced per year with the move-in total shown under it: every cost the lister named, each on its
            own row. The listing shows the key facts, the gallery and any video, the amenities, the answers on light
            and water, who listed it, their reviews and the map. An unanswered question shows as unanswered.
          </p>
          <h3 className="nf-h4">Viewings</h3>
          <p>
            Schedule a visit from the listing, in person or by live video from the property. It is free: Vallo charges
            no inspection fee. If an owner or agent asks for a fee to inspect, that is a private arrangement, it is not
            a Vallo charge, and the member can report it. After a viewing the member fills an inspection report of
            eight rooms and areas with notes and photos.
          </p>
          <h3 className="nf-h4">Agreements</h3>
          <p>
            For a rent or a sale, an agreement is drawn up from the listing&apos;s own figures and the inspection
            report. Both sides confirm the same version; if anything changes, the version moves and both confirm again.
            Money moves only after the viewing and the agreement.
          </p>
          <h3 className="nf-h4">Offers and the Deal Room</h3>
          <p>
            On a home that is for sale, Make an offer lets a buyer tell the seller in writing what they propose to
            pay, how they plan to pay and when they would like to complete. The seller can accept, decline, answer with
            a counteroffer or ask a question. Each offer and counteroffer is its own version, so nobody can later claim
            different terms were agreed. The Deal Room is where the offer lives: the versions, the inspection, the
            documents each side asks for, and the stage the deal has reached. Making an offer costs nothing, commits
            the buyer to nothing and does not take the home off the market. A buyer needs a government ID on their
            account and must be 18 or over. Vallo receives no part of the purchase price and asks for no deposit.
          </p>
          <h3 className="nf-h4">Paying</h3>
          <p>
            Every payment for a deal happens inside Vallo. A hotel room is paid by card when the guest books. A
            shortlet is paid when the host accepts, or at once where the host has chosen that for the listing. The payment
            goes to the owner, agent or host through the payment processor as soon as it clears, and Vallo never sees
            a full card number. A refund goes back the way the money came, usually within 5 to 10 working days.
            Paying rent through Vallo is not open yet, and Vallo does not take payment for a purchase at any stage.
          </p>
          <h3 className="nf-h4">Stays: hotels, shortlets and serviced apartments</h3>
          <p>
            Priced per night for the guest&apos;s dates and party. Every charge at the door (caution deposit, power,
            cleaning, an extra guest, a visitor) is answered by the host before the place can be published, and shown
            before booking. Unpaid dates are held for 48 hours at no cost. Each stay shows one of four cancellation
            policies, fixed on the booking when it is paid. From check-in, the guest is asked whether the place is as
            listed; a no goes to a person at Vallo.
          </p>
          <h3 className="nf-h4">Restaurants and tables</h3>
          <p>
            A diner books a table for free, up to 90 days ahead, for up to 50 people. The restaurant confirms or
            declines. The booking carries a check-in code and its own conversation, and Vallo reminds the diner the
            evening before and two hours before. The bill is paid at the restaurant. Only a diner who was seated can
            review.
          </p>
          <h3 className="nf-h4">Roommates</h3>
          <p>
            For people who want to share a home: students, corps members, graduates and young professionals. A
            roommate profile, posts for a room on offer or a roommate wanted, groups of two or more searching together
            with a shared shortlist, a directory of schools and of states of posting, optional checks a person can add
            (a code sent to a school email address, or a document such as a student ID or an NYSC call-up letter), and
            a cost splitter. The rule to repeat: meet in a public place, and never send money before seeing the room.
          </p>
          <h3 className="nf-h4">Circle</h3>
          <p>
            Communities for people who buy, rent, let, sell and work in property. A member asks a question, discusses
            an area, attaches a live listing to ask about it, and reads answers, with an accepted answer shown first.
            Communities can be public or private. An answer in Circle is a member&apos;s opinion, not Vallo&apos;s.
          </p>
          <h3 className="nf-h4">Around</h3>
          <p>
            A feed of places, not of strangers. A member joins their local government, estate or campus and reads what
            people there are saying. All 36 states, the Federal Capital Territory and all 774 local governments are
            there.
          </p>
          <h3 className="nf-h4">Messages and calls</h3>
          <p>
            Every listing has a message button, and a member does not need a booking to ask. Conversations sit in
            Messages, with property and stays in their own tabs. Keeping the conversation on Vallo is what gives
            support something to work from if a deal goes wrong.
          </p>
          <h3 className="nf-h4">The assistant</h3>
          <p>
            Answers questions about finding, renting, buying and staying, in English, Yoruba, Hausa or Igbo. It
            searches the same listings a member does, so it names only places that are really on Vallo. It is an AI,
            the member agrees before using it, and it never acts without the member&apos;s approval.
          </p>
          <h3 className="nf-h4">Price Check</h3>
          <p>
            Tell it where and what, and it shows what similar properties near there are currently advertised for on
            Vallo, how many it found, how far away and how recent, and how sure it is. It is the asking prices of
            listings, not what anybody paid, not a price put on a particular property and not advice. It needs at least
            five comparable real listings nearby, and it says so when it has too few. It does not price land, hotels or
            restaurants, and it never builds a figure from example listings.
          </p>
          <h3 className="nf-h4">Badges and verification</h3>
          <p>
            The verification ladder says what Vallo has confirmed about a lister, one rung at a time, each decided by a
            person. The Verified tick appears only once a person at Vallo has looked at the ID of the lister behind the
            listing. The Ownership seen mark means a reviewer saw an owner&apos;s document: it is not a title search
            and not legal advice. Other badges are earned from what really happened, such as replying quickly. A badge
            is not a promise about how anybody will behave.
          </p>
          <h3 className="nf-h4">Reviews</h3>
          <p>
            Only somebody who stayed, was seated or holds a tenancy can review. A review cannot be edited once posted.
            A host can reply once, publicly, and can ask Vallo to look at a review that breaks the rules.
          </p>
          <h3 className="nf-h4">Tools that need no account</h3>
          <p>
            A move-in calculator that shows the real total up front, area price pages, and a checker for a property
            advert or a receipt seen elsewhere. These are open to anybody and are a good first thing to show a person.
          </p>
          <h3 className="nf-h4">Languages and apps</h3>
          <p>
            English, Yoruba, Hausa and Igbo. Vallo runs in any web browser and as the app for Android phones and
            iPhones, from Google Play and the App Store, on the same account.
          </p>
        </>
      ),
    },
    {
      id: "what-it-costs",
      title: "What Vallo costs",
      body: (
        <>
          <DocTable
            caption="Who pays Vallo, and what"
            columns={[
              { key: "who", label: "Who" },
              { key: "pays", label: "What they pay" },
            ]}
            rows={FEES}
          />
          <p>
            The payment processor&apos;s and the payment partner&apos;s fees are their own charges. Vallo does not keep
            them. The percentages are round figures: the exact amount is always shown in naira before a lister agrees.
            The member-facing page is{" "}
            <Link href="/docs/what-vallo-costs" className={A}>
              What Vallo costs
            </Link>
            ; send that link rather than typing figures from memory.
          </p>
        </>
      ),
    },
    {
      id: "how-review-works",
      title: "How Vallo reviews listers and listings",
      body: (
        <>
          <p>
            This is the heart of the pitch to both sides, so know it exactly.
          </p>
          <ul role="list">
            <li>
              <strong>The lister.</strong> Before anybody can publish, they set up a workspace and give their identity
              (a government ID or NIN), proof of address where the role needs it, business papers for a firm or a host,
              and a Nigerian bank account in their own name. A person at Vallo looks at these and approves, asks for
              more, or says no with a reason.
            </li>
            <li>
              <strong>The listing.</strong> A person at Vallo reads each listing before it goes up, and approves it,
              asks for more, or rejects it with a reason the lister can read and act on.
            </li>
            <li>
              <strong>An agent&apos;s instruction.</strong> An agent or firm listing goes live only once Vallo has
              confirmed the owner who instructed them.
            </li>
            <li>
              <strong>Afterwards.</strong> Members can report a listing, a person or a post. A guest is asked on
              arrival whether a stay is as listed. A listing or a lister can be suspended.
            </li>
          </ul>
          <DocCallout tone="warning" title="What review is not">
            Review is a person looking at documents and a listing. It is not a promise that a deal will go well, a
            search of title, a survey of the building or legal advice. Never tell anybody that a property, a person or
            a payment on Vallo carries no risk. Say what was looked at, and tell buyers to use their own solicitor.
          </DocCallout>
        </>
      ),
    },
    {
      id: "what-to-say",
      title: "What to say when you are asked",
      body: (
        <>
          <p>
            These are the questions that come up most, with an answer you can use as it stands. Your desk&apos;s copilot
            reads this page, so you can also ask it to draft a reply and then check the draft against this table.
          </p>
          <DocTable
            caption="Common questions and an honest answer to each"
            columns={[
              { key: "asked", label: "What you are asked" },
              { key: "say", label: "What you can say" },
            ]}
            rows={SAY_THIS}
          />
        </>
      ),
    },
    {
      id: "never-say",
      title: "What nobody at Vallo says",
      body: (
        <>
          <ul role="list">
            <li>That Vallo holds, keeps or looks after anybody&apos;s money. It never does.</li>
            <li>That a listing, a person, a place or a payment comes with a promise of safety. Say what was looked at and by whom.</li>
            <li>A number of customers, enquiries or bookings a business will get.</li>
            <li>That Vallo puts a price on a property. Price Check shows asking prices, with how sure it is.</li>
            <li>That listing is free only for now, or for a first period. Listing is free.</li>
            <li>That a feature marked Not open yet is available, or a date for it.</li>
            <li>That a member will get a refund or a payout. Another desk decides that, on the facts.</li>
            <li>That the Vallo Guarantee exists. It was retired on 9 November 2026.</li>
            <li>Anything about a named member to somebody else. Use a reference or a count.</li>
          </ul>
          <p>
            If you are asked something this chapter does not answer, do not guess. Say you will find out, then ask your
            lead or use the Escalate button, described in{" "}
            <Link href="/admin/manual/escalation" className={A}>
              Escalation and out of hours
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "where-to-send-people",
      title: "Where to send people",
      body: (
        <>
          <p>A link to the right page is better than a long message. These are the pages members can open.</p>
          <ul role="list">
            <li>
              <Link href="/docs/what-vallo-is" className={A}>What Vallo is</Link>, for anybody new.
            </li>
            <li>
              <Link href="/docs/what-vallo-costs" className={A}>What Vallo costs</Link>, for every fee.
            </li>
            <li>
              <Link href="/docs/listing-on-vallo" className={A}>Listing a property</Link>,{" "}
              <Link href="/docs/for-owners" className={A}>For owners and landlords</Link> and{" "}
              <Link href="/docs/for-agents" className={A}>For agents and firms</Link>.
            </li>
            <li>
              <Link href="/docs/hosting" className={A}>Hosting a hotel or shortlet</Link> and{" "}
              <Link href="/docs/restaurants" className={A}>Restaurants and tables</Link>.
            </li>
            <li>
              <Link href="/docs/roommates" className={A}>Roommates</Link> and{" "}
              <Link href="/docs/circle" className={A}>Vallo Circle</Link>.
            </li>
            <li>
              <Link href="/docs/paying-on-vallo" className={A}>How paying works</Link> and{" "}
              <Link href="/docs/badges-and-verification" className={A}>Badges and verification</Link>.
            </li>
            <li>
              <Link href="/docs/trust-and-safety" className={A}>Avoiding scams and reporting</Link>.
            </li>
          </ul>
        </>
      ),
    },
  ],
};
