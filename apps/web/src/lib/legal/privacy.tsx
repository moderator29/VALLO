/**
 * Privacy policy, as content rather than as a page.
 *
 * These sections are rendered in two places and must never differ between
 * them: `(site)/privacy` for the public web, and `(app)/legal/privacy` for
 * somebody already inside the product. The in-product copy exists because the
 * marketing page is a different application shell: tapping Privacy policy in the
 * side navigation used to throw a signed-in person out of the product
 * entirely, and their back button then returned them to the marketing site
 * rather than to the screen they were reading a moment earlier.
 *
 * Two routes, one document. A legal text that says different things in two
 * places is not a legal text.
 */

import { SUPPORT_HREF, SUPPORT_LABEL } from "@/lib/support-email";
import { GRACE_WINDOW_DAYS } from "@/lib/account-deletion/constants";
import {
  COMPANY_DOMAIN,
  COMPANY_FORMAL_NAME,
  COMPANY_NDPC_REGISTRATION,
  COMPANY_REGISTERED_OFFICE,
  COMPANY_TRADING_NAME,
  DATA_PROTECTION_OFFICER,
} from "./company";

/** The date on the page; moves with PRIVACY_VERSION (`./versions`). */
export const PRIVACY_UPDATED = "25 September 2026";

export const PRIVACY_SECTIONS: { id?: string; title: string; body: React.ReactNode }[] = [
  {
    title: "1. Who we are",
    body: (
      <>
        {/* This description is identity, not obligation. It said "stays,
            hotels, restaurants and experiences", the product's earlier scope,
            and omitted property entirely; it now matches how the terms of
            service section 2 describes the platform, which changed again on
            22 September when the platform's position changed. No right or
            duty in this policy turns on the sentence, and the two documents
            are kept saying the same thing on purpose: a controller described
            one way in the terms and another way in the notice is a controller
            a reader cannot identify. */}
        <p>
          {COMPANY_TRADING_NAME} is a marketplace for property and stays in Nigeria:
          homes to rent, property for sale, land, shops and offices, and stays, hotels
          and restaurants listed by the people who run them
          {COMPANY_DOMAIN ? <>, on the web at {COMPANY_DOMAIN}</> : null}. It is operated
          by {COMPANY_FORMAL_NAME}, a private company limited by shares registered in
          Nigeria under the Companies and Allied Matters Act 2020, whose registered
          office is {COMPANY_REGISTERED_OFFICE}.
        </p>
        <p>
          For the purposes of the Nigeria Data Protection Act 2023 (the &quot;NDPA&quot;),{" "}
          <strong>{COMPANY_FORMAL_NAME}</strong> is the data controller for the personal
          data described in this policy. Where this policy says &quot;we&quot; or
          &quot;us&quot;, it means that company.
          {COMPANY_NDPC_REGISTRATION ? (
            <> It is registered with the Nigeria Data Protection Commission under
            registration number {COMPANY_NDPC_REGISTRATION}.</>
          ) : null}
        </p>
        <p>
          {DATA_PROTECTION_OFFICER ? <>Our Data Protection Officer is {DATA_PROTECTION_OFFICER}. </> : null}
          Questions about this policy, about the data we hold about you, or any request to
          exercise the rights in section 8, should go to{" "}
          <a href={SUPPORT_HREF} className="font-semibold text-[var(--nf-content-link)] hover:underline">
            {SUPPORT_LABEL}
          </a>
          , with Privacy as the subject.{" "}
          {DATA_PROTECTION_OFFICER
            ? "Requests sent that way reach the Data Protection Officer."
            : "Requests sent that way reach the people at Vallo responsible for data protection."}
        </p>
      </>
    ),
  },
  {
    /* STORE-08 / SEC-13: every entry below was derived from what the code
       stores, not from what a policy usually says. When a feature starts
       storing something new, this list changes in the same commit, and so do
       `docs/store/PRIVACY_LABELS.md` and PRIVACY_VERSION. */
    title: "2. The data we collect",
    body: (
      <>
        <p>We collect only what the platform needs to work:</p>
        <ul>
          <li>
            <strong>Account data.</strong> Your name, email address, phone number if you
            give one, password (stored only in hashed form), language, the state and
            local government you choose, your occupation if you give it, and the
            interests you pick.
          </li>
          <li>
            <strong>Your public profile and what you post.</strong> Your display name,
            handle, photo, cover picture and bio, and the posts, comments, stories,
            reactions and follows you make in the social part of Vallo. These are
            visible to other members, as the profile screen shows.
          </li>
          <li>
            <strong>What you list.</strong> If you list a property or a stay: its
            description, photographs, videos, price, address and, if you drop a pin or
            tap &quot;use my location&quot;, its map position. The street address can be
            read by members who are signed in; it is not shown to anybody who is not.
          </li>
          <li>
            <strong>Bookings, messages and reviews.</strong> The listings you save, the
            bookings, reservations and inspections you make, the messages you exchange
            with the people who list, and the reviews you write.
          </li>
          <li>
            <strong>Payment data.</strong> Payment references, amounts, how each payment
            was split (the lister&rsquo;s share and our commission), refunds, and, if you save them, a card token and the bank
            account you nominate for payouts. We do not keep a wallet or a balance for
            you, because we never hold your money. Card numbers are handled by Paystack;
            we never see or store your full card number.
          </li>
          <li>
            <strong>Agreements, and claims made before 9 November 2026.</strong> The
            agreements you draw up and confirm, their versions, Vallo&rsquo;s decision and
            its reason, and, if you made a claim on the Vallo Guarantee while it ran (it was
            retired on 9 November 2026), what you claimed, the photographs and evidence you
            uploaded, and the decision.
          </li>
          <li>
            <strong>Verification data.</strong> If you list property or get paid on
            Vallo (as an agent, landlord, owner, host or firm): a photo of your
            government ID (an international passport, a driver&rsquo;s licence, a NIN
            slip or card, or a voter&rsquo;s card), a selfie we compare with the photo on
            your ID, a recent proof of address, business registration details where they
            apply, the name printed on your ID as our reviewer records it, and the bank
            account you nominate for payouts with the account holder&rsquo;s name your
            bank returns. If our team cannot confirm your identity from these, we may ask
            you for one more photo of you holding your ID. Renters and buyers are never
            asked for any of this.
          </li>
          <li>
            <strong>Location.</strong> Your device location is read only when you ask
            for it: to place a listing&rsquo;s pin, to centre the map on where you are,
            or to save a spot for a price check (stored to about 100 metres). We do not
            track your location in the background.
          </li>
          <li>
            <strong>What you type to the AI assistant or the support chat.</strong>{" "}
            Assistant conversations are kept on your account so you can come back to
            them; the support chat is kept on your device, and a ticket you open with a
            person is kept on your account. What you type is processed by Anthropic to
            write the answers, only if you agree to it. See section 12.
          </li>
          <li>
            <strong>Devices and notifications.</strong> If you turn notifications on, the
            notification address your phone or browser gives us and a short device name
            (&quot;iPhone&quot;, &quot;Android phone&quot;). To warn you when your account
            is used on a new device, we keep a code derived from the device and browser
            you sign in with, and the browser and platform of each signed-in session.
          </li>
          <li>
            <strong>Technical data.</strong> IP address, browser and device type in our
            hosting and database logs, used to keep the service working and secure. If
            something crashes, a crash report with the error, the page and the device
            type, with personal details removed.
          </li>
          <li>
            <strong>Price checks.</strong> When you use the price check, we record the
            area, the kind of property and how far you got, against your account, so we
            can see whether it gives useful answers. That and the sign-up step counts
            below are the only records we keep of how the product is used. There is no
            other analytics and no advertising tracking in Vallo.
          </li>
          <li>
            <strong>Sign-up step counts.</strong> We count, ourselves, how many visits
            reach each step of joining Vallo: opening the home page, starting to sign up,
            and, once you have an account, your first search and your first save. Each
            count carries the language, whether it was the website or the app, the part
            of the page you came from, and a random visit number kept in a cookie that is
            deleted when you close your browser. Before you have an account nothing ties a
            count to you; after, the first search and the first save are linked to your
            account only so that each is counted once. Nothing is shared with anyone, and
            the counts are deleted after 90 days.
          </li>
          <li>
            <strong>Emails we send you.</strong> A record of each one is kept for 90
            days after it is delivered, so we can answer whether it arrived. A record of
            an email that could not be delivered is kept until a person at Vallo has
            dealt with it.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "3. How we use your data",
    body: (
      <ul>
        <li>To create and run your account and show the platform in your language.</li>
        <li>To process bookings, take payments, issue refunds and pay people out.</li>
        <li>
          To check the identity of the people who list and get paid, and keep fraudulent
          listings off the platform. A trained member of our verification team looks at
          your ID, compares your selfie with the photo on it, checks your proof of
          address, and checks that the name on the bank account you are paid into
          matches the name on your ID. No decision about your identity is made by a
          machine alone: a person decides, and if they cannot accept a document they tell
          you why.
        </li>
        <li>
          To carry messages between you and the people who list, about listings and
          bookings.
        </li>
        <li>To show listings, stays and places on a map and near where you ask.</li>
        <li>
          To answer your questions with the AI assistant and the support chat, if you
          agree to it (section 12).
        </li>
        <li>
          To send you notifications and emails about your bookings, messages, money and
          account, including a warning when your account is used on a new device.
        </li>
        <li>To answer support requests and investigate reports and disputes.</li>
        <li>To keep the service secure, prevent abuse and comply with Nigerian law.</li>
        <li>
          News and updates by email are on when you sign up, with a box you can untick
          there, and you can switch them off at any time in Settings. Every one includes
          a way to opt out.
        </li>
      </ul>
    ),
  },
  {
    title: "4. Our lawful bases under the NDPA",
    body: (
      <>
        <p>Every use of your data rests on a lawful basis recognised by the NDPA:</p>
        <ul>
          <li>
            <strong>Contract.</strong> Running your account, processing your bookings and
            payments, carrying your messages and paying people who list are necessary to
            provide the service you signed up for.
          </li>
          <li>
            <strong>Legal obligation.</strong> Identity verification of the people who
            list and get paid (customer due diligence under the Money Laundering
            (Prevention and Prohibition) Act 2022), financial record keeping and
            responding to lawful requests from Nigerian authorities.
          </li>
          <li>
            <strong>Legitimate interest.</strong> Fraud prevention, new-device warnings,
            crash reports and platform security, balanced against your rights.
          </li>
          <li>
            <strong>Consent.</strong> The AI assistant and support chat, notifications,
            reading your device location, and marketing. Each can be withdrawn at any
            time without affecting the rest of the platform. The selfie you take to
            verify, which shows your face, is also processed with your explicit consent,
            given separately on the verification screen; if you withdraw it we can no
            longer confirm your identity, so you cannot list or be paid until you verify
            again.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "5. Who we share data with",
    body: (
      <>
        <p>We do not sell personal data. We share it only where the service requires:</p>
        <ul>
          <li>
            <strong>The people who list, and the people who contact them.</strong> When
            you book a stay, request an inspection, apply for a tenancy or enquire about
            a sale, the person who listed the property sees the details they need to
            answer you. When you list, the people who contact you see your public listing
            profile.
          </li>
          <li>
            <strong>Other members,</strong> who see your public profile and what you post
            in the social part of Vallo.
          </li>
          <li>
            <strong>Our service providers,</strong> each under contract, only on our
            instructions and only for the job named:
            <ul>
              <li>Supabase (Ireland, EU): our database, sign-in and file storage.</li>
              <li>Vercel (United States): hosting the website and app.</li>
              <li>
                Paystack (Nigeria): card and bank payments, splitting each payment to the
                lister&rsquo;s bank account, refunds, and
                confirming the account holder&rsquo;s name on the bank account you
                nominate for payouts.
              </li>
              <li>
                Payluk (Nigeria): where the Vallo wallet is offered, the payment provider
                that holds and moves that money. It receives your name, email address and
                phone number.
              </li>
              <li>
                Termii (Nigeria) and Twilio (United States): sending the one-time codes
                that confirm your phone number. They receive your phone number and the
                message with the code.
              </li>
              <li>
                Yellow Card (Nigeria): where crypto payment is offered, converting it to
                naira. It receives the payment reference and amount.
              </li>
              <li>Resend (United States): sending our emails.</li>
              <li>
                Anthropic (United States): writing the answers of the AI assistant and
                the support chat, if you agree to it (section 12).
              </li>
              <li>
                MapTiler (Switzerland) and CARTO (United States, Spain): map tiles. When a
                map is shown they receive your IP address and the part of the map you are
                looking at.
              </li>
              <li>
                Google Firebase Cloud Messaging (United States) and Apple Push
                Notification service (United States), and your browser&rsquo;s own push
                service: delivering notifications to your device, if you turn them on.
              </li>
              <li>
                Sentry (United States), only when crash reporting is switched on: crash
                reports, with personal details removed.
              </li>
              <li>
                Unsplash (United States): some example photographs are loaded from it,
                which gives it your IP address.
              </li>
            </ul>
          </li>
          <li>
            <strong>Your verification documents and selfie are not shared</strong> with
            other members or with any of the providers above except Supabase, which
            stores them. Only our verification team sees them.
          </li>
          <li>
            <strong>Authorities.</strong> Where Nigerian law requires it, or to protect
            the safety of our users, and only to the extent required.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "6. Storage and international transfers",
    body: (
      <p>
        Our database and files are stored in Ireland (EU). Some of our providers named in
        section 5 process data in the United States, Switzerland or elsewhere. Where
        personal data leaves Nigeria we rely on the transfer mechanisms the NDPA permits,
        including transfers to jurisdictions providing adequate protection and
        contractual safeguards with our providers, so your data keeps the same level of
        protection wherever it is processed.
      </p>
    ),
  },
  {
    /* Rewritten so the document and the code finally agree. The old version
       promised deletion "within a reasonable period", and the product could
       not perform one at all for anybody who had transacted: see
       docs/design/audits/r3/findings.md F-17. Every sentence below describes
       what lib/account-deletion actually does. */
    title: "7. How long we keep data, and what happens when you delete your account",
    body: (
      <>
        <p>
          We keep personal data only as long as we need it. While your account is open we
          keep your profile, your content and your records. When you delete your account,
          two different things happen to two different kinds of data, and this section
          says plainly which is which.
        </p>
        <p>
          <strong>You can delete your account yourself,</strong> in Settings then Account,
          in the app or on this website. You do not need to write to us and we do not do
          it by hand.
        </p>
        <p>
          <strong>Nothing is destroyed for {GRACE_WINDOW_DAYS} days.</strong> The moment
          you confirm, your account is signed out everywhere and deactivated: you cannot
          sign in and nobody can reach your profile. We email you the date the deletion
          runs and a code that stops it. If you use that code inside the window,
          everything is put back and nothing has been lost. At the end of the{" "}
          {GRACE_WINDOW_DAYS} days a scheduled job runs the deletion, and we email you
          again when it has finished.
        </p>
        <p>
          <strong>Destroyed outright.</strong> Your profile and the details in it, your
          photograph and cover picture, your posts, comments, stories and unpublished
          drafts, your saved properties, stays, tables, searches and interests, your
          search history, the devices you are signed in on and the device records we keep
          to warn you about new sign-ins, your notification addresses, your
          notifications, the emails we had queued or sent you, your price checks and saved
          price-check spots, your assistant conversations, your saved cards and bank
          accounts, and every file you have uploaded, including host documents and the
          identity and agency documents of anybody who applied to be an agent and was not
          approved. The files are removed from storage, not merely the records that
          point at them. The one exception is an approved agent&rsquo;s identification,
          described below.
        </p>
        <p>
          <strong>Your email address is not kept.</strong> We keep only a one-way keyed
          code made from it, which cannot be turned back into the address. Our staff can
          use it only to see that a new account uses the same mailbox as a deleted one.
        </p>
        <p>
          <strong>Money is never deleted with an account.</strong> On the day the deletion
          runs we check again. If a payment or a refund is still in progress, a claim
          made before 9 November 2026 is still open, or money is owed to you or by you, the deletion
          waits: nothing is destroyed, a person at Vallo is told, and we contact you to
          settle it first. Your code to stop the deletion keeps working while it waits.
        </p>
        <p>
          <strong>Kept, with you removed from it.</strong> Vallo is registered with the
          Special Control Unit against Money Laundering and is subject to Nigeria&rsquo;s
          Money Laundering (Prevention and Prohibition) Act, which requires a business
          that moves money to retain its transaction records for at least five years after
          the transaction. So your bookings, reservations, agreements, payments, Guarantee claims,
          platform revenue lines, payout records, inspection requests and reviews are kept
          for that period. Your name, email address and telephone number are removed from
          every one of them, and what remains is an amount, a date and a reference that no
          longer identifies you. Messages you have sent stay in the other person&rsquo;s
          conversation so their side of the thread is still readable, with the sender
          shown as a deleted account.
        </p>
        <p>
          <strong>This is the retention exception to your right to erasure,</strong> and
          section 8 sets out how to exercise that right. The NDPA permits us to keep
          personal data where another law requires us to, and this is that case. It is
          limited to the records named above, for the period named above, and to nothing
          else.
        </p>
        <p>
          Verification documents are the clearest example of the line. If you were
          approved as an agent, you were a customer under the same anti money laundering
          law, which requires us to keep your identification. So when you delete your
          account we keep, for five years after it closes, your identity and agency
          documents (including the selfie you took to verify), your name, residential address, ID type and number, business
          registration and payout account details. Only our staff can read them, and at
          the end of the five years they are destroyed. If you applied and were not
          approved, none of this is kept: the documents and the numbers are destroyed with
          the rest of your account.
        </p>
        <p>
          The full list of what is destroyed and what is kept, and the form that stops a
          deletion already running, are at{" "}
          <a
            href="/delete-account"
            className="font-semibold text-[var(--nf-content-link)] hover:underline"
          >
            the delete account page
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: "8. Your rights under the NDPA",
    body: (
      <>
        <p>The NDPA gives you rights over your personal data. You can:</p>
        <ul>
          <li>Ask for a copy of the personal data we hold about you.</li>
          <li>Ask us to correct data that is inaccurate or incomplete.</li>
          <li>
            Delete your account yourself, in Settings then Account, which destroys
            everything except the records section 7 says we are required to keep.
          </li>
          <li>Ask us to delete other data we no longer have a lawful reason to keep.</li>
          <li>Object to, or ask us to restrict, certain processing.</li>
          <li>Ask for your data in a portable format.</li>
          <li>Withdraw consent where processing is based on consent.</li>
        </ul>
        <p>
          {/* The sentence somebody reads when they want their data back or
              deleted. It has to point at a channel a person actually reads,
              which today is the contact form: it writes a support_tickets row
              an admin works in the console. It said support@rentme.ng, and
              that mailbox does not exist, so every NDPA request sent to it
              would have gone nowhere while the sender believed they had
              asked. */}
          Deletion is the one you do not have to ask us for: it is a control in the
          product, it takes effect immediately, and{" "}
          <a
            href="/delete-account"
            className="font-semibold text-[var(--nf-content-link)] hover:underline"
          >
            the delete account page
          </a>{" "}
          explains it in full. To exercise any of the others, write to us through{" "}
          <a href={SUPPORT_HREF} className="font-semibold text-[var(--nf-content-link)] hover:underline">
            {SUPPORT_LABEL}
          </a>
          . We respond within the timelines the NDPA sets. If you are not satisfied with
          our response, you have the right to complain to the Nigeria Data Protection
          Commission (NDPC).
        </p>
      </>
    ),
  },
  {
    /* SEC-13: this said Vallo used "analytics that help us understand how the
       product is used". It does not: there is no analytics or advertising
       script, and the only cookies are the functional ones listed here. */
    title: "9. Cookies and similar technology",
    body: (
      <>
        <p>
          We use only cookies and device storage that the product needs to work, and one
          first-party cookie for the sign-up step counts in section 2. There is no analytics
          from a third party, and no advertising or tracking cookie in Vallo.
        </p>
        <ul>
          <li>Your sign-in session (set by our sign-in provider, Supabase).</li>
          <li>
            Your choices: language, theme, which side of Vallo you last used, how you like
            search results shown, and whether you have seen the welcome cards.
          </li>
          <li>That you agreed to how the AI assistant works (section 12).</li>
          <li>
            A random visit number for the sign-up step counts, deleted when you close your
            browser.
          </li>
          <li>
            On your device only: places you saved before signing in, your support chat,
            whether notifications are on for this device, and your data-saver choice.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "10. Children",
    body: (
      <p>
        {COMPANY_TRADING_NAME} is for adults. You must be at least 18 years old to create
        an account, book a stay or list a property. We do not knowingly collect personal
        data from children, and we delete any such data we discover.
      </p>
    ),
  },
  {
    title: "11. Security",
    body: (
      <>
        <p>
          We protect personal data with encryption in transit, access controls, hashed
          passwords and payment processing through licensed providers. No system is
          perfectly secure, so if we ever discover a breach that puts your rights at risk
          we will notify the NDPC and affected users as the NDPA requires.
        </p>
        <p>
          Identity documents and selfies are kept in private storage that is never
          public. Only members of our verification team, who have agreed to our staff
          rules on confidentiality, can open them, and only inside Vallo&rsquo;s staff
          console: they are never downloaded, forwarded or sent by email or messaging
          apps. Every time one is opened, who opened it and when is recorded. Nobody on
          our team can review their own documents.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    /* STORE-07: named here because the assistant sends what a person types to
       a third party outside Nigeria. `lib/ai/consent.ts` holds the words the
       person agrees to before it does. */
    title: "12. The AI assistant and the support chat",
    body: (
      <>
        <p>
          Vallo&rsquo;s assistant, the support chat and the @vallo replies in the social
          feed are AI. They are powered by <strong>Anthropic</strong>, a company in the
          United States. When you use them, what you type, the recent turns of the
          conversation and the Vallo listings the assistant looks up for you are sent to
          Anthropic to write the answer.
        </p>
        <ul>
          <li>
            <strong>Only with your agreement.</strong> Before the first question we show
            you what is sent and to whom, and nothing is sent until you agree. Our servers
            refuse to send anything without that agreement. You can use Vallo fully
            without the AI, and you can always reach a person at{" "}
            <a href="/contact" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Contact support
            </a>
            , with no AI involved.
          </li>
          <li>
            <strong>Not used to train models.</strong> Under Anthropic&rsquo;s commercial
            terms, what we send is not used to train its models. Anthropic keeps it only
            for a limited period for safety and abuse monitoring.
          </li>
          <li>
            <strong>Don&rsquo;t share secrets.</strong> Never type card numbers, passwords
            or codes into the assistant.
          </li>
          <li>
            <strong>Withdrawing.</strong> Deleting your account deletes your assistant
            conversations with us. To withdraw your agreement without deleting your
            account, clear this site&rsquo;s data on your device or write to support.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "13. Changes to this policy",
    body: (
      <p>
        When we change this policy we will update the date at the top of this page, and
        for significant changes we will tell you directly through the product or by
        email before they take effect.
      </p>
    ),
  },
];
