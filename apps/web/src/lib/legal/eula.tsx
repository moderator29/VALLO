import React from "react";
import { COMPANY_FORMAL_NAME, COMPANY_TRADING_NAME } from "./company";
import { EULA_ZERO_TOLERANCE } from "./eula-copy";

/**
 * The end user licence agreement, which is really the community agreement.
 *
 * WHY THIS DOCUMENT EXISTS, SAID PLAINLY.
 *
 * A repository-wide search for "eula", "licence agreement", "zero tolerance",
 * "community guidelines" and "community standards" returned nothing before
 * this file. The platform carries user generated content in three places that
 * a stranger can reach: the social feed and its comments and stories, a
 * listing's own words and photographs, and a one to one conversation. Two
 * people who have never met agree in one of those places to meet at a
 * property. There was no document anybody had agreed to that said what is not
 * allowed and what happens when somebody does it.
 *
 * Apple's guideline 1.2 asks for four precautions from an application with
 * user generated content, and the published text is the authority for all
 * four: "A method for filtering objectionable material from being posted to
 * the app", "A mechanism to report offensive content and timely responses to
 * concerns", "The ability to block abusive users from the service", and
 * "Published contact information so users can easily reach you". The published
 * text of 1.2 contains NO twenty four hour figure and no requirement for an
 * agreement of this kind; that pair comes from the rejection message App
 * Review sends, as reported consistently by developers who have received it.
 * This document is written to the rejection message rather than to the
 * published guideline, because the rejection message is what a refusal would
 * carry, and the commitment in section 4 is therefore a real promise this
 * company is making rather than a quotation from a guideline.
 *
 * THE OPERATIVE CLAUSE IS SECTION 4 AND IT IS NOT DECORATION. It commits a
 * human being to reading reports and acting within twenty four hours. The
 * admin moderation queue is where that is done and the reports older than
 * twenty four hours counter is how it is measured. Do not soften this
 * sentence without also changing what the product does.
 *
 * FOR THE SOLICITOR. Like `terms.tsx`, these clauses are DESCRIPTIVE: each
 * one says what the platform does or what this company undertakes to do.
 * Section 4's twenty four hour undertaking is the one clause here that
 * creates an obligation rather than describing one, and it is the founder's
 * to confirm before submission; it is recorded as his in the store research
 * file's founder section.
 *
 * Rendered in two places from this one source, exactly as the terms are:
 * `(site)/eula` for the public web, and linked from the sign up acceptance so
 * a person can read it before they tick it.
 */

/* Both constants live in `eula-copy.ts`, a plain module, so a test or an
   action can quote the clause without pulling in the React runtime. They are
   re-exported here because this file is where anybody looks for them. */
export { EULA_LAST_UPDATED, EULA_ZERO_TOLERANCE } from "./eula-copy";

export const EULA_SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. What this agreement is",
    body: (
      <>
        <p>
          This is the agreement between you and {COMPANY_FORMAL_NAME} about what you may
          post on {COMPANY_TRADING_NAME} and how you may behave towards other people
          here. It sits alongside our Terms of service and our Privacy policy, and where
          this document and the Terms say the same thing, they mean the same thing.
        </p>
        <p>
          You accept this agreement when you create an account. You are asked to tick a
          box saying so, and we record the version and the moment you accepted it.
        </p>
      </>
    ),
  },
  {
    title: "2. There is no tolerance for abuse",
    body: (
      <>
        <p>
          <strong>{EULA_ZERO_TOLERANCE}</strong>
        </p>
        <p>
          This applies everywhere a person can be reached on {COMPANY_TRADING_NAME}: a
          post, a comment, a story, a profile, the words and photographs on a listing,
          and a one to one conversation. A private message is not a private exception.
        </p>
      </>
    ),
  },
  {
    title: "3. What is not allowed",
    body: (
      <>
        <p>None of the following may be posted, sent or shown to anybody here.</p>
        <ul>
          <li>
            Abuse, threats, harassment, stalking, or contacting somebody who has asked
            you to stop.
          </li>
          <li>
            Hate: attacking a person or a group for their ethnicity, religion, state of
            origin, sex, disability, sexual orientation or age.
          </li>
          <li>Sexually explicit content, and any sexual content involving a child.</li>
          <li>
            Content that puts somebody in danger, including publishing another person&apos;s
            address, phone number, bank details or documents without their agreement.
          </li>
          <li>
            Fraud: a property you do not have the right to let or sell, a request to pay
            outside the platform, a fake document, or a listing you know to be untrue.
          </li>
          <li>
            Impersonating another person, a company or {COMPANY_TRADING_NAME} itself.
          </li>
        </ul>
        <p>
          Some of this is also a crime in Nigeria. Where it is, we report it to the
          authorities as well as removing it.
        </p>
      </>
    ),
  },
  {
    title: "4. What we do about it, and how quickly",
    body: (
      <>
        <p>
          <strong>We act on every report within 24 hours.</strong> A person reads it, not
          only a machine. If the content breaks this agreement we remove it, and if the
          person who posted it was abusive we end their account.
        </p>
        <p>
          Some content never reaches anybody in the first place. A post or a profile that
          matches our filters is held before it is visible and a person decides whether
          it goes up. Photographs are not classified by machine and we do not pretend
          otherwise: they are reviewed by a person when somebody reports them.
        </p>
        <p>
          We do not tell the person who posted it who reported them, ever.
        </p>
      </>
    ),
  },
  {
    title: "5. Reporting and blocking",
    body: (
      <>
        <p>
          There is a way to report from every surface that carries somebody else&apos;s
          words: a post, a comment, a story, a profile, a listing, and a conversation. It
          is in the menu on each one.
        </p>
        <p>
          You can block anybody. Blocking is in the same menu, and in a conversation it
          is in the options sheet behind the kebab. A person you block cannot message
          you, see your profile or find your listings, and you do not see theirs. They
          are not told. You can undo it in Settings, Privacy.
        </p>
      </>
    ),
  },
  {
    title: "6. Reaching us",
    body: (
      <p>
        Our contact page is at /contact and it opens a real support ticket that a person
        answers. Anything urgent about somebody&apos;s safety should come through it and
        will be treated as urgent. If you are in immediate danger, contact the emergency
        services first.
      </p>
    ),
  },
  {
    title: "7. Ending your account",
    body: (
      <>
        <p>
          We may end your account for breaking this agreement, and we will tell you why
          unless doing so would put somebody at risk or interfere with a criminal
          investigation.
        </p>
        <p>
          You can end your own account at any time, from Settings, Account, in the app or
          on the website. The delete-account page on the website explains, without signing
          in, what is deleted and what is kept, and stops a deletion you have started. That
          is your right and nothing in this agreement limits it.
        </p>
      </>
    ),
  },
  {
    title: "8. Your licence to use the application",
    body: (
      <p>
        {COMPANY_FORMAL_NAME} grants you a personal, non-exclusive, non-transferable,
        revocable licence to use the {COMPANY_TRADING_NAME} application on a device you
        own or control, for your own use. You may not copy it, sell it, rent it, take it
        apart or work backwards from it, and you may not use it to build a competing
        service. This licence ends when your account ends.
      </p>
    ),
  },
];
