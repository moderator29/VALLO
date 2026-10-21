import Link from "next/link";
import { NO_INSPECTION_FEE, OFF_PLATFORM_SENTENCE, PRIVATE_FEE_NOTE } from "@/lib/money/copy";
import { SUPPLY_DOOR_HREF } from "@/lib/supply/roles";
import { MAX_DAYS_AHEAD, MAX_PARTY } from "@/lib/reservations/limits";
import { MAX_UPLOAD_LABEL, MAX_VIDEOS, MAX_VIDEO_SECONDS, MIN_MEDIA, RECOMMENDED_MEDIA } from "@/lib/agent/listings-model";
import { VERIFICATION_ORDER } from "@/lib/trust/verification";
import type { DocChapter } from "./chapters";
import { DocsFlow } from "./DocsFlow";
import {
  COMMISSION_FROM_SHARE,
  HOTEL_COMMISSION_SENTENCE,
  HOTEL_ROOM_BY_CARD,
  PAY_INSIDE_VALLO,
  PRICE_IS_THE_PRICE,
  SEATED_TABLE_FEE,
  VALLO_NEVER_HOLDS,
} from "./facts";

/**
 * THE CHAPTERS WRITTEN FROM THE FOUNDER'S DECISIONS OF 13 OCTOBER 2026
 * (docs/DECISIONS_2026-10-13.md): a quick start for each kind of person, what
 * Vallo costs, viewings, hosting, restaurants and tables, and badges.
 *
 * The same rules as `chapters.tsx`: nothing here describes a feature that is
 * not built; a rule decided and being built is stated as the rule, never as a
 * screen. No provider is named: the product speaks as Vallo.
 */

const A = "font-semibold text-[var(--nf-content-link)] hover:underline";

/* ---------------------------------------------------------- quick start */

