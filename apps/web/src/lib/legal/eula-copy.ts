/**
 * The two constants from the community rules that other modules need.
 *
 * Separated from `eula.tsx` because that file is JSX and anything importing it
 * pulls in the React runtime. The clause below is quoted by the document, by
 * the sign-up acceptance and by the test that guards it, so all three say the
 * same words and a change to one is a change to all.
 */

/** The date the three documents last changed together. */
/* 17 October 2026: section 7 said an account could be ended "from the
   delete-account page on the website without signing in". Starting a deletion
   needs a signed-in session and a re-authentication; the page explains it and
   carries the restore form. A correction of where the control is, not of the
   right, so TERMS_VERSION does not move. */
export const EULA_LAST_UPDATED = "17 October 2026";

/**
 * The operative clause, and the one App Review's rejection message asks for.
 *
 * NOT QUOTABLE FROM THE GUIDELINES PAGE, and that is recorded here rather than
 * implied. The published text of guideline 1.2 contains no twenty four hour
 * figure and asks for no agreement of this kind; it asks for a filter, a
 * report mechanism with "timely responses to concerns", a block, and published
 * contact information. The twenty four hours and the zero tolerance wording
 * come from the rejection message, as reported consistently by developers who
 * have received it. We write to the rejection message because that is what a
 * refusal would carry, which makes this sentence a promise this company is
 * making rather than a quotation. Do not soften it without also changing what
 * the moderation queue does.
 */
export const EULA_ZERO_TOLERANCE =
  "There is no tolerance for objectionable content or abusive behaviour on Vallo. If you post content that is abusive, threatening, hateful, sexually explicit, or that harasses another person, we will remove it and we will end your account. We act on every report within 24 hours. You agree not to post such content as a condition of using Vallo.";
