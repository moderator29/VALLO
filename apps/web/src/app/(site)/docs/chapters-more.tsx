import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { AI_DISCLOSURE } from "@/lib/ai/consent";
import { NO_INSPECTION_FEE } from "@/lib/money/copy";
import {
  STAYS_DOOR_ORDER,
  STAYS_DOORS,
  SUPPLY_DOORS,
  SUPPLY_DOOR_HREF,
  WORKSPACE_STANDING_COPY,
} from "@/lib/supply/roles";
import { MAX_UPLOAD_LABEL, MAX_VIDEOS, MAX_VIDEO_SECONDS, MIN_MEDIA, RECOMMENDED_MEDIA } from "@/lib/agent/listings-model";
import { EDIT_WINDOW_MINUTES, POST_MAX, POST_MEDIA_MAX } from "@/lib/social/posts-model";
import { MODERATOR_CAN, MODERATOR_CANNOT } from "@/lib/social/areas-model";
import type { DocChapter, DocSection } from "./chapters";
import { DocsFlow } from "./DocsFlow";
import { PAY_INSIDE_VALLO } from "./facts";
import { EULA_ZERO_TOLERANCE } from "@/lib/legal/eula-copy";

/**
 * THE CHAPTERS THE PLATFORM GREW INTO (Track M, the docs pass, 25 September
 * 2026, rewritten by the docs track on 13 October 2026): getting around the
 * app, Price Check, the assistant, listing a property, messages and calls,
 * and Around.
 *
 * The same rules as `chapters.tsx`. Every label a reader will look for on
 * screen is read from the dictionary or the module that draws it, so the
 * document and the screen cannot disagree; every rule is imported from the
 * code that enforces it. Nothing here describes a feature that is not there.
 * `number` and `group` are set by `chapters.tsx` from the reading order.
 */

const A = "font-semibold text-[var(--nf-content-link)] hover:underline";
const en = getDictionary("en");
const look = en.settings.appearance;

/* ------------------------------------------------------ getting around */

export const GETTING_AROUND: DocChapter = {
  slug: "getting-around",
  number: 0,
  title: "Getting around the app",
  summary:
    "The dock and its tray, the menu, light and dark, and the motion setting: how the app is laid out on a phone and a computer, and how to make it look and move the way you like.",
  icon: "map-route",
  sections: [
    {
      id: "the-dock",
      heading: "The dock, and the tray behind it",
      body: (
        <>
          <p>
            On a phone, a dock floats at the foot of the screen with the places you use most. It
            slips away while you scroll down a long page and comes back the moment you scroll
            up, so it never sits on top of what you are reading.
          </p>
          <p>
            The round button at the end of the dock opens a tray. Signed in, the tray holds{" "}
            {[
              en.nav.messages,
              en.shape.plans.title,
              en.nav.saved,
              en.nav.aiAssistant,
              en.nav.agreements,
              en.priceCheck.title,
              en.nav.settings,
            ].join(", ")}{" "}
            and {en.nav.helpSupport}. Signed out it holds {en.nav.aiAssistant},{" "}
            {en.priceCheck.title} and {en.nav.helpSupport}. The tray is a faster door, not a
            second map: everything in it is also in the menu.
          </p>
        </>
      ),
    },
    {
      id: "the-menu",
      heading: "The menu",
      body: (
        <p>
          The menu button at the top of the screen opens the full list of destinations, grouped,
          with your name and your standing at the top. On a computer the same list stays open as
          a rail down the left of the screen. The switch between the Property side and Vallo Stays
          lives in the menu too, and the chapter on{" "}
          <Link href="/docs/what-vallo-is#the-two-sides" className={A}>
            the two sides
          </Link>{" "}
          explains what it changes.
        </p>
      ),
    },
    {
      id: "light-and-dark",
      heading: "Light and dark",
      body: (
        <>
          <p>
            Vallo comes in a light and a dark theme. Choose under Settings, then{" "}
            {look.label}, then {look.theme}: {look.themeLight}, {look.themeDark} or{" "}
            {look.themeSystem}. {look.themeSystem} follows whatever your phone or computer is set
            to, and changes with it.
          </p>
          <p>
            The choice is kept on this device. A few surfaces keep the night in both themes
            because they are built on night photography, such as the photographs on a listing and
            the front of the website; everything around them follows your choice.
          </p>
        </>
      ),
    },
    {
      id: "motion",
      heading: "Motion",
      body: (
        <>
          <p>
            Under Settings, then {look.label}, then {look.motion}, you choose how much the app
            moves. {look.motionNote}
          </p>
          <ul role="list">
            <li>
              <strong>{look.motionCinematic}.</strong> {look.motionCinematicSub}
            </li>
            <li>
              <strong>{look.motionStandard}.</strong> {look.motionStandardSub}
            </li>
            <li>
              <strong>{look.motionCalm}.</strong> {look.motionCalmSub}
            </li>
            <li>
              <strong>{look.motionOff}.</strong> {look.motionOffSub}
            </li>
          </ul>
          <p>Three switches sit under the levels:</p>
          <ul role="list">
            <li>
              <strong>{look.motionSplash}.</strong> {look.motionSplashSub}
            </li>
            <li>
              <strong>{look.motionDoors}.</strong> {look.motionDoorsSub}
            </li>
            <li>
              <strong>{look.motionAmbient}.</strong> {look.motionAmbientSub}
            </li>
          </ul>
          <p>
            The splash and the door moments only play at {look.motionStandard} or{" "}
            {look.motionCinematic}. At {look.motionCalm} and {look.motionOff} nothing loops, nothing
            drifts behind the page, and every screen settles at once.
          </p>
        </>
      ),
    },
  ],
};

