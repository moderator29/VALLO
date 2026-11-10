/**
 * What each refusal from the offer doors says to a person. Plain, short, and
 * never a promise Vallo has not made. A status the table does not know falls
 * back to a safe sentence that says nothing changed.
 */
export const DOOR_WORDS: Record<string, string> = {
  bad_request: "Something was missing. Check the form and try again.",
  not_found: "We could not find that deal on your account.",
  not_signed_in: "Sign in to continue.",
  not_eligible: "You need to finish the checks below before you can send an offer.",
  listing_unavailable: "This property is not taking offers right now.",
  offers_off: "The lister is not taking offers on this property.",
  no_price: "This listing has no asking price yet, so there is nothing to offer on.",
  own_listing: "This is your own listing. Offers appear under Offers received.",
  no_mandate: "This property is not taking offers right now.",
  bad_amount: "Enter an offer above zero, or leave it blank to offer the asking price.",
  amount_too_large: "That figure is above what Vallo can record. Check the amount.",
  bad_payment: "Check how you plan to pay. Cash has no deposit or instalments.",
  bad_deposit: "A deposit must be above zero and less than your offer.",
  bad_instalment: "Say how many months you propose to pay over, from 1 to 120.",
  bad_date: "Choose a closing date from today, within three years.",
  note_too_long: "Keep the note under 2,000 characters.",
  already_open: "You already have a live offer on this property.",
  rate_limited: "You have sent several offers in the last hour. Try again later.",
  too_many_open: "You have several offers waiting. Withdraw one, or wait for an answer, before sending another.",
  locked: "This offer can no longer be changed.",
  expired: "This offer has expired.",
  superseded: "New terms were proposed while you were reading. Read the latest version and answer that one.",
  version_changed: "The terms changed while you were reading. Read the latest version first.",
  wrong_turn: "It is not your turn to answer on this offer.",
  not_a_party: "This property is no longer listed by the seller on this offer.",
  no_change: "Change the amount or the terms to make a counteroffer.",
  listing_has_agreed_offer: "Another offer on this property already has agreed terms. That one has to end first.",
  bad_stage: "That is not the next step for this deal.",
  waiting_for_other_side: "Recorded. The other side has to confirm it too.",
  own_document: "You uploaded this document, so the other side has to review it.",
  reason_required: "Say why, in a sentence.",
  describe_more: "Describe what happened in at least 20 characters.",
  forbidden: "Your account cannot do that.",
  own_agreement: "You are a party to this deal, so somebody else has to handle it.",
  price_changed: "The asking price changed. Read the listing again.",
};

export const DOOR_FALLBACK = "That did not go through. Nothing changed. Try again in a moment.";
export const REPLAY_NOTE = "That was already recorded.";
