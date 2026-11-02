/**
 * Session 3's copy for settings, the referral hub, the passport and verification (W6).
 *
 * One module per owner so nine agents can add strings without editing en.ts
 * at the same time. English only: ha, ig and yo fall back to it through
 * `withFallback` until a translator supplies a line, because an invented
 * translation of a new line is worse than none. Money sentences never live
 * here; they come from `lib/money/copy.ts` (Session 2).
 *
 * Every sentence below says only what the code can prove today. In particular
 * the referral lines promise no reward (none exists: `public.referral_codes`
 * records who brought whom and nothing else). The passport's copy is
 * `passportV2` in en.ts.
 */
export const experienceAccountEn = {
  /* ------------------------------------------------------------ settings */
  settings: {
    /**
     * One page per setting, with its explanation (D25). `what` is what the
     * page does, `who` is who sees what is on it. The two are drawn by
     * `SettingsLede` under the page header.
     */
    lede: {
      what: "What this page does",
      account: {
        what: "Who you are signed in as, where you are, what you came for and your search defaults. This is also where you sign out or close your account.",
        who: "Only you can see this page.",
      },
      notifications: {
        what: "Choose which kinds of update reach you, and which of your phones Vallo may notify.",
        who: "These choices belong to your account. You can change them whenever you like.",
      },
      privacy: {
        what: "What other people can see about you, where you are signed in, and who you have blocked. The rest of what Vallo holds about you is one tap down.",
        who: "Only you can see this page.",
      },
      moneyLock: {
        what: "Use this phone's face or fingerprint lock before money moves, so a stolen unlocked phone cannot send it.",
        who: "The lock stays on your phone. Vallo never receives your face or your fingerprint.",
      },
      ai: {
        what: "The assistant answers questions about Vallo. This page shows whether you agreed to how it works, and lets you take that back.",
        who: "Your agreement is kept against your account and on this device.",
      },
      data: {
        what: "A copy of what Vallo holds about your account, and a way to clear what this device has saved.",
        who: "The copy is made for you alone, and only while you are signed in.",
      },
      appearance: {
        what: "Theme, text size, motion and language for this device.",
        who: "These choices apply to this device. Dark is the default.",
      },
      help: {
        what: "Ask the assistant, read the help centre, check what you have reported, and find the legal pages.",
        who: "What you report goes to Vallo's team.",
      },
      invite: {
        what: "Your own invite code and link. When somebody signs up with it, the sign-up is recorded as coming from you.",
        who: "Whoever opens your link sees your first name and nothing else about you.",
      },
      passport: {
        what: "What Vallo itself recorded about you, for signed-in members to see.",
        who: "Every line is on until you hide it. Your phone number, email, ID numbers, date of birth and address are never on it.",
      },
    },
    /** The glass navigation inside a settings screen with sections. */
    nav: {
      toggle: "Sections on this page",
      label: "On this page",
    },
    account: {
      navAccount: "Sign in and account",
      navPlace: "Your place",
      navSearch: "Search",
    },
    privacy: {
      navVisible: "What others see",
      navSecurity: "Security",
      navMore: "More",
      /** The doors that used to be groups crammed into this page. */
      moreLabel: "More privacy and security",
      moneyLockSub: "Face or fingerprint before money moves",
      aiSub: "What you agreed to, and how to take it back",
      dataSub: "Download a copy, or clear what this device saved",
    },
    notificationsNav: {
      navChannels: "What reaches you",
      navPhone: "On your phone",
      /** The link at the foot of one notification: the generic settings page, which has no per-category choice. */
      fromNotice: "Change what reaches you",
    },
  },

  /* -------------------------------------------------------- referral hub */
  invite: {
    /** The sealed gift, before the ticket opens. */
    sealed: "Your invite is ready",
    open: "Open your invite",
    replay: "Play the reveal again",
    codeLabel: "Your invite code",
    copy: "Copy",
    copied: "Copied",
    copyAria: "Copy your invite code",
    share: "Share",
    shareAria: "Share your invite",
    /** The share sheet (`ActionSheetIllustrated`). */
    sheetTitle: "Share your invite",
    sheetBody: "Send the link, or just the code. Whoever opens it sees only your first name.",
    sheetCopyLink: "Copy the link",
    sheetCopyLinkHint: "Paste it into any chat",
    sheetMore: "More ways to share",
    sheetMoreHint: "Messages, email and your other apps",
    /** Rows under the ticket. */
    linkLabel: "Your link",
    groupLabel: "Your invites",
    referralsTitle: "Who joined with your code",
    howTitle: "How invites work",
    howSub: "What is recorded, and what is not",
    /** `/settings/invite/how-it-works`. */
    how: {
      lede: "Invites are a way to bring somebody you know to Vallo. This is everything they do, and everything they do not.",
      codeTitle: "Your code is yours",
      codeBody: "Vallo made this code for your account the first time you opened this page. It is six characters long and it only ever points to you.",
      seenTitle: "What the other person sees",
      seenBody: "Somebody who opens your link sees your first name and nothing else about you.",
      recordedTitle: "What is recorded",
      recordedBody: "When they sign up with your link, or type your code, the sign-up is recorded as coming from you.",
      notTitle: "What is not",
      notBody: "Nothing here is an investment. There is nothing to pay in, only the person you invite is counted, and nothing builds up from the people they invite.",
      back: "Back to your code",
    },
    /**
     * `/settings/invite/referrals` and one referral. Vallo records a sign-up that
     * comes from a code, but a member has no way to read that list, so both pages
     * say so plainly. No reward, stage or earnings wording lives here: the
     * founder has not decided on a reward, and none is promised.
     */
    referrals: {
      lede: "Vallo records a sign-up that comes from your code.",
      emptyTitle: "This list is not shown here",
      emptyBody: "Vallo records when somebody signs up with your code, but this page cannot show you who. Your code and link are all you need.",
      emptyAction: "Back to your code",
    },
  },

  /* ------------------------------------------------------- verification */
  verification: {
    pathLabel: "What each step checks",
    pathLede: "Four steps, in order. Each one names what a person at Vallo actually looks at.",
    /** `{date}` is a date. */
    passedOn: "Passed on {date}",
    /** `{date}` is a date. */
    refusedOn: "Refused on {date}",
    passed: "Passed",
    failedLabel: "Needs another go",
    inReview: "With a reviewer",
    next: "Next",
    later: "Later",
    checkedLabel: "What was checked",
    willCheckLabel: "What will be checked",
    reviewerSaid: "The reviewer wrote",
    documentsApproved: "Documents approved",
    documentsRejected: "A document was refused",
    tierLabel: "Where you are",
    /** `{done}` and `{total}` are whole numbers. */
    stepsOf: "{done} of {total} steps passed",
    /** Drawn instead of the path when an agent's verification could not be read. */
    unreadable: "We could not read your verification right now.",
    /* `/verification`'s own sentences where the reviewer recorded nothing,
       and the line above their words (Round 3 sweep, C3). */
    suspendedNoReason: "Our team stopped this account. The reason was not recorded here, so they will have to tell you what it was.",
    rejectedNoReason: "The reviewer did not record a reason. Send the documents again and our team will look at them within one working day.",
    rejectedFix: "Replace the document that was refused and send it again. Everything you have already had approved stays approved.",
    moreInfoNoNote: "A reviewer has asked for something more before they can finish checking this account. What they asked for was not recorded here, so our team will have to tell you.",
    moreInfoFix: "Send the document again through the steps below. Anything already approved stays approved.",
    reviewerSaidHeading: "What the reviewer said",
  },
  /**
   * The verification flow (KycFlow and DocumentUploader on /verification),
   * moved out of the components and kyc.ts (Round 3 sweep, C3). The three
   * consents stay in kyc.ts in English: they are recorded attestations, and
   * the staff console reads them back as written. `{n}` and `{total}` are
   * numbers, `{formats}` the accepted file types, `{size}` the size limit.
   */
  kyc: {
    back: "Back a step",
    leave: "Leave verification",
    continue: "Continue",
    send: "Send for review",
    sendUnreached: "We could not reach Vallo to send this. Nothing was lost. Check your connection and press Send for review again.",
    optional: "Optional",
    progress: "Step {n} of {total}",
    businessYes: "Yes, I run a property business",
    businessYesDetail: "An agency, a management company, or anything registered with the CAC.",
    businessNo: "No, this is just me",
    businessNoDetail: "You are listing or selling your own property.",
    identityRow: "Government issued ID",
    selfieRow: "Selfie",
    selfieTaken: "Taken",
    gapSelfie: "A selfie",
    /* The selfie step (2 November 2026): a live photo of the face, never the ID held up. */
    selfie: {
      title: "Take a selfie",
      tips: [
        "Find good light. Facing a window works well.",
        "Look straight at the camera, with your whole face inside the oval.",
        "No sunglasses, hat or face covering. Everyday glasses are fine.",
      ],
      start: "Open the camera",
      starting: "Starting the camera",
      capture: "Take the photo",
      retake: "Take it again",
      use: "Use this photo",
      saving: "Saving your selfie",
      saved: "Selfie saved. You can take it again if you like.",
      denied: "The camera is blocked for Vallo. Allow it in your browser or phone settings, or take the photo with your camera instead.",
      unavailable: "We could not start a camera here. Take the photo with your camera instead.",
      fromCamera: "Take the photo with your camera",
      failed: "Your selfie did not save. Nothing was sent. Check your connection and try again.",
      preview: "Camera preview",
      yourPhoto: "Your selfie",
      privacy: "Only the person at Vallo who checks your ID sees this photo.",
    },
    addressRow: "Proof of address",
    businessRow: "Property business",
    yes: "Yes",
    no: "No",
    notGiven: "Not given",
    missing: "Missing",
    gapsTitle: "Still needed before this can be sent",
    sentTitle: "Sent for review",
    sentBody: "A person on our team reads every submission by hand. Most decisions come back within one working day, and we email you either way.",
    sentMeanwhile: "You can keep drafting listings while you wait. They publish the moment you are approved. If anything is wrong with a document we tell you exactly what and you replace just that one.",
    sentAction: "Back to your profile",
    nextTitle: "What happens next",
    nextReview: "A person checks your ID, your selfie and your address. Most decisions come back within one working day.",
    nextPayout: "Add the bank account you will be paid into. We check that the name on the account matches your ID.",
    nextPayoutAction: "Add your bank account",
    steps: {
      "identity-document": { title: "Your ID", hint: "One government issued document that shows your face and your name." },
      selfie: { title: "A quick selfie", hint: "We compare it with the photo on your ID, so we know the ID is yours." },
      "address-document": { title: "Where you live", hint: "One recent document that shows your name at your address." },
      "business-question": { title: "Do you run a property business?", hint: "This decides whether we ask you for business details, and nothing else." },
      "business-details": { title: "Your business", hint: "Three short groups: what it is, how to reach it, and where it sits." },
      consent: { title: "Permissions", hint: "Three separate agreements. Each one is its own decision." },
      review: { title: "Check and send", hint: "Nothing is submitted until you press the button on this screen." },
    },
    sections: {
      identity: { heading: "Business identity", note: "What the business is called and how it is registered." },
      contact: { heading: "Contact", note: "How a client, and how we, reach the business." },
      address: { heading: "Address", note: "Where the business actually operates from." },
    },
    fields: {
      businessName: { label: "Registered business name" },
      rcNumber: { label: "CAC registration number", hint: "The RC or BN number on your certificate." },
      tin: { label: "Tax identification number", hint: "If you have one. It is not required to be approved." },
      businessPhone: { label: "Business phone" },
      businessEmail: { label: "Business email" },
      website: { label: "Website or social page" },
      street: { label: "Street address" },
      city: { label: "City or town" },
      state: { label: "State" },
    },
    documents: {
      identity: {
        title: "Government issued ID",
        qualifies: "An international passport, a driver's licence, a NIN slip or card, or a permanent voter's card.",
        caution: "All four corners in frame, and the photograph and the numbers readable.",
      },
      address: {
        title: "Proof of address",
        qualifies: "A utility bill, a bank statement, or a tenancy agreement showing your name and the address.",
        caution: "It must be dated within the last three months. Anything older is refused.",
      },
    },
    subtypes: {
      passport: "International passport",
      drivers_licence: "Driver's licence",
      nin_card: "NIN slip or card",
      voters_card: "Permanent voter's card",
      utility_bill: "Utility bill",
      bank_statement: "Bank statement",
      tenancy_agreement: "Tenancy agreement",
    },
    /* What the review lists as still needed. */
    gapWhichId: "Which ID you uploaded",
    gapWhichAddress: "Which proof of address you uploaded",
    gapAddressDate: "The date on your proof of address, within the last three months",
    /* The address date's problems. */
    dateMissing: "Enter the date printed on the document.",
    dateFuture: "That date is in the future. Enter the date printed on the document.",
    dateOld: "That document is more than three months old, so it would be refused. Use a more recent one.",
    /* The uploader. */
    fileType: "That file is not {formats}. Choose one of those instead.",
    fileSize: "That file is over {size}. Photograph the document again at a lower resolution, or use a PDF.",
    choose: "Choose a file",
    uploading: "Uploading",
    signInFirst: "Sign in first, then choose the file again.",
    uploadFailed: "That file did not finish uploading. Nothing was sent. Check your connection and choose it again.",
    whichId: "Which ID is this?",
    whichAddress: "Which document is this?",
    pickOne: "Choose one",
    issuedOn: "Date on the document",
    issuedOnHint: "The date printed on the bill, statement or agreement.",
    replace: "Replace",
    limit: "{formats}. Up to {size}.",
    kb: "{n} KB",
  },
};
