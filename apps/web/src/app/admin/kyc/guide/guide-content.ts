/**
 * THE REVIEWER GUIDE (manual verification, 2 November 2026).
 *
 * What a person on the verification desk needs to do the job well on their
 * first day: the flow end to end, what to look at on each document, the name
 * rules, the words to use when sending something back, and what to do when
 * something looks wrong. Kept as data so the page and its test read the same
 * words. The desk reads English.
 */

export type GuideSection = {
  id: string;
  title: string;
  lede?: string;
  points: readonly string[];
  /** Numbered when the order matters. */
  ordered?: boolean;
};

export const GUIDE_INTRO =
  "You confirm that the people who list property and get paid on Vallo are who they say they are. Renters and buyers are never asked. Every decision you make is written to the audit log with your name, and the person is told the result in their notifications.";

export const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    id: "flow",
    title: "The flow, start to finish",
    ordered: true,
    points: [
      "A lister opens Get verified and sends three things: a photo of their ID, a live selfie taken in the app, and a proof of address. A business also sends its CAC details.",
      "You get a notification, and the Verification row in the menu shows how many documents are waiting.",
      "Open Verification and open the person. Identity at a glance shows their ID beside their selfie, the names to compare, and their bank account name once they add one.",
      "Check the ID, then the selfie, using the checklists below.",
      "Approve the ID by typing the name exactly as printed on it. That name becomes their confirmed identity, and their bank account must match it.",
      "Approve the selfie if it is the same person, live. When the ID and the selfie are both approved, the person's identity is confirmed.",
      "Check the proof of address. When it is approved, the address step is done.",
      "When they add the bank account they are paid into, Vallo asks the bank for the account name and compares it with the name on their ID. A match passes on its own; a mismatch waits for you.",
      "Anything you cannot accept, send back with a reason they can act on. They replace just that document and it comes back to the queue.",
    ],
  },
  {
    id: "id",
    title: "Checking the ID",
    lede: "Accepted: international passport (the photo page), driver's licence, NIN slip or NIN card, permanent voter's card.",
    points: [
      "It is a photo of the document itself. Refuse a screenshot, a photo of a screen, a photocopy or a scan of a scan.",
      "All four corners are in view, and the photo, the name and the numbers are sharp enough to read.",
      "It is not expired. A NIN slip has no expiry.",
      "Nothing looks edited: no mismatched fonts, no blurred or pasted patches around the name, photo or dates, no text that sits crooked against the rest.",
      "The photo on the ID is a real person of a believable age for the date of birth.",
      "A passport photo page has two lines of letters and chevrons along the bottom. If they are missing or look typed on, look closer.",
      "If the same ID number or face appears on another account, do not approve. Report it (below).",
    ],
  },
  {
    id: "selfie",
    title: "Checking the selfie",
    points: [
      "Same person: compare the shape of the face, the eyes, the nose, the ears and the hairline. Ignore hair, beard, glasses, make-up and weight, which change.",
      "Live, not a photo of a photo: look for screen edges, moire stripes, glare from a screen, a printed border or fingers holding a picture.",
      "One face only, the whole face visible, no sunglasses or face covering.",
      "If the light is too poor to compare, send it back and ask them to retake it facing a window.",
    ],
  },
  {
    id: "names",
    title: "Comparing names",
    points: [
      "Type the name on the ID exactly as printed, surname and given names in the ID's order.",
      "A different order is fine: OKEKE CHIDI and Chidi Okeke are the same name.",
      "A missing middle name is fine, and so is an initial for a middle name.",
      "Titles do not count: Chief, Alhaji, Dr, Engr, Mrs and the rest.",
      "A hyphenated surname written with a space, or the other way round, is fine.",
      "A different first name or surname is not fine, unless they explain it with a document (marriage, deed poll). If in doubt, book a video call.",
    ],
  },
  {
    id: "address",
    title: "Checking the proof of address",
    points: [
      "A utility bill, a bank statement or a tenancy agreement.",
      "Dated in the last three months. The desk marks anything older, or undated.",
      "Their name is on it, and it is the name on the ID.",
      "The whole page is visible and readable.",
    ],
  },
  {
    id: "business",
    title: "Checking a business",
    points: [
      "Look the RC or BN number up on the CAC public search (search.cac.gov.ng). It costs nothing.",
      "The registered name and number match what they typed, and the company is active.",
      "The person verifying should be a director, proprietor or someone the business has authorised in writing.",
    ],
  },
  {
    id: "bank",
    title: "The bank account check",
    points: [
      "Done automatically through Paystack when they add the account they are paid into. It costs nothing.",
      "A match passes the payout step on its own. The bank checked the person's BVN when it opened the account, so a matching name is strong proof.",
      "A mismatch waits for you. A business account in the registered business name is fine. A different person's account is not: refuse it with a reason.",
    ],
  },
  {
    id: "reasons",
    title: "Sending something back: words that work",
    lede: "The person is sent your words exactly. Say what is wrong and what to do.",
    points: [
      "The photo is blurry. Take it again in good light, with the whole ID flat and all four corners in view.",
      "This is a photo of a screen. Take a photo of the ID itself.",
      "This ID has expired. Send an ID that is still valid.",
      "Your selfie is too dark to compare with your ID. Take it again facing a window, with your whole face in the oval.",
      "The name on your ID does not match the name on your account. Send an ID in your own name, or contact support to correct your account name.",
      "This bill is more than three months old. Send one dated in the last three months.",
      "We could not confirm this document. Send a different government ID.",
    ],
  },
  {
    id: "forged",
    title: "How to tell a forged ID",
    lede: "A name and a face can both be copied, so they are not enough to approve on when something feels wrong. Use the Cross-checks panel beside the ID and the selfie on every person. Nothing in it proves an ID is genuine: it catches common forgeries and reused IDs.",
    points: [
      "There is no free public place to look up a NIN or a BVN, and Vallo has no paid lookup switched on. Never type a member's ID number into any outside website, app or chat, and never send a document outside the console, not even to check it.",
      "Cross-checks lists what it found, worst first. Stop means do not approve: escalate. Look closer is a hint that may be innocent. Fine means that one check found nothing wrong, not that the ID is real. Not run means the check could not run: carry on with the others.",
      "This ID number is on another account, or The same file is on another account: one ID belongs to one person, and an identical file means one of them did not take the photo. Stop. The link opens the other account, for staff who may open it.",
      "A picture very like theirs is on another account: it may be the same card photographed again, or two cards of the same kind that look alike to the comparison. Open the other account and compare the two by eye.",
      "Saved by an editing app, or Looks like a screenshot: people crop and rotate honest photos in the same apps forgers use, so zoom in on the name, the photo and the dates. A file with no such mark is not cleared by that: marks are easy to remove.",
      "The name lines compare the name on the ID, the account name and the bank account name. A different order or a missing middle name is allowed for. A bank account in another person's name is refused.",
      "For a passport, open Check a passport's bottom lines and type the two lines printed at the bottom of the photo page. It answers at once, in your browser, and sends nothing anywhere. All five check digits should pass, and the name and dates it reads out should be the ones printed on the page.",
      "If you typed the lines correctly and a check digit still fails, the page has very likely been edited. A pass is a good sign and not proof: a careful forger can work the digits out too.",
      "For any other ID, open Check the number printed on the ID. An unusual shape (a NIN is 11 digits, no letters) means read the document again. A right shape proves nothing. Compare with other accounts keeps only a scrambled form of the number and tells you if another account carries the same one.",
      "Open What a real one looks like and tick through the list for that document by eye. No list is proof: a careful forgery copies every line.",
      "Still unsure? Ask for a selfie holding their ID (the next section). A person holding the real card can take that photo in a minute; a person with only a picture of one cannot.",
      "If anything says Stop, or you still doubt it after all of this, do not approve and do not tell the member what you suspect. Send it back with: We could not confirm this document. Send a different government ID. Then press Escalate to Trust and Safety on the panel and write what you saw.",
      "Escalating a doubt is the right call, not a failure. Approving a forged ID is the mistake.",
    ],
  },
  {
    id: "ask",
    title: "When you do not trust it: ask for a selfie holding their ID",
    lede: "This is never a step people go through. Use it only for a person you cannot confirm.",
    ordered: true,
    points: [
      "On the person, press Ask for a selfie holding their ID.",
      "Write why, in plain words. A starting sentence is filled in for you to edit. They are sent your words exactly.",
      "They get a notification and find your request at the top of Get verified, with a camera to take the photo and one button to send it.",
      "The photo comes back to the queue marked Selfie holding their ID (asked for), in place of the selfie you doubted.",
      "Compare three things: the face in the photo, the photo on the ID in their hand, and the ID they sent first. Approve it as the same person, or reject it with a reason.",
      "If it still does not settle it, book a video call. If it looks forged, follow When something looks wrong.",
    ],
  },
  {
    id: "video",
    title: "When to book a video call",
    points: [
      "The ID looks real but the selfie is unclear, or the face is hard to compare.",
      "The names differ and they say there is a reason.",
      "An older account with no selfie on file.",
      "Book it from Review calls. Ask them to show their face and the ID next to it on camera. Never record the call or take screenshots.",
    ],
  },
  {
    id: "report",
    title: "When something looks wrong",
    ordered: true,
    points: [
      "Do not approve, and do not accuse. Send it back with: We could not confirm this document. Send a different government ID.",
      "Never tell the person you suspect fraud. Under Nigeria's anti-money-laundering rules that is tipping off.",
      "Write what you saw in Internal notes on the person: which document, what looked wrong, and when.",
      "Tell the Trust and Safety lead. A forged ID, an ID on two accounts, or a person on a sanctions or PEP list goes to the Compliance officer, who decides on a suspicious transaction report.",
      "If they keep sending forged documents, Trust and Safety can stop the account.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy rules, always",
    points: [
      "Look at documents only inside the console. Never download, screenshot, print or forward one.",
      "Never ask anyone to send documents by WhatsApp, email or text. Everything goes through Get verified.",
      "Never review someone you know. The console stops you reviewing yourself; for friends and family, leave it for a colleague.",
      "Every view and every decision is logged with your name.",
    ],
  },
  {
    id: "time",
    title: "How fast",
    points: [
      "Decide every submission within one working day. The member is told to expect that.",
      "Oldest first. A person waiting is a listing not yet live.",
    ],
  },
];
