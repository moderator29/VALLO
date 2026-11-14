import type { StaffScope } from "./guard";

/**
 * NAMED STAFF POSITIONS AND THEIR JOB DESCRIPTIONS.
 *
 * A super admin grants a position, which sets its default bundle of scopes in
 * one step (they may still adjust individual scopes). The same list lives in
 * `private.staff_position_title` / `private.staff_position_scopes`
 * (migration `20260929094459_named_staff_positions_with_default_scope_bundles`);
 * `staff-positions.test.ts` reads that migration and fails if the two drift.
 *
 * Each position carries its job description: what the position is, what it is
 * responsible for, what is expected of the person in it, and where they take
 * what they cannot decide. It is linked from the access email and shown in the
 * console beside the staff handbook, so a staff member can always read back
 * exactly what their role covers.
 *
 * Client-safe: data only.
 */

export const STAFF_POSITIONS = [
  "moderator",
  "support_agent",
  "kyc_reviewer",
  "listings_reviewer",
  "agreements_officer",
  "trust_safety_lead",
  "compliance_officer",
  "finance_officer",
  "operations_manager",
  "cfo",
  "coo",
  "ceo",
  "business_development_executive",
  "social_media_manager",
  "marketing_manager",
  "content_manager",
  "technical_administrator",
  "customer_support_lead",
] as const;
export type StaffPosition = (typeof STAFF_POSITIONS)[number];

export function isStaffPosition(value: unknown): value is StaffPosition {
  return typeof value === "string" && (STAFF_POSITIONS as readonly string[]).includes(value);
}

export type JobDescription = {
  title: string;
  /** One sentence: what the position is for. */
  summary: string;
  reportsTo: string;
  scopes: StaffScope[];
  responsibilities: string[];
  expectations: string[];
  escalate: string[];
};

const ALWAYS_EXPECTED = [
  "Decide only on the evidence in the console, write every reason in plain words the member can read, and never decide a case in which you have any interest.",
  "Keep personal data inside the console. Never copy, screenshot, export or share it except through the console's own export, and only for the purpose your role names.",
  "Protect your account: a strong password that you use nowhere else, because it is what opens the console, and no shared devices.",
];

