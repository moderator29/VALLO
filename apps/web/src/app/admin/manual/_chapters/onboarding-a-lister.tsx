import Link from "next/link";
import { DocCallout, DocCrossLink } from "@/components/docs/DocArticle";
import { DocFlow } from "@/components/docs/DocFlow";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { VERIFICATION_ORDER } from "@/lib/trust/verification";
import {
  NO_DOCUMENT_ANSWER,
  STAYS_DOORS,
  STAYS_DOOR_ORDER,
  SUPPLY_DOORS,
  SUPPLY_DOOR_ORDER,
} from "@/lib/supply/roles";
import { A, type ManualBody } from "./parts";

/**
 * Chapter 16: ONBOARDING A LISTER, END TO END (the founder, 15 November 2026).
 *
 * The one page a member of staff reads before they bring a landlord, an
 * agent, a hotel, a shortlet host or a restaurant onto Vallo: what each kind
 * of lister gives, how long each step takes, what the reviewer looks at, what
 * happens when something is missing, what the lister sees at each step, and
 * the words to use when asking a business for their papers.
 *
 * Read from the flows themselves on 15 November 2026: the chooser and the
 * three property doors (`lib/supply/roles.ts`, `app/(app)/profile/setup`,
 * `components/supply/OwnerRegisterForm.tsx`, `components/agent/ApplyWizard.tsx`),
 * the stays flow (`app/host/apply`, `lib/host/onboarding.ts` and
 * `lib/host/actions.ts`), the listing gate (`lib/agent/listings-actions.ts`),
 * the reviewer's own decisions (`lib/admin/actions.ts`), the identity gate
 * (`lib/verification/lister-identity.ts`) and the ladder
 * (`lib/trust/verification.ts`, imported here so a rung cannot drift).
 */

/** The property doors, from the chooser's own copy. */
const PROPERTY_DOORS: DocTableRow[] = SUPPLY_DOOR_ORDER.map((id) => {
  const door = SUPPLY_DOORS[id as "owner" | "agent"];
  return {
    id: `door-${id}`,
    cells: {
      who: door.title,
      asks: (
        <ul role="list">
          {door.needs.map((need) => (
            <li key={need}>{need}</li>
          ))}
        </ul>
      ),
      how: door.howLong,
    },
  };
});

const STAYS_ROWS: DocTableRow[] = STAYS_DOOR_ORDER.map((id) => ({
  id: `stays-${id}`,
  cells: {
    who: STAYS_DOORS[id].title,
    asks: STAYS_DOORS[id].blurb,
  },
}));

/** The ladder, from the ladder itself: what each rung says and what a reviewer looks at. */
const LADDER: DocTableRow[] = VERIFICATION_ORDER.map((rung) => ({
  id: `rung-${rung.kind}`,
  cells: { rung: rung.label, means: rung.meaning, looks: rung.evidence },
}));

