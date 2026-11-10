import Link from "next/link";
import { DocCallout } from "@/components/docs/DocCallout";
import { DocTable } from "@/components/docs/DocTable";
import { BALANCE_TITLE, FIGURE_HINT, FIGURE_LABEL, HELD_BY } from "@/lib/money/balance-copy";
import { CONTACT_EMAIL } from "@/lib/docs/contact";
import type { DocChapter } from "./chapters";

/**
 * THE CHAPTERS THE DOCUMENTATION SWEEP ADDED (Agent DOCS, 11 November 2026).
 *
 * Each of these covers a part of the platform a member can reach that had no
 * page of its own: Circle, Roommates, saved places and compare, notifications,
 * settings, the wallet, rewards, the host and agent workspaces, the tenancy
 * file, the tools that need no account, and profiles. They were written from
 * the screens' own source (the route's header comment and the modules that
 * hold its words and rules), and where a figure or a label exists in code it is
 * imported, not typed. `DOCS_COVERAGE.md` records what each was checked
 * against. None of them describes a feature that is not there; where a thing is
 * off until a switch is turned, the page says so.
 *
 * `number` and `group` are set by `chapters.tsx`.
 */

const A = "font-semibold text-[var(--nf-content-link)] hover:underline";
const UPDATED = "2026-11-11";
/** The money screen's name, from the module that draws it: the custody-words rule allows the word only as that name. */
const W = BALANCE_TITLE.toLowerCase();

/* ------------------------------------------------------------- circle */

