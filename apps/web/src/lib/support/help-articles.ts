import type { BrandIconName } from "@/design-system/icons/BrandIcon";
import { SUPPORT_SENTENCE } from "@/lib/support-email";
import { doorsSentence } from "@/lib/supply/roles";
import { NO_INSPECTION_FEE, OFF_PLATFORM_SENTENCE, REFUND_ROUTE, WHO_PAYS_SENTENCE } from "@/lib/money/copy";
import { FULL_REFUND_HOURS } from "@/lib/trust/cancellation";
import { RESPONSE_COMMITMENTS } from "@/lib/trust/standards";
import { DELETE_CONFIRM_PHRASE, GRACE_WINDOW_DAYS } from "@/lib/account-deletion/constants";
import { EULA_ZERO_TOLERANCE } from "@/lib/legal/eula-copy";
import { COMPANY_FORMAL_NAME, COMPANY_REGISTERED_OFFICE } from "@/lib/legal/company";
import {
  CARD_MEANS,
  COMMISSION_FROM_SHARE,
  ESCROW_MEANS,
  ESCROW_OR_CARD,
  HOTEL_COMMISSION_SENTENCE,
  HOTEL_ROOM_BY_CARD,
  PAY_INSIDE_VALLO,
  PRICE_IS_THE_PRICE,
  SALE_IS_ESCROW,
  SEATED_TABLE_FEE,
  VALLO_NEVER_HOLDS,
} from "@/app/(site)/docs/facts";

/**
 * The help centre's articles and trust links, in one module.
 *
 * They were written inline in `app/(site)/help/page.tsx`, which a page file
 * cannot export, so the in-app support home (`app/(app)/support`) had no way
 * to search or feature them without a second copy. Both surfaces now read
 * this one list, so an answer corrected here is corrected on both.
 *
 * Rewritten by the docs track on 13 October 2026 to the founder's money rules
 * (every payment inside Vallo; Escrow, the default, or card for rent and
 * shortlets; a sale always escrow; a hotel room by card; Vallo never holds
 * the money), which are written once in `app/(site)/docs/facts.ts`. Short
 * answers; the long versions are the /docs chapters. No provider is named.
 */
export type Faq = {
  category: string;
  q: string;
  a: string;
};

/**
 * The three trust surfaces, reachable from the page people already come to
 * when something has gone wrong. They are also the answer to the question the
 * FAQ format cannot carry, because an FAQ answer is plain text and cannot hold
 * a link.
 */
export const TRUST_LINKS: { href: string; icon: BrandIconName; title: string; body: string }[] = [
  {
    href: "/safety",
    icon: "shield-check",
    title: "Safety centre",
    body: "How paying works, how inspections work, and what we will never ask you for.",
  },
  {
    href: "/standards",
    icon: "shield-home",
    title: "Trust and safety",
    body: "What is not allowed, how we enforce it, and how quickly we answer a report.",
  },
  {
    href: "/cancellations",
    icon: "calendar-clock",
    title: "Cancellations",
    body: "The standard refund schedule for stays, and the four policies a host business can pick.",
  },
];

