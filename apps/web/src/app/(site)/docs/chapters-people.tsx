import Link from "next/link";
import { LISTING_SALE_ABOUT, NO_INSPECTION_FEE, PRIVATE_FEE_NOTE } from "@/lib/money/copy";
import { SUPPLY_DOORS, SUPPLY_DOOR_HREF, doorsSentence } from "@/lib/supply/roles";
import { VERIFICATION_ORDER } from "@/lib/trust/verification";
import { MAX_BLOCK_NIGHTS } from "@/lib/agent/calendar-model";
import type { DocChapter } from "./chapters";
import { DocsFlow } from "./DocsFlow";
import {
  CARD_MEANS,
  ESCROW_MEANS,
  ESCROW_OR_CARD,
  HOTEL_ROOM_BY_CARD,
  PAY_INSIDE_VALLO,
  PRICE_IS_THE_PRICE,
  SALE_TAKES_NO_MONEY,
} from "./facts";

/**
 * THE CHAPTERS FOR EACH KIND OF PERSON (the docs track, 13 October 2026):
 * your account and workspaces, searching, reading a listing, the road from a
 * viewing to the keys, booking a stay, reviews, and the two chapters for the
 * people who list: owners and landlords, and agents and firms.
 *
 * The same rules as `chapters.tsx`: one topic each, task-first headings,
 * short sentences, nothing that is not built, money sentences from
 * `facts.ts` or `lib/money/copy.ts`, and no provider named.
 */

const A = "font-semibold text-[var(--nf-content-link)] hover:underline";

/* ------------------------------------------------------ account, workspaces */

export const ACCOUNT_AND_WORKSPACES: DocChapter = {
  slug: "getting-started",
  number: 0,
  title: "Your account and workspaces",
  summary:
    "Create an account, sign in, fill in your profile, and add a workspace to list, host or work as an agent. One account holds one side.",
  icon: "user-check",
  sections: [
    {
      id: "creating-an-account",
      heading: "Create an account",
      body: (
        <>
          <ol role="list">
            <li>
              Go to{" "}
              <Link href="/sign-up" className={A}>
                Sign up
              </Link>
              .
            </li>
            <li>Use your email and a password, or Google. Apple appears when it is switched on.</li>
            <li>With email, open the confirmation we send you. The account is then ready.</li>
          </ol>
          <p>
            An account is free. You need one to book, to pay, to message and to post, because each of
            those has to belong to somebody. You must be 18 or over.
          </p>
        </>
      ),
    },
    {
      id: "signing-in",
      heading: "Sign in, or get back in",
      body: (
        <ul role="list">
          <li>
            <Link href="/sign-in" className={A}>
              Sign in
            </Link>{" "}
            the way you signed up. A Google account has no password.
          </li>
          <li>
            Forgot your password? Use{" "}
            <Link href="/forgot-password" className={A}>
              Forgot password
            </Link>{" "}
            and we email you a link.
          </li>
          <li>Tap something that needs an account while signed out, and you come back to it after signing in.</li>
        </ul>
      ),
    },
    {
      id: "your-profile",
      heading: "Fill in your profile",
      body: (
        <>
          <p>
            <Link href="/profile" className={A}>
              Your profile
            </Link>{" "}
            holds your name, phone number, photo, state and local government, and what you do. Your
            bookings, agreements, saved places and reviews open from it.
          </p>
          <p>
            Claim a handle, and your public page lives at <code>/u/your-handle</code>. Handles are 3 to
            20 lowercase letters, digits or underscores, starting with a letter. You choose what shows
            there under Privacy.
          </p>
        </>
      ),
    },
    {
      id: "workspaces",
      heading: "Add a workspace to list or host",
      body: (
        <>
          <p>
            A workspace is where you list, host or answer enquiries. Open{" "}
            <Link href={SUPPLY_DOOR_HREF} className={A}>
              Add a workspace
            </Link>{" "}
            and pick the one that fits: {doorsSentence()}, a hotel, a shortlet, or a restaurant.
          </p>
          <p>
            <strong>One account holds one side.</strong> An account is either an owner (landlord)
            account or an agent account, never both. If you are both, use two accounts.
          </p>
          <p>
            When you add a workspace you accept the{" "}
            <Link href="/terms" className={A}>
              Terms
            </Link>{" "}
            and the{" "}
            <Link href="/privacy" className={A}>
              Privacy Policy
            </Link>
            , and agree that every payment for a deal happens inside Vallo. Hosts also accept the{" "}
            <Link href="/host-agreement" className={A}>
              Host Agreement
            </Link>
            .
          </p>
          <p>
            <strong>What happens next:</strong> a person at Vallo reviews what you send. You can follow
            it from your profile. If something is missing, you are told what, and you send the same
            application again.
          </p>
        </>
      ),
    },
    {
      id: "settings",
      heading: "Change your settings",
      body: (
        <ul role="list">
          <li>
            <strong>Appearance.</strong> Light, dark or system, and how much the app moves.
          </li>
          <li>
            <strong>Language.</strong> English, Yorùbá, Hausa or Igbo.
          </li>
          <li>
            <strong>Notifications.</strong> Bookings, messages, payments and agreements, and ideas and
            offers. Marketing is off until you turn it on.
          </li>
          <li>
            <strong>Privacy.</strong> Hide my activity, and Data saver.
          </li>
          <li>
            <strong>Security.</strong> Change your password and sign out.
          </li>
          <li>
            <strong>Your data.</strong> Ask for a copy, or delete the account. See{" "}
            <Link href="/docs/your-data-and-your-rights" className={A}>
              Privacy and your data
            </Link>
            .
          </li>
        </ul>
      ),
    },
  ],
};

