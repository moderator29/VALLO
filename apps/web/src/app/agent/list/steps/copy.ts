/**
 * THE NEW WORDS OF THE ONE-QUESTION WIZARD (P1.1, November 2026), in English.
 *
 * Every string the re-flowed wizard draws that the dictionary slice
 * (`t.agentListings`) does not already hold lives here for now, so the lead
 * can move it into `packages/i18n` in one sweep (this session may not edit
 * that package). Nothing here repeats a dictionary key: where a word already
 * exists in the slice, the step reads it from there.
 *
 * Placeholders in braces are filled with `fill` from `app/agent/_copy`.
 */
export const WIZARD_WORDS = {
  /* The frame's own words: the save state and the step count. */
  frame: {
    stepOf: "Step {n} of {total}",
    saved: "Saved",
    saving: "Saving",
    device: "Saved on this device",
    error: "Not saved yet",
    close: "Close",
    continue: "Continue",
    backToCheck: "Back to Check your listing",
    submit: "Submit for review",
  },

  /* The eyebrow over each step: the section the question belongs to. */
  eyebrows: {
    basics: "The basics",
    location: "Location",
    details: "Details",
    supply: "Light and water",
    compound: "The compound",
    access: "Access",
    amenities: "Amenities",
    pricing: "Pricing",
    charges: "Charges",
    terms: "Terms",
    photos: "Photos",
    finish: "Finish",
    check: "Check and submit",
  },

  kind: {
    title: "What are you listing today?",
    subtitle: "This decides which questions come next. You can change it until you submit.",
    stay: { label: "A stay", detail: "Booked by the night: a shortlet, an apartment, a home or a villa." },
    rent: { label: "A property to let", detail: "A longer let, paid yearly, quarterly or monthly: a home, a shop, an office or land." },
    sale: { label: "A property for sale", detail: "Sold outright, with a title to transfer." },
    pickFirst: "Choose one to continue.",
    broadcastLead: "Already posted it on WhatsApp?",
  },

  type: {
    title: "Which best describes it?",
    subtitle: "Pick the one a searcher would use. The questions that follow fit it.",
  },

  location: {
    title: "Where is the property?",
    subtitle: "The state, the city and the area are what people search by.",
    privacyTitle: "Who sees the exact location",
    privacyBody:
      "Searchers see the area, never the street address. The address is shared only once a booking is confirmed or you share it in a chat yourself.",
  },

  rooms: {
    title: "How many rooms does it have?",
    titleLand: "How big is the plot?",
    titleWorkspace: "What is inside?",
    subtitle: "Tap a number. Toilets and parking are optional.",
    subtitleLand: "The plot's area, if you know it. Everything else about the land goes in the description.",
    more: "More than {n}",
  },

  place: {
    title: "What is the place like?",
    subtitle: "Its shape, how it is furnished, which floor, and how new it is.",
  },

  supply: {
    title: "Is there light and water?",
    subtitle: "The first questions anyone asks here. Honest answers win the enquiries that silent listings lose.",
    hoursNote: "\"Generator\" on its own tells a guest nothing; the hours are the answer.",
  },

  compound: {
    title: "Tell us about the compound",
    subtitle: "The service charge, the homes around it and, where we ask, the flooding.",
  },

  access: {
    title: "How does somebody get through the gate?",
    subtitle: "Nobody can read this from your public page.",
    panelTitle: "Getting through the gate",
    panelBody:
      "It is released only to a guest whose booking is confirmed, and to nobody else, ever. The page says the estate has a gate and that the details arrive on confirmation.",
    estateName: "Estate or compound name",
    gateDirections: "What to tell the gate",
    gateDirectionsHint: "The words that get somebody through, in the order they need them.",
    securityPhone: "Security desk number",
    accessCode: "Access code",
  },

  amenities: {
    title: "What else is there?",
    subtitle: "Choose everything a guest or tenant will actually find.",
  },

  price: {
    titleRent: "What is the rent?",
    titleSale: "What is the asking price?",
    titleStay: "What is your nightly rate?",
    titleHead: "What is the price per head?",
    subtitleRent: "The rent alone. What a tenant pays on top comes next.",
    subtitleSale: "Buyers filter on this figure, so it is the one number that has to be right.",
    subtitleStay: "Weekend rates, discounts and house rules can be added after the draft is saved.",
    rent: "Rent",
    salePrice: "Asking price",
    rate: "Price per night",
    head: "Price per head",
    howOften: "How often is it paid?",
    rentNegotiable: "The rent is negotiable",
    rentNegotiableBody: "Say so and somebody who is close will start the conversation.",
    priceNegotiable: "The price is negotiable",
    priceNegotiableBody: "Say so and a buyer will open the conversation rather than scroll past.",
  },

  charges: {
    titleRent: "Any charges on top of the rent?",
    titleSale: "What does a buyer pay on top?",
    titleStay: "Any charges at the door?",
    subtitleRent: "Add each one a tenant pays to move in. Anything you leave out reads as not declared, never as free.",
    subtitleSale: "Add each cost a buyer meets. Anything you leave out reads as not stated, never as zero.",
    subtitleStay: "Every charge a guest could be asked for on arrival, answered one by one.",
    add: "Add another charge",
    addFirst: "Add a charge",
    remove: "Remove {name}",
    amount: "Amount",
    naira: "Naira",
    percentRent: "% of rent",
    percentPrice: "% of price",
    percentNeedsBase: "Set the price first to use a percentage.",
    percentLine: "= {amount}",
    once: "Once",
    onceBody: "Paid once, at move-in.",
    onceSale: "Paid once, at completion.",
    cadence: "How often",
    yearly: "Yearly",
    quarterly: "Quarterly",
    monthly: "Monthly",
    moveInHeadline: "A tenant pays to move in: {amount}",
    moveInBasis: "One rental period plus these charges.",
    moveInStated: "As you stated it.",
    buyHeadline: "A buyer pays in all: {amount}",
    buyBasis: "The asking price plus these costs.",
    statedTotalRent: "Total to move in (optional)",
    statedTotalSale: "Total to buy (optional)",
    stayNeedsDraft: "Your answers save first, then the door charges can be declared here. Press Continue on the step before, then come back.",
    stayUnreadable: "We could not read the charges at the door just now. You can declare them later from Listings, Charges at the door.",
    names: {
      cautionDepositNaira: "Caution deposit",
      agencyFeeNaira: "Agency fee",
      legalFeeNaira: "Legal fee",
      agreementFeeNaira: "Agreement fee",
      serviceChargeNaira: "Service charge",
      saleAgencyFeeNaira: "Agency fee",
      saleLegalFeeNaira: "Legal fee",
      governorsConsentFeeNaira: "Governor's consent",
      stampDutyNaira: "Stamp duty",
      surveyRegistrationFeeNaira: "Survey and registration",
    },
  },

  terms: {
    titleRent: "When can someone move in?",
    titleSale: "What title comes with it?",
    titleStay: "When is it available?",
    subtitleRent: "The shortest tenancy you accept, and the first day it is free.",
    subtitleSale: "A buyer asks this before anything else. A property for sale needs a stated title.",
    subtitleStay: "Shown on the listing so nobody has to ask.",
    shortestTenancy: "Shortest tenancy, in months",
    availableFrom: "Available from",
    tenure: "Title",
    tenureAsk: "A buyer will ask before anything else. Answering here saves both of you a journey.",
    saleStatus: "Where the sale stands",
    yearBuilt: "Year built",
  },

  photos: {
    title: "Add photos of the place",
    subtitle: "At least {min}. The first one is your cover, so lead with the wide shot that sells it.",
    needMore: "Add {more} more to submit, {ready} ready",
    needOne: "Add 1 more to submit, {ready} ready",
    enough: "Enough to submit, {ready} ready. Most listings use {recommended} or more.",
    coverMark: "Cover",
  },

  describe: {
    title: "Describe the property",
    subtitle: "Write it yourself, or start from a first version made from your answers. Edit it freely.",
    titleLabel: "Title",
    descriptionLabel: "Description",
    wordCount: "{count} / {min} words",
    rewrite: "Rewrite from my answers",
    rewriteBody: "A plain first version built from what you told us. Nothing leaves Vallo.",
    ai: "Write with AI",
    aiWorking: "Writing",
    undo: "Undo",
    undone: "Your own words are back.",
    rewritten: "Rewritten from your answers. Undo puts your own words back.",
    aiWritten: "Written with AI. Read it through, then edit anything that is not right.",
    aiUnavailable: "Writing with AI is not available right now. Rewrite from my answers works without it.",
    aiFailed: "The AI writer did not answer. Nothing changed. Try again, or rewrite from your answers.",
    aiNoConsent: "Agree to how the AI writer works first.",
    titleFromAnswers: "We started a title from your answers. Make it your own.",
    consent: {
      title: "Write with AI?",
      body:
        "Vallo's writer is an AI. It is powered by Anthropic, a company in the United States. To write your title and description we send it the property's type, area, city and state, the rooms, the light and water, the amenities, and the title and description you have typed. We never send the street address, the gate details, a phone number or a price. Anthropic does not use it to train its models.",
      covers: "Agreeing covers later uses on your account. You can withdraw it in Settings, Privacy.",
      agree: "Agree and continue",
      decline: "Keep editing myself",
      how: "How we handle it",
    },
  },

  check: {
    title: "Check your listing",
    subtitle: "Every answer is here. Change anything before you submit.",
    seeTitle: "How it appears in search",
    answersTitle: "Your answers",
    fixTitleOne: "1 thing to fix",
    fixTitleMany: "{count} things to fix",
    readyTitle: "Ready to submit",
    readyBody: "Nothing is missing. Submit it and it goes into the review queue.",
    change: "Change",
    fix: "Fix",
    notSet: "Not set",
    optionalLater:
      "House rules, viewing times and the owner's mandate are not asked here. Add them from Listings once you have submitted.",
    verify: "Verify your identity before submitting",
    verifyBody: "Your draft stays here while you do.",
    verifyAction: "Verify now",
    doorCharges: "Declare the charges at the door",
    doorChargesBody: "A stay cannot go live until every charge a guest could meet on arrival is answered.",
    rows: {
      kind: "Listing",
      type: "Property type",
      location: "Location",
      rooms: "Rooms and size",
      place: "The place",
      supply: "Light and water",
      compound: "The compound",
      access: "Gate details",
      amenities: "Amenities",
      price: "Price",
      charges: "Charges",
      terms: "Terms",
      photos: "Photos",
      describe: "Title and description",
    },
    kinds: { stay: "A stay, by the night", rent: "To let", sale: "For sale" },
    photosLine: "{count} photos and videos ({recommended} recommended)",
    accessSet: "Added, private until a booking is confirmed",
    chargesCount: "{count} declared",
    chargesNone: "None declared",
    doorDeclared: "Declared",
    doorOpen: "Not declared yet",
    words: "{count} words",
  },
} as const;

export type WizardWords = typeof WIZARD_WORDS;
