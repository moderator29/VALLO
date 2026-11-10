/**
 * THE STAFF HANDBOOK (Track K, 25 September 2026).
 *
 * Every staff member acknowledges this before any desk unlocks. The version
 * string is the one `private.staff_handbook_version()` returns: change what
 * staff agree to, bump both in the same commit, and every member is asked to
 * acknowledge again before they can act.
 *
 * Client-safe: data only.
 */
export const STAFF_HANDBOOK_VERSION = "2026-09-25";

export const STAFF_HANDBOOK: { heading: string; points: string[] }[] = [
  {
    heading: "What your access is",
    points: [
      "You can see and act on only the desks named in your access. Everything else in the console stays closed to you, and the database refuses it even if a page were to open.",
      "Your access was given by the founder's super admin account and only that account can change it. You cannot grant access to anybody, including yourself.",
      "Every decision you make is written to the audit log with your name, the time, the record and what changed. The log cannot be edited or deleted by anybody.",
    ],
  },
  {
    heading: "Money",
    points: [
      "Vallo never holds customer money. Licensed payment partners process payments, and hold escrow where it is switched on (it is not on for sales yet), and the money is never in a Vallo account. Say so plainly when a member asks, and never tell anybody that Vallo is holding their money. A balance a member sees is what the partner holds for them, not Vallo funds.",
      "Never ask for, accept or pass on money from a member, a lister or anybody else, for any reason. There is no fee you may charge and no payment you may arrange.",
      "Vallo charges no inspection fee. If a member tells you they were asked for one, treat it as a report.",
      "Never give out account numbers, and never move a conversation or a payment off the platform.",
    ],
  },
  {
    heading: "Deciding well",
    points: [
      "Decide on the evidence in front of you: the inspection report and its photographs, the listing, the documents filed. Never on who the person is or what they say they will do.",
      "Write your reason in plain words. The member reads it exactly as you wrote it.",
      "If you know a person in a case, or have any interest in it, do not decide it. Leave it for somebody else and say why in the notes. On agreements and Guarantee claims the database already refuses a decision by a party to them.",
      "When you are unsure, escalate to the founder rather than guessing. A slower right answer is better than a quick wrong one.",
    ],
  },
  {
    heading: "People's information",
    points: [
      "Personal data is protected by the Nigeria Data Protection Act 2023. Look only at what your task needs, and never copy, screenshot, export or share it outside the console.",
      "Never contact a member outside Vallo, and never use anything you saw here for any purpose of your own.",
      "Look after your account: a strong password, never shared, never signed in on a shared device. Tell the founder at once if you think it has been compromised.",
    ],
  },
  {
    heading: "If this is broken",
    points: [
      "Breaking any of this ends your access immediately and may be reported to the authorities. Access can also end at any time without a reason.",
    ],
  },
];