/** The words to use, as words. Copy them, change the name, send them. */
const SCRIPTS: { id: string; when: string; say: string }[] = [
  {
    id: "first-ask",
    when: "The first ask, after they have said yes to listing",
    say: "Thank you. The next step is short. Vallo asks every business for three things before a listing goes up: a government ID for the person who will manage the account, your registration papers, and a Nigerian bank account in the business name or your own name so you can be paid. You send all three inside Vallo, on one screen, and a person at Vallo reads them. Would you like me to walk you through it now, or send you the link?",
  },
  {
    id: "cac",
    when: "Asking for the registration papers",
    say: "Could you send the name as the Corporate Affairs Commission holds it, your RC or BN number, and a photo or scan of the certificate? I check the number on the Commission's own free search while we talk, so if the name on the certificate reads differently from the name you trade under, tell me now and we will put both on the file.",
  },
  {
    id: "id",
    when: "Asking for the ID and the photo of their face",
    say: "Vallo asks for one government ID for the person who manages the account: an international passport photo page, a driver's licence, a NIN slip or card, or a permanent voter's card. Take the photo of the document itself, flat, with all four corners in the frame, and then a photo of your face in good light. Only the review team opens them. They are never shown on your page and we never ask for them on WhatsApp or by email.",
  },
  {
    id: "bank",
    when: "Asking for the bank account",
    say: "Add the account you want to be paid into. It has to be a Nigerian bank account, and the name on it has to be the name on your ID or your registered business name. Vallo asks your bank for the account name and compares the two, so a friend's account or a nickname on the account will hold your payouts up.",
  },
  {
    id: "no-papers",
    when: "A landlord with no document for the property",
    say: NO_DOCUMENT_ANSWER.reassurance,
  },
  {
    id: "chase",
    when: "Nothing has arrived and you are following up",
    say: "I am still holding your file open. Two things are outstanding: your certificate, and the photo of your ID. Once both are in, a person reads them and you hear back either way. If anything in the papers is awkward, tell me what it is and I will tell you honestly whether it stops the listing.",
  },
  {
    id: "waiting",
    when: "They ask how long",
    say: "A person reads it, not a machine, so I will not give you an hour. What Vallo publishes for an application and for identity documents is a decision within 3 days, and in practice the desk works to a shorter rule of its own. If something is missing you are told exactly what, and you replace only that one thing rather than starting again.",
  },
];

const SCRIPT_ROWS: DocTableRow[] = SCRIPTS.map((script) => ({
  id: script.id,
  cells: { when: script.when, say: script.say },
}));