export const QUICK_START: DocChapter = {
  slug: "quick-start",
  number: 0,
  title: "Quick start",
  summary:
    "The first few steps for each kind of person: renting or buying, booking a stay or a table, letting your own property, working as an agent, hosting, or running a restaurant.",
  icon: "house-sparkle",
  sections: [
    {
      id: "renter",
      heading: "Rent or buy a home",
      body: (
        <>
          <ol role="list">
            <li>Make an account. Looking, saving, messaging and viewing are free.</li>
            <li>
              <Link href="/search" className={A}>
                Search
              </Link>{" "}
              and filter. Light, water and the gate are filters, not small print.
            </li>
            <li>Message the lister with any question.</li>
            <li>Tap Schedule a visit, in person or by video. It is free.</li>
            <li>Decide, confirm the agreement, and pay inside Vallo.</li>
          </ol>
          <p>
            Next: <Link href="/docs/agreements-and-paying" className={A}>From viewing to keys</Link>.
          </p>
        </>
      ),
    },
    {
      id: "guest",
      heading: "Book a stay or a table",
      body: (
        <>
          <ol role="list">
            <li>Open Stays and set your dates and guests.</li>
            <li>See the full price, including any charge at the door, before you book.</li>
            <li>Book and pay inside Vallo. A hotel room is paid by card when you book.</li>
            <li>For a table, open Restaurants and ask for a date, a time and a party size. It is free.</li>
          </ol>
          <p>
            Next: <Link href="/docs/booking-a-stay" className={A}>Booking a stay</Link> and{" "}
            <Link href="/docs/restaurants" className={A}>Restaurants and tables</Link>.
          </p>
        </>
      ),
    },
    {
      id: "landlord",
      heading: "Let or sell your own property",
      body: (
        <>
          <ol role="list">
            <li>
              Open{" "}
              <Link href={SUPPLY_DOOR_HREF} className={A}>
                Add a workspace
              </Link>{" "}
              and choose the owner workspace.
            </li>
            <li>Say who you are, and add your ownership document if you have one.</li>
            <li>Post the listing with photos, videos, the price and every cost a tenant will meet.</li>
            <li>Vallo reviews it. If it needs more, you are told what, and you send it again.</li>
            <li>Publish viewing times and answer requests in the thread.</li>
          </ol>
          <p>
            Next: <Link href="/docs/for-owners" className={A}>For owners and landlords</Link>.
          </p>
        </>
      ),
    },
    {
      id: "agent",
      heading: "Work as an agent or a firm",
      body: (
        <>
          <ol role="list">
            <li>Apply through the agent or firm workspace. A person at Vallo reviews it.</li>
            <li>Post listings for the owners you act for. Each is reviewed before it goes up.</li>
            <li>Publish viewing times so renters can book at once.</li>
            <li>Answer enquiries quickly from your inbox.</li>
          </ol>
          <p>
            Next: <Link href="/docs/for-agents" className={A}>For agents and firms</Link>.
          </p>
        </>
      ),
    },
    {
      id: "host",
      heading: "Host a hotel, shortlet or serviced apartment",
      body: (
        <>
          <ol role="list">
            <li>
              Open{" "}
              <Link href="/host/start" className={A}>
                host setup
              </Link>{" "}
              and choose hotel or shortlet.
            </li>
            <li>Add your ID and business papers. Vallo reviews them.</li>
            <li>Set your rooms, rates, calendar, charges at the door and cancellation policy.</li>
            <li>
              Accept the Terms, the Privacy Policy and the{" "}
              <Link href="/host-agreement" className={A}>
                Host Agreement
              </Link>
              , then publish.
            </li>
          </ol>
          <p>
            Next: <Link href="/docs/hosting" className={A}>Hosting a hotel or shortlet</Link>.
          </p>
        </>
      ),
    },
    {
      id: "restaurant",
      heading: "Run a restaurant on Vallo",
      body: (
        <>
          <ol role="list">
            <li>Open host setup and choose restaurant.</li>
            <li>Set your hours, tables per sitting and house rules.</li>
            <li>Confirm or decline each table request.</li>
            <li>Mark each table seated or a no-show after its time.</li>
          </ol>
          <p>
            Next: <Link href="/docs/restaurants#for-restaurants" className={A}>Running a restaurant</Link>.
          </p>
        </>
      ),
    },
    {
      id: "photos-and-videos",
      heading: "Add photos and videos to a listing",
      body: (
        <ul role="list">
          <li>Photos and videos go in one uploader.</li>
          <li>
            A listing needs at least {MIN_MEDIA} items. {RECOMMENDED_MEDIA} is recommended.
          </li>
          <li>The first item is the cover, and the cover must be a photo.</li>
          <li>
            Add up to {MAX_VIDEOS} videos, each up to {MAX_UPLOAD_LABEL} and {MAX_VIDEO_SECONDS} seconds,
            as MP4, MOV or WebM.
          </li>
        </ul>
      ),
    },
  ],
};

/* ------------------------------------------------------ what it costs */

export const WHAT_VALLO_COSTS: DocChapter = {
  slug: "what-vallo-costs",
  number: 0,
  title: "What Vallo costs",
  summary:
    "Free to use and free to list. Vallo charges only on a completed deal, from the lister's or host's share. The hotel commission, the restaurant fee, and the optional Pro plan.",
  icon: "naira-coins",
  sections: [
    {
      id: "free-to-use",
      heading: "Free to use, free to list",
      body: (
        <>
          <p>
            Making an account, searching, saving, messaging and asking to view are free. Listing a
            property, a stay or a restaurant is free.
          </p>
          <p>Nobody has to pay a monthly subscription to use Vallo.</p>
        </>
      ),
    },
    {
      id: "only-on-a-deal",
      heading: "Vallo charges only on a completed deal",
      body: (
        <>
          <p>{COMMISSION_FROM_SHARE}</p>
          <p>
            A renter, buyer or guest pays exactly the listed price. Before a lister publishes, Vallo
            shows them what they will receive after its commission, in naira.
          </p>
          <p>{NO_INSPECTION_FEE}</p>
        </>
      ),
    },
    {
      id: "hotels",
      heading: "The hotel commission",
      body: <p>{HOTEL_COMMISSION_SENTENCE}</p>,
    },
    {
      id: "restaurants",
      heading: "The restaurant fee",
      body: (
        <>
          <p>Booking a table is free for the diner.</p>
          <p>
            Vallo bills the restaurant {SEATED_TABLE_FEE} for each table seated from a Vallo booking,
            once a month. A no-show or a cancelled table costs the restaurant nothing.
          </p>
        </>
      ),
    },
    {
      id: "pro",
      heading: "The Pro plan is optional",
      body: (
        <p>
          Vallo offers an optional Pro plan. You never need it to list, to book, to view or to get paid,
          and nothing you need is locked behind it.
        </p>
      ),
    },
    {
      id: "see-every-cost",
      heading: "See every cost before you book",
      body: (
        <>
          <p>{PRICE_IS_THE_PRICE}</p>
          <p>
            A host or lister must not charge anything that is not listed on Vallo, and must not add a
            charge without a stated reason. If someone asks you for a charge that is not listed, do not
            pay it. {PRIVATE_FEE_NOTE}
          </p>
        </>
      ),
    },
    {
      id: "who-holds-the-money",
      heading: "Who holds the money",
      body: (
        <p>
          {VALLO_NEVER_HOLDS} See{" "}
          <Link href="/docs/paying-on-vallo" className={A}>
            How paying works
          </Link>
          .
        </p>
      ),
    },
  ],
};