export const CIRCLE: DocChapter = {
  slug: "circle",
  number: 0,
  title: "Vallo Circle",
  summary:
    "The community side of Vallo: ask questions, join communities for a topic or a neighbourhood, and read answers from people who know the place.",
icon: "chat-duo",
  updated: UPDATED,
  glance: [
    "Circle is where you ask and discuss. Around, the feed, is where you discover.",
    "Ask a question, start a discussion or join a community for a topic or an area.",
    "A private community is read only by its members, and its owner and moderators decide who joins.",
    "Circle is advice from members, not advice from Vallo, and nobody there can make a deal for you.",
  ],
  actions: ["open-circle", "open-around"],
  related: [
    { href: "/docs/around", label: "Around, the feed" },
    { href: "/docs/trust-and-safety", label: "Trust and safety" },
  ],
  sections: [
    {
      id: "what-it-is",
      heading: "What Circle is",
      body: (
        <>
          <p>
            Circle is a community for people who buy, rent, let, sell and work in property: tenants, buyers, landlords,
            owners, agents and professionals. You ask, discuss an area, share what you know and find opportunities.
          </p>
          <p>
            It sits beside Around, the feed. Around is visual and for discovering; Circle is organised and for asking.
            A place you find on Around can be taken to Circle with a question attached.
          </p>
        </>
      ),
    },
    {
      id: "reach-it",
      heading: "How to reach it",
      body: (
        <p>
          Open <Link href="/circle" className={A}>Circle</Link> from the Around screen&apos;s Circle lens or from the
          side navigation. The home screen has a banner with live counts, then tabs. Each tab is in the address
          (<code>?tab=</code>), so Back and a shared link land on the same tab.
        </p>
      ),
    },
    {
      id: "tabs",
      heading: "The tabs",
      body: (
        <DocTable
          caption="The tabs on Circle home and what each lists"
          headLabel="Tab"
          columns={[{ key: "what", label: "What it shows" }]}
          rows={[
            { head: "For you", icon: "house-heart", cells: { what: "Featured discussions, popular questions and where to go next." } },
            { head: "Discussions", icon: "chat-bubble", cells: { what: "Posts of type discussion, newest, most popular or unanswered first." } },
            { head: "Ask", icon: "circle-people", cells: { what: "Questions. A question marks its accepted answer, and that answer is shown first." } },
            { head: "Neighbourhoods", icon: "location", cells: { what: "Communities tied to an area." } },
            { head: "Professionals", icon: "briefcase", cells: { what: "Members who list a professional role, linking to their profile." } },
            { head: "Opportunities", icon: "trending-up", cells: { what: "Posts of type opportunity." } },
            { head: "Guides", icon: "file-text", cells: { what: "Longer how-to posts written by members." } },
          ]}
        />
      ),
    },
    {
      id: "ask-and-answer",
      heading: "Ask a question or start a discussion",
      body: (
        <>
          <ol>
            <li>
              Open <Link href="/circle/ask" className={A}>Ask the community</Link>. You can pick a community first, or
              attach a live listing to ask about that place. A draft is never attachable.
            </li>
            <li>Pick the community, give the question a title, add detail, then preview it.</li>
            <li>Publish. People answer under it, and an accepted answer is shown first.</li>
          </ol>
          <p>
            To start a discussion inside one community, open it and use its new-post button. You must be a member, and
            the database holds that rule as well as the screen.
          </p>
        </>
      ),
    },
    {
      id: "communities",
      heading: "Communities",
      body: (
        <>
          <p>
            A community has a topic or an area and its own posts, which you can sort newest, popular or unanswered. You can join one from its page. You can create a community: choose a name, a topic, whether it is public or private, then preview it.
          </p>
          <ul>
            <li>
              <strong>Public</strong>: anyone on Vallo can read it; members post.
            </li>
            <li>
              <strong>Private</strong>: people ask to join and only members read the posts. The owner and moderators see
              the join requests under Manage. Nobody else can.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "wrong",
      heading: "What can go wrong",
      body: (
        <>
          <DocCallout kind="warning" title="Advice is not a deal">
            <p>
              An answer in Circle is a member&apos;s opinion. Nobody in Circle can hold a place for you or take a
              payment for you. Never pay outside Vallo, and never send a deposit to someone you met in a comment. See the{" "}
              <Link href="/safety" className={A}>safety centre</Link>.
            </p>
          </DocCallout>
          <ul>
            <li>If a tab is empty, it says so: every list on Circle is a real read, and nothing is filled in to look busy.</li>
            
            <li>
              Rules for what is not allowed are in the <Link href="/standards" className={A}>standards</Link>.
            </li>
          </ul>
        </>
      ),
    },
  ],
};

/* ---------------------------------------------------------- roommates */

export const ROOMMATES: DocChapter = {
  slug: "roommates",
  number: 0,
  title: "Roommates",
  summary:
    "Find people to share with, or a room to take: a roommate profile, posts, groups that search together, a school and corps directory, and a cost splitter.",
icon: "house-sparkle",
  updated: UPDATED,
  glance: [
    "Make a roommate profile once, then browse people and room posts that fit it.",
    "A group can search together, shortlist places and split the cost of a move-in.",
    "Roommates has its own safety centre and its own checks, and a badge says exactly which check it stands for.",
    "The cost splitter does arithmetic on your own figures and says it is an estimate.",
  ],
  actions: ["open-roommates"],
  related: [
    { href: "/docs/badges-and-verification", label: "Badges and verification" },
    { href: "/docs/circle", label: "Vallo Circle" },
  ],
  sections: [
    {
      id: "what-it-is",
      heading: "What Roommates is",
      body: (
        <p>
          Roommates connects people who want to share a home. You can offer a room, say you want a roommate, or look
          for people to search with. It sits inside your Vallo account, so you do not need a second sign-in.
        </p>
      ),
    },
    {
      id: "start",
      heading: "Start with your profile",
      body: (
        <>
          <ol>
            <li>
              Open <Link href="/roommates" className={A}>Roommates</Link> and set up your roommate profile. It starts
              from what you have already told Vallo, so nothing is typed twice.
            </li>
            <li>Say where you want to live, your budget, your move-in date and how you like to live.</li>
            <li>Browse <strong>Discover</strong> for people and <strong>room posts</strong> for places, filtered to fit.</li>
          </ol>
          <p>
            Your profile is what other members see, so write it as you would want to read one. You can edit or remove it
            from My roommates.
          </p>
        </>
      ),
    },
    {
      id: "posts",
      heading: "Post a room or say you want one",
      body: (
        <p>
          Choose what you are posting first: a room on offer, a roommate wanted, or looking together. The flow is a few
          short screens ending in a review. A post can be edited later, opening on its review screen. Only you can edit
          your own post.
        </p>
      ),
    },
    {
      id: "groups",
      heading: "Groups and searching together",
      body: (
        <>
          <p>
            A group is two or more people searching together. You can start one from your profile (your city, areas,
            school, budget and move-in date are carried over) or ask to join an open group near where you want to live.
            A group has a dashboard where members shortlist room posts and see who is looking.
          </p>
          <p>
            A property that suits sharing carries a note on its listing: &quot;Good for sharing, up to N people&quot;,
            set by the lister.
          </p>
        </>
      ),
    },
    {
      id: "schools-corps",
      heading: "Schools and corps members",
      body: (
        <p>
          There is a directory of schools, searched by name, with a page for each, and a page for corps members: choose
          your state of posting and see who else is heading there. Both link to Circle communities.
        </p>
      ),
    },
    {
      id: "checks",
      heading: "Checks and badges",
      body: (
        <>
          <p>
            Under <Link href="/roommates/verify" className={A}>Add a check</Link> you can complete the checks as they
            stand: a code sent to an address on your school&apos;s own domain, or a document check (a student ID, an NYSC
            call-up letter or similar). A badge names the check it stands for. It does not mean Vallo knows the person
            well, and it does not replace meeting in a public place first.
          </p>
        </>
      ),
    },
    {
      id: "split",
      heading: "Split the cost",
      body: (
        <>
          <p>
            <Link href="/roommates/split" className={A}>The cost splitter</Link> divides a rent and the costs around a
            move-in between people, using the figures you type. It is arithmetic, always labelled an estimate. A listing
            can open it with the rent filled in.
          </p>
          <p>
            A flatmate&apos;s share of a move-in has its own page, which pays only that share, by card, straight to the landlord or agent through the payment partner. Vallo does not hold it.
          </p>
        </>
      ),
    },
    {
      id: "safety",
      heading: "Staying careful",
      body: (
        <>
          <p>
            Read the <Link href="/roommates/safety" className={A}>Roommates safety centre</Link>. In short: meet in a
            public place, tell someone, never send money before you have seen the room, and report and block anyone who
            asks you to.
          </p>
          <DocCallout kind="warning" title="Never pay outside Vallo">
            <p>A room is only real once you have seen it. Do not send a deposit to someone you have only chatted with.</p>
          </DocCallout>
        </>
      ),
    },
  ],
};

/* ------------------------------------------------------ saved, compare */

export const SAVED_AND_COMPARE: DocChapter = {
  slug: "saved-and-compare",
  number: 0,
  title: "Saved places, searches and compare",
  summary: "Keep a shortlist, keep a search, and put up to four places side by side.",
icon: "home-search",
  updated: UPDATED,
  glance: [
    "The heart saves a place to your account. Saved places live at Saved.",
    "A saved search keeps a hunt so you can run it again.",
    "Compare shows up to four published places side by side, and the page can be sent to someone.",
  ],
  actions: ["open-saved", "open-compare"],
  related: [{ href: "/docs/finding-a-place", label: "Finding a place" }],
  sections: [
    {
      id: "saved",
      heading: "Saved places",
      body: (
        <p>
          Tap the heart on a place and it is saved to your account, which is the source of truth: it follows you to other devices. Saved stays and restaurants are kept there too.  <Link href="/saved" className={A}>Saved</Link> lists them, ready to compare or book. You need an
          account to save; signed out, the heart asks you to sign in and brings you back to the place.
        </p>
      ),
    },
    {
      id: "searches",
      heading: "Saved searches",
      body: (
        <p>
          <Link href="/saved/searches" className={A}>Saved searches</Link> lists the hunts you keep. What you see is what
          your account holds, so a reload proves it. Open one to run it again.
        </p>
      ),
    },
    {
      id: "compare",
      heading: "Compare",
      body: (
        <>
          <p>
            <Link href="/compare" className={A}>Compare</Link> puts up to four published places side by side. The places
            are in the page address, so you can send the page to someone. Every fact shown is the listing&apos;s own. A place that is no longer published, or that is a stay or a restaurant, is left out and counted in a line.
          </p>
        </>
      ),
    },
    {
      id: "wrong",
      heading: "What can go wrong",
      body: (
        <ul>
          <li>
            <strong>A saved place disappeared.</strong> The lister may have unpublished it. Compare says so for each one.
          </li>
          <li>
            <strong>Saved while signed out.</strong> Sign in first; the heart then keeps the place on your account.
          </li>
        </ul>
      ),
    },
  ],
};

/* ------------------------------------------------------- notifications */

export const NOTIFICATIONS: DocChapter = {
  slug: "notifications",
  number: 0,
  title: "Notifications",
  summary: "Where things you need to act on arrive, how to open each one, and how to choose what reaches you.",
icon: "support-shield",
  updated: UPDATED,
  glance: [
    "Notifications are your own rows, grouped by day, with new ones arriving as they happen.",
    "Each one opens a full page, so a push or an email can link straight to it.",
    "You choose what reaches you under Settings, Notifications, and a no-sign-in page handles email preferences.",
  ],
  actions: ["open-notifications", "open-settings"],
  related: [{ href: "/docs/messages-and-notifications", label: "Messages" }],
  sections: [
    {
      id: "inbox",
      heading: "The inbox",
      body: (
        <p>
          <Link href="/notifications" className={A}>Notifications</Link> is the bell. It lists what happened to your
          bookings, offers, agreements, messages and account, grouped by day. Reading one marks it read. It is separate
          from Messages, which holds conversations.
        </p>
      ),
    },
    {
      id: "open",
      heading: "Opening one",
      body: (
        <p>
          Each notification opens its own page with the whole message and the button for what to do next. The tab title
          never names the event, so a title on a shared screen does not give away what happened. A push notification or
          an email links to the same page.
        </p>
      ),
    },
    {
      id: "choose",
      heading: "Choose what reaches you",
      body: (
        <>
          <p>
            <Link href="/settings/notifications" className={A}>Settings, Notifications</Link> holds the switches and the
            list of devices that can be reached by push. Reminders, and nudges to finish your phone, identity, listing draft or profile, each have their own switch under Reminders.
          </p>
          <p>
            Every email carries a link to your email preferences that works without signing in. The signed link in that
            email is the authority, so the page shows only a masked address and your switches.
          </p>
        </>
      ),
    },
    {
      id: "wrong",
      heading: "What can go wrong",
      body: (
        <ul>
          <li>No pushes: check the device is listed under Settings, Notifications, and that the phone allows them.</li>
          <li>
            You see nothing and have never booked or messaged: the inbox only ever holds your own real rows, so an empty one is true.
          </li>
        </ul>
      ),
    },
  ],
};

/* ------------------------------------------------------------- settings */

export const SETTINGS: DocChapter = {
  slug: "settings",
  number: 0,
  title: "Settings and privacy choices",
  summary: "What each settings page controls: account, privacy, security, appearance, region, devices and standing.",
icon: "person-card",
  updated: UPDATED,
  glance: [
    "Settings is a home page with a row for each area, and each area is a page of its own.",
    "Privacy choices cover who sees what, blocked people, your data and a money lock.",
    "Security covers your passcode, your phone number and where you are signed in.",
    "Your standing shows any restriction on your account, why, until when, and how to appeal.",
  ],
  actions: ["open-settings", "privacy-choices"],
  related: [
    { href: "/docs/your-data-and-your-rights", label: "Your data and your rights" },
    { href: "/docs/trust-and-safety", label: "Trust and safety" },
  ],
  sections: [
    {
      id: "map",
      heading: "Where everything is",
      body: (
        <DocTable
          caption="The settings pages and what each controls"
          headLabel="Page"
          columns={[{ key: "what", label: "What it controls" }]}
          rows={[
            { head: <Link href="/settings/account" className={A}>Account</Link>, icon: "user-check", cells: { what: "Who you are signed in as, your search defaults, sign out and deletion." } },
            { head: <Link href="/settings/place" className={A}>Place</Link>, icon: "location", cells: { what: "Where you are and what you do, in three short questions." } },
            { head: <Link href="/settings/interests" className={A}>Interests</Link>, icon: "heart", cells: { what: "What you came to Vallo for, in case you change your mind." } },
            { head: <Link href="/settings/privacy" className={A}>Privacy and security</Link>, icon: "shield-lock", cells: { what: "What others can see, where you are signed in, and who you have blocked." } },
            { head: <Link href="/settings/passcode" className={A}>Passcode</Link>, icon: "lock", cells: { what: "Change the code or its length (6 or 4 digits). A new length is a new code." } },
            { head: <Link href="/settings/phone" className={A}>Phone</Link>, icon: "phone", cells: { what: "Confirm one mobile number. Moments that need it send you here and bring you back." } },
            { head: <Link href="/settings/devices" className={A}>Devices</Link>, icon: "settings-gear", cells: { what: "Where you are signed in, so a lost phone can be signed out." } },
            { head: <Link href="/settings/notifications" className={A}>Notifications</Link>, icon: "bell", cells: { what: "What reaches you, on which device, and your reminders." } },
            { head: <Link href="/settings/appearance" className={A}>Appearance</Link>, icon: "sun", cells: { what: "Theme, text size, motion, data saver and language, held on this device." } },
            { head: <Link href="/settings/accessibility" className={A}>Accessibility</Link>, icon: "eye", cells: { what: "Contrast, reduced transparency, text size and motion in one place." } },
            { head: <Link href="/settings/region" className={A}>Region</Link>, icon: "globe", cells: { what: "Language, and how money and dates are shown. The currency is naira and is not a preference." } },
            { head: <Link href="/settings/payments" className={A}>Payment methods</Link>, icon: "credit-card", cells: { what: "Methods you pay with and are paid to, shared by both sides." } },
            { head: <Link href="/settings/passport" className={A}>Vallo Passport</Link>, icon: "id-card", cells: { what: "What your passport shows other members. On by default; you switch lines off." } },
            { head: <Link href="/settings/ai-assistant" className={A}>Assistant</Link>, icon: "bot", cells: { what: "Off until you agree to it. Then one switch per permission, with reading and acting kept apart." } },
            { head: <Link href="/settings/standing" className={A}>Standing</Link>, icon: "scale", cells: { what: "Your own record with Trust and Safety: any restriction, why, until when, and how to appeal." } },
            { head: <Link href="/settings/invite" className={A}>Invite</Link>, icon: "gift", cells: { what: "Your invite link and how invites work." } },
          ]}
        />
      ),
    },
    {
      id: "privacy",
      heading: "Privacy choices",
      body: (
        <ul>
          <li>
            <Link href="/settings/privacy/blocked" className={A}>Blocked accounts</Link>: the people you blocked, newest
            first, each with Unblock. You never see who blocked you.
          </li>
          <li>
            <Link href="/settings/privacy/data" className={A}>Your data</Link>: ask for a copy of your account, and clear
            what this device saved.
          </li>
          <li>
            <Link href="/settings/privacy/money-lock" className={A}>Money lock</Link>: an extra check before money moves.
            You can enrol and remove it here.
          </li>
          <li>
            <Link href="/settings/privacy/ai" className={A}>Assistant agreement</Link>: what you agreed to, and the way
            to take it back.
          </li>
        </ul>
      ),
    },
    {
      id: "new-device",
      heading: "A new device signed in",
      body: (
        <p>
          When a new device signs in to your account you are told by push and in the app. The message asks whether it
          was you. If it was not, use the link in it to sign that device out and change your passcode. Do this at once;
          an account can start payments and change payout details.
        </p>
      ),
    },
    {
      id: "delete",
      heading: "Leaving",
      body: (
        <p>
          To close your account, see <Link href="/delete-account" className={A}>Delete your account</Link>. It explains
          what is deleted, what is kept and for how long. You can also write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className={A}>{CONTACT_EMAIL}</a>.
        </p>
      ),
    },
  ],
};

/* --------------------------------------------------------------- wallet */

export const WALLET: DocChapter = {
  slug: "wallet",
  number: 0,
  title: BALANCE_TITLE,
  summary: "Every movement of your money in one place, what each figure means, and who holds it.",
icon: "naira-coins",
  updated: UPDATED,
  glance: [
    HELD_BY,
    `${BALANCE_TITLE} shows what was added, sent, withdrawn and held for a deal, read from our payment partner with its time.`,
    `When the ${W} is not connected, it shows no figure at all, because any figure would be made up.`,
  ],
  actions: ["open-wallet", "open-receipts"],
  related: [
    { href: "/docs/paying-on-vallo", label: "How paying works" },
    { href: "/docs/refunds-and-cancellations", label: "Refunds and cancellations" },
  ],
  sections: [
    {
      id: "what-it-is",
      heading: `What the ${W} is`,
      body: (
        <>
          <p>
            <Link href="/wallet" className={A}>Wallet</Link> is a record and a set of controls for money that belongs to
            you. {HELD_BY} What you see is read from the partner, and each figure says when the partner last confirmed
            it.
          </p>
          <DocCallout kind="not-live" title="Not always connected">
            <p>
              Where the wallet is not connected for your account yet, the screen is drawn with no figures and says so.
              It never shows a number it cannot read.
            </p>
          </DocCallout>
        </>
      ),
    },
    {
      id: "figures",
      heading: "The four figures",
      body: (
        <DocTable
          caption={`The figures on the ${W} overview`}
          headLabel="Figure"
          columns={[
            { key: "state", label: "State" },
            { key: "means", label: "What it means" },
          ]}
          rows={(["available", "protected", "pending", "processing"] as const).map((key) => ({
            head: FIGURE_LABEL[key],
            cells: {
              state: {
                state: FIGURE_LABEL[key],
                tone: key === "available" ? "success" : key === "protected" ? "info" : "warning",
              },
              means: FIGURE_HINT[key],
            },
          }))}
        />
      ),
    },
    {
      id: "actions",
      heading: "Add, send and withdraw",
      body: (
        <>
          <ul>
            <li>
              <strong>Add money</strong> takes an amount and a method, then the payment partner&apos;s payment page,
              then a waiting screen that says what is known and what is not.
            </li>
            <li>
              <strong>Send</strong> takes an amount, who it goes to and what it is for, shows a quote, then a deliberate
              slide to confirm.
            </li>
            <li>
              <strong>Withdraw</strong> takes an amount and a bank account, shows a quote, then a slide to confirm.
            </li>
          </ul>
          <p>
            None of these screens shows fake progress or a timer. A waiting screen says it is waiting for the bank. See
            every movement, with filters, under <Link href="/wallet/transactions" className={A}>Transactions</Link>.
          </p>
        </>
      ),
    },
    {
      id: "records",
      heading: "Payments, refunds and receipts",
      body: (
        <ul>
          <li>
            <Link href="/payments" className={A}>Payments</Link>: what you paid through Vallo and every refund that
            came back to your card or bank account. A record, not an account.
          </li>
          <li>
            <Link href="/refunds" className={A}>Refunds</Link>: each with its state as a word.
          </li>
          <li>
            <Link href="/receipts" className={A}>Receipts</Link>: a receipt for each payment, with a code anybody can
            check at <Link href="/r" className={A}>vallospaces.com/r</Link>.
          </li>
          <li>
            <Link href="/payouts" className={A}>Payouts</Link>: for hosts and owners, each payment, the platform fee in
            naira and what reached the bank.
          </li>
        </ul>
      ),
    },
    {
      id: "wrong",
      heading: "What can go wrong",
      body: (
        <ul>
          <li>
            <strong>A figure says Pending or Processing for a while.</strong> It is waiting for the bank. Come back; the
            screen updates when the partner confirms.
          </li>
          <li>
            <strong>A refund has not arrived.</strong> Banks usually show it within 5 to 10 working days. See{" "}
            <Link href="/docs/refunds-and-cancellations" className={A}>Refunds and cancellations</Link>, then ask the
            support desk with your reference.
          </li>
        </ul>
      ),
    },
  ],
};

/* -------------------------------------------------------------- rewards */

export const REWARDS: DocChapter = {
  slug: "rewards-and-referrals",
  number: 0,
  title: "Rewards and referrals",
  summary: "Invite people, see where each one stands, and what the rewards balance is and is not.",
icon: "gift",
  updated: UPDATED,
  glance: [
    "Your invite link is made the first time you open Invite.",
    "A referral moves through joined, pending, under review and qualified, and the list shows where each person is.",
    "The rewards balance is separate from any payment you made or were paid.",
    "Where rewards are not available for your account, the screens say so.",
  ],
  actions: ["open-rewards"],
  related: [{ href: "/docs/what-vallo-costs", label: "What Vallo costs" }],
  sections: [
    {
      id: "invite",
      heading: "Invite someone",
      body: (
        <p>
          Open <Link href="/settings/invite" className={A}>Invite</Link> to get your own invite link. Send it to someone;
          when they sign up with it they appear in your referrals. <Link href="/settings/invite/how-it-works" className={A}>How
          invites work</Link> says what an invite does and does not do.
        </p>
      ),
    },
    {
      id: "referrals",
      heading: "Where each referral stands",
      body: (
        <DocTable
          caption="The states a referral can be in"
          headLabel="State"
          columns={[{ key: "means", label: "What it means" }]}
          rows={[
            { head: "Joined", cells: { means: { state: "Joined", tone: "info" } } },
            { head: "Pending", cells: { means: { state: "Pending", tone: "warning" } } },
            { head: "Under review", cells: { means: { state: "Under review", tone: "warning" } } },
            { head: "Qualified", cells: { means: { state: "Qualified", tone: "success" } } },
          ]}
        />
      ),
    },
    {
      id: "balance",
      heading: "The rewards balance",
      body: (
        <>
          <p>
            <Link href="/rewards" className={A}>Rewards</Link> shows the balance, your invite link and two inner pages:
            your referrals, and a history of every amount added or taken, newest first, like a statement. The rewards
            balance is kept separate from payments for homes and stays.
          </p>
          <DocCallout kind="not-live" title="When rewards are paused or not available">
            <p>
              If rewards are not available for your account, or are paused, the pages say so in words and show no figures.
              Withdrawing uses the banks our payment partner can pay out to; if that list cannot be read, the form says so.
            </p>
          </DocCallout>
        </>
      ),
    },
    {
      id: "leaderboard",
      heading: "The leaderboard",
      body: (
        <p>
          <Link href="/leaderboard" className={A}>The leaderboard</Link> ranks referrals and the top agents, landlords,
          hotels and restaurants, this month or all time, in your city or everywhere. It counts real activity only. Until
          it is switched on it says it opens soon.
        </p>
      ),
    },
  ],
};

/* ------------------------------------------------------- host workspace */

export const HOST_WORKSPACE: DocChapter = {
  slug: "host-workspace",
  number: 0,
  title: "The host workspace",
  summary: "For hotels, guest houses, serviced apartments, shortlets and restaurants: requests, the calendar, rooms, earnings and reviews.",
icon: "key-ring",
  updated: UPDATED,
  glance: [
    "One list shows everything waiting for your answer, with the clock showing.",
    "The calendar sets rates and nights and can sync with other sites you sell on.",
    "Earnings shows each payment, the commission and your share. It is read only.",
    "Photos and arrival charges stay open after your application is sent.",
  ],
  actions: ["start-hosting", "open-payouts"],
  related: [
    { href: "/docs/hosting", label: "Hosting on Vallo" },
    { href: "/docs/restaurants", label: "Restaurants" },
    { href: "/docs/what-vallo-costs", label: "What Vallo costs" },
  ],
  sections: [
    {
      id: "start",
      heading: "Becoming a host",
      body: (
        <>
          <p>
            <Link href="/host/start" className={A}>Start hosting</Link> asks which kind of host you are, because the
            proof we ask for depends on it. The application is a short flow ending in a review. Once it is sent, the
            workspace is where you run the business.
          </p>
        </>
      ),
    },
    {
      id: "desk",
      heading: "What is in the workspace",
      body: (
        <DocTable
          caption="The host workspace screens"
          headLabel="Screen"
          columns={[{ key: "what", label: "What it is for" }]}
          rows={[
            { head: "Decide", icon: "clock", cells: { what: "One list of every room request and table request waiting for your answer, with the clock." } },
            { head: "Bookings", icon: "calendar-booking", cells: { what: "Guests' requests for rooms, to accept or decline, and the stays that follow. A request holds its rooms from the moment it is made." } },
            { head: "Reservations", icon: "utensils", cells: { what: "Where a venue answers a table." } },
            { head: "Calendar", icon: "calendar-check", cells: { what: "Rates and nights on one calendar, and syncing with the other sites you sell on." } },
            { head: "Rooms", icon: "building-hotel", cells: { what: "How far ahead a hotel is bookable and by how many rooms." } },
            { head: "Arrival charges", icon: "coins", cells: { what: "Every charge a guest could be asked for on arrival, each an amount or none." } },
            { head: "Photos", icon: "picture", cells: { what: "Where your own photographs go up, open after the application is sent." } },
            { head: "Earnings", icon: "banknote", cells: { what: "What each guest payment paid you, payment by payment, and any refund that reversed part of one. A monthly statement lists every line." } },
            { head: "Reviews", icon: "star", cells: { what: "What guests wrote, your one public answer to each, and a fair way to ask Vallo to look at one." } },
            { head: "Transfer", icon: "switch-profile", cells: { what: "The way out of a business, in two separate doors." } },
            { head: "Settings and assistant", icon: "settings-gear", cells: { what: "Your businesses, what reaches you about bookings and messages, and the assistant." } },
          ]}
        />
      ),
    },
    {
      id: "money",
      heading: "How you are paid",
      body: (
        <>
          <p>
            The earnings statement shows, for each payment: what the guest paid, Vallo&apos;s commission, and your share.
            Vallo&apos;s commission comes out of your share and is never added to the guest&apos;s price. See{" "}
            <Link href="/docs/what-vallo-costs" className={A}>What Vallo costs</Link> for the current figures.
          </p>
          <p>
            Vallo never holds your share. The payment partner pays money into your bank on its normal settlement
            schedule.
          </p>
        </>
      ),
    },
    {
      id: "wrong",
      heading: "What can go wrong",
      body: (
        <ul>
          <li>A request has a clock. If it runs out unanswered it lapses, so check Decide often.</li>
          <li>Never ask a guest for a charge that is not listed. Hosts agree not to in the Host Agreement.</li>
          <li>A review you think is unfair can be sent to Vallo to look at; you cannot delete it.</li>
        </ul>
      ),
    },
  ],
};

/* ------------------------------------------------------ agent workspace */

export const AGENT_WORKSPACE: DocChapter = {
  slug: "agent-workspace",
  number: 0,
  title: "The agent and lister workspace",
  summary: "For agents, landlords, owners and firms: listings, the owner mandate, enquiries, analytics, promotion and earnings.",
icon: "report-stats",
  updated: UPDATED,
  glance: [
    "A listing goes live only after Vallo has confirmed who instructed the lister, through the mandate.",
    "Analytics shows only real figures. With no data, it shows nothing rather than a demonstration.",
    "Verification is a ladder of rungs, and the workspace shows the next one.",
    "A TO LET board and a status picture can be made for any listing, carrying no phone number, address or price.",
  ],
  actions: ["list-property", "start-verification"],
  related: [
    { href: "/docs/listing-on-vallo", label: "Listing on Vallo" },
    { href: "/docs/for-agents", label: "For agents" },
    { href: "/docs/for-owners", label: "For owners and landlords" },
  ],
  sections: [
    {
      id: "map",
      heading: "What is in the workspace",
      body: (
        <DocTable
          caption="The agent workspace screens"
          headLabel="Screen"
          columns={[{ key: "what", label: "What it is for" }]}
          rows={[
            { head: "Dashboard", icon: "chart-bar", cells: { what: "Your own numbers, read live. Nobody sees invented figures." } },
            { head: "List a property", icon: "house", cells: { what: "The listing wizard, and your drafts." } },
            { head: "Listings", icon: "stack", cells: { what: "Everything you own, in every status, with the actions for each." } },
            { head: "Mandate", icon: "file-check", cells: { what: "Who you are letting for. The owner's name, number and how they stand to the property." } },
            { head: "Health", icon: "circle-check", cells: { what: "What the listing's record holds, what it is missing and what you can do today." } },
            { head: "Calendar", icon: "calendar-check", cells: { what: "Mark nights unavailable on a nightly listing." } },
            { head: "Bookings and inspections", icon: "calendar-booking", cells: { what: "Requests and stays, and inspection requests." } },
            { head: "Messages", icon: "chat-bubble", cells: { what: "The host side of conversations, inside the workspace." } },
            { head: "Reviews", icon: "star", cells: { what: "What guests said and your answer." } },
            { head: "Analytics", icon: "trending-up", cells: { what: "The six stages from seen in results to viewing booked, per listing; each figure on its own page." } },
            { head: "Promotion", icon: "crown", cells: { what: "Paid promotion for a listing and its measured results." } },
            { head: "Earnings and portfolio", icon: "banknote", cells: { what: "What has settled from your stays, and an owner's buildings." } },
            { head: "Verification", icon: "shield-check", cells: { what: "Where you stand on the ladder and what the next rung wants." } },
            { head: "Firm", icon: "users", cells: { what: "For a firm's principal: the people in the firm." } },
          ]}
        />
      ),
    },
    {
      id: "mandate",
      heading: "The owner mandate",
      body: (
        <>
          <p>
            An agent or firm listing goes live only once Vallo has confirmed the owner who instructed the lister. On the
            listing&apos;s Mandate screen you add the owner&apos;s name, number and how they stand to the property. A
            landlord has no account and needs none: a single-use link sent to the number on the mandate lets them reply
            on one page.
          </p>
          <p>
            For a sale, a signed sale mandate is a separate record. It is the thing a buyer relies on to know an agent
            can sell the property. See{" "}
            <Link href="/docs/how-offers-work" className={A}>How offers work</Link>.
          </p>
        </>
      ),
    },
    {
      id: "share",
      heading: "Showing a listing elsewhere",
      body: (
        <>
          <p>
            <strong>Board:</strong> a printable TO LET board carrying the unit&apos;s shape, &quot;on Vallo&quot; and the
            listing code, and nothing else: no phone number, no address, no price, no name.
          </p>
          <p>
            <strong>Status kit:</strong> a 9:16 picture for your WhatsApp Status, so you do not have to choose between
            Vallo and the places you already advertise. Anyone can check an advert at{" "}
            <Link href="/check" className={A}>Is this a Vallo agent?</Link>.
          </p>
        </>
      ),
    },
    {
      id: "wrong",
      heading: "What can go wrong",
      body: (
        <ul>
          <li>A listing is not available: check Health. A missing mandate or verification step is named there.</li>
          <li>An approved agent sees numbers; anyone else sees none. That is by design.</li>
          <li>Never take a deposit outside Vallo. A payment outside Vallo is not covered.</li>
        </ul>
      ),
    },
  ],
};

/* ------------------------------------------------------ tenancy and rent */

export const TENANCY: DocChapter = {
  slug: "tenancy-and-move-in",
  number: 0,
  title: "Moving in and your tenancy file",
  summary: "The move-in ledger, paying the first rent, your tenancy file afterwards, and what to do when a caution is not returned.",
icon: "house-sparkle",
  updated: UPDATED,
  glance: [
    "The move-in ledger lists every cost the lister named, each as its own row, and the total.",
    "After you pay, your tenancy file keeps what the listing promised, the money, the caution and the move-in record.",
    "Vallo holds nothing and decides nothing. If a caution is not returned, the file prints as a pack for the tribunal.",
    "The file names the area, never the address.",
  ],
  actions: ["open-agreements", "move-in-cost"],
  related: [
    { href: "/docs/agreements-and-paying", label: "Agreements and paying" },
    { href: "/docs/viewings", label: "Viewings" },
  ],
  sections: [
    {
      id: "ledger",
      heading: "The move-in ledger",
      body: (
        <p>
          Before you pay, the listing page and the payment step show the move-in ledger: the listing summary, each cost
          the lister named as its own row, and the total. The total is stated by the lister, or is the sum of the named
          parts and marked as such. The amount you pay is that figure and nothing else. You can work the same sum
          without an account with the{" "}
          <Link href="/move-in-cost" className={A}>move-in calculator</Link>.
        </p>
      ),
    },
    {
      id: "pay",
      heading: "Paying",
      body: (
        <>
          <p>
            The payment step is the end of the inspection journey on the platform. The figure is frozen on the charge by
            the database the moment it opens, so the amount on screen is the amount charged. If it is not ready to pay,
            the screen says why: not accepted yet, no figure to pay, already paid, or signed out.
          </p>
          <p>
            Sharing with others? A flatmate&apos;s share has its own link that pays only their share, by card, straight to
            the landlord or agent.
          </p>
        </>
      ),
    },
    {
      id: "file",
      heading: "Your tenancy file",
      body: (
        <>
          <p>
            After a move-in is paid there is one page you can open months later, for the tenant and the lister alike:
            the tenancy, the money and its receipts, the caution, what the listing promised (frozen at payment), and the
            record of the flat. It names the area and city only.
          </p>
          <p>
            A tenancy that is not yours answers exactly as one that does not exist, so a stranger guessing ids learns
            nothing.
          </p>
        </>
      ),
    },
    {
      id: "caution",
      heading: "If a caution is not returned",
      body: (
        <>
          <p>
            Vallo holds nothing and decides nothing here. The tenant&apos;s remedy is the Tenancy Tribunal or a small claims
            court. The tenant can open <strong>the tribunal pack and caution demand letter</strong> from the tenancy file:
            the whole record on one printable page, with the money and its receipts, the move-in and move-out reports
            room by room, every deduction with its answer, and the pinned messages.
          </p>
          <DocCallout kind="note" title="Tenant only">
            <p>The pack is the tenant&apos;s. A lister who opens it is told that only the tenant can prepare it.</p>
          </DocCallout>
        </>
      ),
    },
    {
      id: "review",
      heading: "Reviewing your landlord",
      body: (
        <p>
          A month after you move in, the tenant on the rent charge is asked about the door first, then the rest. It is
          for the tenant, and a charge that is not yours or does not exist shows a plain screen.
        </p>
      ),
    },
  ],
};

/* ------------------------------------------------------- public tools */

export const TOOLS: DocChapter = {
  slug: "tools-without-an-account",
  number: 0,
  title: "Tools that need no account",
  summary: "Work out a move-in total, check an advert or a receipt, and read what homes in an area are asking.",
icon: "naira-coins",
  updated: UPDATED,
  glance: [
    "The move-in calculator, area prices, the agent check and the receipt check work with no account.",
    "A receipt code and a record code each check one thing and confirm nothing else.",
    "A share link or a safety link opens one card for everybody the same way.",
  ],
  actions: ["move-in-cost", "price-check"],
  related: [
    { href: "/docs/price-check", label: "Price Check" },
    { href: "/safety", label: "The safety centre" },
  ],
  sections: [
    {
      id: "move-in",
      heading: "Move-in cost",
      body: (
        <p>
          <Link href="/move-in-cost" className={A}>The move-in calculator</Link> shows the real total up front, for
          anyone. Put in a rent and the costs a landlord commonly adds, and it shows the sum and what each part is.
        </p>
      ),
    },
    {
      id: "area",
      heading: "What homes in an area are asking",
      body: (
        <p>
          Area price pages show what homes in one area are <em>asking</em>, by type and bedrooms, with the count behind
          every figure. They are what places are asking, nothing more, and they carry no listings. See{" "}
          <Link href="/docs/price-check" className={A}>Price Check</Link>.
        </p>
      ),
    },
    {
      id: "agent-check",
      heading: "Is this a Vallo agent?",
      body: (
        <p>
          Property adverts live on WhatsApp statuses, Instagram posts and flyers, and Vallo does not stop that.{" "}
          <Link href="/check" className={A}>The agent check</Link> turns an advert into something you can test: type the
          code from the advert and see whether the person behind it is on Vallo.
        </p>
      ),
    },
    {
      id: "receipts",
      heading: "Check a receipt or a record",
      body: (
        <>
          <p>
            Every receipt has a code. Type it at <Link href="/r" className={A}>vallospaces.com/r</Link> and the page
            shows the receipt to whoever holds the code. It is never indexed by search engines.
          </p>
          <p>
            A lister can put a record code (<code>VR-</code> and six characters) on a bio, a card or a TO LET board.
            Someone signed in who types it into search sees the lister&apos;s live Record. A code that cannot be one of
            ours, or matches nobody, gets one answer, so the page never confirms which codes exist.
          </p>
        </>
      ),
    },
    {
      id: "links",
      heading: "Links you are sent",
      body: (
        <ul>
          <li>
            <strong>A share link</strong> opens one card with one button, the same to everybody.
          </li>
          <li>
            <strong>A safety link</strong> is sent from a renter&apos;s phone to someone they trust before going to an
            inspection alone. It says who they are meeting and where.
          </li>
          <li>
            <strong>A landlord reply link</strong> is single use, sent to the number on the mandate. The landlord needs
            no account.
          </li>
        </ul>
      ),
    },
  ],
};

/* ------------------------------------------------------------ profiles */

export const PROFILES: DocChapter = {
  slug: "profiles-and-passport",
  number: 0,
  title: "Profiles, passport and the directory",
  summary: "Your public page, the passport other members can open, and how to find an agent, a landlord or a hotel.",
icon: "user-check",
  updated: UPDATED,
  glance: [
    "Your page is at /u/ followed by your handle. You choose the name and the sentence people see.",
    "Your passport shows only the lines you left on, to other signed-in members.",
    "The directory lists agents, landlords and firms for property, and hotels, hosts and shortlet operators for stays.",
  ],
  actions: ["open-profile", "open-settings"],
  related: [{ href: "/docs/badges-and-verification", label: "Badges and verification" }],
  sections: [
    {
      id: "page",
      heading: "Your page",
      body: (
        <p>
          Every handle is an address, whether someone holds it or not. A handle nobody has taken is an invitation to take
          it. Your page shows your posts, your followers and who you follow, and the buttons to follow or write to you.
          You edit it on a full page, where you choose the name you are known by.
        </p>
      ),
    },
    {
      id: "messages",
      heading: "Writing to someone",
      body: (
        <p>
          From a profile, Message opens your existing chat with them, or starts one when you send the first message.
          Where a chat cannot be opened, the screen says so in plain words.
        </p>
      ),
    },
    {
      id: "passport",
      heading: "Vallo Passport",
      body: (
        <>
          <p>
            Every member has a passport. It is on by default with every line shown, and you switch lines off in{" "}
            <Link href="/settings/passport" className={A}>Settings, Vallo Passport</Link>. Another signed-in member can
            open it from your profile or from a chat; they see exactly the lines you left on and nothing more.
          </p>
          <p>
            If it is off, or you have blocked each other, or no one has that handle, the page says the same thing:
            &quot;not available&quot;. It never says which.
          </p>
        </>
      ),
    },
    {
      id: "directory",
      heading: "The directory",
      body: (
        <p>
          <Link href="/directory" className={A}>The directory</Link> is one list flipped by the side switch: Property
          lists agents, landlords and firms; Stays lists hotels, hosts and shortlet operators. Open one to see their
          page and verification.
        </p>
      ),
    },
  ],
};