export const JOB_DESCRIPTIONS: Record<StaffPosition, JobDescription> = {
  moderator: {
    title: "Moderator",
    summary:
      "Keeps Vallo safe to use by reviewing what members report and what the platform flags, and deciding what stays up.",
    reportsTo: "Head of Trust and Safety, or the COO where there is none",
    scopes: ["moderation"],
    responsibilities: [
      "Work the reports and message-flag lanes of the moderation queue, oldest first, inside the response time the queue shows.",
      "Decide each report: dismiss it, act on it, or hold the content, and write the reason the reporter will read.",
      "Review content held by the automatic checks and either release it or remove it, with a reason.",
      "Recognise fraud patterns (requests for money off the platform, inspection fees, fake listings) and report them to your lead the same day.",
      "Record anything a colleague needs to know in the case's internal notes, never in a message to the member.",
    ],
    expectations: [
      "Consistency: the same content gets the same decision, whoever reported it and whoever posted it.",
      "Care with people who report harm: a report is taken seriously even when the evidence is thin.",
      "Claim a case before you work it and release it if you step away, so two moderators never decide the same case.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: [
      "Threats of violence, child safety, or anything that may be a crime: escalate at once, and do not contact the member.",
      "A report about a member of staff: escalate to the Head of Trust and Safety without acting on it.",
    ],
  },
  support_agent: {
    title: "Support Agent",
    summary: "Answers members who write to Vallo, resolves what can be resolved and routes what cannot.",
    reportsTo: "Operations Manager",
    scopes: ["support"],
    responsibilities: [
      "Answer support tickets in the order the desk shows, inside the reply time the ticket carries.",
      "Explain how Vallo works in the words the product uses: Vallo never holds a member's money, payments go straight to the lister through Paystack, and refunds go back to the card that paid.",
      "Set each ticket's status honestly, and close a ticket only with a closing note that says what was done.",
      "Hand a ticket that needs another desk (money, safety or verification) to that desk from the ticket itself, with the reason they will read first; keep the member told on the thread while the other desk looks.",
      "Start from a saved reply where one fits, and always read and adjust it before it goes: it is your name on it.",
    ],
    expectations: [
      "Warmth and plain language. A member writing to us is usually worried; the first reply should make things clearer, not longer.",
      "Never promise an outcome another desk decides, and never ask a member for a password, a card number or a one-time code.",
      "Never move a conversation or a payment off the platform.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: [
      "Anything about money that has not arrived or a refund that has not come back: note the booking and escalate to finance.",
      "A member who says they are in danger: escalate immediately and follow the safety runbook.",
    ],
  },
  kyc_reviewer: {
    title: "KYC Reviewer",
    summary:
      "Checks the identity and business documents people file, so that every verified badge on Vallo means a real, checked person.",
    reportsTo: "Compliance Officer",
    scopes: ["kyc_review"],
    responsibilities: [
      "Review agent, owner and firm applications and the identity documents filed with them, in the order the verification desk shows.",
      "Approve, reject, or ask for more information, with a reason the applicant can act on.",
      "Compare documents against the application: names, numbers, dates and photographs must agree.",
      "Record every check you performed on the verification ladder, one rung at a time.",
    ],
    expectations: [
      "Look only at the documents your task needs, and only in the console's own viewer. Every view is written to the audit log.",
      "Never decide your own application or that of anyone you know; the database refuses it, and you should leave it before it has to.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: [
      "A document you believe is forged, or a match on the sanctions or fraud lists: escalate to the Compliance Officer and do not tell the applicant why.",
    ],
  },
  listings_reviewer: {
    title: "Listings Reviewer",
    summary:
      "Reviews every property before it goes live, so that what a renter or buyer sees on Vallo is real, accurate and allowed.",
    reportsTo: "Head of Trust and Safety",
    scopes: ["listing_approval"],
    responsibilities: [
      "Review submitted listings: photographs, description, price, fees and the mandate or ownership evidence behind them.",
      "Approve, publish, send back for changes, or reject, always with a reason the lister will read.",
      "Check that every fee a renter will pay is declared, and that nothing asks for an inspection fee.",
      "Watch for duplicate and copied listings and for photographs taken from elsewhere.",
    ],
    expectations: [
      "A listing goes live only when you would be comfortable sending a member of your own family to view it.",
      "Never review your own listing or one from someone you know.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: ["A listing you believe is a scam: reject it, report it to moderation, and tell your lead the same day."],
  },
  agreements_officer: {
    title: "Agreements Officer",
    summary:
      "Approves the agreements that open payment, and decides claims on the Vallo Guarantee.",
    reportsTo: "COO",
    scopes: ["agreements", "guarantee"],
    responsibilities: [
      "Review each agreement both parties have confirmed and approve it or send it back with a reason; payment opens only after your approval.",
      "Decide Guarantee claims on the evidence filed, within the published scope of the Guarantee.",
      "Record the payout reference once a claim is paid.",
    ],
    expectations: [
      "Read the whole agreement: amounts, dates, the property and the parties. Nothing is approved on a summary.",
      "Never decide an agreement or a claim you are a party to; the database refuses it.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: ["A claim above your comfort, or one that looks coordinated: escalate to the CFO before deciding."],
  },
  trust_safety_lead: {
    title: "Head of Trust and Safety",
    summary:
      "Leads moderation, listings review, verification and support, and owns how safe Vallo feels to the people who use it.",
    reportsTo: "COO",
    scopes: ["listing_approval", "kyc_review", "moderation", "support"],
    responsibilities: [
      "Run the moderation, listings, verification and support queues day to day, and see that nothing sits past its response time.",
      "Assign work, take escalations from your team, and decide the cases they cannot.",
      "Keep decisions consistent across reviewers, and write down the rules you apply so the next reviewer applies them too.",
      "Report fraud patterns and safety incidents to the COO weekly, and at once when serious.",
    ],
    expectations: [
      "Lead by example: your own decisions are the standard your team copies.",
      "Look after reviewers who handle distressing material, and rotate them off it when they need a break.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: ["Anything that may be a crime, or that could harm a member if it waited: the COO and the CEO, the same hour."],
  },
  compliance_officer: {
    title: "Compliance Officer",
    summary:
      "Owns Vallo's anti-money-laundering programme and its duties to the regulators, including SCUML and reports to the NFIU.",
    reportsTo: "CEO, with a direct line to the board",
    scopes: ["kyc_review", "compliance"],
    responsibilities: [
      "Work the compliance desk: suspicious transaction reports, threshold reports, politically exposed persons, sanctions screening and beneficial ownership.",
      "Decide whether a case is reported to the NFIU, and file it on time.",
      "Oversee KYC reviewers, and set the verification standard they apply.",
      "Keep the sanctions lists current and review every match.",
      "Export the registers the regulators ask for, and keep a record of what was sent and when.",
    ],
    expectations: [
      "Never tell a person, or anyone who might tell them, that they are the subject of a report. Tipping off is an offence.",
      "Independence: no commercial target outranks a compliance decision.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: ["A case involving a member of staff, or one that may need the authorities: the CEO directly, in writing."],
  },
  finance_officer: {
    title: "Finance Officer",
    summary:
      "Watches the money that moves through Vallo, reconciles it with Paystack, and decides Guarantee payouts within limits.",
    reportsTo: "CFO",
    scopes: ["guarantee", "finance"],
    responsibilities: [
      "Read the Money and Payments desks daily: settlements, refunds, the Guarantee reserve and reconciliation.",
      "Reconcile Vallo's records with Paystack and chase any difference until it is explained.",
      "Decide Guarantee claims and record payouts.",
      "Export the payments history for month-end and for the accountants.",
    ],
    expectations: [
      "Vallo never holds customer money. Never describe a balance or a store of value, and never arrange a payment outside Paystack.",
      "Every number you report can be traced to a record in the console.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: ["A reconciliation difference you cannot explain within a day: the CFO."],
  },
  operations_manager: {
    title: "Operations Manager",
    summary:
      "Keeps the platform running day to day: scheduled jobs, alerts, bookings, support and agreements.",
    reportsTo: "COO",
    scopes: ["support", "agreements", "operations"],
    responsibilities: [
      "Watch the operations and alerts desks and act on anything red.",
      "Oversee bookings and reservations that are stuck, late or disputed.",
      "Lead the support team and approve agreements when the agreements desk is busy.",
      "Keep the runbooks current, and write one for every incident that did not have one.",
    ],
    expectations: [
      "Calm under pressure, and a written note after every incident: what happened, what we did, what changes.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: ["An outage, a data incident, or a payment failure affecting many members: the COO and the CEO at once."],
  },
  cfo: {
    title: "Chief Financial Officer",
    summary:
      "Owns Vallo's finances, its money model and its financial controls, and answers for them to the board.",
    reportsTo: "CEO and the board",
    scopes: ["agreements", "guarantee", "finance", "compliance"],
    responsibilities: [
      "Oversee settlements, refunds, the Guarantee reserve and reconciliation, and sign off month-end.",
      "Set the limits within which finance staff decide Guarantee payouts, and decide the claims above them.",
      "Own the relationship with Paystack and the auditors.",
      "Work with the Compliance Officer on anything where money and compliance meet.",
    ],
    expectations: [
      "The no-custody rule is yours to protect: Vallo never holds customer money, and nothing the company says or builds may suggest otherwise.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: ["Anything that would change the money model, or a material loss: the CEO and the board."],
  },
  coo: {
    title: "Chief Operating Officer",
    summary:
      "Runs the operation: trust and safety, support, listings, agreements and the day-to-day platform.",
    reportsTo: "CEO",
    scopes: ["listing_approval", "moderation", "support", "agreements", "operations"],
    responsibilities: [
      "Lead the operations, trust and safety, and support teams and set their targets.",
      "Watch the backlog and response times across every desk, and move people to where the queue is.",
      "Take escalations from the team leads, and decide what they cannot.",
      "Recommend staff access changes to the super admin as the team changes.",
    ],
    expectations: [
      "You are accountable for every desk's quality, not only its speed.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: ["A serious incident, a legal matter, or a regulator's enquiry: the CEO."],
  },
  ceo: {
    title: "Chief Executive Officer",
    summary: "Leads Vallo and is accountable for everything it does, including to its members and its regulators.",
    reportsTo: "The board",
    scopes: [
      "listing_approval",
      "kyc_review",
      "moderation",
      "support",
      "agreements",
      "guarantee",
      "finance",
      "compliance",
      "operations",
    ],
    responsibilities: [
      "Set direction, and see that every desk runs to the standard members are promised.",
      "Receive escalations from the COO, CFO and Compliance Officer and decide them.",
      "Read every desk as needed; the super admin still grants access and changes switches.",
    ],
    expectations: [
      "Your access reaches every desk. Use it to understand and to decide, and leave day-to-day decisions to the people whose job they are.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: ["Anything affecting the company's licence or its members' safety: the board."],
  },
  business_development_executive: {
    title: "Business Development Director",
    summary:
      "Brings in the landlords, agents, hotels and restaurants Vallo lists, and reviews their listings and identity checks before they go live.",
    reportsTo: "COO",
    /* `kyc_review` added 14 November 2026 (the founder: the Business
       Development Director reviews members' identity checks as well as their
       listings, and holds no admin role). */
    scopes: ["business_development", "listing_approval", "kyc_review"],
    responsibilities: [
      "Find and approach property owners, agents, hotels, shortlet hosts and restaurants, and bring them onto Vallo.",
      "Keep every prospect and partnership in one place: who they are, what stage they are at, what was last said, and the next follow-up date.",
      "Review submitted listings in your pipeline: photographs, description, price, fees and the mandate or ownership evidence behind them.",
      "Approve, publish, send back for changes, or reject a listing, always with a reason the lister will read.",
      "Review identity checks on the KYC desk: the document, the selfie and the name against the account, then approve or refuse with a reason the member will read.",
      "Where the evidence supports it, restrict a member on a property case; write the reason and attach the evidence, because this decision is read back later.",
      "Report on your pipeline weekly: who you are talking to, what is close, and what is stuck.",
    ],
    expectations: [
      "A partnership earns its place on Vallo the same way a listing does: it would hold up to a member's own family using it.",
      "Never review a listing from someone you brought on yourself without a second person's eyes on it first, and never review your own listing or one from someone you know personally.",
      "Keep what a prospect tells you in the pipeline record, not in a personal notebook or a chat outside Vallo.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: [
      "A listing you believe is a scam: reject it, report it to moderation, and tell your lead the same day.",
      "A restriction decision you are not sure of, or a partner who pushes back hard on one: the COO.",
    ],
  },
  social_media_manager: {
    title: "Social Media Manager",
    summary:
      "Plans and prepares Vallo's social content and campaigns: the calendar, the drafts and the media library, posted by hand on each platform.",
    reportsTo: "Marketing lead, or the COO where there is none",
    scopes: ["social_media"],
    responsibilities: [
      "Keep the content calendar: what is going out, on which platform, and when.",
      "Write and prepare posts and campaigns in the console, with their images, video and captions, ready to copy onto each platform.",
      "Keep the media library organised, so a photo or video is easy to find and reuse.",
      "Send a draft for approval before it is due, and post it yourself on the real platform once it is approved.",
      "Record what was actually posted and when, so the calendar stays the true record of what went out.",
      "Report on what was posted and how it did, from whatever each platform's own dashboard shows you.",
    ],
    expectations: [
      "Nothing about a member, a payment, a legal matter or an internal decision goes out without the approval this role asks for.",
      "Vallo's posts never promise a payment is safe, protected or guaranteed; where in doubt, ask rather than post.",
      "This role has no access to listings, support, moderation or any member's data. If a post needs a real figure or a real quote, ask the desk that owns it.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: ["Anything that could be read as a company statement on a legal, safety or financial matter: the COO before it is posted."],
  },
  marketing_manager: {
    title: "Marketing Manager",
    summary:
      "Plans Vallo's marketing campaigns and promotions, tracks what they bring in, and keeps campaign budgets honest.",
    reportsTo: "COO",
    scopes: ["marketing"],
    responsibilities: [
      "Plan each campaign in the console: the objective, the channel, the audience, the dates and, where you are authorised, the budget.",
      "Build the tracked link for every campaign (source, medium and campaign name) so sign-ups can be traced back to it.",
      "Send each campaign to the COO or an admin for approval before it goes live, and act on any reason it is sent back with.",
      "Log the numbers each campaign produces (spend, clicks, sign-ups, listings created, referrals) from the real dashboards, as they come in.",
      "Read the acquisition figures the console already holds and say plainly when a figure is not available.",
      "Work with the Social Media Manager on campaign posts, and with the Content Manager on campaign copy.",
    ],
    expectations: [
      "Every figure you report is either read from the console or logged by you with its source in the note. Never round a number up or fill a gap with a guess.",
      "A campaign goes live only after it is approved, and spends only what its approved budget says.",
      "Marketing copy never promises a payment is safe, protected or guaranteed, and never mentions a member or a payment by name.",
      "This role has no access to listings, support, moderation or any member's data.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: [
      "A change to a budget after approval, or spend that would pass it: the COO before it is committed.",
      "Anything that could be read as a company statement on a legal, safety or financial matter: the COO before it goes out.",
    ],
  },
  content_manager: {
    title: "Content Manager",
    summary:
      "Plans, writes and publishes Vallo's own content: guides, announcements, articles and brand material, through an approval step.",
    reportsTo: "COO",
    scopes: ["content"],
    responsibilities: [
      "Keep the editorial calendar: what is being written, who owns it and the date it is due.",
      "Write and edit guides, announcements and articles in the console, and send each one for approval before it is published.",
      "Record the link once an item is published, so the calendar is the true record of what went out.",
      "Keep the brand library: the links and notes (voice, names, approved wording) that everyone writes from.",
      "Watch the moderation queue's counts for the feed and raise anything unusual with the Head of Trust and Safety. You read the counts; the decisions stay with moderation.",
      "Retire content that is out of date, and check the content health table each week for items that have slipped.",
    ],
    expectations: [
      "Nothing about a member, a payment, a legal matter or an internal decision is published without the approval this role asks for.",
      "Content never says a payment is safe, protected or guaranteed, and never describes Vallo as holding anyone's money.",
      "Images and video belong in the social media library; this desk holds text and links only.",
      "This role has no access to the moderation queue itself, to listings, support or any member's data.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: [
      "A draft that touches a legal, safety or financial matter: the COO before it is sent for approval.",
      "Feed content that looks harmful or illegal: the Head of Trust and Safety the same hour.",
    ],
  },
  technical_administrator: {
    title: "Technical Administrator",
    summary:
      "Watches the health of the platform from the console, keeps the record of technical incidents, and reads deployment information where authorised.",
    reportsTo: "COO",
    scopes: ["technical"],
    responsibilities: [
      "Read the health panel each morning: the scheduled jobs, the crash counts, the open alerts and which providers are configured.",
      "Declare an incident when something is wrong, with its severity, and post an update every time the position changes.",
      "Resolve an incident only with a written summary of what happened and what was done.",
      "Read the deployment information the console shows (release, environment, region) when asked what is running.",
      "Hand anything that needs a change to infrastructure, a key or the database to the people who hold that access, with the facts you saw.",
    ],
    expectations: [
      "This desk is read-only. It never shows, asks for or stores a key, a password, a database credential or a secret, and you never paste one into an incident update.",
      "The incident log is the record: what you knew, when, and what you did, in plain words.",
      "A figure you cannot read is reported as not available, never as zero.",
      "This role has no access to listings, support, moderation, money or any member's data.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: [
      "An outage, a data incident or a payment failure affecting many members: the COO and the CEO at once.",
      "Anything that suggests a key or credential has leaked: the COO immediately, and do not post the detail in the incident log.",
    ],
  },
  customer_support_lead: {
    title: "Customer Support Lead",
    summary:
      "Leads the support team: who works which tickets, what is escalated, the quality of the answers, and the policy the team answers from.",
    reportsTo: "COO",
    scopes: ["support", "support_lead"],
    responsibilities: [
      "Watch the team's workload each day: what is open, what is oldest, what is late and who is holding it.",
      "Take unassigned tickets yourself and ask a colleague to release one that is stuck; claims free themselves after thirty minutes without a touch.",
      "Work the escalation list, and hand each escalated ticket to the desk that can decide it, with the reason they will read first.",
      "Review a sample of answered tickets every week against tone, accuracy, speed and policy, and give the agent the notes.",
      "Report the support figures that the console can count: first response, time to resolve and the backlog.",
      "Write the support policy notes the team answers from, and send each for approval before the team relies on it.",
    ],
    expectations: [
      "Reviews are about the answer, not the person. Score on the four criteria and write what would have been better.",
      "Never promise an outcome another desk decides, and never ask a member for a password, a card number or a one-time code.",
      "A policy note is a draft until the COO or an admin approves it. The team works from approved notes only.",
      ...ALWAYS_EXPECTED,
    ],
    escalate: [
      "Anything about money that has not arrived or a refund that has not come back: finance, with the booking.",
      "A member who says they are in danger: the Head of Trust and Safety and the COO immediately.",
      "A pattern of late tickets you cannot clear with the team you have: the COO.",
    ],
  },
};

export function positionTitle(position: StaffPosition | null | undefined): string | null {
  return position ? JOB_DESCRIPTIONS[position].title : null;
}
