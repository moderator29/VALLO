/**
 * Session 3's copy for the admin console, desktop and phone (W8).
 *
 * One module per owner so nine agents can add strings without editing en.ts
 * at the same time. English only: ha, ig and yo fall back to it through
 * `withFallback` until a translator supplies a line, because an invented
 * translation of a new line is worse than none. Money sentences never live
 * here; they come from `lib/money/copy.ts` (Session 2).
 *
 * Every line here PRESENTS something the console already does. None of it
 * decides what is true: a desk lede says what the desk is for, never what is
 * currently in it.
 */
export const experienceAdminEn = {
  /**
   * The console search (the command palette, reference 7067): one box over
   * every desk, opened with Control or Command K, or from the search button
   * on a phone.
   */
  palette: {
    /** The phone bar's search button, and the field's accessible name. */
    open: "Search the console",
    title: "Search the console",
    placeholder: "Go to a desk, or search for a person, listing or reference",
    desks: "Desks",
    actions: "Search for",
    /** Beside the bar's field on a keyboard device. */
    shortcut: "Ctrl K",
    shortcutMac: "Cmd K",
    /** Whole-list statuses, read out politely as the list changes. */
    resultsOne: "1 result",
    resultsMany: "{count} results",
    resultsNone: "No results",
    noMatchTitle: "No desk by that name",
    noMatchBody:
      "Search for it instead: press Enter to look it up across the desks you can open, or search the people list.",
    searchDesk: "Search {desk} for “{query}”",
    searchPeople: "Search people for “{query}”",
    searchQueue: "Search the unified queue for “{query}”",
    lookup: "Look up “{query}” as a reference",
    lookupHint: "Reads as {kind}",
    waiting: "{count} waiting",
    jump: "g then {key}",
    keyMove: "Move",
    keyOpen: "Open",
    keyClose: "Close",
    close: "Close the search",
  },
  /**
   * What each desk is for, one line, in the order of the rail. Shown under
   * the desk's name in the search, in the phone menu (reference 7086: a title
   * and a line under it) and nowhere that could be mistaken for a live count.
   */
  deskLedes: {
    overview: "What is waiting on a person, and how the platform is doing.",
    queue: "Reports, flagged messages and held content in one list.",
    lookup: "Paste a reference, an id or an email and find the record.",
    listings: "Review each listing before it goes live in search.",
    supply: "Who is listing, by type, and the firms behind them.",
    applications: "Agents and owners applying to list.",
    businesses: "Hotels, restaurants and firms, and what each has been checked for.",
    stops: "Stop or restore a lister, with the reason on record.",
    kyc: "Identity documents waiting on a reviewer.",
    compliance: "Sanctions, politically exposed people, thresholds and reports.",
    money: "Cautions, refunds and reconciliation.",
    payments: "Every charge and what it settled to, with lookup.",
    fees: "The commission and listing fee in force, and their history.",
    referrals: "Rewards owed, the monthly budget, and referrals and payouts waiting on a decision.",
    agreements: "Agreements held for review before payment opens.",
    bookings: "Stays and their payments, and refunds to the card.",
    reservations: "Restaurant reservations and their decisions.",
    moderation: "Posts, stories and the standing of members.",
    social: "Posts, stories, comments and bios held or reported.",
    standing: "Members on a warning, a hold or a restriction.",
    tickets: "Support tickets, claimed and answered by the team.",
    people: "Find a member and open their file.",
    "account-recovery": "Help a member back into an account they cannot reach.",
    operations: "Scheduled jobs, in-flight work and the store checks.",
    alerts: "Platform alerts waiting for a person to acknowledge them.",
    audit: "Who did what, and when. Every decision is written here.",
    oversight: "Who decided what, how long each queue waits, and where it slipped.",
    analytics: "Sign-ups, listings and the money that moved.",
    "front-door": "How visitors move through the first screens, and invite codes.",
    settings: "The switches, reference data and staff for the console.",
    switches: "Turn features on and off for the platform.",
    reference: "The lists the product reads: areas, categories and more.",
    examples: "Example listings, counted apart from real supply.",
    staff: "Who holds staff access, and to which desks.",
    handbook: "The staff handbook and your own role.",
    help: "Help and support for the people who run the console.",
    /* Admin coverage (13 October 2026): the desks that had no way in. */
    "agreement-settings": "The review threshold, the signals and the incident switch.",
    "restaurant-fees": "Fees owed on seated tables, and the disputes about them.",
    "blocked-terms": "The words the safety scan holds, flags or refuses.",
    "weight-withheld": "Reviews and reports that do not count, and clearing a stamp.",
    "call-usage": "Video and audio calls: volume, connect rate and minutes.",
    retention: "Money records past their retention date, and the typed-confirmation tool.",
    "field-speed": "How fast the app is on the phones people actually use.",
  },
  /** The console's mobile shell. */
  shell: {
    /** The menu button's visible label, shown beside the glyph on a wide phone. */
    menu: "Menu",
    drawerDesks: "All desks",
    drawerSections: "Sections",
    waitingTotal: "{count} waiting",
    /** The phone sheet that holds a desk's filters. */
    filtersOpen: "Filters",
    filtersTitle: "Filter this list",
    filtersApply: "Show results",
    filtersReset: "Clear filters",
    filtersCount: "{count} filters on",
    filtersNone: "No filters on",
    /** The sheet's status row: the chip with no status. */
    filtersAll: "All",
    /** The sheet's close control, named for what it does. */
    filtersClose: "Close the filters",
    /** The overview's lead. */
    overviewLead: "Waiting on a person",
    overviewLeadBody: "Each count is read from the desk it opens, the same figure as the rail.",
    overviewClear: "Nothing waiting",
    overviewWaiting: "Waiting",
    overviewTotal: "{count} in all",
    overviewTotalNone: "Nothing waiting on any desk",
    overviewUnread: "The queue counts could not be read just now. They retry every minute.",
  },
  /** Page-level sections of a desk, for the inner navigation (glass pull). */
  sections: {
    navLabel: "Sections of this desk",
    toggle: "Open the sections of this desk",
    jumpTo: "Jump to a section",
    moneyTitle: "Money desk sections",
    guarantee: "Guarantee claims (retired)",
    cautions: "Cautions",
    refunds: "Refunds",
    reconciliation: "Reconciliation",
    tenancy: "Tenancy charges",
    refundClock: "Refund clock",
    history: "Payments and refunds",
    /** Operations and Analytics, in the same glass pull as the Money desk. */
    health: "Health",
    figures: "Figures",
    sentBack: "Sent back",
  },
  /** The money desk read as documents. Labels and slide prompts only; a money
      sentence is never written here. */
  money: {
    statementOverline: "Statement",
    reserveTitle: "The Vallo Guarantee reserve (retired 9 November 2026)",
    refundsOverline: "Refund record",
    refundsTitle: "Refunds to the card",
    cautionsOverline: "Rulings",
    cautionsTitle: "Cautions on the record",
    historyOverline: "Ledger",
    historyTitle: "Payments and refunds",
    /** A ruling is a slide, never a tap. */
    slideApprove: "Slide to approve this claim",
    slideReject: "Slide to reject this claim",
    slideRule: "Slide to rule",
    slideReceived: "Slide to rule: received",
    slideNotReceived: "Slide to rule: not received",
    slidePaid: "Slide to mark it paid",
    /** Said on the track when the server refused. */
    refused: "That did not go through",
    readOnlyDesk: "This desk is read only for your access.",
  },
  /**
   * The compliance desk's rulings. Only the one ruling that cannot be taken
   * back is a slide: a second person approving a recorded decision (the
   * approval is final; sending it back reopens the case, so that stays a
   * button). No money sentence lives here.
   */
  compliance: {
    slideApprove: "Slide to approve this decision",
    slideApproveRelease: "Slide to approve the release",
    /** Said on the track when the server refused; the refusal's own sentence is under it. */
    refused: "That did not go through",
    /** The desk's decision bar, named for a screen reader. */
    decisionBar: "Decision",
  },
  /**
   * A desk that only reads says so once, quietly, instead of leaving a table
   * that looks as if it should have a control. It states what the desk does
   * (reads and reports), never what is currently in it.
   */
  readOnly: {
    line: "This desk reads and reports. It changes nothing: decisions are taken on the desk each item belongs to.",
  },
  /**
   * Where a listing stands, as steps (reference 7118). Every step is a status
   * the record really has; a time is printed only where the record stores one.
   */
  listingTrack: {
    label: "Where this listing stands",
    title: "Review progress",
    submitted: "Submitted",
    review: "In review",
    decision: "Decision",
    live: "Live",
    sentBack: "Sent back to the lister for more information",
    notYetLive: "Approved, not yet live",
    rejected: "Rejected",
  },
  /** Case history and audit trails. */
  cases: {
    historyOpen: "Show the history",
    historyClose: "Hide the history",
    historyHeading: "History",
    trailHeading: "Audit trail",
    trailNone: "Nothing has been recorded against this case yet.",
    trailLink: "Open the audit trail",
    historyCount: "{count} in all",
    back: "Back to the list",
    selected: "{count} selected",
    selectRow: "Select this row",
    selectAll: "Select every row on this page",
    clearSelection: "Clear the selection",
    noBulkOnMoney: "Money rulings are taken one at a time.",
    selectNone: "Clear every row",
    bulkLabel: "Bulk actions on the selected rows",
    bulkConfirmTitle: "Apply to the selected rows?",
    bulkConfirmBody: "{verb} will be applied to {count} selected rows. One batch is written to the audit log, and rows another operator holds are skipped.",
    bulkConfirmApply: "Apply",
    /** A verb that cannot run yet says what it is waiting for. */
    bulkNeedsReason: "{verb} needs a reason, chosen in the bulk form.",
    bulkNeedsTo: "{verb} needs a person to hand to, chosen in the bulk form.",
    bulkNeedsOpen: "Choose it",
  },
  /** Status words for the console's own chips, by state, never colour alone. */
  chips: {
    waiting: "Waiting",
    clear: "Clear",
  },
};
