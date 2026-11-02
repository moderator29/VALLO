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
