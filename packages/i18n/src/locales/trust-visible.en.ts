/**
 * TRUST MADE VISIBLE, in English: the proof strip, the account-number moment,
 * the truth questions, the fee ratios, the ranking in words, and phone and
 * identity confirmation.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS ITS OWN FILE. The reason `price-check.en.ts` gives: `en.ts` is
 * written by several workers in the same hour, and a namespace in its own
 * module costs that file one import and one line.
 *
 * ---------------------------------------------------------------------------
 * THE CLAIMS RULE, APPLIED TO EVERY STRING BELOW. Each sentence states what
 * happened and when, never what that makes the property or the person. No
 * string here says "verified", "safe", "secure" or "guaranteed" about the
 * world; where a check is named, the sentence beside it says what the check
 * is NOT. A null never has a string, because a null renders nothing.
 *
 * Other locales inherit these through `withFallback`, which is the honest
 * state: an untranslated key is a copy gap for a speaker to close.
 */
export const trustVisibleEn = {
  proof: {
    /** The strip's accessible name. */
    label: "What Vallo has on record for this listing",
    /** `{date}` is a formatted date. */
    identitySeen: "The lister's identity document seen by Vallo, {date}",
    identityNimc: "The lister's identity matched with NIMC, {date}",
    identitySeenFirm: "The identity document of the person who listed this for the firm seen by Vallo, {date}",
    ownership: "Title document seen in the lister's name, {date}",
    mandate: "Owner's instruction seen and owner spoken to, {date}",
    availability: "Owner confirmed available, {date}",
    /** V-87. `{number}`, `{company}` and `{date}` come from the credential check. */
    /** `{name}` is the name as the register shows it. */
    lasrera: "Registered with LASRERA as {name}, number {number}, checked on the LASRERA register {date}",
    esvarbon: "Registered estate surveyor and valuer (ESVARBON) as {name}, number {number}, checked on the ESVARBON register {date}",
    cacDirector: "A director of {company} ({number}), checked with the CAC {date}",
    photographs: "Photographed at the property, {date}",
    /** `{count}` renters answered; `{listed}` said as listed; `{month}` e.g. "September 2026". */
    rentersAll:
      "{count} renters with a viewing the lister confirmed answered afterwards. All {count} said the agent and the flat were as listed, as of {month}.",
    rentersSome:
      "{count} renters with a viewing the lister confirmed answered afterwards. {listed} of {count} said the agent and the flat were as listed, as of {month}.",
    openHint: "What this check is",
    sheetIs: "What this is",
    sheetIsNot: "What this is not",
    close: "Close",
    explain: {
      identity: {
        is: "A member of Vallo staff looked at a government identity document for the person who listed this, and it matched the application.",
        isNot: "It is not a check of the property, the price, or whether the place is still available. It says who, not whether they will treat you fairly.",
      },
      identityFirm: {
        is: "A member of Vallo staff looked at a government identity document for the person who listed this on the firm's behalf, and it matched their application.",
        isNot: "It is not a check of the firm's registration with the CAC, of the property, the price, or whether the place is still available.",
      },
      identityNimc: {
        is: "The lister's National Identification Number was confirmed with NIMC, and the name on it matched the name on their Vallo application.",
        isNot: "It is not a check of the property, the price, or whether the place is still available. Vallo never stores the number itself.",
      },
      ownership: {
        is: "A member of Vallo staff looked at a document in the lister's name for this address, on this date.",
        isNot: "We are not a land registry. It does not say the title is good, that nobody else claims the land, or that the document is still current.",
      },
      mandate: {
        is: "A member of Vallo staff saw a written instruction from the owner to the lister, and spoke to the owner named on it.",
        isNot: "It does not say the instruction is still in force today, or that the owner agreed any particular fee. We are not a land registry.",
      },
      credential: {
        is: "A member of Vallo staff checked this registration against the public register on this date. Checks older than a year are not shown.",
        isNot: "It is not required to list on Vallo, and it says nothing about this property, the price or whether the place is still available.",
      },
      availability: {
        is: "The owner, not the agent, told Vallo on this date that the place was still available.",
        isNot: "It is not a reservation. The place can be let to somebody else after this date.",
      },
      photographs: {
        is: "The photographs were taken through Vallo's camera while standing at this property, on this date.",
        isNot: "It does not say the property looks the same today, or anything about its condition.",
      },
      renters: {
        is: "Different renters whose viewing the lister confirmed through Vallo answered four short questions after the agreed time. Each renter's latest answer counts once, and nothing is shown until five have answered.",
        isNot: "It does not prove they went: Vallo cannot yet see who stood at the gate. It is not a review of the flat's condition, and nobody's answer is quoted or named.",
      },
    },
  },
  /** V-06: Recommended, in words, generated with the constants in `lib/listings/ranking.ts`. */
  ranking: {
    title: "How Recommended is ordered",
    intro:
      "In property search, Recommended counts {count} things about each listing, one point each, and puts the highest count first. Real listings always come before example listings.",
    inputs: {
      costs:
        "Every cost is named: caution, agency, legal and agreement fees on a tenancy; every buying cost, or a stated total to buy, on a sale. A stay priced by the night, or anything priced per head, has nothing more to name, so its price alone earns this point.",
      utilities: "Light and water are answered: how often the power is on, and where the water comes from.",
      photos: "At least {min} photographs of the place.",
      checked: "A person at Vallo has checked the identity of whoever listed it.",
    },
    /** `{ceiling}` is how many of the newest matching listings are ordered. */
    order:
      "Listings with the same count keep the newest first. The order is worked out over the {ceiling} newest listings that match a search.",
    promise: "Nobody can pay to place a property listing higher. Vallo does not sell placement.",
    shelfLine: "Nobody can pay to be higher.",
    shelfLink: "How it works",
  },
  /** V-12: every fee as a share of a year's rent, and the law's number beside it. */
  fees: {
    /** `{share}` is a percentage such as "10.0%". */
    shareOfRent: "{share} of a year's rent",
    /** `{amount}` is money, `{share}` a percentage. */
    toAgent: "Fees to the agent: {amount}, {share} of a year's rent.",
    /** `{state}`, `{agency}`, `{legal}`, `{source}` come from `lib/trust/fee-rules.ts`. */
    stateRule:
      "{state}'s published rule is up to {agency} for the agency fee and up to {legal} for the legal fee, each of a year's rent ({source}).",
    noCap: "Vallo does not cap anybody's fee. It publishes it.",
    sortBasis: "Ordered by the agency, legal and agreement fees together, as a share of a year's rent. Listings that did not state their fees come last.",
  },
  /** V-50: confirming a mobile number with a one-time code. */
  phone: {
    title: "Phone",
    subtitle: "One confirmed mobile number per account",
    why: "Vallo asks for a confirmed mobile number once, before your first message, visit, booking, payment or listing, and before your first review and your first report. It is never shown to anybody. It keeps one person to one account, which is what makes reviews and reports worth trusting.",
    closedTitle: "Nothing is needed from you",
    closedBody: "Vallo is not asking for phone numbers at the moment. Browsing, saving and messaging never need one.",
    /* While codes are not sent: the number is saved to the profile unconfirmed,
       for the things that need one on file (a wallet opened in the member's own name). */
    profileTitle: "Your mobile number",
    profileBody: "Saved to your profile so anything opened in your own name, like your payments account, can use it. It is never shown to anybody. We will ask you to confirm it with a code later.",
    profileHint: "Your mobile number. Nigeria is chosen first; tap the flag for another country.",
    /** `{last}` is the last four digits. */
    profileCurrent: "On your profile: the number ending {last}.",
    profileSave: "Save number",
    profileSaving: "Saving",
    profileSaved: "Saved. Your number is on your profile.",
    profileInvalid: "That is not a mobile number we can use. Check the digits and the country beside them.",
    profileRefused: "This number may already be in use. Try a different number, or contact support.",
    profileFailed: "We could not save your number just now. Nothing was changed. Try again in a moment.",
    profileBack: "Continue",
    signedOutTitle: "Sign in to confirm your number",
    signedOutBody: "A number is confirmed for an account, so this needs yours.",
    signIn: "Sign in",
    readFailed: "We could not read your phone settings just now. Nothing was changed. Try again in a moment.",
    /** `{last}` is the last four digits, `{date}` a date. */
    confirmed: "Your mobile number ending {last} was confirmed on {date}.",
    change: "Use a different number",
    numberLabel: "Mobile number",
    numberHint: "A mobile number from any country. We send a six-digit code to it.",
    /* The phone step of sign-up (after the email code). */
    signUpTitle: "Confirm your mobile number",
    /** `{number}` is the number, written in full: it is the person's own, on their own screen. */
    signUpSentTo: "We sent a six-digit code to {number}.",
    signUpSending: "Sending a six-digit code to {number}.",
    later: "Do this later",
    /* A confirmed number is the account's identity and never changes (2 November 2026). */
    numberFixed: "Your mobile number is confirmed and cannot be changed. If it is wrong, contact support.",
    wrongNumber: "Wrong number?",
    contactSupport: "Contact support",
    /** A number that is not a mobile number in the country chosen (any country but Nigeria). */
    numberInvalid: "That does not look like a mobile number for the country you chose. Check the digits, or pick another country.",
    send: "Send the code",
    sending: "Sending",
    /** `{number}` is the masked number. */
    sentTo: "We sent a six-digit code to {number}. It expires in 10 minutes.",
    codeLabel: "Code",
    confirm: "Confirm",
    confirming: "Confirming",
    resend: "Send a new code",
    /** `{s}` is whole seconds until a new code may be asked for. */
    resendIn: "Send a new code in {s}s",
    /** The code cells' description for a screen reader. */
    codeCells: "Six digit code",
    done: "Confirmed. Your number is never shown to anybody.",
    /** Under `done`: the wallet opens with the confirmed number, by itself. */
    walletNote: "Your Vallo balance is being set up now.",
    /** The sentence a gated action refuses with. */
    required:
      "Confirm your mobile number first. It is asked once, it is never shown to anybody, and it keeps one person to one account. Open Settings, then Phone.",
    closed: "Vallo is not asking for phone numbers at the moment. Nothing is needed from you.",
    numberEmpty: "Enter your mobile number.",
    codeShape: "The code is six digits.",
    sendLimited: "That is a lot of codes in a short time. Wait an hour and try again.",
    /** V-50 NO ENUMERATION: the one sentence for every refusal that could tell
       somebody whether a number is on Vallo, so taken and invalid read the same. */
    numberRefused: "This number may already be in use. Try a different number, or contact support.",
    sendAlready: "That number is already confirmed on your account.",
    sendUnconfigured: "We could not send a code just now. Nothing was changed. Try again later.",
    sendFailed: "We could not send a code just now. Nothing was changed. Try again in a moment.",
    confirmWrong: "That code does not match. Check the message and try again.",
    confirmExpired: "That code has expired. Ask for a new one.",
    confirmLocked: "Too many wrong codes. Ask for a new one.",
    confirmNoCode: "There is no code waiting for this account. Ask for one first.",
    /** The button beside `required`: Settings, Phone, then back to where the member was. */
    requiredAction: "Confirm my number",
    /** A QA account (public.qa_accounts) is never asked for a phone. */
    qaTitle: "This is a test account",
    qaBody: "Vallo test accounts are never asked for a phone number. Nothing is needed from you.",
  },
  /** V-49: confirming identity with a NIMC virtual NIN. */
  vnin: {
    title: "Confirm with your NIN instead",
    /** `{code}` is Vallo's NIMC merchant code, from configuration. */
    lede: "Dial *346*3*your NIN*{code}# on the phone linked to your NIN, and paste the sixteen-character virtual NIN NIMC sends you. Vallo never stores your NIN.",
    label: "Virtual NIN",
    submit: "Confirm with NIMC",
    checking: "Checking with NIMC",
  },
  /** Dojah: the selfie and government ID check on /verification (2 November 2026). */
  dojah: {
    title: "Confirm who you are with a selfie",
    lede: "Enter your NIN or BVN and take a photo of your face. It takes about two minutes, and a clean match confirms you straight away. Vallo never stores your NIN or BVN.",
    start: "Start the check",
    again: "Try the check again",
    opening: "Opening the check",
    frameTitle: "Identity check",
    close: "Close",
    waiting: "Checking your result. This usually takes under a minute.",
    passed: "Your identity is confirmed. Thank you.",
    review: "Thank you. A person on our team will look at your check and tell you.",
    retry: "The check could not finish. Try again in good light, with your whole face in the frame.",
    abandoned: "You left the check before the end. Start again when you are ready.",
    /** `{note}` is the reviewer's own words. */
    refused: "Our team could not accept your last check: {note}",
    limit: "That is three tries today. Try again tomorrow, or upload your ID document below.",
    closed: "The selfie check is not open at the moment. Upload your ID document below instead.",
    failed: "We could not open the check just now. Try again in a moment.",
    privacy: "The check is run by Dojah, Vallo's identity partner. Your photo and ID are used only to confirm it is you.",
  },
  /** V-23: the line about the other person under a thread's header. */
  person: {
    label: "About the person in this conversation",
    /** `{date}` is a formatted date. */
    identitySeen: "Identity document seen by Vallo, {date}",
    identityNimc: "Identity matched with NIMC, {date}",
    /** `{month}` is a month and year. */
    memberSince: "On Vallo since {month}",
    phoneConfirmed: "Phone confirmed",
    /** Viewings the other person requested from the reader, and the reader accepted. */
    viewingsOne: "1 viewing with you arranged on Vallo",
    /** `{count}` is a number. */
    viewingsMany: "{count} viewings with you arranged on Vallo",
  },
  /** V-59: the tenancy review, led by the door. */
  tenancy: {
    title: "How moving in went",
    lede: "A month in, five questions before any stars. Whether you paid anything more is private: it is counted, never shown with your name.",
    paidExtra: "Did you pay anything to anybody for this place beyond what you paid on Vallo?",
    howMuch: "How much, in naira",
    toWhom: "To whom",
    to: { agent: "The agent", caretaker: "A caretaker", landlord: "The landlord", other: "Somebody else" },
    asListed: "Was the place as listed: the light, the water, the gate?",
    agentOnTime: "Did the agent show up when agreed?",
    again: "Would you rent through this agent again?",
    rating: "Overall, out of five",
    body: "Anything else, in a sentence (optional)",
    yes: "Yes",
    no: "No",
    notSure: "Not sure",
    submit: "Send",
    sending: "Sending",
    incomplete: "Answer every question, then send.",
    done: "Thank you. Your review is recorded.",
    failed: "Your review did not send. Nothing was recorded. Try again.",
    notOpen: "The review opens a month after your move-in date, for the tenant on the rent charge.",
    /** `{date}` is the move-in date. */
    movedIn: "Your move-in date is {date}.",
    already: "You have already reviewed this tenancy.",
    missingTitle: "We could not find that tenancy",
    missingBody: "It may belong to another account. Your inspections and payments are in one place.",
    openInspections: "See your inspections",
    signedOut: "Sign in to review your tenancy.",
    signIn: "Sign in",
    entry: "Tell us how moving in went",
    /** `{count}` tenants who paid nothing more at the door: never under five. */
    doorMany: "Moved in for the Vallo price: {count} tenants said nothing more was asked at the door.",
  },
  /** V-21: the agent band on a profile, with no score in it. */
  profile: {
    reviews: "Reviews",
    /** `{rating}` is the average to one decimal, `{count}` the number of reviews. */
    reviewsValue: "{rating} from {count}",
    staysHosted: "Stays hosted",
    /* The share card frame (spec section 10) the band is drawn on. */
    cardTitle: "Agent record",
    ratingUnit: "of 5",
    reviewsWord: "{count} reviews",
    reviewsWordOne: "1 review",
    ratingLabel: "Average review",
    honest: "From reviews people left on Vallo. A record of past work, not a promise about the next.",
    noReviews: "No reviews yet. A reply time is shown until there are some.",
  },
  /** V-05: the four questions a renter answers after an inspection. */
  truth: {
    title: "Four quick questions",
    lede: "Eight seconds. Your answers are private to Vallo and only ever counted, never shown with your name.",
    questions: {
      agentMatched: "Was the person who showed you the place the agent on Vallo, or someone they named?",
      propertyMatched: "Was it the place in the photos?",
      available: "Is it still available to you?",
      offPlatformAsk: "Did anybody ask you for money outside Vallo?",
    },
    yes: "Yes",
    no: "No",
    notSure: "Not sure",
    submit: "Send my answers",
    sending: "Sending",
    incomplete: "Answer all four, then send.",
    done: "Thank you. Your answers were recorded on {date}.",
    offPlatformNote:
      "Because you said you were asked for money outside Vallo, our team has a report from you about this listing. You do not need to do anything else.",
    failed: "Your answers did not send. Nothing was recorded. Try again.",
    signedOut: "Sign in to answer.",
    notOpen: "These questions open once the agreed time for the inspection has passed.",
    already: "You have already answered for this inspection.",
  },
  /** V-04: the card above an account number, for the person receiving it. */
  account: {
    label: "About the account number in this message",
    checking: "Checking who this account belongs to.",
    belongs:
      "This account belongs to the verified lister. Vallo still cannot protect a payment made to an account.",
    notOnRecord: "The name on this account is not a name Vallo has on record for this lister.",
    /** `{amount}` is formatted money. */
    payLead: "Paying for this place? Pay the move-in total here: {amount}, recorded to the kobo.",
    payButton: "Pay the move-in total",
    requestLead: "Pay only after inspection. Request one here.",
    requestButton: "Request an inspection",
    report: "Report",
    block: "Block",
  },
  /** V-49 and V-87 on the verification desk. The desk reads English. */
  desk: {
    payoutLabel: "Payout name check (suggestion):",
    payoutMatch: "the names match",
    payoutDiffer: "the names do not match",
    /** `{holder}` is the bank's account holder, `{onRecord}` the name Vallo holds. */
    payoutNames: "Bank holder {holder}; on record {onRecord}.",
    credentialTitle: "Record a credential checked on the public register",
    credentialKind: "Credential",
    lasrera: "LASRERA registration",
    esvarbon: "ESVARBON registration",
    credentialNumber: "Number as the register shows it",
    credentialName: "Name as the register shows it",
    credentialCac: "A CAC directorship cannot be checked here: the free CAC search does not list directors. It waits for the identity aggregator.",
    credentialSubmit: "Record the check",
    credentialRecording: "Recording",
    credentialRecorded: "Recorded, dated today.",
    credentialForbidden: "Only Vallo staff can record a credential check.",
    credentialInvalid: "That does not look like a register number we can record. Check it and try again.",
    credentialNoName: "Enter the name exactly as the register shows it.",
    credentialNeedsAggregator: "A CAC directorship waits for the identity aggregator.",
    credentialFailed: "The check was not recorded. Try again in a moment.",
    /** V-45: the review desk's photograph comparison. A resemblance, never a verdict. */
    photosTitle: "Photographs that look like others on Vallo",
    /** `{total}` photographs on this listing. */
    photosNone: "None of these {total} photographs look like one on another lister's listing or on a listing Vallo rejected.",
    /** `{matched}` of `{total}`. */
    photosSome:
      "{matched} of these {total} photographs look like photographs on another lister's listing or on a listing Vallo rejected. Look before you decide: a shared stock photo, a firm's two agents and a relisted flat all match too.",
    /** `{count}` photographs matched a rejected listing. */
    photosRejected: "{count} of them look like photographs on a listing Vallo rejected.",
    /** `{position}` is the photo's number, `{reference}` the other listing's code, `{distance}` bits apart out of 64. */
    photoLine: "Photo {position} looks like one on {reference}, {distance} of 64 bits apart",
    photoLineRejected: "Photo {position} looks like one on {reference}, which Vallo rejected, {distance} of 64 bits apart",
    photoNoReference: "a listing with no code",
    photosNotCompared: "These photographs have not been compared: hashing needs the server's storage key, which this environment does not have.",
    photosFailed: "The comparison could not be read just now. Try again before deciding.",
    /** `{hashed}` of `{photos}` on this listing compared against `{pool}` hashed photographs elsewhere. */
    photosCoverage: "{hashed} of {photos} photographs compared, against {pool} hashed photographs on other listings.",
    photosPartial: "Not every photograph here could be compared yet, so no match is not the same as no copy.",
    /** `{count}` photographs across Vallo still without a hash. */
    photosWaiting: "{count} photographs across Vallo are not hashed yet.",
    photosBackfill: "Hash the next 60",
    photosBackfilling: "Hashing",
    /** `{count}` photographs hashed by one press. */
    photosBackfilled: "Hashed {count} more. Reload to compare again.",
    /** V-60: recalling a stop for fraud. */
    recallTitle: "Tell the people this account talked to",
    recallLede: "Everybody who had a conversation or an inspection with this account in the 60 days before the stop is told, by notification and email. The account, the reason written above and whoever reported it are never named.",
    /** `{reason}` is one of the two reason phrases below. */
    recallBecause: "The upheld reports say this account was stopped {reason}.",
    recallNoReport: "No upheld report of paying outside Vallo or a scam stands against this account, so there is nothing to recall. Uphold the report first.",
    recallCount: "Count who would be told",
    recallCounting: "Counting",
    /** `{count}` people. */
    recallWillTellOne: "This will tell 1 person.",
    recallWillTell: "This will tell {count} people.",
    recallNobody: "Nobody talked to this account in the 60 days before the stop, so there is nobody to tell.",
    recallConfirm: "Tell them",
    recallSending: "Telling them",
    /** `{count}` people, `{date}` a date. */
    recallSent: "Told {count} people on {date}.",
    recallSentOne: "Told 1 person on {date}.",
    recallLifted: "This stop has been lifted, so nobody can be told it stands.",
    recallFailed: "That did not go through. Nothing was sent. Try again in a moment.",
    recallForbidden: "Only Vallo staff can recall a stop.",
    /** The words every recipient reads. `{listing}` is the title they talked about, `{reason}` a reason phrase. */
    recallTitle2: "An account you talked to has been stopped",
    recallBodyAbout: "An account you talked to about {listing} was stopped by Vallo {reason}. If you paid them anything, tell us now: open the conversation and report it.",
    recallBodyPlain: "An account you arranged a viewing with, about {listing}, was stopped by Vallo {reason}. If you paid them anything, tell us now.",
    recallListingFallback: "a place on Vallo",
    /** `{date}` is when the upheld report behind this stop was resolved. */
    /** `{ref}` is the report's short reference, `{date}` when it was upheld. */
    recallReport: "It rests on report {ref}, upheld on {date}.",
    recallReportChanged: "The report behind this stop has changed since you counted. Nothing was sent. Count again.",
    recallReasonPay: "for asking people to pay outside Vallo",
    recallReasonRules: "for breaking Vallo's safety rules",
    recallAlready: "This stop has already been recalled. Nobody is told twice.",
    /** V-63: the moderation lane's safety holds. */
    holdsTitle: "Safety holds",
    holdsLede: "People whose new inspection requests are paused because somebody pressed \"I feel unsafe\" after writing to them. A hold lapses on its own; clear it once you have looked, or extend it.",
    holdsEmpty: "Nobody is on a safety hold.",
    /** `{name}` is the held person, `{date}` when it lapses. */
    holdsRow: "{name}, paused until {date}",
    holdsClear: "Clear",
    holdsExtend: "Extend 72 hours",
    holdsWorking: "Saving",
    holdsFailed: "That did not save. Try again.",
    holdsUnavailable: "The safety holds could not be read just now.",
  },
  /** V-34: the Vallo Record, counted facts, never a score. */
  record: {
    title: "The Vallo Record",
    /** The honest caveat under every Record. */
    note: "Counted by Vallo from what happened on Vallo. Each line has its own count and is never added up into a score.",
    /** `{count}` is the number of answered enquiries the median is taken over. */
    replies: {
      hour: "Replies usually within an hour ({count} enquiries, last 90 days)",
      twoHours: "Replies usually within 2 hours ({count} enquiries, last 90 days)",
      fewHours: "Replies usually within a few hours ({count} enquiries, last 90 days)",
      day: "Replies usually within a day ({count} enquiries, last 90 days)",
      threeDays: "Replies usually within 3 days ({count} enquiries, last 90 days)",
    },
    answered: "Enquiries answered within a day: {count} of {total}, last 90 days",
    kept: "Inspections kept: {count} of {total}, counted from the code at the gate, last 12 months",
    described: "Found as described at inspection: {count} of {total} renters, last 12 months",
    lets: "Let through Vallo: {count} in the last 12 months",
    since: "On Vallo since {month}",
    /** `{date}` is the date of the stop. */
    stopped: "Stopped by Vallo on {date}",
    /** `{code}` is VR- and six characters. */
    code: "Record code {code}",
    codeHint: "Anybody signed in to Vallo can type this code into search to see this Record as it stands today.",
    lookupTitle: "A Vallo Record",
    lookupMissingTitle: "No Record has that code",
    lookupMissingBody: "Check the code with the person who gave it to you. Record codes start VR- and never contain 0, 1, I, L, O or U.",
    lookupLimited: "You have looked up a lot of codes in the last hour. Try again later.",
    lookupFailed: "The Record did not load. Try again.",
    lookupEmpty: "Too few to count yet.",
    search: "Back to search",
  },
  /** V-63: "I feel unsafe", one sheet, the actions in order. */
  unsafe: {
    opener: "I feel unsafe",
    openerHint: "Call for help, leave, or tell Vallo.",
    title: "If you feel unsafe",
    lede: "Do what you need to, in this order. Vallo never tells the other person who reported them.",
    call: "Call 112",
    callHint: "Nigeria's emergency number. If you are in danger, call now.",
    leave: "Leave and block",
    leaveHint: "They can no longer message you and Vallo is told.",
    tell: "Tell Vallo",
    tellHint: "A person here reads it {clock}.",
    /**
     * Added to either hint only when the person filing is the lister in this
     * thread or on this inspection: a hold pauses the other person's requests
     * to them, which means nothing to a renter filing about a lister.
     */
    pauseHint: "If you have written to them here, their new inspection requests to you are paused for up to three days while a person here looks at it.",
    working: "One moment",
    /** `{clock}` is the promised time, e.g. "within 4 hours". */
    told: "Vallo has it. A person here reads it {clock}. Vallo does not tell them who reported them.",
    left: "You have left and they are blocked. Vallo has it and a person here reads it {clock}.",
    failed: "That did not go through. If you are in danger, call 112 now.",
    notAParty: "This is not a conversation you are part of.",
    signedOut: "Sign in to tell Vallo. If you are in danger, call 112 now.",
    close: "Close",
    /** After filing, when the hold was placed. */
    heldNote: "Their new inspection requests to you are paused for up to three days while a person here looks at it.",
  },
  /** V-63: the report sheet's promise, read from the category's own clock. */
  report: {
    /** `{clock}` is the promised time for the chosen category, e.g. "within 4 hours". */
    filed: "A person here reads every report. For this kind of report that is {clock}. You will not have to chase it, and the person you reported is never told who reported them.",
    footer: "The person you report is never told who reported them. If you are in danger,",
    call: "call 112 now",
  },
  /**
   * V-97, the state kit's own screens. Written to `docs/design/VOICE.md`:
   * second person, one sentence of body, and nothing the code cannot prove.
   */
  state: {
    /** The shared 404. No hotel pun: renters and landlords read this too. */
    lostTitle: "We could not find that page",
    lostBody: "The link may be old, or the page may have moved. Search for what you came for, or go back home.",
    /** A screen inside the app that failed to load. No promise that nothing was lost: no code checks it. */
    screenErrorOverline: "Still loading",
    screenErrorTitle: "Taking longer than usual",
    /* The audit's claims sweep reworded this: nothing promises the reader lost nothing. W2 (round 5)
       says what is safe in the same spirit: a failed load cannot undo what was already sent or saved,
       and it can lose what was being typed. What happened, what is safe, what to do. */
    screenErrorBody: "Vallo tried a few times and this page has not answered yet. Nothing you sent or saved was undone. Tap Try again in a moment.",
    /** `{digest}` is the server's id for the failure, for support to find it. */
    screenErrorRef: "Reference {digest}. If this keeps happening, quote it to support.",
    /* What a screen says while it is tried again by itself (`SignalHold`, 13 November 2026). It
       was "Loading on a weak connection", which was false when the server, not the signal, was
       slow, so it now says only what is true for both: the page is loading and Vallo is retrying.
       The hold's spoken label is `screenErrorOverline` ("Still loading"): one key fewer in the words
       every page carries (core-entry.test.ts holds them under 13 KB). */
    holdNote: "Still loading. Trying again.",
    offlineOverline: "Connection",
    offlineTitle: "You are offline",
    offlineBody: "The connection dropped before this page could load. Pages you have opened before still open, and your balance is never shown from an old copy.",
  },
};