/* ------------------------------------------------------------ viewings */

export const VIEWINGS: DocChapter = {
  slug: "viewings",
  number: 0,
  title: "Viewings",
  summary:
    "See a property before any money moves: schedule a visit in person or by video, follow where it stands, get reminders, change the time or cancel, close the visit, and what to do if someone does not come.",
  icon: "calendar-clock",
  sections: [
    {
      id: "viewing-is-free",
      heading: "A viewing never takes money",
      body: (
        <p>
          {NO_INSPECTION_FEE} Money for a rental or a sale moves only after you have seen the property and
          decided.
        </p>
      ),
    },
    {
      id: "two-ways",
      heading: "Schedule a visit",
      body: (
        <>
          <DocsFlow
            label="Scheduling a visit"
            steps={[
              { object: "home-search", label: "Choose the visit type" },
              { object: "calendar-grid", label: "Pick a day and time" },
              { object: "doc-review", label: "Check it" },
              { object: "calendar-check", label: "Send or book" },
            ]}
          />
          <ol role="list">
            <li>On a rental or a sale, tap <strong>Schedule a visit</strong>.</li>
            <li>
              Choose <strong>In-person visit</strong> or <strong>Video visit</strong>, a live video call
              from the property. Video is offered only while calls are switched on.
            </li>
            <li>
              Pick a day, then a time: morning, afternoon or evening. All times are Lagos time.
              <ul role="list">
                <li>
                  <strong>The lister has opened viewing times.</strong> You see only the real open times.
                  The one you pick is booked as soon as you confirm.
                </li>
                <li>
                  <strong>The lister has none.</strong> Suggest a time, at least two hours from now. The
                  lister confirms it, offers another time, or declines.
                </li>
              </ul>
            </li>
            <li>Add a note or a question for the lister, if you like.</li>
            <li>Check the date, the time and the visit type, then send the request or book the time.</li>
          </ol>
        </>
      ),
    },
    {
      id: "status",
      heading: "Follow your visit",
      body: (
        <>
          <p>After you send it, the visit has its own page. It shows where it really stands:</p>
          <ul role="list">
            <li>
              <strong>Request sent.</strong> Waiting for the lister. Nothing is booked yet.
            </li>
            <li>
              <strong>Visit confirmed.</strong> The lister is expecting you.
            </li>
            <li>
              <strong>A new time was offered.</strong> Accept it in one tap, or cancel the request.
            </li>
            <li>
              <strong>Request declined</strong> or <strong>Visit cancelled.</strong> Ask for another time
              from the same page.
            </li>
          </ul>
          <p>
            <strong>What happens next</strong> is listed on the same page: the lister confirms, the
            reminders, the visit, then your decision. Once the visit is confirmed, use{" "}
            <strong>Add to calendar</strong>. For a video visit, <strong>Join video visit</strong> opens
            10 minutes before the time. Your visits are also in Plans.
          </p>
        </>
      ),
    },
    {
      id: "reminders",
      heading: "Get reminders",
      body: (
        <>
          <p>The renter and the lister are both reminded three times, in Lagos time:</p>
          <ul role="list">
            <li>the evening before, at 19:00;</li>
            <li>on the morning of the visit, at 08:00;</li>
            <li>two hours before the visit.</li>
          </ul>
          <p>Each reminder says whether the visit is in person or by video.</p>
        </>
      ),
    },
    {
      id: "changing",
      heading: "Change the time or cancel",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>Change time.</strong> Your current request is cancelled first and the lister is
              told. Then you pick a new time.
            </li>
            <li>
              <strong>Cancel.</strong> Cancel a request or a confirmed visit from its page. The lister is
              told, and you can ask again from the listing.
            </li>
          </ul>
          <p>A lister can offer another time or cancel, and can say why. The chat stays open either way.</p>
        </>
      ),
    },
    {
      id: "closing",
      heading: "Close the viewing afterwards",
      body: (
        <>
          <p>
            Once the time has passed, either side marks the viewing complete and says how it went:{" "}
            <strong>inspected</strong>, <strong>deal done</strong> or <strong>no deal</strong>.
          </p>
          <p>
            <strong>What happens next:</strong> for a rental or a sale, you submit the inspection report
            and confirm the agreement. See{" "}
            <Link href="/docs/agreements-and-paying" className={A}>
              From viewing to keys
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "no-show",
      heading: "If somebody does not come",
      body: (
        <p>
          Either side can report a no-show from the viewing time until 14 days after. The person reported
          can dispute it within 48 hours. If they do, a person at Vallo looks at both sides and decides.
        </p>
      ),
    },
    {
      id: "for-listers",
      heading: "Manage visits as a lister",
      body: (
        <>
          <p>
            Open{" "}
            <Link href="/agent/inspections" className={A}>
              Inspections
            </Link>{" "}
            in your workspace.
          </p>
          <ul role="list">
            <li>
              <strong>At a glance:</strong> visits today, in the next 7 days, and how many need your
              answer.
            </li>
            <li>
              <strong>Needs your answer:</strong> open a request to confirm it, offer another time, or
              decline.
            </li>
            <li>
              <strong>Visit calendar:</strong> a week or a month view, with each visit on the day it is
              for. Filter by state: requested, proposed, confirmed, done, missed, declined or withdrawn.
            </li>
            <li>
              <strong>When you can show:</strong> beside the calendar, set the days and hours you can show
              each place. Renters then book a free slot without waiting for you.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "safety",
      heading: "Go prepared",
      body: (
        <p>
          Keep the arrangement in the Vallo chat. {OFF_PLATFORM_SENTENCE} Never pay a fee to see a property.
          Read the <Link href="/safety" className={A}>Safety centre</Link>.
        </p>
      ),
    },
  ],
};

/* ------------------------------------------------------------- hosting */

export const HOSTING: DocChapter = {
  slug: "hosting",
  number: 0,
  title: "Hosting a hotel or shortlet",
  summary:
    "Set up a hotel, shortlet or serviced apartment: review, the rules every host agrees to, rooms, rates and the calendar, bookings, charges at the door, check-in and getting paid.",
  icon: "hotel",
  sections: [
    {
      id: "setup",
      heading: "Set up as a host",
      body: (
        <>
          <DocsFlow
            label="From setup to published"
            steps={[
              { object: "person-card", label: "Choose hotel or shortlet" },
              { object: "id-card-check", label: "ID and business papers" },
              { object: "doc-review", label: "Vallo reviews" },
              { object: "home-check", label: "Publish" },
            ]}
          />
          <p>
            Hotels, shortlets, serviced apartments and restaurants set up through one host wizard, from{" "}
            <Link href="/host/start" className={A}>
              host setup
            </Link>
            . You give your identity, your business papers and the details of the place. A person at Vallo
            reviews them before you are published. For restaurants, see{" "}
            <Link href="/docs/restaurants#for-restaurants" className={A}>
              Running a restaurant
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "sent-back",
      heading: "If Vallo sends it back",
      body: (
        <p>
          Vallo tells you what to fix. You edit the same application and send it again; you do not start
          over. The wizard asks before you leave with changes you have not saved.
        </p>
      ),
    },
    {
      id: "rules",
      heading: "Follow the rules every host agrees to",
      body: (
        <ul role="list">
          <li>
            Accept the <Link href="/terms" className={A}>Terms</Link>, the{" "}
            <Link href="/privacy" className={A}>Privacy Policy</Link> and the{" "}
            <Link href="/host-agreement" className={A}>Host Agreement</Link> before you publish.
          </li>
          <li>Charge nothing that is not listed on Vallo.</li>
          <li>Add no charge without a stated reason.</li>
          <li>{PAY_INSIDE_VALLO}</li>
        </ul>
      ),
    },
    {
      id: "stays",
      heading: "Set rooms, rates and the calendar",
      body: (
        <ul role="list">
          <li>
            <strong>Hotels.</strong> Add room types and rate plans. In{" "}
            <Link href="/host/rooms" className={A}>
              Rooms and nights
            </Link>
            , say how far ahead and how many of each room can be booked.
          </li>
          <li>
            <strong>The calendar.</strong> In{" "}
            <Link href="/host/calendar" className={A}>
              Calendar
            </Link>
            , set the rate and the rooms open for each night. Sync it with other sites you sell on, so a
            night booked elsewhere closes here.
          </li>
          <li>
            <strong>Shortlets.</strong> Set the nightly rate, any cleaning charge, a minimum stay and the
            most guests.
          </li>
          <li>
            <strong>House rules.</strong> Include your check-in time.
          </li>
        </ul>
      ),
    },
    {
      id: "door-charges",
      heading: "List every charge at the door",
      body: (
        <p>
          In{" "}
          <Link href="/host/arrival" className={A}>
            Charges at the door
          </Link>
          , answer each one: caution deposit, power, cleaning, an extra guest and a visitor. Give an
          amount, or say there is none. The place cannot be published until all are answered, and guests
          see them before they book.
        </p>
      ),
    },
    {
      id: "policy",
      heading: "Choose a cancellation policy",
      body: (
        <p>
          Pick Flexible, Moderate, Firm or Strict. The guest sees its terms before they book, and the
          refund follows the policy on their booking. See{" "}
          <Link href="/docs/refunds-and-cancellations#which-policy" className={A}>
            the four policies
          </Link>
          .
        </p>
      ),
    },
    {
      id: "bookings",
      heading: "Handle bookings",
      body: (
        <ul role="list">
          <li>{HOTEL_ROOM_BY_CARD} It is confirmed when the payment clears.</li>
          <li>
            A booking that needs your answer waits in{" "}
            <Link href="/host/decide" className={A}>
              Decide by
            </Link>
            , soonest to lapse first, with the clock showing.
          </li>
          <li>
            <Link href="/host" className={A}>
              Overview
            </Link>{" "}
            shows requests waiting, who arrives today, and unread messages.
          </li>
          <li>The guest gets the gate details once the booking is confirmed.</li>
        </ul>
      ),
    },
    {
      id: "check-in",
      heading: "Check guests in",
      body: (
        <p>
          From check-in time until three hours after, your guest is asked <em>Is it as listed?</em> A no,
          with a reason and a photo, goes to a person at Vallo, and you are told. Make sure the place
          matches the listing before they arrive.
        </p>
      ),
    },
    {
      id: "getting-paid",
      heading: "Get paid",
      body: (
        <>
          <p>
            Your share goes to the bank account on your payout details. {COMMISSION_FROM_SHARE}
          </p>
          <p>{HOTEL_COMMISSION_SENTENCE}</p>
          <p>
            <Link href="/host/earnings" className={A}>
              Earnings
            </Link>{" "}
            shows every payment, with a monthly statement you can download.
          </p>
        </>
      ),
    },
    {
      id: "reviews",
      heading: "Answer reviews",
      body: (
        <p>
          Reply to each review once from{" "}
          <Link href="/host/reviews" className={A}>
            Reviews
          </Link>
          , or ask Vallo to look at one that breaks the rules. See{" "}
          <Link href="/docs/reviews" className={A}>
            Reviews
          </Link>
          .
        </p>
      ),
    },
  ],
};

/* --------------------------------------------------------- restaurants */

export const RESTAURANTS: DocChapter = {
  slug: "restaurants",
  number: 0,
  title: "Restaurants and tables",
  summary:
    "Book a table for free, what the restaurant confirms, your check-in code, paying your bill, and how a restaurant runs its tables on Vallo.",
  icon: "concierge-bell",
  sections: [
    {
      id: "free",
      heading: "Booking a table is free",
      body: (
        <p>
          You pay nothing to Vallo or to the restaurant to book a table. You pay your bill at the
          restaurant after you eat.
        </p>
      ),
    },
    {
      id: "book",
      heading: "Book a table",
      body: (
        <>
          <DocsFlow
            label="Booking a table"
            steps={[
              { object: "calendar-grid", label: "Ask for a table" },
              { object: "seal-check", label: "The restaurant confirms" },
              { object: "concierge-bell", label: "Show your code" },
            ]}
          />
          <ol role="list">
            <li>
              Open{" "}
              <Link href="/restaurants" className={A}>
                Restaurants
              </Link>{" "}
              and pick one.
            </li>
            <li>
              Choose a date, a time and a party size. Times are Lagos time. You can book up to{" "}
              {MAX_DAYS_AHEAD} days ahead, for up to {MAX_PARTY} people.
            </li>
            <li>Read the house rules: how long a sitting lasts, how long a late table is held, and how much notice to give if you cannot come.</li>
            <li>Send the request.</li>
          </ol>
        </>
      ),
    },
    {
      id: "what-happens-next",
      heading: "What happens next",
      body: (
        <ol role="list">
          <li>The restaurant confirms the table or declines, and you are told.</li>
          <li>The booking opens its own conversation, so running late is a message.</li>
          <li>It sits in Plans at its time, with a check-in code.</li>
          <li>Vallo reminds you the evening before and two hours before.</li>
          <li>Show the code when you arrive. The restaurant marks your table seated.</li>
          <li>
            If the restaurant does not answer, Vallo asks you the next day whether you dined. If you and
            the restaurant disagree, Vallo decides.
          </li>
        </ol>
      ),
    },
    {
      id: "paying-the-bill",
      heading: "Pay your bill",
      body: (
        <p>
          Pay the restaurant directly when you eat. Paying the bill through Vallo is not switched on yet.
        </p>
      ),
    },
    {
      id: "cancel",
      heading: "Cancel a table",
      body: (
        <p>
          Cancel from the reservation. Nothing was paid, so nothing comes back. Give the notice the
          restaurant asks for if you can.
        </p>
      ),
    },
    {
      id: "review",
      heading: "Review a restaurant",
      body: <p>Only a diner whose table was marked seated can review the restaurant.</p>,
    },
    {
      id: "for-restaurants",
      heading: "Run a restaurant on Vallo",
      body: (
        <>
          <ul role="list">
            <li>
              Set up from{" "}
              <Link href="/host/start" className={A}>
                host setup
              </Link>{" "}
              and choose restaurant. Vallo reviews your papers before you are published.
            </li>
            <li>Set your hours, how many people each sitting can take, and your house rules.</li>
            <li>
              Open{" "}
              <Link href="/host/reservations" className={A}>
                Reservations
              </Link>
              . Today at a glance shows covers expected, tables to confirm, seated and done. Tables are
              listed by day (today, upcoming, earlier), and you can search by guest, note, venue or party
              size.
            </li>
            <li>
              On each request, confirm when you have a table, or decline. A line shows how many tables the
              guest kept and missed across Vallo in the last 12 months, counts only; a first-time guest shows none.
            </li>
            <li>
              After the time, mark the table seated (type the diner&rsquo;s six-digit code, or tap
              Seated) or a no-show. Seated opens three hours before the table.
            </li>
          </ul>
          <p>
            <strong>Your fee:</strong> listing is free, and booking is free for diners. Vallo bills you{" "}
            {SEATED_TABLE_FEE} for each table seated from a Vallo booking, once a month.
          </p>
        </>
      ),
    },
  ],
};

/* -------------------------------------------------------------- badges */

export const BADGES_AND_VERIFICATION: DocChapter = {
  slug: "badges-and-verification",
  number: 0,
  title: "Badges and verification",
  summary:
    "What the verification ladder, the Ownership seen mark and the badges mean, how each is earned, and their limits. A badge is not a guarantee.",
  icon: "shield-check",
  sections: [
    {
      id: "what-a-badge-means",
      heading: "What a badge means",
      body: (
        <>
          <p>
            The verification ladder says what Vallo has confirmed about a lister, one rung at a time. The
            Ownership seen mark says a reviewer has seen an owner&rsquo;s document. A badge says something a
            person has earned, such as replying quickly.
          </p>
          <p>
            A person at Vallo decides each verification rung and each ownership document. Most badges are
            awarded each night from what has really happened on Vallo. Vallo can remove a badge if
            something changes.
          </p>
        </>
      ),
    },
    {
      id: "the-ladder",
      heading: "Read the verification ladder",
      body: (
        <p>
          A lister climbs four rungs, in order:{" "}
          {VERIFICATION_ORDER.map((rung) => rung.label.toLowerCase()).join(", ")}. The{" "}
          <strong>Verified</strong> tick appears only once a person here
          has checked the ID of the lister behind the listing. See{" "}
          <Link href="/docs/for-agents#verification" className={A}>
            the ladder in full
          </Link>
          .
        </p>
      ),
    },
    {
      id: "ownership-seen",
      heading: "Read the Ownership seen mark",
      body: (
        <>
          <p>
            An owner can upload a document they hold on the property. When a reviewer approves it, an{" "}
            <strong>Ownership seen</strong> mark with the date shows on the owner&rsquo;s profile, listings
            and search results.
          </p>
          <p>
            Its limits: it means a reviewer saw a document. It is not a title search, it does not say the
            title is good, and it is not legal advice. Before you buy, have your own lawyer look at the
            title.
          </p>
        </>
      ),
    },
    {
      id: "what-it-does-not-mean",
      heading: "What a badge does not mean",
      body: (
        <>
          <p>
            A badge is not a guarantee. It does not promise that a person will behave well, that a listing
            is exactly as described, or that a deal will go well. Weigh it with the listing, the photos, the
            conversation and a viewing.
          </p>
          <p>Whatever the badge says, pay only inside Vallo, and only after the viewing.</p>
        </>
      ),
    },
    {
      id: "agent-badges",
      heading: "Agent badges",
      body: (
        <ul role="list">
          <li><strong>Verified agent.</strong> Identity and payout account confirmed and the application approved.</li>
          <li><strong>First listing.</strong> The first listing was published.</li>
          <li><strong>Fast responder.</strong> A quick typical first reply across many conversations.</li>
          <li><strong>Ten stays.</strong> Ten bookings completed.</li>
          <li><strong>Estate specialist.</strong> Several published listings in one area.</li>
          <li><strong>Photo pro.</strong> Listings that passed the photo checks.</li>
          <li><strong>Vallo Elite.</strong> A high bar over time. It is removed while there is an open trust flag.</li>
        </ul>
      ),
    },
    {
      id: "member-badges",
      heading: "Member badges",
      body: (
        <ul role="list">
          <li><strong>Confirmed member.</strong> Email and phone confirmed.</li>
          <li><strong>First stay.</strong> A first completed booking.</li>
          <li><strong>Honest reviewer.</strong> Reviews written after real stays.</li>
          <li><strong>Neighbour</strong> and <strong>Local guide.</strong> Helpful contributions to a place on Around.</li>
          <li><strong>Year one.</strong> A year since joining.</li>
          <li><strong>Top contributor.</strong> Given by Vallo to someone who has helped others.</li>
        </ul>
      ),
    },
  ],
};
