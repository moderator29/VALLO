import { FULL_REFUND_HOURS } from "@/lib/trust/cancellation";
import { FEE_RULES } from "@/lib/trust/fee-rules";
import { NO_INSPECTION_FEE, PAYMENT_GATE_SENTENCE, REFUND_ROUTE } from "@/lib/money/copy";
import { HOTEL_ROOM_BY_CARD, PAY_INSIDE_VALLO, PRICE_IS_THE_PRICE, STAYS_PAID_BY_CARD } from "@/app/(site)/docs/facts";
import { bpsLabel } from "@/lib/site/move-in-calculator";
import type { GuideSlug } from "./slugs";

/**
 * A14. GUIDES THAT RANK WHILE THE CATALOGUE IS CLOSED.
 *
 * Plain, evergreen answers to what people search before they pay for a home
 * or a stay in Nigeria. THE RULES THEY ARE WRITTEN TO:
 *
 *   No statistic. Nothing here counts scams, prices or people, because the
 *   platform has no such figure it can stand behind.
 *   No law stated as settled beyond what the codebase already cites with a
 *   source (`lib/trust/fee-rules.ts`), and that one is flagged for a lawyer.
 *   Every sentence about Vallo is read from the module that enforces it:
 *   money from `lib/money/copy.ts`, refunds from `lib/trust/cancellation.ts`.
 *   Every guide carries the date it was last reviewed, and the claims lint
 *   reads this file like any other.
 *
 * English only for now: the page says so in the reader's language, and the
 * article is marked `lang="en"` so a screen reader pronounces it correctly.
 */

/**
 * A block of a guide: a paragraph, a list, a pull-quote or a callout.
 *
 *   quote    a sentence LIFTED FROM THIS GUIDE'S OWN PARAGRAPHS, set large
 *            (the test refuses a quote the guide does not already say, so a
 *            pull-quote can never be a new claim);
 *   callout  a short aside on a tinted card: `vallo` for what the product
 *            itself does, `rule` for a published rule with its caveat, `warn`
 *            for a step that must not be skipped.
 */
export type GuideBlock =
  | string
  | { list: string[] }
  | { quote: string }
  | { callout: string; title: string; tone: "vallo" | "rule" | "warn" };

/** Every sentence a block prints, for the word count, the claims lint and the quote check. */
export function blockText(block: GuideBlock): string[] {
  if (typeof block === "string") return [block];
  if ("list" in block) return block.list;
  if ("quote" in block) return [block.quote];
  return [block.title, block.callout];
}

export type GuideSection = { id: string; title: string; blocks: GuideBlock[] };

export type Guide = {
  slug: GuideSlug;
  title: string;
  description: string;
  /** ISO date the guide was first published. */
  published: string;
  /** ISO date a person last read it against the product and the sources. */
  reviewed: string;
  /** A rough reading time, from the word count. */
  sections: GuideSection[];
  /** Where each outside fact comes from, named so a reader can look it up. */
  sources: string[];
  /** Where the guide sends the reader next. */
  next: { href: string; label: string };
};

const LAGOS = FEE_RULES.find((rule) => rule.stateCode === "LA");
const LAGOS_RULE = LAGOS
  ? `Vallo prints one published rule beside Lagos listings: an agency fee of at most ${bpsLabel(LAGOS.agencyMaxBps)} of a year's rent and a legal fee of at most ${bpsLabel(LAGOS.legalMaxBps)}, from the ${LAGOS.stateName} ${LAGOS.source}. Vallo does not cap anybody's fee; it prints the listing's own fees beside the rule so you can compare. Laws are amended, so ask a lawyer before you rely on any figure in a dispute.`
  : "";

const REVIEWED = "2026-10-13";