/* ------------------------------------------------------------- searching */

export const FINDING_A_PLACE: DocChapter = {
  slug: "finding-a-place",
  number: 0,
  title: "Search, filters and the map",
  summary:
    "Search property and stays, use the filters (power and water too), switch to the map, save places and searches, and share a search by its link.",
  icon: "home-search",
  sections: [
    {
      id: "searching",
      heading: "Search for property",
      body: (
        <>
          <p>
            Open{" "}
            <Link href="/search" className={A}>
              Search
            </Link>{" "}
            and type a city, an area or the kind of place you want. The tiles across the top narrow it
            to one kind: rentals, homes, apartments, shortlets, villas, shops, offices, land and more.
          </p>
          <p>Sort by Recommended, Top rated, Price low to high, or Price high to low.</p>
        </>
      ),
    },
    {
      id: "searching-stays",
      heading: "Search for a stay with your dates",
      body: (
        <>
          <p>
            On the Stays side, open{" "}
            <Link href="/stays/search" className={A}>
              the stay search
            </Link>{" "}
            and set where, check-in, check-out and guests. Every price then shows the total for your
            nights. A place that cannot take your party is not shown.
          </p>
          <p>
            Restaurants have their own shelf at{" "}
            <Link href="/restaurants" className={A}>
              Restaurants
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "filters",
      heading: "Narrow it down with filters",
      body: (
        <ul role="list">
          <li>
            <strong>Budget.</strong> A minimum, a maximum, or both, in naira.
          </li>
          <li>
            <strong>Bedrooms and bathrooms.</strong> The least you need.
          </li>
          <li>
            <strong>Guests.</strong> How many the place must take.
          </li>
          <li>
            <strong>Amenities.</strong> Wi-Fi, air conditioning, kitchen, parking, pool, security,
            backup power, running water and more. Every one you tick must be there.
          </li>
          <li>
            <strong>Instant book.</strong> Only places you can book without waiting for the host.
          </li>
          <li>
            <strong>Verified only.</strong> Only listings whose lister a person at Vallo has checked.
          </li>
        </ul>
      ),
    },
    {
      id: "power-and-water",
      heading: "Filter on light and water",
      body: (
        <ul role="list">
          <li>
            <strong>Power filters must all be true.</strong> Backup power (a generator, inverter or
            solar) and Band A (the address is on a Band A feeder). Tick both, and the place must have
            both.
          </li>
          <li>
            <strong>Water filters accept any one.</strong> Treated mains, borehole, pumped storage or
            tanker delivery. Tick two, and either will do.
          </li>
          <li>A lister who has not answered is not counted as a yes.</li>
        </ul>
      ),
    },
    {
      id: "the-map",
      heading: "See results on the map",
      body: (
        <p>
          Switch between List and Map beside the sort control. Each pin shows the price. Pins close
          together group until you zoom in. Tap a pin for the card, and the card for the listing. Your
          last choice is remembered.
        </p>
      ),
    },
    {
      id: "saving",
      heading: "Save places",
      body: (
        <p>
          Tap the heart on a card or a listing. Your shortlist is in{" "}
          <Link href="/saved" className={A}>
            Saved
          </Link>
          . Hearts tapped before you sign in are kept on your device and moved to your account when you
          sign in.
        </p>
      ),
    },
    {
      id: "saved-searches",
      heading: "Save a search and get told about new matches",
      body: (
        <p>
          Filter the results down, then save the search. It waits in{" "}
          <Link href="/saved/searches" className={A}>
            Saved searches
          </Link>{" "}
          under the name you give it. Turn on alerts, and you are told when a new place fits it.
        </p>
      ),
    },
    {
      id: "sharing-a-search",
      heading: "Share a search",
      body: (
        <p>
          Every filter is in the address bar. Copy the link and send it: it opens on the same results,
          dates and all.
        </p>
      ),
    },
  ],
};

/* -------------------------------------------------------- reading a listing */

export const UNDERSTANDING_A_LISTING: DocChapter = {
  slug: "understanding-a-listing",
  number: 0,
  title: "Reading a listing",
  summary:
    "What is on a listing page: the move-in total, highlights, amenities, the gallery, who listed it and how to reach them, light and water, and the gate.",
  icon: "listing-review",
  sections: [
    {
      id: "the-page",
      heading: "What is on the page",
      body: (
        <ol role="list">
          <li>The cover photo, with Watch video where the lister added a video.</li>
          <li>The title, the area and the price, with the move-in total on a rental.</li>
          <li>The key facts: rooms, bathrooms, size and more. Tap Show all details for the rest.</li>
          <li>Highlights, the description, amenities, light and water.</li>
          <li>Listed by: who put the listing up.</li>
          <li>The gallery, reviews and the map.</li>
        </ol>
      ),
    },
    {
      id: "highlights",
      heading: "Read the highlights",
      body: (
        <p>
          The highlights card shows up to three facts the lister gave: the power supply, the backup and
          its hours, the water, or the move-in total. Nothing in it is estimated or guessed. A fact the
          lister did not answer is left out, and with fewer than two facts there is no card.
        </p>
      ),
    },
    {
      id: "amenities",
      heading: "Check the amenities",
      body: (
        <p>
          Each amenity the lister ticked has its own tile, such as Wi-Fi, parking, security or a
          generator. If something you need is not there, message the lister and ask before you view.
        </p>
      ),
    },
    {
      id: "gallery",
      heading: "See every photo and video",
      body: (
        <p>
          The gallery strip shows the first few. Tap View all to open every photo and video full screen,
          in order.
        </p>
      ),
    },
    {
      id: "listed-by",
      heading: "See who listed it",
      body: (
        <>
          <p>
            The Listed by card shows the lister&rsquo;s name and photo, and one word for who they are:{" "}
            <strong>Landlord</strong>, <strong>Agent</strong> or <strong>Agency</strong>. Where they have a
            public profile, tap the name to open it.
          </p>
          <ul role="list">
            <li>
              Their badge is the one they have earned on Vallo. An example listing never carries one.
            </li>
            <li>
              Under the name, it says either that a person at Vallo checked their ID before the listing
              went live, or that they manage this listing on Vallo.
            </li>
            <li>
              <strong>Message</strong> opens a chat about this listing.
            </li>
            <li>
              <strong>Call</strong> rings the lister only inside a chat you already have about this
              listing, and only where calls are switched on. Otherwise, message them first to arrange a
              call.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "schedule-a-visit",
      heading: "Schedule a visit",
      body: (
        <p>
          On a rental or a sale, the main button is Schedule a visit. Choose in person or video, pick an
          open time or suggest one, and send. A visit never takes money. See{" "}
          <Link href="/docs/viewings#two-ways" className={A}>
            Schedule a visit
          </Link>
          .
        </p>
      ),
    },
    {
      id: "move-in-total",
      heading: "Read the move-in total",
      body: (
        <>
          <p>
            On a rental, the rent is not the whole cost. The move-in total is the rent plus every other
            sum due before you get the keys, such as caution, agency and legal fees. It is shown as one
            figure, with its parts.
          </p>
          <p>{PRICE_IS_THE_PRICE}</p>
        </>
      ),
    },
    {
      id: "badges",
      heading: "Understand the marks beside the lister",
      body: (
        <ul role="list">
          <li>
            <strong>Verified.</strong> A person at Vallo checked the ID of the lister behind this
            listing.
          </li>
          <li>
            <strong>Ownership seen.</strong> A reviewer has seen the owner&rsquo;s own proof of
            ownership, with the date. It is not a title search.
          </li>
          <li>
            <strong>Instant book.</strong> You can book without waiting for the host to accept.
          </li>
        </ul>
      ),
    },
    {
      id: "verified-vs-partner",
      heading: "Know where listings come from",
      body: (
        <p>
          Every real listing on Vallo was put up by a person who applied and was approved, and reviewed
          before it went live. Nothing is imported or scraped. See{" "}
          <Link href="/docs/badges-and-verification" className={A}>
            Badges and verification
          </Link>{" "}
          for what each mark does and does not mean.
        </p>
      ),
    },
    {
      id: "light",
      heading: "Read the light row",
      body: (
        <ul role="list">
          <li>
            <strong>The grid.</strong> Band A (20 hours a day or more), mostly on, patchy, rarely on, or
            no grid supply.
          </li>
          <li>
            <strong>The backup.</strong> None, a generator, an inverter, solar, or generator and
            inverter, and how many hours a day it runs.
          </li>
          <li>
            <strong>The meter.</strong> Whether the unit is on a prepaid meter.
          </li>
          <li>If the lister has not answered, the listing says so. Message them to ask.</li>
        </ul>
      ),
    },
    {
      id: "water",
      heading: "Read the water row",
      body: (
        <p>
          One of five: treated mains, borehole, pumped storage, tanker delivery, or no running water.
        </p>
      ),
    },
    {
      id: "the-gate",
      heading: "Get the gate details",
      body: (
        <p>
          The estate name, directions, the security post number and any access code are never on the
          public listing. Before you book, the page says the estate has a gate. Once your booking is
          confirmed, the details appear on the listing and on your booking.
        </p>
      ),
    },
    {
      id: "rent-listings",
      heading: "Rent or buy: there is no Reserve button",
      body: (
        <p>
          A yearly rental or a sale is not booked like a stay. You message the lister, view the place,
          then agree and pay inside Vallo. See{" "}
          <Link href="/docs/agreements-and-paying" className={A}>
            From viewing to keys
          </Link>
          .
        </p>
      ),
    },
    {
      id: "examples",
      heading: "Spot an example listing",
      body: (
        <p>
          A listing marked Example shows what a listing looks like. It cannot be rented, bought or
          booked.
        </p>
      ),
    },
  ],
};

/* ----------------------------------------------------- viewing to the keys */

export const AGREEMENTS_AND_PAYING: DocChapter = {
  slug: "agreements-and-paying",
  number: 0,
  title: "From viewing to keys",
  summary:
    "Renting or buying, step by step: the viewing, the inspection report, the agreement you both confirm, paying by card, and moving in.",
  icon: "contract-sign",
  sections: [
    {
      id: "the-steps",
      heading: "The steps, in order",
      body: (
        <>
          <DocsFlow
            label="From viewing to keys"
            steps={[
              { object: "calendar-check", label: "View it" },
              { object: "doc-home", label: "Inspection report" },
              { object: "contract-sign", label: "Both confirm" },
              { object: "payment-sent", label: "Pay on Vallo" },
              { object: "keys-handover", label: "Move in" },
            ]}
            caption={NO_INSPECTION_FEE}
          />
          <p>
            Money moves only after you have seen the place and decided. Nothing on this road is paid
            outside Vallo.
          </p>
        </>
      ),
    },
    {
      id: "view-it",
      heading: "1. View the place",
      body: (
        <p>
          Tap Schedule a visit on the listing, in person or by video. See{" "}
          <Link href="/docs/viewings" className={A}>
            Viewings
          </Link>
          . {PRIVATE_FEE_NOTE}
        </p>
      ),
    },
    {
      id: "inspection-report",
      heading: "2. Submit the inspection report",
      body: (
        <p>
          After the viewing, tick the eight rooms and areas on the inspection report, add notes and
          photos, and submit it. It records what you saw and when.
        </p>
      ),
    },
    {
      id: "the-agreement",
      heading: "3. Confirm the agreement",
      body: (
        <>
          <ul role="list">
            <li>
              The agreement is drawn up from the listing&rsquo;s own figures and your report, with the
              move-in date and the day the keys are handed over.
            </li>
            <li>You and the owner or agent each confirm the same version.</li>
            <li>If anything changes, the version moves and you both confirm again.</li>
            <li>An agent confirming for an owner confirms that they hold the owner&rsquo;s instruction.</li>
          </ul>
          <p>
            Your agreements are in{" "}
            <Link href="/agreements" className={A}>
              Agreements
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "pay",
      heading: "4. Pay inside Vallo",
      body: (
        <>
          <p>
            <strong>For rent:</strong> {ESCROW_OR_CARD}
          </p>
          <ul role="list">
            <li>{ESCROW_MEANS}</li>
            <li>{CARD_MEANS}</li>
          </ul>
          <p>
            <strong>For a sale:</strong> {SALE_TAKES_NO_MONEY} {LISTING_SALE_ABOUT}
          </p>
          <p>
            {PAY_INSIDE_VALLO} See{" "}
            <Link href="/docs/paying-on-vallo" className={A}>
              How paying works
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "move-in",
      heading: "5. Move in",
      body: (
        <p>
          <strong>What happens next:</strong> your tenancy gets its own page with the agreement,
          receipts and reports. About a month after you move in, Vallo asks you for a review, starting
          with whether you paid anyone anything beyond what you paid on Vallo. Your answer to that
          question is private.
        </p>
      ),
    },
  ],
};

/* --------------------------------------------------------- booking a stay */

/*
 * BOOKING A STAY (replaces "Booking and paying"; `/docs/booking-and-paying`
 * redirects here). The ids `reserve-and-hold`, `who-is-arriving`,
 * `the-rules-that-refuse`, `the-price-breakdown`, `confirmation`,
 * `cancelling` and `trips` are kept so the old chapter's links still land.
 */
export const BOOKING_A_STAY: DocChapter = {
  slug: "booking-a-stay",
  number: 0,
  title: "Booking a stay",
  summary:
    "Book a hotel room, a shortlet or a serviced apartment: see the full price first, pay inside Vallo, get the gate details, and check the place when you arrive.",
  icon: "calendar-check",
  sections: [
    {
      id: "reserve-and-hold",
      heading: "Book a stay",
      body: (
        <>
          <DocsFlow
            label="Booking a stay"
            steps={[
              { object: "calendar-grid", label: "Pick your dates" },
              { object: "receipt-check", label: "See the full price" },
              { object: "payment-sent", label: "Pay on Vallo" },
              { object: "luggage-check", label: "In your Plans" },
            ]}
          />
          <p>
            <strong>A hotel room.</strong> Pick the room and the rate. {HOTEL_ROOM_BY_CARD} The booking
            is confirmed when the payment clears.
          </p>
          <p>
            <strong>A shortlet or serviced apartment.</strong> Reserve your dates. The nights are held
            for you for 48 hours at no cost. A listing marked <strong>Instant book</strong> can be paid at once. Otherwise
            the host accepts or declines first, and you are told which.
          </p>
          <p>
            <strong>Paying.</strong> {ESCROW_OR_CARD} See{" "}
            <Link href="/docs/paying-on-vallo" className={A}>
              How paying works
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "the-price-breakdown",
      heading: "See the full price before you book",
      body: (
        <>
          <ul role="list">
            <li>The nightly rate times the nights, written out.</li>
            <li>Cleaning, only if the host charges it.</li>
            <li>
              Any charge at the door, such as a caution deposit, power, cleaning, an extra guest or a
              visitor, listed before you book.
            </li>
            <li>The total. Nothing from Vallo is added to it.</li>
          </ul>
          <p>
            The price is fixed from the listing when you book, so it cannot move before you pay. A host
            must not ask for anything that is not listed. If one does, do not pay it, and report it.
          </p>
        </>
      ),
    },
    {
      id: "who-is-arriving",
      heading: "Book for someone else",
      body: (
        <p>
          The person paying need not be the person staying. Name the guest who will arrive, with their
          phone number, and that is who the host expects. Leave it blank and the booking is yours.
        </p>
      ),
    },
    {
      id: "the-rules-that-refuse",
      heading: "If a booking is refused",
      body: (
        <ul role="list">
          <li>
            <strong>Too few nights.</strong> The host has a minimum stay. The message names it.
          </li>
          <li>
            <strong>Too many guests.</strong> The place takes fewer people than your party.
          </li>
          <li>
            <strong>Dates taken.</strong> Somebody booked them first. Pick other dates.
          </li>
        </ul>
      ),
    },
    {
      id: "confirmation",
      heading: "What happens after you pay",
      body: (
        <ol role="list">
          <li>The booking is confirmed and the nights are closed to anyone else.</li>
          <li>The gate details appear on the listing and on your booking.</li>
          <li>You get a notification and an email with the booking.</li>
          <li>The host is told who is coming.</li>
        </ol>
      ),
    },
    {
      id: "arrival",
      heading: "Check the place when you arrive",
      body: (
        <p>
          From check-in time until three hours after, your booking asks <em>Is it as listed?</em> Tap
          yes, or tap no, give a reason and add a photo taken there. A no goes to a person at Vallo.
        </p>
      ),
    },
    {
      id: "cancelling",
      heading: "Cancel a stay",
      body: (
        <p>
          The policy on your booking decides what comes back. See{" "}
          <Link href="/docs/refunds-and-cancellations" className={A}>
            Cancellations and refunds
          </Link>
          .
        </p>
      ),
    },
    {
      id: "trips",
      heading: "Find your stays in Plans",
      body: (
        <p>
          On the Stays side,{" "}
          <Link href="/bookings?side=stays&from=stays" className={A}>
            Plans
          </Link>{" "}
          lists your stays and tables by date: today in the middle, what is coming above, and what is
          finished below. After a stay you can leave a review; see{" "}
          <Link href="/docs/reviews" className={A}>
            Reviews
          </Link>
          .
        </p>
      ),
    },
  ],
};

/* ---------------------------------------------------------------- reviews */

export const REVIEWS: DocChapter = {
  slug: "reviews",
  number: 0,
  title: "Reviews",
  summary:
    "Who can review a stay, a table or a tenancy, how a host replies, and what happens when a host asks Vallo to look at a review.",
  icon: "reviews",
  sections: [
    {
      id: "who-can-review",
      heading: "Who can leave a review",
      body: (
        <ul role="list">
          <li>
            <strong>A stay.</strong> The guest, after a completed booking.
          </li>
          <li>
            <strong>A restaurant.</strong> Only a diner whose table was marked seated.
          </li>
          <li>
            <strong>A tenancy.</strong> The tenant, about a month after moving in. The first question is
            whether you paid anyone anything beyond what you paid on Vallo. That answer is private.
          </li>
        </ul>
      ),
    },
    {
      id: "write-a-review",
      heading: "Write a review",
      body: (
        <p>
          Open the booking from Plans and give a rating and a few words about what it was really like. A
          review cannot be edited once it is posted, so read it before you send it.
        </p>
      ),
    },
    {
      id: "replies",
      heading: "Reply to a review as a host or lister",
      body: (
        <p>
          You can answer each review once, publicly, from Reviews in your workspace. The guest is told.
          Keep it to the facts.
        </p>
      ),
    },
    {
      id: "contest",
      heading: "Ask Vallo to look at a review",
      body: (
        <p>
          A host who thinks a review breaks the rules can ask Vallo to look at it. The review stays up
          while Vallo looks. Vallo then keeps it, or hides it with a public note saying why. Both sides
          are told. Nothing is deleted.
        </p>
      ),
    },
    {
      id: "reading-ratings",
      heading: "Read a rating",
      body: (
        <p>
          A rating is shown with the number of reviews behind it. Two reviews say very little; read what
          people wrote.
        </p>
      ),
    },
  ],
};

/* --------------------------------------------------------- owners, landlords */

export const FOR_OWNERS: DocChapter = {
  slug: "for-owners",
  number: 0,
  title: "For owners and landlords",
  summary:
    "List your own property with no agency fee: the owner workspace, your ownership document and the Ownership seen mark, viewings, agreements and getting paid.",
  icon: "keys-home",
  sections: [
    {
      id: "start",
      heading: "Set up your owner workspace",
      body: (
        <>
          <p>
            Open{" "}
            <Link href={SUPPLY_DOOR_HREF} className={A}>
              Add a workspace
            </Link>{" "}
            and choose <strong>{SUPPLY_DOORS.owner.title}</strong>. {SUPPLY_DOORS.owner.howLong} It asks
            for:
          </p>
          <ul role="list">
            {SUPPLY_DOORS.owner.needs.map((need) => (
              <li key={need}>{need}</li>
            ))}
          </ul>
          <p>
            An owner account cannot also be an agent account. If you also work as an agent, use a second
            account.
          </p>
        </>
      ),
    },
    {
      id: "ownership-document",
      heading: "Add your ownership document",
      body: (
        <>
          <p>
            Upload what you hold on the property: a Certificate of Occupancy, a deed of assignment,
            governor&rsquo;s consent, a survey plan, a utility bill or a letter of authority. If you hold
            nothing, say so; that is an honest answer and you can still list.
          </p>
          <p>
            <strong>What happens next:</strong> a reviewer at Vallo looks at the document. Once it is
            approved, an <strong>Ownership seen</strong> mark with the date appears beside you on your
            profile, your listings and search results.
          </p>
          <p>
            The mark means a reviewer has seen your document. It is not a title search, and a buyer
            should still have their own lawyer look at the title.
          </p>
        </>
      ),
    },
    {
      id: "list",
      heading: "List your property",
      body: (
        <p>
          Post it from your workspace with photos, videos, the price and every cost a tenant will meet.
          Vallo reviews it before it goes up. See{" "}
          <Link href="/docs/listing-on-vallo" className={A}>
            Listing a property
          </Link>
          .
        </p>
      ),
    },
    {
      id: "viewings",
      heading: "Offer viewing times",
      body: (
        <p>
          Publish the times you can show the place, so renters book a free slot at once. Answer other
          requests by confirming, offering another time or declining, and see every visit on your visit
          calendar. See{" "}
          <Link href="/docs/viewings#for-listers" className={A}>
            Manage visits as a lister
          </Link>
          . {NO_INSPECTION_FEE}
        </p>
      ),
    },
    {
      id: "get-paid",
      heading: "Agree terms and get paid",
      body: (
        <p>
          After the viewing and the inspection report, you and the renter confirm the same agreement. The
          renter then pays inside Vallo, by card, and your share comes to the bank account
          on your payout details. See{" "}
          <Link href="/docs/paying-on-vallo#for-listers" className={A}>
            Get paid
          </Link>
          .
        </p>
      ),
    },
  ],
};

/* ------------------------------------------------------------ agents, firms */

export const FOR_AGENTS: DocChapter = {
  slug: "for-agents",
  number: 0,
  title: "For agents and firms",
  summary:
    "Apply as an agent or a registered firm, climb the verification ladder, list for owners, publish viewing times, work your enquiries and get paid.",
  icon: "person-card",
  sections: [
    {
      id: "applying",
      heading: "Apply as an agent or a firm",
      body: (
        <>
          <p>
            Open{" "}
            <Link href={SUPPLY_DOOR_HREF} className={A}>
              Add a workspace
            </Link>{" "}
            and choose <strong>{SUPPLY_DOORS.agent.title}</strong> or{" "}
            <strong>{SUPPLY_DOORS.firm.title}</strong>. An agent gives:
          </p>
          <ul role="list">
            {SUPPLY_DOORS.agent.needs.map((need) => (
              <li key={need}>{need}</li>
            ))}
          </ul>
          <p>A firm also gives:</p>
          <ul role="list">
            {SUPPLY_DOORS.firm.needs.slice(1).map((need) => (
              <li key={need}>{need}</li>
            ))}
          </ul>
          <p>
            <strong>What happens next:</strong> a person at Vallo reviews it. Your documents go to a
            private store only you and the reviewer can open. Follow it from your profile. An agent
            account cannot also be an owner account.
          </p>
        </>
      ),
    },
    {
      id: "verification",
      heading: "Climb the verification ladder",
      body: (
        <>
          <ol role="list">
            {VERIFICATION_ORDER.map((rung) => (
              <li key={rung.kind}>
                <strong>{rung.label}.</strong> {rung.meaning}
              </li>
            ))}
          </ol>
          <p>
            A person at Vallo decides each rung, in order. See where you stand at{" "}
            <Link href="/agent/verification" className={A}>
              Verification
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "listing-a-property",
      heading: "List a property for an owner",
      body: (
        <p>
          Use{" "}
          <Link href="/agent/list" className={A}>
            List a property
          </Link>
          . State your own fees on the listing, where a tenant can read them. Each listing is reviewed
          before it goes up. See{" "}
          <Link href="/docs/listing-on-vallo" className={A}>
            Listing a property
          </Link>
          .
        </p>
      ),
    },
    {
      id: "viewing-times",
      heading: "Publish viewing times and manage visits",
      body: (
        <p>
          In{" "}
          <Link href="/agent/inspections" className={A}>
            Inspections
          </Link>
          , set the times you can show each place, so renters book a free slot at once. Your visit
          calendar shows today, the next 7 days and the requests that need your answer, by week or by
          month, with filters. A day&rsquo;s viewings can be laid out in order, as a route. See{" "}
          <Link href="/docs/viewings#for-listers" className={A}>
            Manage visits as a lister
          </Link>
          .
        </p>
      ),
    },
    {
      id: "reviews-and-messages",
      heading: "Work your enquiries",
      body: (
        <>
          <p>
            Enquiries arrive in{" "}
            <Link href="/agent/messages" className={A}>
              your inbox
            </Link>
            . Each one has a stage: New, Replied, Viewing booked, Viewed, Offer made, then Let or Lost.
            Vallo moves the stage when it sees a reply, a viewing or a payment, and you can set it by
            hand. A lost enquiry takes one reason.
          </p>
          <ul role="list">
            <li>Quick replies answer the common questions from the listing&rsquo;s own figures.</li>
            <li>Briefs show what renters and buyers are looking for, so you can answer the ones you fit.</li>
            <li>
              <Link href="/agent/analytics" className={A}>
                Analytics
              </Link>{" "}
              shows how enquiries move, and where they are lost.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "calendar",
      heading: "Manage a shortlet calendar",
      body: (
        <p>
          Each nightly listing has a calendar. Close nights you are not letting, up to {MAX_BLOCK_NIGHTS}{" "}
          at a time, and open them again the same way. A guest&rsquo;s held nights and nights you closed
          are kept apart, so an expired hold never opens a night you closed.
        </p>
      ),
    },
    {
      id: "bookings",
      heading: "Accept or decline a booking",
      body: (
        <p>
          <Link href="/agent/bookings" className={A}>
            Bookings
          </Link>{" "}
          shows who is coming, when and for how much. Where a listing does not take Instant book, accept
          or decline from here within 48 hours. Accepting does not mean you are paid; the guest pays
          next, and the booking says which has happened.
        </p>
      ),
    },
    {
      id: "earnings",
      heading: "See what you earned",
      body: (
        <p>
          <Link href="/agent/earnings" className={A}>
            Earnings
          </Link>{" "}
          shows, month by month, what was paid, your share, the payment partner&rsquo;s charge and any
          refunds. Change your payout account in{" "}
          <Link href="/agent/settings" className={A}>
            Agent settings
          </Link>
          .
        </p>
      ),
    },
  ],
};
