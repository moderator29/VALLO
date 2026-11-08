/**
 * Wallet/money copy (SW11). Moved from `lib/money/balance-copy.ts`
 * (MOVE_COPY, ONBOARDING_COPY, PHONE_TAKEN_COPY, WAITING_COPY).
 */

export const walletMoveEn = {
  enterAmount: "Enter amount",
  available: "Available",
  others: "Other",
  continue: "Continue",
  change: "Change",
  method: "Payment method",
  methodName: "Bank transfer or card",
  methodSub: "On the payment provider's own page",
  methodSheet: "Pay with",
  methodOnly: "This is the one way to add money for now.",
  sendTo: "Send to",
  chooseRecipient: "Choose who to send to",
  reason: "What is it for?",
  otherReason: "Say what it is for",
  withdrawTo: "Withdraw to",
  chooseAccount: "Choose a bank account",
  review: "Check and confirm",
  notAvailableTitle: "Not available yet",
  notAvailableAdd: "Adding money opens when Wallet is connected. Nothing was charged.",
  notAvailableSend: "Sending opens when Wallet is connected. Nothing was sent.",
  notAvailableWithdraw: "Withdrawals open when Wallet is connected. Nothing has moved.",
  backToWallet: "Back to Wallet",
};

export const walletOnboardingEn = {
  NOT_STARTED: {
    title: "Set up Wallet",
    body: "Your money is held by our licensed provider, never by Vallo. To set up Wallet we share your name, email and phone with them, so they can keep your money under your name. Nothing else is shared and nothing is charged.",
  },
  PENDING: {
    title: "Setting up Wallet",
    body: "We have asked our partner to open your account and are waiting for their answer. This page updates on its own. You do not need to do anything.",
  },
  VERIFICATION_REQUIRED: {
    title: "A few details first",
    body: "Your account is opened in your own name, so we need these on your profile before we ask our partner to open it.",
  },
  ACTIVE: { title: "Wallet is ready", body: "You can add money, withdraw and transfer." },
  RESTRICTED: {
    title: "Some actions are paused",
    body: "Our partner has limited what this account can do for now. Nothing has moved, and nothing will until this is sorted. Contact support and we will find out why.",
  },
  SUSPENDED: {
    title: "Your account is on hold",
    body: "Our partner has put this account on hold. Your money stays where it is and nothing can move until the hold is lifted. Contact support and we will help.",
  },
  FAILED: {
    title: "We could not set up Wallet",
    body: "Our licensed provider did not accept the details we sent. Check your name, email and phone on your profile, then try again.",
  },
};

export const walletPhoneTakenEn = {
  title: "That number is already in use",
  body: "Our licensed provider opens one account per mobile number, and the number on your profile already belongs to another account. Use a different mobile number of yours, then try again.",
  action: "Use a different number",
};

/* The history rows' kinds live in their own module so the history screen can
   read them on the client without this file's other words. */
export { historyKindLabelEn as walletHistoryKindLabelEn } from "./history-kinds.en";

export const walletWaitingEn = {
  withdrawal: {
    title: "On its way to your bank",
    body: "Bank transfers usually land within a few minutes and can take longer at busy times. You can leave this screen: we keep checking and this updates the moment your bank confirms. You will not be charged twice.",
  },
  deposit: {
    title: "Waiting for your bank to confirm",
    body: "Once your bank confirms the payment it shows as Available. That is usually a few minutes. You can leave this screen; it updates on its own.",
  },
  send: {
    title: "Sending",
    body: "Sends between members usually settle within a minute. You can leave this screen; it updates on its own and you will not be charged twice.",
  },
  unknown: {
    title: "Checking what happened",
    body: "We asked for this and did not hear back in time. That does not mean it failed. Please do not try again: we are checking, and this updates on its own. You will not be charged twice.",
  },
  review: {
    title: "Under review",
    body: "What we heard back did not match what you asked for, so a person is checking it before anything is shown as done. Your money is not lost. We will tell you as soon as it is settled.",
  },
};

export const walletStatusEn = {
  notConnectedFigure: "Not connected yet",
  notConnected: "Opens when Wallet is connected",
  unreachableFigure: "Not available right now",
  unreachableLine: "We could not read your figures just now. Nothing has moved.",
  staleNote: "These are the last figures we confirmed. Money moves again once we reconnect.",
  activityEmpty: {
    title: "No activity yet",
    body: "Money you add, send or withdraw shows here.",
  },
  recordsLabel: "Your money",
};
