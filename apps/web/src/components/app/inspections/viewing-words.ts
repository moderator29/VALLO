import type { Dictionary } from "@vallo/i18n/core";
import type { StepSheetWords, TimeSheetWords } from "./ViewingSheets";

/**
 * THE WORDS A VIEWING SAYS ON THE CARD AND ON THE DASHBOARD ROWS.
 *
 * `InspectionSheet` and `InspectionRows` are English-only surfaces, and they
 * used to carry three spellings of one move between them and the thread
 * ("Take that time" here, "Accept this time" there; "It happened" beside
 * "Mark as inspected"). They read one set now, and its English is the
 * thread face's (`threads.rental` in the dictionary), so a lister and a
 * renter see the same word for the same move wherever they meet it.
 *
 * Every word now comes from `threads.rental` (language audit, 17 October
 * 2026): the moves the thread face did not carry (asking before a
 * withdrawal, calling off a booked viewing, moving one, a no-show and its
 * dispute) were English in every locale until then. The shapes are the same
 * as before, built from the reader's dictionary.
 */

/** The words a viewing's controls and sheets say, from the reader's `threads.rental`. */
export function viewingWords(c: Dictionary["threads"]["rental"]) {
  const VIEWING_WORDS = {
    confirm: c.confirm,
    offerAnother: c.offerAnother,
    decline: c.decline,
    acceptTime: c.acceptTime,
    withdraw: c.withdraw,
    cancelViewing: c.cancelViewing,
    cancelled: c.cancelledNote,
    markInspected: c.markInspected,
    openChat: c.openChat,
    payRent: c.payRent,
    lagosTime: c.lagosTime,
  };

  /** Offering a time instead of the one asked for. */
  const PROPOSE_WORDS: TimeSheetWords = {
    title: c.proposeTitle,
    body: c.offerBody,
    when: c.proposeWhen,
    note: c.proposeNote,
    notePlaceholder: c.offerPlaceholder,
    send: c.proposeSend,
  };

  /** Moving a viewing that is already booked: it is not confirmed until they take the new time. */
  const RESCHEDULE_WORDS: TimeSheetWords = { ...PROPOSE_WORDS, body: c.rescheduleBody };

  const DECLINE_WORDS: StepSheetWords = {
    title: c.declineTitle,
    body: c.declineBody,
    note: c.reasonLabel,
    confirm: c.declineConfirm,
    keep: c.keep,
  };

  const LISTER_CANCEL_WORDS: StepSheetWords = {
    title: c.listerCancelTitle,
    body: c.listerCancelBody,
    note: c.reasonLabel,
    confirm: c.cancelConfirm,
    keep: c.keep,
  };

  const WITHDRAW_WORDS: StepSheetWords = {
    title: c.withdrawTitle,
    body: c.withdrawBody,
    confirm: c.withdrawConfirm,
    keep: c.keep,
  };

  /** Saying the other side did not come: the renter, or the lister (or whoever they sent). */
  const noShowWords = (otherSide: "requester" | "lister"): StepSheetWords => ({
    title: otherSide === "requester" ? c.noShowRenterTitle : c.noShowListerTitle,
    body: otherSide === "requester" ? c.noShowRenterBody : c.noShowListerBody,
    note: c.whatHappened,
    confirm: c.noShowConfirm,
    keep: c.keep,
  });

  const DISPUTE_WORDS: StepSheetWords = {
    title: c.disputeTitle,
    body: c.disputeBody,
    note: c.whatHappened,
    confirm: c.disputeSend,
    calm: true,
    keep: c.keep,
  };

  const NO_SHOW_WORDS = {
    markRenter: c.markRenterNoShow,
    markLister: c.markListerNoShow,
    badge: c.noShowBadge,
    dispute: c.disputeThis,
  };

  const RENTER_CANCEL_WORDS: StepSheetWords = {
    title: c.listerCancelTitle,
    body: c.renterCancelBody,
    confirm: c.cancelConfirm,
    keep: c.keep,
  };

  return {
    VIEWING_WORDS,
    PROPOSE_WORDS,
    RESCHEDULE_WORDS,
    DECLINE_WORDS,
    LISTER_CANCEL_WORDS,
    WITHDRAW_WORDS,
    noShowWords,
    DISPUTE_WORDS,
    NO_SHOW_WORDS,
    RENTER_CANCEL_WORDS,
    /** The one line a decline or a cancel can carry into the renter's notification. */
    REASON_LABEL: c.reasonLabel,
  };
}