export const FAQS: Faq[] = [
  // ----------------------------------------------------- property and stays
  {
    category: "Property and Stays",
    q: "What is Vallo actually for?",
    a: "Vallo is a marketplace for property, stays and restaurants in Nigeria. Rent or buy a home, a shop, an office or land; book a hotel room, a shortlet or a serviced apartment; or book a table. Vallo does not remove the agent. It removes the runaround: you see who you are dealing with and what you will pay before you call anybody.",
  },
  {
    category: "Property and Stays",
    q: "What are the two sides, and what does switching do?",
    a: "Vallo has two sides on one account. Property is renting and buying, priced per year or as a sale price. Stays is hotels, shortlets, serviced apartments and restaurant tables, priced per night for your dates. The switch is at the foot of the menu. It changes the words and the bottom bar. Your profile, inbox, saved places and Plans stay the same.",
  },
  {
    category: "Property and Stays",
    q: "How is paying for a stay different from paying for a tenancy?",
    a: `A hotel room is paid by card when you book. A shortlet is paid once the host accepts it. A tenancy comes after a viewing: you submit the inspection report, you and the lister confirm the agreement, and then you pay. ${ESCROW_OR_CARD} ${PAY_INSIDE_VALLO}`,
  },
  {
    category: "Property and Stays",
    q: "Does Vallo hold my money?",
    a: `No. ${VALLO_NEVER_HOLDS} ${ESCROW_MEANS} ${CARD_MEANS}`,
  },
  {
    category: "Property and Stays",
    q: "Do I have to pay for a restaurant table?",
    a: "No. Booking a table is free and nothing is paid in advance. The restaurant confirms it or declines, and you pay your bill at the restaurant when you eat. Paying the bill through Vallo is not switched on yet.",
  },
  {
    category: "Property and Stays",
    q: "What does Verified mean, and what is Ownership seen?",
    a: "Verified means a person at Vallo checked the ID of the lister behind the listing. Ownership seen means a reviewer has seen the owner's own proof of ownership, on the date shown. Neither is a guarantee, and Ownership seen is not a title search: before you buy, have your own lawyer look at the title.",
  },

  // ------------------------------------------------------------- booking
  {
    category: "Booking a stay",
    q: "How do I book a stay on Vallo?",
    a: `Open Stays and set where, your dates and your guests. Every price becomes the total for your nights. Open a place and see the full price, including any charge at the door, before you book. ${HOTEL_ROOM_BY_CARD} For a shortlet or serviced apartment, reserve: the nights are held for 48 hours at no cost while the host answers. The stay then appears in Plans.`,
  },
  {
    category: "Booking a stay",
    q: "How do I hold a table at a restaurant?",
    a: "Open Restaurants, pick one, and ask for a date, a time and a party size. Times are Lagos time. The restaurant confirms or declines and you are told either way. The booking opens its own conversation and sits in Plans with a check-in code to show when you arrive.",
  },
  {
    category: "Booking a stay",
    q: "Do I need an account to book?",
    a: "Yes. Bookings, payments, messages and receipts belong to your account. Making one is free and takes about a minute.",
  },
  {
    category: "Booking a stay",
    q: "Can I talk to the host or agent before I book?",
    a: "Yes. Every listing has a message button. Ask about the area, the light, the water or parking before you commit, and keep the conversation on Vallo so there is a record.",
  },
  {
    category: "Booking a stay",
    q: "How do I cancel a booking?",
    a: "Open the booking from Plans. A booking you have not paid for can be let go at any time for nothing. For a paid stay, ask from the booking for it to be cancelled and refunded: a person at Vallo decides it by the cancellation policy on your booking. If the host cancels, or the place was not as listed, you get everything back.",
  },
  {
    category: "Booking a stay",
    q: "Will I see every cost before I book?",
    a: `Yes. ${PRICE_IS_THE_PRICE} That includes a caution deposit, power, cleaning, an extra guest or a visitor. A host must not charge anything that is not listed on Vallo. If someone asks for a charge that is not listed, do not pay it, and report it.`,
  },

  // ------------------------------------------------------------ payments
  {
    category: "Payments and refunds",
    q: "Should I pay with Escrow or by card?",
    a: `${ESCROW_OR_CARD} ${ESCROW_MEANS} ${CARD_MEANS} ${SALE_IS_ESCROW}`,
  },
  {
    category: "Payments and refunds",
    q: "Can I pay the owner, agent or host outside Vallo?",
    a: `No. ${PAY_INSIDE_VALLO} Nobody on Vallo has a reason to send you an account number. If somebody asks you to pay outside Vallo, say no and report them.`,
  },
  {
    category: "Payments and refunds",
    q: "Do I pay to inspect a property?",
    a: `No. ${NO_INSPECTION_FEE} If anybody asks you for money to view a place, that is not a Vallo charge, and you can report it. ${OFF_PLATFORM_SENTENCE}`,
  },
  {
    category: "Payments and refunds",
    q: "How do refunds work?",
    a: `Every stay shows its cancellation policy before you book, and the refund follows the policy on your booking. Hotels, shortlets and serviced apartments run as a business pick Flexible, Moderate, Firm or Strict. A stay listed by an owner or agent follows the standard schedule: everything back more than ${FULL_REFUND_HOURS} hours before check-in, half inside that, and nothing once check-in day has started. If the host cancels, or the place was not as listed, you get everything back. ${REFUND_ROUTE}`,
  },
  {
    category: "Payments and refunds",
    q: "How long does a refund take to arrive?",
    a: `Vallo starts a refund by the end of the fifth Nigerian business day after you ask. ${REFUND_ROUTE} The booking shows where your refund is. If nothing has arrived ten working days after it started, contact support with your booking reference.`,
  },
  {
    category: "Payments and refunds",
    q: "What payment methods can I use?",
    a: "You pay in naira, inside Vallo. With Escrow, a licensed payment partner holds your payment until the deal is confirmed. With Pay by card, you pay on the payment partner's own page with a Nigerian card or a bank transfer it raises. Vallo never sees your full card number.",
  },
  {
    category: "Payments and refunds",
    q: "Is Vallo free to use?",
    a: "Yes. Making an account, searching, saving, messaging and asking to view a property are free, and listing is free. Vallo only charges when a deal is completed, from the lister's or host's share. A renter or guest pays the listed price, with nothing added by Vallo. No one has to pay a monthly subscription.",
  },
  {
    category: "Payments and refunds",
    q: "What is the Pro plan, and do I have to pay for it?",
    a: "The Pro plan is optional. You never need it to list, to book, to view a property or to get paid, and nothing you need is locked behind it.",
  },

  // ------------------------------------------------------------- viewings
  {
    category: "Viewings",
    q: "How do I book a viewing?",
    a: "On a rental or a sale, tap Schedule a visit. Choose an in-person visit or a video visit, pick a day and time, add a note if you like, check it and send. If the lister has opened viewing times, the one you pick is booked at once. If not, suggest a time: the lister confirms it, offers another time, or declines. Times are Lagos time. The visit's own page shows where it stands, and lets you add it to your calendar, join a video visit from 10 minutes before, change the time or cancel.",
  },
  {
    category: "Viewings",
    q: "Do I pay to view a property?",
    a: `No. ${NO_INSPECTION_FEE} Money for a rental or a sale moves only after you have seen the property and decided.`,
  },
  {
    category: "Viewings",
    q: "Will I be reminded about a viewing?",
    a: "Yes. The renter and the lister are both reminded three times, in Lagos time: the evening before at 19:00, at 08:00 on the day, and two hours before. Each reminder says whether the visit is in person or by video.",
  },
  {
    category: "Viewings",
    q: "What if the renter or the lister does not turn up to a viewing?",
    a: "Either side can report a no-show from the viewing time until 14 days after. The person reported can dispute it within 48 hours, and if they do, a person at Vallo looks at both sides and decides.",
  },
  {
    category: "Viewings",
    q: "How do I close a viewing after it happens?",
    a: "Once the time has passed, either side can mark the viewing complete and say how it went: inspected, deal done or no deal. For a rental or a sale, you then submit the inspection report and confirm the agreement.",
  },

  // ------------------------------------------------------------- messages
  {
    category: "Messages",
    q: "Can I delete a message I sent?",
    a: "Yes. Delete for me removes it from your own view. Delete for everyone removes it for both sides, and works for 2 days and 12 hours after the message was sent.",
  },
  {
    category: "Messages",
    q: "Can I reply to, forward or call from a conversation?",
    a: "Yes. You can reply to a particular message, forward a message to another conversation, and start a voice or video call from inside the thread.",
  },
  {
    category: "Messages",
    q: "Why is a message in Requests?",
    a: "Messages from people you do not follow arrive as Requests, so a stranger cannot fill your inbox. They wait in their own tab until you open them.",
  },
  {
    category: "Messages",
    q: "Can I message a hotel or a restaurant before I book?",
    a: "Where the business takes messages, its page has a message button. The conversation goes to the business itself and stays in your inbox.",
  },

  // ------------------------------------------------------ listing and hosting
  {
    category: "Listing your property",
    q: "How do I list my property on Vallo?",
    a: `Open Add a workspace from your profile and pick the one that fits: ${doorsSentence()}. The owner form takes about five minutes and asks for your name, an ID and whatever you hold on the property; there is an honest answer if you hold no document. Then post the listing from your workspace. Vallo reviews it before it goes up.`,
  },
  {
    category: "Listing your property",
    q: "Does it cost anything to list?",
    a: `No. Listing is free. ${WHO_PAYS_SENTENCE} Before you publish, Vallo shows you what you will receive.`,
  },
  {
    category: "Listing your property",
    q: "When do owners, agents and hosts get paid?",
    a: "Add a Nigerian bank account in your own name to your payout details first. With Pay by card, your share goes to that account when the payment clears. With Escrow, it is released when the deal is confirmed. Vallo's commission comes out of your share, and every payment shows on your earnings.",
  },
  {
    category: "Listing your property",
    q: "Is a listing reviewed before it is published?",
    a: "Yes. A person at Vallo reviews every listing. They approve it, ask for more, or reject it with a reason. If it is sent back, edit it and send it again.",
  },
  {
    category: "Listing your property",
    q: "Can I be both a landlord and an agent?",
    a: "Not on one account. An account is either an owner (landlord) account or an agent account, never both. If you are both, use two accounts.",
  },
  {
    category: "Listing your property",
    q: "How many photos and videos does a listing need?",
    a: "At least 3 photos or videos, and 5 is recommended. They go in one uploader. The first item is the cover and must be a photo. You can add up to 3 videos, each up to 100MB and 60 seconds, as MP4, MOV or WebM.",
  },
  {
    category: "Listing your property",
    q: "What does the Ownership seen mark mean, and how do I get it?",
    a: "Upload the document you hold on the property when you set up as an owner: a Certificate of Occupancy, a deed of assignment, governor's consent, a survey plan, a utility bill or a letter of authority. When a reviewer approves it, Ownership seen shows with the date on your profile, your listings and search results. It means a reviewer saw your document; it is not a title search.",
  },
  {
    category: "Hosting",
    q: "How do I set up a hotel, shortlet or restaurant?",
    a: "Use host setup. You give your identity and business papers, and Vallo reviews them before you are published. If you are sent back, you edit the same application and send it again. You agree to the Terms, the Privacy Policy and the Host Agreement before you publish.",
  },
  {
    category: "Hosting",
    q: "What does Vallo charge a hotel?",
    a: `${HOTEL_COMMISSION_SENTENCE} Listing is free, and the guest pays exactly the price shown.`,
  },
  {
    category: "Hosting",
    q: "What cancellation policies can a host choose?",
    a: "Flexible, Moderate, Firm or Strict. The guest sees the terms of the one a host picks before they book, and the refund follows them.",
  },
  {
    category: "Booking a stay",
    q: "What happens at a restaurant after I book a table?",
    a: "Booking a table is free and nothing is paid in advance. The restaurant confirms it, Vallo reminds you the evening before and two hours before, and you pay your bill at the restaurant. After the time, the restaurant marks the table seated or a no-show, using your check-in code. If it does not answer, Vallo asks you the next day whether you dined. Only diners whose table was seated can review.",
  },
  {
    category: "Hosting",
    q: "What does Vallo charge a restaurant?",
    a: `Listing is free, and booking is free for diners. Vallo bills the restaurant ${SEATED_TABLE_FEE} for each table seated from a Vallo booking, once a month. A no-show or a cancelled table costs nothing.`,
  },

  // ------------------------------------------------------- verification
  {
    category: "Verification and trust",
    q: "What does the verified badge on a listing mean?",
    a: "A person at Vallo checked the ID of the lister behind it, and the listing was reviewed before it went live. Listings that fail review do not appear on Vallo.",
  },
  {
    category: "Verification and trust",
    q: "How are agents verified?",
    a: "Every agent gives their NIN or a government ID, proof of address and a bank account in their own name. A firm also gives its CAC registration. A person at Vallo reviews each application, and the verification ladder shows how far each lister has climbed.",
  },
  {
    category: "Verification and trust",
    q: "Does a badge mean a person cannot defraud me?",
    a: "No. A badge shows what Vallo has confirmed or what a person has earned. It is not a guarantee against fraud. Pay only inside Vallo, and only after you have seen the property.",
  },
  {
    category: "Verification and trust",
    q: "How do I report a suspicious listing or user?",
    a: `Use the report option on the listing, or ${SUPPORT_SENTENCE} with the listing link and what you saw. A person reads every report, and a listing can be hidden while it is looked at.`,
  },
  {
    category: "Verification and trust",
    q: "Does Vallo charge any fees?",
    a: `Not to a renter, buyer or guest. ${PRICE_IS_THE_PRICE} ${COMMISSION_FROM_SHARE} An agency or caution fee can be part of what a landlord asks for; when it is, it is named on the listing and counted into the move-in total. Anyone presenting an inspection fee, a holding fee or a platform fee as a Vallo charge is lying: report them.`,
  },
  {
    category: "Verification and trust",
    q: "Someone asked me to pay into a bank account. What do I do?",
    a: "Stop, and report them. Nobody at Vallo, and no lister or host, will give you an account number to pay into: every payment for a deal happens inside Vallo. Report it from the listing or the contact form, with the account number and the messages. Reports about paying outside Vallo are answered within four hours.",
  },
  {
    category: "Verification and trust",
    q: "Why shouldn't I share an account number in chat?",
    a: "Because it is the commonest way people are cheated. Messages that look like account numbers are flagged to the Vallo team. Pay only through Vallo, never into an account someone sends you.",
  },
  {
    category: "Verification and trust",
    q: "What if I have already sent money outside the platform?",
    a: "Call your bank first and ask them to raise a dispute on the transfer; a fast report can let them hold the money in the receiving account. Then report it to Vallo with the listing link, the account details and the messages. Payments made outside Vallo are not covered and Vallo cannot recover them, but it can remove the account and stop the same person reaching anybody else.",
  },

  // ------------------------------------------------------------- around
  {
    category: "Around",
    q: "What is Around?",
    a: "Around is the part of Vallo for places. Join your local government, your estate or your campus, and read what people there are saying today: whether there is light, whether the road is open, whether the tanker came. Reading needs no account; posting needs one. A listing published in a place is announced there once.",
  },
  {
    category: "Around",
    q: "What are the rules for posts, comments and messages?",
    a: `${EULA_ZERO_TOLERANCE} That covers posts, comments, stories, profiles, listings and private messages. A post or profile that carries an account number or a request for payment is held until a person reads it. Report anything from its menu, and block or mute anyone. The person you report is never told who reported them.`,
  },

  // ------------------------------------------------- account and data
  {
    category: "Your account and data",
    q: "How old do I have to be to use Vallo?",
    a: "You must be 18 or over to make an account, book, pay, post or list. You confirm your age when you sign up. Browsing needs no account.",
  },
  {
    category: "Your account and data",
    q: "How do I delete my account?",
    a: `Go to Settings, then Account, then Delete account. Confirm it is you and type ${DELETE_CONFIRM_PHRASE}. You are signed out everywhere at once, and nothing is destroyed for ${GRACE_WINDOW_DAYS} days: the code we email you stops it. After that your profile, posts, saved places and uploaded files are destroyed. Records of money that moved are kept for at least five years with your name, email and phone number removed, because Nigerian anti-money-laundering law requires it. A booking or a listing still open has to be finished, cancelled or unpublished first, and the screen tells you which.`,
  },
  {
    category: "Your account and data",
    q: "What does Vallo keep about me, and can I get a copy?",
    a: "Only what the platform needs to work: your account, what you list, book, post and send, payment references, and, if you list or host, your ID and payout account. Download a copy yourself from Settings, under Privacy. To correct something, or to object to how it is used, write through the contact form with Privacy as the subject. If the answer does not satisfy you, you can complain to the Nigeria Data Protection Commission. The Privacy Policy says what is kept and for how long.",
  },
  {
    category: "Your account and data",
    q: "Can I appeal a decision Vallo made?",
    a: `Yes. If a post or a listing was taken down, an application refused or your account stopped, reply to the notice or write through the contact form with what happened and why you think the decision was wrong. A person who did not make the first decision reads it. Appeals are answered ${RESPONSE_COMMITMENTS.routine.label.toLowerCase()}.`,
  },
  {
    category: "Your account and data",
    q: "How do I contact Vallo?",
    a: `Use the contact form at vallospaces.com/contact, or the support chat in the app. A person replies within one business day, and a report about paying outside Vallo ${RESPONSE_COMMITMENTS.urgent.label.toLowerCase()}. Vallo is run by ${COMPANY_FORMAL_NAME}, whose registered office is ${COMPANY_REGISTERED_OFFICE}.`,
  },

  // ------------------------------------------------------ using the app
  {
    category: "Using the app",
    q: "Is there a Vallo app?",
    a: "Vallo works in any web browser at vallospaces.com. It also comes as an app for Android phones and iPhones, published through Google Play and the App Store; when a store link shows on the Vallo home page, the app is live in that store. The app opens the same Vallo, with the same account.",
  },
  {
    category: "Using the app",
    q: "What is the round button at the end of the dock?",
    a: "It opens a tray with the places you reach most: messages, plans, saved, the assistant, agreements, Price Check, settings and help. Everything in it is also in the menu.",
  },
  {
    category: "Using the app",
    q: "Can I switch between light and dark?",
    a: "Yes. Under Settings, then Appearance, then Theme, choose Light, Dark or System. System follows your phone or computer. The choice is kept on this device.",
  },
  {
    category: "Using the app",
    q: "Can I make the app move less?",
    a: "Yes. Under Settings, then Appearance, then Motion, choose Cinematic, Standard, Calm or Off. Calm keeps short fades only, and Off stops movement altogether. If your phone asks for less motion, Vallo follows it.",
  },
  {
    category: "Using the app",
    q: "What is Price Check?",
    a: "It tells you what similar properties near a place are advertised for on Vallo, from the listings published there, and how sure that answer is. With too few nearby listings it says so rather than guessing. It is not what anybody has paid, and it is not advice.",
  },
  {
    category: "Using the app",
    q: "What can the AI assistant do, and what will it not do?",
    a: "It searches the same listings you do, compares a few side by side, explains what moving in really costs, tells you what residents have written about an area, and points you to the right screen, in English, Yorùbá, Hausa or Igbo. It never acts without your approval: it cannot book, pay or send a message for you. It never invents a listing or a price, never says a land title is good, and never suggests paying outside Vallo.",
  },

  // ---------------------------------------------------------- languages
  {
    category: "Languages and accessibility",
    q: "Which languages does Vallo work in?",
    a: "English, Yorùbá, Hausa and Igbo. Switch language at any time from the switcher in the header or in Settings, and your choice is remembered on your device.",
  },
  {
    category: "Languages and accessibility",
    q: "Can I get support in my own language?",
    a: "Yes. Write to support in English, Yorùbá, Hausa or Igbo and you will get a reply in the language you used.",
  },
];

/**
 * The five questions the support home shows before anybody types.
 *
 * Chosen by hand for what people arrive worried about: whether we hold their
 * money, how refunds work, the bank-transfer scam, the inspection charge that
 * is not ours, and how a stay is booked. Each is the exact `q` of an entry in
 * FAQS, so the answer is the help centre's own word; `popularArticles` drops a
 * question that no longer matches rather than inventing an answer for it.
 */
export const POPULAR_QUESTIONS: readonly string[] = [
  "Does Vallo hold my money?",
  "How do refunds work?",
  "Someone asked me to pay into a bank account. What do I do?",
  "Do I pay to inspect a property?",
  "How do I book a stay on Vallo?",
];