export const GUIDES: readonly Guide[] = [
  {
    slug: "avoiding-rental-scams",
    title: "How to avoid rental scams in Nigeria",
    description:
      "The patterns behind most rental and shortlet scams, the questions that expose them, and how to check an agent before you pay anybody.",
    published: REVIEWED,
    reviewed: REVIEWED,
    sections: [
      {
        id: "pattern",
        title: "The pattern is almost always the same",
        blocks: [
          "Most rental scams share one shape: a place that looks better than its price, somebody who is in a hurry, and a request for money before you have seen the inside of the property. The money is usually asked for as an inspection fee, a form fee or a deposit to hold the place, sent by transfer to a personal account.",
          "Once the transfer is made there is usually no record that ties the person to the property, and no way to get the money back. So the most useful habit is simple: do not send money for a home you have not seen, to a person you cannot identify.",
          { quote: "Do not send money for a home you have not seen, to a person you cannot identify." },
        ],
      },
      {
        id: "signs",
        title: "Signs to stop and ask questions",
        blocks: [
          {
            list: [
              "You are asked to pay before you inspect, or to pay to inspect.",
              "The person says they are abroad, at a funeral, or otherwise unable to show you the place, but will send the keys once you pay.",
              "The account name on the transfer details is not the name of the person you are talking to, or not a company.",
              "You are pushed to decide today because \"many people are interested\".",
              "The photographs look like a hotel or a magazine, or you find the same photographs on another advert with a different phone number.",
              "The move-in amount changes each time you ask, or new fees appear after you agree.",
            ],
          },
        ],
      },
      {
        id: "check-agent",
        title: "Check the agent before you pay",
        blocks: [
          "Ask for the agent's full name, their company if they have one, and their Vallo code if they are on Vallo. A Vallo code starts with VA-.",
          "On vallospaces.com/check anybody can paste a phone number or a Vallo code and see whether it belongs to an agent registered with Vallo, with no account. If it does, you see the agent's public name, never their number. If it does not, you are told plainly. A code proves only that the code exists, so message the agent on Vallo to be sure you are talking to the owner of that code.",
          "A \"no match\" is not proof that somebody is a criminal, and a match is not a promise about a deal. It is one more fact you did not have before.",
        ],
      },
      {
        id: "inspect",
        title: "Inspect, in daylight, before any money moves",
        blocks: [
          "For a rental, view the property in person or on a live video call before you pay anything. Go in daylight, bring somebody with you if you can, and look at the water, the light, the road and the gate. Ask to see the room you will actually rent, not a show flat.",
          {
            tone: "vallo",
            title: "On Vallo",
            callout: `${NO_INSPECTION_FEE} If somebody asks you for an inspection fee on a property listed on Vallo, that is a private arrangement with them, and you can report it.`,
          },
        ],
      },
      {
        id: "pay",
        title: "Pay in a way that leaves a record",
        blocks: [
          "Whatever platform you use, pay in a way that leaves a record with the property and the other person's real name on it, and keep every message. Cash handed over at an inspection leaves nothing to trace.",
          {
            tone: "vallo",
            title: "On Vallo",
            callout: `${PAY_INSIDE_VALLO} ${PAYMENT_GATE_SENTENCE} A Vallo receipt carries a code that anybody can look up at vallospaces.com/r.`,
          },
        ],
      },
      {
        id: "shortlets",
        title: "Shortlets and hotels",
        blocks: [
          "A stay is the other way round from a rental: you usually cannot inspect a room in another city before you book, so you pay first. That makes the cancellation terms and the way you pay more important. Read the cancellation terms before you pay, and never pay for a stay by transfer to a personal account because a host offers a discount for it.",
        ],
      },
      {
        id: "if-it-happened",
        title: "If it has already happened",
        blocks: [
          {
            tone: "warn",
            title: "Act the same day",
            callout: "Contact your bank at once and ask them to flag the transfer. The sooner you ask, the more they can try.",
          },
          "Keep every message, number, account name and receipt. You can report the matter to the police, and if the person advertised on Vallo, report them to Vallo from the listing or the contact page so the account can be looked at.",
        ],
      },
    ],
    sources: ["Vallo's own agent check (vallospaces.com/check) and receipt check (vallospaces.com/r)."],
    next: { href: "/check", label: "Check an agent now" },
  },

  {
    slug: "what-a-move-in-total-includes",
    title: "What a move-in total includes",
    description:
      "Rent, caution deposit, service charge, agency fee, legal fee and agreement fee: what each line means, who it goes to, and how to add them up before you pay.",
    published: REVIEWED,
    reviewed: REVIEWED,
    sections: [
      {
        id: "why",
        title: "Why the rent is not the price",
        blocks: [
          "In most Nigerian cities the rent is only part of what you pay to move in. On top of it come fees for the agent and the lawyer, a refundable deposit, and often a service charge. Together they can add a large share to the first payment, and landlords often want more than one year of rent at the start.",
          "The move-in total is the whole amount you have to find before you get the keys. Knowing it before you inspect saves you from travelling to a place you cannot afford.",
          { quote: "The move-in total is the whole amount you have to find before you get the keys." },
        ],
      },
      {
        id: "lines",
        title: "The lines, one by one",
        blocks: [
          {
            list: [
              "Rent: the amount for the period of the tenancy, usually a year in Lagos and Abuja. If the landlord asks for two years up front, the first payment includes two years of rent.",
              "Caution deposit: money held against damage or unpaid bills and meant to come back when you leave, less anything properly deducted. Ask in writing how and when it is returned.",
              "Service charge: the cost of shared services such as security staff, cleaning of common areas, a generator or water. Ask what it covers and how often it is charged.",
              "Agency fee: what the agent charges for finding the tenant. It is usually a share of one year's rent.",
              "Legal fee: what the lawyer charges for preparing the tenancy agreement. Also usually a share of one year's rent.",
              "Agreement fee: a separate charge some listings add for drawing up or stamping the agreement. Ask what it pays for if it appears beside a legal fee.",
            ],
          },
        ],
      },
      {
        id: "lagos-rule",
        title: "Is there a limit on the fees?",
        blocks: [
          LAGOS_RULE
            ? { tone: "rule", title: "The published rule in Lagos", callout: LAGOS_RULE }
            : "Vallo does not cap anybody's fee. It prints the fees each listing states so you can compare them.",
          "For other states Vallo prints no rule, because it has none it can cite. Fees are agreed between you and the agent or landlord, so ask for every figure in writing before you pay.",
        ],
      },
      {
        id: "add-up",
        title: "How to add it up",
        blocks: [
          "Add one period of rent to every fee and the deposit, then add the rent for each further year the landlord wants up front. The move-in calculator at vallospaces.com/move-in-cost does exactly this with the figures you type. It prints nothing as typical; the only rule it offers is the one above, labelled as a maximum.",
          {
            tone: "vallo",
            title: "On Vallo",
            callout:
              "The lister states the move-in total themselves. Where they did not, the listing shows the sum of the parts they named and says it is a sum, not a quote.",
          },
        ],
      },
      {
        id: "questions",
        title: "Questions to ask before you pay",
        blocks: [
          {
            list: [
              "Is this the whole amount, or will anything else be asked for at signing?",
              "How many years of rent do you want at the start?",
              "When and how is the caution deposit returned?",
              "What does the service charge cover, and when is it next due?",
              "Who receives each payment, and will I get a receipt for each one?",
            ],
          },
        ],
      },
    ],
    sources: LAGOS ? [`${LAGOS.stateName} ${LAGOS.source}, as cited in Vallo's published fee rules. Confirm with a lawyer.`] : [],
    next: { href: "/move-in-cost", label: "Work out a move-in total" },
  },

  {
    slug: "renting-in-lagos",
    title: "Renting in Lagos: a plain guide",
    description:
      "How renting a home in Lagos usually works, from searching and inspecting to fees, agreements and paying, with the questions worth asking at each step.",
    published: REVIEWED,
    reviewed: REVIEWED,
    sections: [
      {
        id: "how",
        title: "How it usually works",
        blocks: [
          "Most homes in Lagos are let through agents, though some landlords let their own property. The usual order is: you find a place, you inspect it, you agree the terms, you pay the move-in total, and you sign a tenancy agreement before you get the keys.",
          "Rent is usually quoted per year, and many landlords ask for one or two years at the start. Fees for the agent and the lawyer, a caution deposit and a service charge are commonly added on top. Ask for the move-in total, not just the rent.",
          { quote: "Ask for the move-in total, not just the rent." },
        ],
      },
      {
        id: "area",
        title: "Choosing an area",
        blocks: [
          "Lagos is large and the journey often matters as much as the house. Before you inspect, try the trip to work or school at the hour you would really make it. Ask neighbours about water, power, flooding in the rainy season and the road to the house.",
          "Prices differ a great deal from one area to the next and from one street to the next, so compare several places in the same area before you decide.",
        ],
      },
      {
        id: "inspect",
        title: "Inspecting",
        blocks: [
          "Inspect every place before you pay anything. Test the taps, the switches and the sockets, look at the ceilings for water marks, and check whether the meter is prepaid and whose name it is in. Ask who you will call when something breaks.",
          {
            tone: "vallo",
            title: "On Vallo",
            callout: `${NO_INSPECTION_FEE} The inspection report is eight items with photographs, and it becomes the record of what the place was like when you moved in.`,
          },
        ],
      },
      {
        id: "fees",
        title: "Fees and the published rule",
        blocks: [
          LAGOS_RULE
            ? { tone: "rule", title: "The published rule in Lagos", callout: LAGOS_RULE }
            : "Vallo does not cap anybody's fee. It prints the fees each listing states so you can compare them.",
        ],
      },
      {
        id: "agreement",
        title: "The agreement",
        blocks: [
          "Read the tenancy agreement before you pay. It should name the landlord, the tenant, the property, the rent, the period, what each fee was for, how the caution deposit is returned, who repairs what, and how either side can end the tenancy. If something you were promised is not in it, ask for it to be added.",
          {
            tone: "vallo",
            title: "On Vallo",
            callout: `The agreement is drawn up from the listing's own figures and the inspection report. ${PAYMENT_GATE_SENTENCE}`,
          },
        ],
      },
      {
        id: "paying",
        title: "Paying",
        blocks: [
          "Pay in a way that leaves a record with the property and the other person's name on it, and get a receipt for every payment. Before you pay anybody you met online, check who they are: see the guide on avoiding rental scams.",
        ],
      },
    ],
    sources: LAGOS ? [`${LAGOS.stateName} ${LAGOS.source}, as cited in Vallo's published fee rules. Confirm with a lawyer.`] : [],
    next: { href: "/guides/avoiding-rental-scams", label: "Read: how to avoid rental scams" },
  },

  {
    slug: "renting-in-abuja",
    title: "Renting in Abuja: a plain guide",
    description:
      "How renting a home in Abuja usually works, what the move-in total is made of, and what to ask before you pay an agent or a landlord.",
    published: REVIEWED,
    reviewed: REVIEWED,
    sections: [
      {
        id: "how",
        title: "How it usually works",
        blocks: [
          "Renting in Abuja follows the same broad order as elsewhere in Nigeria: find a place, inspect it, agree the terms, pay the move-in total and sign a tenancy agreement. Rent is usually quoted per year, and landlords often ask for one or more years at the start.",
          "Many estates charge a service charge for security, waste, water or a shared generator, and it can be a large part of the yearly cost. Ask for the figure and what it covers before you inspect.",
          { quote: "Ask for the figure and what it covers before you inspect." },
        ],
      },
      {
        id: "area",
        title: "Choosing an area",
        blocks: [
          "Abuja's districts and the satellite towns around them differ a great deal in price and in the daily journey. Visit at the time of day you would travel, and ask about water supply, power, the state of the estate road and how the estate is run.",
        ],
      },
      {
        id: "fees",
        title: "Fees",
        blocks: [
          "Vallo prints no fee rule for the Federal Capital Territory, because it has none it can cite with a source. Agency and legal fees are agreed between you and the agent or landlord, so ask for every figure in writing and add them up before you pay. The move-in calculator at vallospaces.com/move-in-cost adds up whatever you were quoted.",
        ],
      },
      {
        id: "inspect",
        title: "Inspecting",
        blocks: [
          "Inspect before you pay anything. Look at the water system, the meter and whose name it is in, the ceilings, the windows and the doors, and ask who handles repairs.",
          { tone: "vallo", title: "On Vallo", callout: NO_INSPECTION_FEE },
        ],
      },
      {
        id: "agreement",
        title: "The agreement and paying",
        blocks: [
          "Read the tenancy agreement before you pay: the parties, the property, the rent, the period, each fee, how the caution deposit is returned and who repairs what. Pay in a way that leaves a record, get a receipt for every payment, and check who you are dealing with before you send any money.",
          { tone: "vallo", title: "On Vallo", callout: PAYMENT_GATE_SENTENCE },
        ],
      },
    ],
    sources: [],
    next: { href: "/guides/what-a-move-in-total-includes", label: "Read: what a move-in total includes" },
  },

  {
    slug: "how-stays-work-on-vallo",
    title: "How stays work on Vallo",
    description:
      "Booking a hotel room, a shortlet or a restaurant table on Vallo: how you pay, how cancellation refunds work, and what to do if the place is not what was listed.",
    published: REVIEWED,
    reviewed: REVIEWED,
    sections: [
      {
        id: "what",
        title: "What you can book",
        blocks: [
          "Vallo Stays carries hotels, shortlet apartments and guest houses by the night, and restaurant tables by reservation, on the same account you use for renting.",
        ],
      },
      {
        id: "booking",
        title: "Booking and paying",
        blocks: [
          `You choose your dates and see the full price before you book. ${PRICE_IS_THE_PRICE} ${HOTEL_ROOM_BY_CARD} A shortlet host may accept each request themselves. ${STAYS_PAID_BY_CARD} You pay on Vallo, never by transfer to a host's own account.`,
          { quote: "Either way you pay on Vallo, never by transfer to a host's own account." },
          "A restaurant table is a request, not a payment: you ask for a date, a time and a party size, the restaurant answers, and you pay the restaurant when you eat.",
        ],
      },
      {
        id: "cancel",
        title: "Cancelling",
        blocks: [
          `Every stay shows its cancellation policy before you pay, and the refund follows the policy on your booking. Hotels, shortlets and serviced apartments run as a business pick Flexible, Moderate, Firm or Strict. A stay listed by an owner or agent follows the standard schedule: cancel more than ${FULL_REFUND_HOURS} hours before check-in and everything comes back, inside that half comes back, and once check-in day has started the stay is the host's.`,
          REFUND_ROUTE,
        ],
      },
      {
        id: "problem",
        title: "If the place is not what was listed",
        blocks: [
          "If you could not get in, or the place was not what was listed, do not cancel: report it from the booking, and a person at Vallo looks at it.",
          { tone: "vallo", title: "On Vallo", callout: "When you arrive, your booking asks whether the place is as listed. Answer no, with a reason and a photo, and a person at Vallo looks at it. A place that was not as listed is refunded in full." },
        ],
      },
      {
        id: "tips",
        title: "Before you travel",
        blocks: [
          {
            list: [
              "Read the house rules and the check-in time, and message the host on Vallo if anything is unclear.",
              "Keep every message on Vallo; it is the record if anything goes wrong.",
              "If a host offers a discount for paying outside Vallo, decline and report it.",
            ],
          },
        ],
      },
    ],
    sources: [],
    next: { href: "/sign-up", label: "Create your account to book a stay" },
  },
];

export function guideBySlug(slug: string): Guide | null {
  return GUIDES.find((guide) => guide.slug === slug) ?? null;
}

/** Words in a guide, for the reading time. */
export function guideWords(guide: Guide): number {
  const text = guide.sections
    /* A pull-quote repeats a sentence already counted, so it is left out. */
    .flatMap((section) => [section.title, ...section.blocks.filter((block) => !(typeof block === "object" && "quote" in block)).flatMap(blockText)])
    .join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

/** Minutes at a steady 200 words a minute, never less than one. */
export function readingMinutes(guide: Guide): number {
  return Math.max(1, Math.round(guideWords(guide) / 200));
}