/* ------------------------------------------------------------- price check */

const pc = en.priceCheck;

export const PRICE_CHECK: DocChapter = {
  slug: "price-check",
  number: 0,
  title: "Price Check",
  summary:
    "What similar properties near a place are currently advertised for on Vallo, how sure the answer is, and the honest answers it gives when it cannot say.",
  icon: "report-stats",
  sections: [
    {
      id: "what-it-answers",
      heading: "What it answers",
      body: (
        <>
          <p>
            <strong>{pc.lead}</strong> {pc.intro}
          </p>
          <p>
            It reads the asking prices on listings published on Vallo. It is not what anybody
            has paid, it is not an opinion on a particular property, and it is not advice. Find
            it in the dock&rsquo;s tray, in the menu, or at{" "}
            <Link href="/price" className={A}>
              /price
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "what-it-asks",
      heading: "What it asks you",
      body: (
        <>
          <p>
            <strong>{pc.ladder.heading}</strong> The {pc.ladder.state.toLowerCase()}, the{" "}
            {pc.ladder.lga.toLowerCase()}, the {pc.ladder.area.toLowerCase()}, and a pin on the
            map. {pc.ladder.pinHelp}
          </p>
          <p>
            <strong>{pc.subject.heading}</strong> A {pc.subject.apartment.toLowerCase()}, a{" "}
            {pc.subject.home.toLowerCase()}, a {pc.subject.shop.toLowerCase()} or an{" "}
            {pc.subject.office.toLowerCase()}; to rent or for sale; the bedrooms and bathrooms;
            and the size if you know it. {pc.subject.sizeHint}
          </p>
          <p>Opened from a listing, it arrives filled in from that listing, and you can change anything that is wrong.</p>
        </>
      ),
    },
    {
      id: "what-you-get",
      heading: "What you get back",
      body: (
        <>
          <DocsFlow
            label="How Price Check answers"
            steps={[
              { object: "pin-map", label: "Where it is" },
              { object: "home-search", label: "What it is" },
              { object: "listing-search", label: "Nearby listings" },
              { object: "report-stats", label: "Asking range" },
            ]}
          />
          <ul role="list">
            <li>
              <strong>{pc.result.askingRange}.</strong> What the comparable properties near the
              pin are asking.
            </li>
            <li>
              <strong>What it is based on.</strong> How many listings, how far away, and how
              recently they were published, with the listings themselves beneath.
            </li>
            <li>
              <strong>{pc.result.confidence}.</strong> {pc.result.confidenceBody}
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "when-it-says-no",
      heading: "When it says it cannot tell you",
      body: (
        <>
          <p>
            Price Check would rather give no figure than a weak one, and it says which of these
            it has run into:
          </p>
          <ul role="list">
            {[
              pc.refusals.noLocation,
              pc.refusals.noComparables,
              pc.refusals.tooFewComparables,
              pc.refusals.wideDispersion,
              pc.refusals.stale,
              pc.refusals.unsupportedPeriod,
              pc.refusals.demoOnly,
            ].map((r) => (
              <li key={r.title}>
                <strong>{r.title.replace("{count}", "only a few")}.</strong> {r.body.replace(/\{count\}/g, "a few")}
              </li>
            ))}
            <li>
              <strong>{pc.refusals.unsupportedType.title}.</strong> Land, hotels and restaurants
              are priced in ways a street of nearby listings cannot answer: land by plot, title and
              access, and stays and tables by the night and the cover.
            </li>
          </ul>
        </>
      ),
    },
  ],
};

/* ------------------------------------------------------------ the assistant */

export const AI_ASSISTANT: DocChapter = {
  slug: "ai-assistant",
  number: 0,
  title: "The assistant",
  summary:
    "What Vallo's assistant can do for you, what it never does, how to read its answers, and what happens to what you type. It never acts without your approval.",
  icon: "bot",
  sections: [
    {
      id: "what-it-is",
      heading: "What it is",
      body: (
        <>
          <p>
            The assistant answers questions about finding, renting, buying and staying, in English,
            Yorùbá, Hausa or Igbo. It searches the same listings you do, so it only names places that are
            really on Vallo, and it links each one.
          </p>
          <p>{AI_DISCLOSURE.body}</p>
          <p>
            The first time you open it, you are asked to agree to that before anything is sent.{" "}
            {AI_DISCLOSURE.human}.
          </p>
        </>
      ),
    },
    {
      id: "what-it-can-do",
      heading: "Ask it to find, compare and explain",
      body: (
        <ul role="list">
          <li>
            <strong>Search.</strong> Homes to rent or buy, stays and restaurants, with the figures each
            listing states.
          </li>
          <li>
            <strong>Compare.</strong> Two to four listings side by side: the price and what it covers,
            bedrooms, where it is, light and water, and how far the lister has climbed the verification
            ladder.
          </li>
          <li>
            <strong>Explain moving-in costs.</strong> The rent is rarely the whole number, and it names the
            usual extra fees.
          </li>
          <li>
            <strong>Describe an area</strong> from what people who live there have posted on Around, as
            their words.
          </li>
          <li>
            <strong>Point you to the right screen.</strong> Ask where to do something, and it links the
            screen.
          </li>
        </ul>
      ),
    },
    {
      id: "your-approval",
      heading: "It never acts without your approval",
      body: (
        <p>
          The assistant reads and answers. It cannot book, pay, publish or send a message for you. Nothing
          happens to your account, your listings or your money unless you do it, or you approve the exact
          action first.
        </p>
      ),
    },
    {
      id: "what-it-will-not-do",
      heading: "What it will not do",
      body: (
        <ul role="list">
          <li>Invent a listing, a price, a date, a rating or a review.</li>
          <li>
            Say a land title is good. It says which document a listing states, says so when it states none,
            and sends you to a lawyer before any money moves.
          </li>
          <li>Suggest paying outside Vallo, for any reason. {PAY_INSIDE_VALLO}</li>
          <li>Follow instructions hidden in a listing or a post. It treats them as text to read.</li>
        </ul>
      ),
    },
    {
      id: "reading-an-answer",
      heading: "Read an answer",
      body: (
        <>
          <DocsFlow
            label="How an answer is built"
            steps={[
              { object: "chat-duo", label: "You ask" },
              { object: "listing-search", label: "It searches Vallo" },
              { object: "doc-review", label: "It answers" },
              { object: "home-check", label: "Linked listings" },
            ]}
          />
          <ul role="list">
            <li>Every place it names links to the listing.</li>
            <li>An example listing is marked Example and cannot be rented, bought or booked.</li>
            <li>A rating comes with the number of reviews behind it.</li>
            <li>When nothing fits, it says so and suggests widening the search.</li>
          </ul>
          <p>
            Open it from the menu, or at{" "}
            <Link href="/assistant" className={A}>
              /assistant
            </Link>
            . Workspaces have their own assistant for listers and hosts.
          </p>
        </>
      ),
    },
  ],
};

/* ------------------------------------------------------- listing on Vallo */

const STANDINGS = (["draft", "pending", "refused", "suspended"] as const).flatMap((key) => {
  const copy = (WORKSPACE_STANDING_COPY as Record<string, { label: string | null; meaning: string | null }>)[key];
  return copy?.label ? [{ key, label: copy.label, meaning: copy.meaning ?? "" }] : [];
});

export const LISTING_ON_VALLO: DocChapter = {
  slug: "listing-on-vallo",
  number: 0,
  title: "Listing a property",
  summary:
    "Choose your workspace, post a listing with photos and videos, see what you will receive, and what happens when Vallo reviews it.",
  icon: "keys-handover",
  sections: [
    {
      id: "the-doors",
      heading: "Choose your workspace",
      body: (
        <>
          <p>
            Everybody who lists starts at{" "}
            <Link href={SUPPLY_DOOR_HREF} className={A}>
              Add a workspace
            </Link>
            . The one you pick decides what Vallo asks you for, because each kind of lister can go wrong
            in a different way. One account holds one side: owner or agent, never both.
          </p>
          <DocsFlow
            label="From a workspace to a published listing"
            steps={[
              { object: "person-card", label: "Pick a workspace" },
              { object: "id-card-check", label: "Say who you are" },
              { object: "doc-review", label: "A person reviews it" },
              { object: "home-check", label: "Publish" },
            ]}
          />
        </>
      ),
    },
    ...(["owner", "agent", "firm"] as const).map(
      (key): DocSection => ({
        id: `door-${key}`,
        heading: SUPPLY_DOORS[key].title,
        body: (
          <>
            <p>
              <strong>{SUPPLY_DOORS[key].blurb}</strong> {SUPPLY_DOORS[key].whoItIsFor}
            </p>
            <ul role="list">
              {SUPPLY_DOORS[key].needs.map((need) => (
                <li key={need}>{need}</li>
              ))}
            </ul>
            <p>{SUPPLY_DOORS[key].howLong}</p>
          </>
        ),
      }),
    ),
    {
      id: "stays-doors",
      heading: "Hotels, shortlets and restaurants",
      body: (
        <>
          <ul role="list">
            {STAYS_DOOR_ORDER.map((id) => (
              <li key={id}>
                <strong>{STAYS_DOORS[id].title}.</strong> {STAYS_DOORS[id].blurb}
              </li>
            ))}
          </ul>
          <p>
            These set up through host setup. See{" "}
            <Link href="/docs/hosting" className={A}>
              Hosting a hotel or shortlet
            </Link>{" "}
            and{" "}
            <Link href="/docs/restaurants#for-restaurants" className={A}>
              Running a restaurant
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "post-a-listing",
      heading: "Post a listing",
      body: (
        <ol role="list">
          <li>
            Open{" "}
            <Link href="/agent/list" className={A}>
              List a property
            </Link>{" "}
            in your workspace.
          </li>
          <li>Say what kind of place it is, where it is, and the rooms.</li>
          <li>Set the price and every cost a tenant or buyer will meet before the keys.</li>
          <li>Answer the light and water questions. An unanswered one shows as unanswered.</li>
          <li>For a shortlet, add the gate details. They stay private until a booking is confirmed.</li>
          <li>Add photos and videos, then send it for review.</li>
        </ol>
      ),
    },
    {
      id: "photos-and-videos",
      heading: "Add photos and videos",
      body: (
        <ul role="list">
          <li>
            At least {MIN_MEDIA} items, and {RECOMMENDED_MEDIA} is recommended. Photos and videos go in one
            uploader.
          </li>
          <li>The first item is the cover, and it must be a photo.</li>
          <li>
            Up to {MAX_VIDEOS} videos, each up to {MAX_UPLOAD_LABEL} and {MAX_VIDEO_SECONDS} seconds, as MP4,
            MOV or WebM.
          </li>
        </ul>
      ),
    },
    {
      id: "what-you-receive",
      heading: "See what you will receive",
      body: (
        <p>
          Before you publish, Vallo shows the price a renter or guest pays and what you receive after
          Vallo&rsquo;s commission, in naira. You accept those figures for the listing. Listing is free.
        </p>
      ),
    },
    {
      id: "review",
      heading: "What happens after you send it",
      body: (
        <ol role="list">
          <li>A person at Vallo reviews the listing.</li>
          <li>They approve it, ask for more, or reject it with a reason.</li>
          <li>If it comes back, the wizard reopens with their note. Edit it and send it again.</li>
          <li>Once approved, it is published and announced once in the place it sits in on Around.</li>
        </ol>
      ),
    },
    {
      id: "standing",
      heading: "Where your workspace stands",
      body: (
        <ul role="list">
          {STANDINGS.map((s) => (
            <li key={s.key}>
              <strong>{s.label}.</strong> {s.meaning}
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "inspections-for-listers",
      heading: "What you may charge",
      body: (
        <p>
          {NO_INSPECTION_FEE} Charge nothing that is not on the listing. {PAY_INSIDE_VALLO}
        </p>
      ),
    },
  ],
};

/* ------------------------------------------------------- messages and calls */

export const MESSAGES: DocChapter = {
  slug: "messages-and-notifications",
  number: 0,
  title: "Messages, calls and notifications",
  summary:
    "Message a lister, host or restaurant, reply, forward, delete and call from a thread, handle Requests, and choose what reaches you.",
  icon: "chat-duo",
  sections: [
    {
      id: "the-inbox",
      heading: "Message a lister",
      body: (
        <p>
          Every listing has a message button. Ask about the road, the light, the water or the landlord
          before you commit. Conversations land in{" "}
          <Link href="/messages" className={A}>
            Messages
          </Link>
          , with property and stays in their own tabs. New messages arrive without a refresh.
        </p>
      ),
    },
    {
      id: "messaging-a-business",
      heading: "Message a hotel or a restaurant",
      body: (
        <p>
          You do not need a booking to ask. Where a business takes messages, its page has a message
          button, and the conversation goes to the business itself. Each table booking also opens its own
          conversation.
        </p>
      ),
    },
    {
      id: "message-tools",
      heading: "Reply, forward, delete and call",
      body: (
        <ul role="list">
          <li>
            <strong>Reply</strong> to one message, so everyone sees which you mean. On a phone, swipe it.
          </li>
          <li>
            <strong>Forward</strong> a message to another conversation.
          </li>
          <li>
            <strong>Delete for me</strong> removes a message from your view only.
          </li>
          <li>
            <strong>Delete for everyone</strong> removes it for both sides, for 2 days and 12 hours after
            it was sent.
          </li>
          <li>
            <strong>Call</strong> by voice or video from inside the conversation, so the call stays on
            Vallo.
          </li>
        </ul>
      ),
    },
    {
      id: "requests",
      heading: "Handle Requests",
      body: (
        <p>
          Messages from people you do not follow arrive as <strong>Requests</strong>, in their own tab, so a
          stranger cannot fill your inbox. They wait there until you open them.
        </p>
      ),
    },
    {
      id: "keep-it-here",
      heading: "Keep it on Vallo",
      body: (
        <>
          <p>A conversation here is a record. Moved to another app, it is your word against theirs.</p>
          <p>
            Do not share account numbers in chat. Messages that look like account numbers are flagged to
            the Vallo team. {PAY_INSIDE_VALLO}
          </p>
        </>
      ),
    },
    {
      id: "notifications",
      heading: "Read your notifications",
      body: (
        <p>
          <Link href="/notifications" className={A}>
            Notifications
          </Link>{" "}
          lists what happened, by day: booking requests and answers, viewings, messages, payments and
          activity on your posts. Tap one to open the thing it is about, or mark them all read at once.
        </p>
      ),
    },
    {
      id: "choosing-what-reaches-you",
      heading: "Choose which emails reach you",
      body: (
        <p>
          Settings has four switches: <strong>Bookings</strong>, <strong>Messages</strong>,{" "}
          <strong>Payments and agreements</strong> and <strong>Ideas and offers</strong>. They control email.
          Marketing is off until you turn it on. Anything that puts money at risk still shows in the app.
        </p>
      ),
    },
  ],
};

/* ---------------------------------------------------------------- Around */

export const AROUND: DocChapter = {
  slug: "around",
  number: 0,
  title: "Around: places, posts and people",
  summary:
    "Join the places you live and work in, from your local government to your estate or campus, and post, ask and read what people there are saying.",
  icon: "map-spot",
  sections: [
    {
      id: "the-idea",
      heading: "What Around is",
      body: (
        <p>
          <Link href="/around" className={A}>
            Around
          </Link>{" "}
          is a feed of places, not of strangers. Join your local government, your estate or your campus,
          and read what people there are saying today: is there light, is the road open, has the tanker
          come.
        </p>
      ),
    },
    {
      id: "the-geography",
      heading: "Find your place",
      body: (
        <p>
          All 36 states, the Federal Capital Territory and all 774 local governments are here. A place can
          also sit inside one, such as an estate inside Eti-Osa. Every place is a city, an area, an estate
          or a campus.
        </p>
      ),
    },
    {
      id: "joining",
      heading: "Join a place",
      body: (
        <ul role="list">
          <li>
            Open{" "}
            <Link href="/around/manage" className={A}>
              the directory
            </Link>
            , find your state, then your local government, and join. Leave any time.
          </li>
          <li>If nobody is in it yet, joining opens it.</li>
          <li>
            For somewhere smaller, propose it from{" "}
            <Link href="/around/new" className={A}>
              the new place screen
            </Link>
            . A person reviews it.
          </li>
          <li>Reading needs no account.</li>
        </ul>
      ),
    },
    {
      id: "posting",
      heading: "Post or ask a question",
      body: (
        <>
          <p>
            Say something, or ask a question people who know the area can answer. Up to{" "}
            {POST_MAX.toLocaleString("en-NG")} characters and {POST_MEDIA_MAX} pictures. You have{" "}
            {EDIT_WINDOW_MINUTES} minutes to edit a post, and you can take it down any time.
          </p>
          <p>People reply, mark what is useful, and repost to their own places. Replies are one level deep.</p>
        </>
      ),
    },
    {
      id: "stories",
      heading: "Write a story",
      body: (
        <p>
          A story is a longer piece with a picture and a headline, about a place. It does not expire, so it
          is still there for the next person deciding whether to move to that street.
        </p>
      ),
    },
    {
      id: "listings-in-a-place",
      heading: "See new listings in your place",
      body: <p>When a listing is published, it is announced once, in the place it is in.</p>,
    },
    {
      id: "moderators",
      heading: "Moderators",
      body: (
        <>
          <p>A place can have moderators. They are members of the place, not Vallo staff. A moderator can:</p>
          <ul role="list">
            {MODERATOR_CAN.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p>A moderator cannot:</p>
          <ul role="list">
            {MODERATOR_CANNOT.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p>You can apply to moderate a place you are in.</p>
        </>
      ),
    },
    {
      id: "rules",
      heading: "Know the rules",
      body: (
        <>
          <p>
            <strong>{EULA_ZERO_TOLERANCE}</strong>
          </p>
          <ul role="list">
            <li>The rules cover posts, comments, stories, profiles, listings and private messages.</li>
            <li>
              No abuse, threats, hate, sexual content, fraud, fake documents, impersonation, or another
              person&rsquo;s address, phone number or bank details shared without their agreement.
            </li>
            <li>
              A post or a profile that carries an account number or a request for payment is held until a
              person reads it. {PAY_INSIDE_VALLO}
            </li>
            <li>The person you report is never told who reported them.</li>
          </ul>
          <p>
            The full rules are the{" "}
            <Link href="/eula" className={A}>
              Community rules
            </Link>{" "}
            and the{" "}
            <Link href="/standards" className={A}>
              Trust and safety standards
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "people",
      heading: "Follow, mute or block",
      body: <p>Follow people whose posts help you. Block or mute an account, and report a post or a profile.</p>,
    },
  ],
};
