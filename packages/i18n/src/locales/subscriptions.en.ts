/**
 * Vallo Pro and Vallo Business: starting the free trial, subscribing through
 * Paystack, the return page, and managing or cancelling a plan on /pro.
 *
 * English is the reference; the other locales fall back to it until a speaker
 * translates them (`fallback.ts`). No figure lives here: `{price}` is the plan
 * row's monthly price, `{days}` the trial length from subscription_settings,
 * `{date}` a date read from the member's subscription row, `{plan}` the plan's
 * name. No em dashes.
 */
export const subscriptionsEn = {
  /** Shown on the plan page, above the buttons, before anything is charged. */
  terms: {
    label: "Before you start",
    /** `{days}` is the trial length. */
    trial: "{days} days free, no card needed. When the trial ends, your account goes back to Free unless you subscribe.",
    /** `{price}` is the plan's monthly price. */
    price: "{price} a month, paid by card.",
    renews: "Renews every month until you cancel.",
    cancel: "Cancel any time on this page. You keep the plan until the end of the month you paid for, and nothing more is charged.",
    inTrial: "Subscribing during your free trial ends the trial and starts your first paid month today.",
  },

  actions: {
    /** `{days}` is the trial length. */
    startTrial: "Start {days}-day free trial",
    /** `{price}` is the plan's monthly price. */
    subscribe: "Subscribe for {price} a month",
    signIn: "Sign in to start",
    /** `{price}` is the plan's monthly price. */
    pay: "Pay {price} and subscribe",
    cancel: "Cancel subscription",
    confirmCancel: "Cancel my plan",
    keep: "Keep my plan",
    close: "Close",
    tryAgain: "Try again",
  },

  /** The sheet behind "Subscribe": the terms once more, then Paystack. */
  review: {
    /** `{plan}` is the plan's name. */
    title: "Subscribe to {plan}",
    today: "Charged today",
    monthly: "Then every month",
    renews: "Renews monthly until you cancel. Cancel any time on the Vallo Pro page.",
    card: "You pay on Paystack's checkout. Vallo never sees or stores your card number.",
  },

  /** A plan the member holds through a subscription, on the "Your plan" card. */
  manage: {
    trialing: "Free trial",
    active: "Active",
    pastDue: "Payment failed",
    nonRenewing: "Cancelled",
    /** `{date}` is the trial's end. */
    trialEnds: "Free trial ends {date}",
    trialBody: "Nothing is charged. When the trial ends, your account goes back to Free unless you subscribe.",
    /** `{price}` and `{date}` are read from the subscription. */
    nextCharge: "Next charge {price} on {date}",
    renewsBody: "Renews monthly. Cancel any time and keep the plan until the end of the month you paid for.",
    /** `{plan}` and `{date}` are read from the subscription. */
    endsOn: "You keep {plan} until {date}. It will not renew and nothing more is charged.",
    /** `{date}` is the end of the period paid for. */
    pastDueBody: "Your last monthly payment did not go through. You keep the plan until {date}. Check your card with your bank, or cancel here.",
    /** `{plan}` is the plan's name. */
    cancelTitle: "Cancel {plan}?",
    /** `{plan}` and `{date}` are read from the subscription. */
    cancelBody: "It will not renew. You keep everything in {plan} until {date}, and nothing more is charged.",
    cancelBodyNow: "It will not renew, and nothing more is charged.",
    cancelled: "Cancelled. Nothing more will be charged.",
  },

  /** What the plan page says instead of a button. */
  offer: {
    closed: "Subscriptions are not open just now. Nothing can be charged.",
    unknown: "We could not check your plan just now, so nothing is offered. Try again in a moment.",
    /** `{plan}` is the plan the member holds. */
    subscribedSame: "You are subscribed to {plan}. Manage it under Your plan above.",
    subscribedOther: "You are subscribed to {plan}. To change plan, cancel it under Your plan above; when it ends you can subscribe to another.",
    /** `{plan}` is the plan's name, `{date}` the trial's end. */
    trialStarted: "Your free trial of {plan} has started. It ends {date}.",
    /** The iPhone app sells no plan (App Store rule 3.1.1); a plan held already works here. */
    iosApp: "Plans are not sold in the iPhone app. A plan you already hold works here as usual.",
  },

  /** /pro/confirm, where Paystack sends the member back. */
  confirm: {
    metaTitle: "Confirming your plan",
    title: "Confirming your payment",
    body: "We are waiting for our payment processor to confirm the charge. This page updates on its own; you do not need to pay again.",
    /** `{plan}` is the plan's name. */
    activeTitle: "You are on {plan}",
    activeBody: "Your plan is active.",
    failedTitle: "This payment did not turn on a plan",
    failedBody: "What our payment processor reported did not match the plan, so nothing was turned on. Vallo staff have been alerted to look at it.",
    declinedTitle: "The payment did not go through",
    declinedBody: "Our payment processor says the charge failed, so nothing was taken for a plan. You can try again from the Vallo Pro page.",
    missingTitle: "We could not find this payment",
    missingBody: "This link does not match a plan checkout on your account. Your plan, if you hold one, is shown on the Vallo Pro page.",
    slowTitle: "Still confirming",
    slowBody: "Our payment processor has not confirmed this charge yet. If you paid, your plan turns on as soon as it does. You do not need to pay again.",
    back: "Back to Vallo Pro",
  },

  /** The payments desk in the console: read only. */
  admin: {
    title: "Subscriptions",
    hint: "Vallo Pro and Vallo Business, newest first. Read only: a plan moves only by Paystack's events, the member's own cancel, or the sweep.",
    caption: "The latest subscriptions",
    counts: {
      trialing: "On a free trial",
      active: "Paying",
      past_due: "Payment failed",
      non_renewing: "Cancelled, running out",
    },
    member: "Member",
    plan: "Plan",
    status: "Status",
    mode: "Mode",
    amount: "A month",
    ends: "Trial or period ends",
    started: "Started",
    trial: "Trial",
    none: "No subscriptions yet.",
    unavailable: "The subscriptions could not be read just now.",
    statuses: {
      trialing: "Free trial",
      converted: "Trial, then paid",
      expired: "Ended",
      incomplete: "Checkout open",
      active: "Paying",
      past_due: "Payment failed",
      non_renewing: "Cancelled, running out",
      cancelled: "Cancelled",
      abandoned: "Checkout not finished",
      mismatch: "Amount did not match",
    },
  },

  /** Every refusal, by the reason the server gives. */
  errors: {
    signed_out: "Sign in first. Your plan lives with your account.",
    closed: "Subscriptions are not open just now. Nothing was charged.",
    unknown_plan: "This plan is not on offer just now. Nothing was charged.",
    trial_used: "You have already had your free trial. You can still subscribe.",
    already_subscribed: "You already hold a plan. Manage it under Your plan.",
    no_trial: "There is no free trial just now. You can still subscribe.",
    price_changed: "The price of this plan has just changed. Reload the page to see it before you pay.",
    payments_paused: "Payments are paused just now. Nothing was charged. Try again later.",
    unavailable: "We could not open the payment just now. Nothing was charged. Try again in a moment.",
    outcome_unknown: "We could not tell whether the payment opened. Nothing is charged unless you pay. Try again in a moment.",
    no_email: "Paying by card needs an email address on your account. Add one in Settings and try again.",
    not_cancellable: "This plan cannot be cancelled here.",
    cancel_failed: "We could not cancel with our payment processor just now. Nothing has changed. Try again in a moment.",
  },
};