export const ONBOARDING_A_LISTER: ManualBody = {
  intro: (
    <p>
      Everything that happens between a person saying yes to Vallo and their first listing being on the platform, in
      the order it happens. It is written for whoever is in the conversation: the Business Development Executive who
      found them, the reviewer who reads their documents, and the support agent they ring when nothing has moved. The
      words in the last section are meant to be used as they stand.
    </p>
  ),
  glance: [
    "Five doors: I own the property, I am an agent, we are a hotel, I run a shortlet, we are a restaurant. One account holds one side only.",
    "Nothing reaches a member until a person at Vallo has read the lister and read the listing.",
    "A lister can write a listing and send it for review before their identity is decided. It cannot be approved or published until it is.",
    "Everybody who takes money through Vallo needs a Nigerian bank account whose name matches their ID or their registered business name.",
    "A landlord with no ownership document still lists. They simply do not get the ownership mark.",
    "Ask for changes with a note, and refuse with a reason. The lister reads your words exactly as you wrote them.",
    "If you are not sure about a document, hand it up rather than decide it. Nobody is marked down for that.",
  ],
  sections: [
    {
      id: "the-five-doors",
      title: "The five doors, and what each one gives",
      body: (
        <>
          <p>
            Everybody who lists starts at{" "}
            <Link href="/profile/setup" className={A}>
              Add a workspace
            </Link>
            . The door they choose decides what Vallo asks them for, because each kind of lister can go wrong in a
            different way: an owner may not own the property, an agent may have no instruction from the owner, a hotel
            may not be the registered business it says it is. One account holds one side. An owner account does not
            become an agent account, and the screen says so and sends them to sign up again with a different email
            address if they are both.
          </p>
          <DocTable
            caption="The property doors: what Vallo asks for, and how long the form takes"
            columns={[
              { key: "who", label: "The door" },
              { key: "asks", label: "What Vallo asks for" },
              { key: "how", label: "How long the form takes" },
            ]}
            rows={PROPERTY_DOORS}
          />
          <p>
            There is a third property door in the words of the product, &quot;we are a registered firm&quot;, and it is
            not offered today. Approving a firm application makes one agent: nothing yet creates the agency as a
            business, attaches staff to it or lets a listing read &quot;listed by the firm&quot;. A firm&apos;s
            principal is sent to the agent form, which is what approval actually gives them. Do not promise a prospect a
            company workspace with staff on it.
          </p>
          <DocTable
            caption="The stays doors"
            columns={[
              { key: "who", label: "The door" },
              { key: "asks", label: "What is behind it" },
            ]}
            rows={STAYS_ROWS}
          />
          <p>
            The stays doors are not three new kinds of business. They are three ways of asking the one question the form
            needs answered, which is what proof to ask for: a hotel is expected to be registered with the Corporate
            Affairs Commission and is asked for its certificate, while somebody letting a furnished flat by the night
            may hold no registration at all and is not asked for one.
          </p>
        </>
      ),
    },
    {
      id: "end-to-end",
      title: "End to end, in order",
      body: (
        <>
          <DocFlow
            label="From a first conversation to a listing on the platform"
            steps={[
              { icon: "user", title: "An account", outcome: "Free, email and a password or Google, and they must be 18 or over." },
              { icon: "briefcase", title: "Add a workspace", href: "/profile/setup", outcome: "They pick their door. It decides every question after it." },
              { icon: "id-card", title: "The form", outcome: "Who they are, where, their papers, and a Nigerian bank account. Nothing typed is lost between screens." },
              { icon: "file-check", title: "Filed with a reference", outcome: "The screen says nobody has looked at it yet and gives them the reference to quote." },
              { icon: "user-check", title: "A person reads it", href: "/admin/agents", outcome: "Approve, ask for changes with a note, or refuse with a reason." },
              { icon: "house", title: "They write the listing", outcome: "Photos, the price, every cost before the keys, light and water." },
              { icon: "clipboard-list", title: "A person reads the listing", href: "/admin/listings", outcome: "Approve, ask for more, or send it back with a reason they can act on." },
              { icon: "feed", title: "Published and announced once", outcome: "It goes up and is announced one time in the place it sits in on Around." },
            ]}
          />
          <p>
            Two of those steps are gates rather than forms, and they are the two that catch people out.
          </p>
          <ul role="list">
            <li>
              <strong>The first listing wants a confirmed phone number.</strong> Sending a first listing for review asks
              for the phone confirmation code. This is on today. A read that fails holds the listing rather than letting
              it through.
            </li>
            <li>
              <strong>Identity is a gate at approval, not at submission.</strong> A lister whose identity is still being
              read may write a listing and send it in, so it reaches the desk. It cannot be approved or published until
              their identity is approved, and the desk says so on the listing with a link to their case. That is the
              founder&apos;s own rule: you can create a listing and not be approved yet, but before it is published the
              person behind it has to be.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "what-each-form-asks",
      title: "What each form actually asks, screen by screen",
      body: (
        <>
          <h3 className="nf-h4">The owner, four screens</h3>
          <ol role="list">
            <li>About you: full name, phone number, and the eleven digits of a National Identity Number. Continue stays shut until the number is eleven digits.</li>
            <li>Where do you own: the state and the local government. The exact spot on the map belongs to the property and is set on the listing.</li>
            <li>
              Proof of ownership: a Certificate of Occupancy, a deed of assignment, governor&apos;s consent, a survey
              plan, a utility bill in their name, a letter of authority from the owner, or &quot;I have none of
              these&quot;. The document itself may be sent later. The Terms, the Privacy policy, and a statement that
              every payment for a deal happens inside Vallo are agreed on this screen.
            </li>
            <li>Filed. The screen says what the ownership answer means for their listing and gives them a way to follow it.</li>
          </ol>
          <h3 className="nf-h4">The agent, six steps</h3>
          <ol role="list">
            <li>About you: the kind of agent, name, surname and phone number.</li>
            <li>Prove who you are: the kind of ID, its number, and the National Identity Number.</li>
            <li>Your business: for a registered one, the business name and the RC number; then the state, the city and the address.</li>
            <li>Documents: the front of the ID, the back of the ID, and for a registered business the certificate. The screen says these files are seen only by the team reading the application and never appear on their public page.</li>
            <li>Getting paid: the bank, the account number and the account name.</li>
            <li>Check and send: everything they typed, the Terms, and the statement about paying inside Vallo.</li>
          </ol>
          <p>
            An agent is asked for more than an owner, and the form says why in its own words: an agent is handling
            somebody else&apos;s property. Their fees are set in the open, where a tenant reads them before ringing.
          </p>
          <h3 className="nf-h4">A hotel, a shortlet or a restaurant</h3>
          <p>
            One row is the whole application, created as a draft at the second step, so nothing is lost and there is no
            second application to fall out of step with the business it becomes. The steps a host sees depend on their
            answers: what kind of host they are, the business named and placed, the registration papers where the
            business is a registered one, the representative and their ID, then either the hotel with its room types
            and rates or the place with its house rules, then facilities and photographs, then the charges a guest
            could meet at the door, then the bank account, then three separate permissions, then check and send.
          </p>
          <p>
            A restaurant is asked about the restaurant itself, its tables and its hours, a health permit attestation,
            and at least one photograph.
          </p>
          <DocCallout tone="note" title="The three permissions are three decisions">
            That the documents are genuine and the details right; the host terms and the privacy policy; and permission
            to use their details for identity and fraud work. They are three switches, not one, because the last has to
            be given on its own under the Nigeria Data Protection Act. Never tell a host to &quot;just tick them
            all&quot;.
          </DocCallout>
        </>
      ),
    },
    {
      id: "how-long-it-takes",
      title: "How long each part takes, honestly",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>The owner&apos;s form:</strong> {SUPPLY_DOORS.owner.howLong} <strong>The agent&apos;s form:</strong>{" "}
              {SUPPLY_DOORS.agent.howLong}
            </li>
            <li>
              <strong>A host&apos;s application:</strong> longer, and it does not have to be done in one sitting.
              Everything typed is saved as it goes, and what must be present is decided only when they press send.
            </li>
            <li>
              <strong>What Vallo publishes:</strong> an application, a verification document and an appeal are promised
              a decision within 3 days. That is the figure a member is shown and the one the queue&apos;s clock counts
              against, so it is the figure to say.
            </li>
            <li>
              <strong>What the screens say while they wait:</strong> the registration screens tell a person to expect
              two working days, and three where a firm&apos;s papers are involved.
            </li>
            <li>
              <strong>What the desk works to:</strong> the reviewer guide&apos;s own rule is a decision on identity
              documents within one working day of arrival, oldest first. Work to that; promise the published figure. A
              person waiting is a listing not yet up.
            </li>
            <li>
              <strong>A listing:</strong> no published figure. Do not invent one. Say that a person reads it and that
              they are told either way.
            </li>
          </ul>
          <DocCallout tone="warning" title="Never give a date">
            Not for a decision, not for a feature, not for a payment. Give the published promise where there is one, say
            what happens next where there is not, and tell them they hear from us either way.
          </DocCallout>
        </>
      ),
    },
    {
      id: "what-the-reviewer-looks-at",
      title: "What the reviewer looks at",
      body: (
        <>
          <p>
            Two different people may be reading one lister: the application itself, on the applications desk, and their
            identity documents, on the verification desk. The ladder below is the record of what has been looked at, one
            rung at a time, each decided by a named person.
          </p>
          <DocTable
            caption="The ladder: what each rung says, and what the reviewer looks at for it"
            columns={[
              { key: "rung", label: "Rung" },
              { key: "means", label: "What it says to a reader" },
              { key: "looks", label: "What the reviewer looks at" },
            ]}
            rows={LADDER}
          />
          <p>On the documents themselves, in short:</p>
          <ul role="list">
            <li>
              <strong>The ID:</strong> a photo of the document and not of a screen, all four corners in view, not
              expired, nothing about it edited, and the face on it a believable one for the date of birth.
            </li>
            <li>
              <strong>The photo of their face:</strong> the same person, taken now rather than found, one whole face, no
              sunglasses. Compare the parts of a face that do not change.
            </li>
            <li>
              <strong>The names:</strong> type the name as the ID prints it. A different order, a missing middle name,
              an initial or a title makes no difference. A different first name or surname needs a document that
              explains it.
            </li>
            <li>
              <strong>The address:</strong> a utility bill, a bank statement or a tenancy agreement, dated in the last
              three months, in the name on the ID.
            </li>
            <li>
              <strong>The business:</strong> look the RC or BN number up on the Corporate Affairs Commission&apos;s own
              public search, which costs nothing. The name and number agree, the company is active, and the person
              applying is a director, the proprietor or somebody the business has authorised in writing.
            </li>
            <li>
              <strong>The bank account:</strong> Vallo asks the bank for the account name and compares it with the name
              on the ID. A match passes that rung on its own. A difference waits for a person. A business account in
              the registered business name is fine; another individual&apos;s account is not.
            </li>
          </ul>
          <p>
            The full procedure, the cross-checks panel beside every person, and the exact words to send a document back
            with are in the reviewer guide on the verification desk.
          </p>
          <DocCrossLink href="/admin/kyc/guide">The reviewer guide, on the verification desk</DocCrossLink>
          <DocCallout tone="note" title="Identity is read by a person today">
            There is no paid identity service switched on. A reviewer has the free cross-checks beside each person: the
            same ID number or file or a very similar picture on another account, the mark of an editing app on an
            image, and for a passport the digits in the two lines at the bottom of the photo page. None of that proves
            a document is genuine. It catches common forgeries and an ID used twice. A paid service is being set up. If
            you are not sure about an ID, do not decide it: press Escalate and write what you saw.
          </DocCallout>
        </>
      ),
    },
    {
      id: "when-something-is-missing",
      title: "When something is missing",
      body: (
        <>
          <p>There are three decisions on an application and only three, and two of them carry your words to the applicant.</p>
          <ul role="list">
            <li>
              <strong>Approve.</strong> The workspace opens. For an owner it opens as an owner, for an agent and a firm
              as an agent. Approval is not a check of anybody: at that moment they are on the bottom of the ladder and
              no document has been looked at. The marks are earned on the ladder afterwards.
            </li>
            <li>
              <strong>Ask for changes.</strong> You must write what to change. The desk refuses an empty note, because
              an empty note reached the applicant as a blank message and an email with nothing in it.
            </li>
            <li>
              <strong>Refuse.</strong> You must say why, in at least eight characters, and in practice in a sentence.
              The applicant reads it word for word and it is the only explanation they get.
            </li>
          </ul>
          <p>
            Nobody decides their own application, whatever their access, and the desk stops you. An application already
            decided cannot be decided again: refresh the queue and you will see who moved it.
          </p>
          <p>
            A host&apos;s application prints exactly what is absent, item by item, rather than saying some fields are
            required: the kind of business, the registered name, the certificate, the representative&apos;s ID, a
            photograph of the property, the pin on the map, a room type, a rate with a cancellation policy, all five
            charges at the door answered, a bank account, the agreements and the three permissions. Read that list back
            to the host and they can finish it in one go.
          </p>
          <p>
            A listing sent back is not lost either. It reopens where they were, with your note on it, and they edit and
            send it again. A listing in draft, sent back, or refused is theirs to edit; one waiting on review or being
            read is not, and they are told that rather than finding a dead button.
          </p>
        </>
      ),
    },
    {
      id: "what-the-lister-sees",
      title: "What the lister sees at each step",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>The moment they send it:</strong> a screen that says the registration is filed, that nobody has
              looked at it yet, and that this screen will not pretend otherwise. Under it: a person reads what you sent,
              we write to you with the answer whichever way it goes, and your listings open the moment it is approved.
            </li>
            <li>
              <strong>The reference:</strong> filed as a reference they can quote to support. If their files did not
              attach, the screen tells them so and asks them to contact us with that reference rather than silently
              losing the upload.
            </li>
            <li>
              <strong>Where it stands:</strong> their workspace carries its standing, in words and never in colour
              alone: waiting, refused, suspended, draft, or nothing at all when it is in good standing. A person whose
              application was refused can see that it was refused, and why.
            </li>
            <li>
              <strong>The ownership answer:</strong> an owner who chose a document is told their listing can carry the
              ownership mark once a reviewer has seen it. An owner who holds nothing is told plainly that their listing
              goes up the same way and simply will not carry that mark.
            </li>
            <li>
              <strong>After approval:</strong> before they publish, the listing shows them the price a renter or guest
              pays and what they receive after Vallo&apos;s commission, in naira, and they accept those figures for
              that listing. Listing itself is free.
            </li>
            <li>
              <strong>On the ladder:</strong> a rung not reached is drawn as not reached, with what it would take.
              Nothing is hidden and nothing is implied.
            </li>
          </ul>
          <DocCallout tone="note" title="What the marks do not say">
            A rung says what a person looked at on a date. The ownership mark means a reviewer saw a document in that
            person&apos;s name for that address: it is not a search of the title and it is not advice. Tell a buyer to
            have their own solicitor look at the title.
          </DocCallout>
        </>
      ),
    },
    {
      id: "asking-a-business-for-their-papers",
      title: "The words to use when asking a business for their papers",
      body: (
        <>
          <p>
            This is the part of the job people find hardest, so the words are written out. Use them as they stand,
            change the name, and send them. They work because they say what is being asked for, why, who sees it and
            what happens next, and they promise nothing nobody can keep.
          </p>
          <DocTable
            caption="What to say, and when"
            columns={[
              { key: "when", label: "When" },
              { key: "say", label: "What to say" },
            ]}
            rows={SCRIPT_ROWS}
          />
          <p>And the rules behind those words, which matter more than the words:</p>
          <ul role="list">
            <li>Documents only ever travel through Vallo. Never ask for one on WhatsApp, by email or by text, and never send one out of the console, not even to check it.</li>
            <li>Never type a member&apos;s ID number or bank number into any outside website, app or chat.</li>
            <li>Never tell somebody their document looks forged. Ask for a different government ID and hand the case up.</li>
            <li>Never say a listing is held up because of something another member did.</li>
            <li>Never promise how many enquiries, viewings or bookings they will get. Vallo is new. Say that the first listers in an area are the ones people find, and that listing costs nothing.</li>
          </ul>
        </>
      ),
    },
    {
      id: "the-desks-you-do-this-on",
      title: "The desks you do this on",
      body: (
        <>
          <ul role="list">
            <li>
              <Link href="/admin/agents" className={A}>Applications</Link>: every application waiting on a decision, with its documents.
            </li>
            <li>
              <Link href="/admin/businesses" className={A}>Businesses</Link>: hotels, shortlet hosts and restaurants, and where each one stands.
            </li>
            <li>
              <Link href="/admin/kyc" className={A}>Verification</Link>: identity, the photo of their face, address and the cross-checks, with the{" "}
              <Link href="/admin/kyc/guide" className={A}>reviewer guide</Link> beside it.
            </li>
            <li>
              <Link href="/admin/review-calls" className={A}>Review calls</Link>: a video call with the person where the documents alone do not settle it.
            </li>
            <li>
              <Link href="/admin/listings" className={A}>Listings</Link>: the listing itself, and the identity gate on approving it.
            </li>
            <li>
              <Link href="/admin/supply" className={A}>Supply</Link> and <Link href="/admin/stops" className={A}>Stops</Link>: who is listing, and who has been stopped from listing and why.
            </li>
            <li>
              <Link href="/admin/business-development" className={A}>Business development</Link>: the pipeline this whole chapter feeds, with the follow-ups due.
            </li>
            <li>
              <Link href="/admin/escalations" className={A}>Escalations</Link>: where anything you cannot or may not decide goes.
            </li>
          </ul>
          <p>
            The member-facing versions of all of this are worth sending rather than retyping:{" "}
            <Link href="/docs/listing-on-vallo" className={A}>Listing a property</Link>,{" "}
            <Link href="/docs/for-owners" className={A}>For owners and landlords</Link>,{" "}
            <Link href="/docs/for-agents" className={A}>For agents and firms</Link>,{" "}
            <Link href="/docs/hosting" className={A}>Hosting a hotel or shortlet</Link>,{" "}
            <Link href="/docs/restaurants" className={A}>Restaurants and tables</Link> and{" "}
            <Link href="/docs/badges-and-verification" className={A}>Badges and verification</Link>.
          </p>
        </>
      ),
    },
  ],
};
