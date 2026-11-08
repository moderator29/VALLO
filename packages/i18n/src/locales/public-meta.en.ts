/**
 * THE TITLES AND DESCRIPTIONS OF THE PUBLIC PAGES (recommendation A10).
 *
 * These were English literals in each page's `export const metadata`, which
 * cannot read the visitor's language: `/ha/about` would have shown a Hausa
 * page under an English tab title and an English search snippet. Each page now
 * asks `publicPageMetadata(key)` (`apps/web/src/lib/i18n/public-metadata.ts`),
 * which reads these in the page's language. The words are the pages' own,
 * moved here unchanged.
 */
export const publicMetaEn = {
  /** The site's own title and description: the landing page and the default. */
  site: {
    title: "Vallo. Space, without the runaround.",
    description:
      "Homes, land, hotels and shortlets across Nigeria. See what you will actually pay before you call anybody, know who is behind every listing, and keep the record. Vallo Stays carries hotels, apartments, guest houses, resorts and restaurant tables on the same account and the same inbox.",
    shareDescription:
      "Homes, land, hotels and shortlets across Nigeria, with the cost of moving in written down before you call anybody. Hotels, apartments and restaurant tables on Vallo Stays. One account, one inbox.",
  },
  pages: {
    about: {
      title: "About",
      description:
        "Vallo is one app with two sides: Property for renting, buying and selling, and Vallo Stays for hotels, apartments, guest houses, resorts and restaurant tables. Homes, land, hotels and shortlets across Nigeria, one account, one inbox, four languages.",
    },
    help: {
      title: "Help centre",
      description:
        "Answers about both sides of Vallo: the switch between Property and Stays, booking a stay, holding a table, payments after inspection, refunds, listing, verification and languages.",
    },
    terms: {
      title: "Terms of service",
      description:
        "The rules for using Vallo: accounts, payments, refunds, what a verified badge means, listing a property, agreements and approval, the Vallo Guarantee and acceptable use.",
    },
    privacy: {
      title: "Privacy policy",
      description:
        "How Vallo collects, uses, protects and shares personal data, and your rights under the Nigeria Data Protection Act 2023.",
    },
    eula: {
      title: "Community rules",
      description:
        "What you may post on Vallo and how you may behave towards other people here: no tolerance for abuse, a report control on every surface, blocking, and a twenty four hour commitment on every report.",
    },
    disclaimer: {
      title: "Disclaimer",
      description:
        "Anything arranged, discussed or paid outside Vallo is not Vallo's responsibility. Vallo never holds your money, charges no inspection fee, and is a marketplace rather than a party to your deal.",
    },
    cancellations: {
      title: "Cancellation policy",
      description:
        "How cancelling works on Vallo: a listed stay follows the platform schedule, everything back until 72 hours before check-in, half back inside that window, nothing back once check-in day starts, fixed on the booking when it is paid. A hotel room shows its own rate's terms. A restaurant table is free to cancel and a tenancy is settled in its own agreement.",
    },
    standards: {
      title: "Trust and safety standards",
      description:
        "What is not allowed on Vallo on either side, property or stays, how we enforce it, how long we take to answer a report, and how to appeal a decision.",
    },
    safety: {
      title: "Safety centre",
      description:
        "How payments work on both sides of Vallo, how a stay is paid for against how a tenancy is, how inspections work, what we will never ask you for, and how to report someone who asks you to pay outside the platform.",
    },
    careers: {
      title: "Careers",
      description:
        "Help build Nigeria's property marketplace and the stays side beside it. How we work at Vallo, and how to send a speculative application.",
    },
    contact: {
      title: "Contact",
      description:
        "Reach the Vallo support team about a property, a stay, a table, a payment or a listing. Send us a message and somebody reads it.",
    },
    deleteAccount: {
      title: "Delete your account",
      description:
        "How to delete your Vallo account, what is destroyed, what is kept for the period Nigerian law requires, how long it takes, and how to stop a deletion you have already started.",
    },
    docs: {
      title: "Documentation",
      description:
        "The full Vallo documentation, both sides: property search and its power and water filters, the stays journey from dated search to Plans, holding a restaurant table, money and agreements, Around, the agent workspace, trust and safety, and your rights under the NDPA.",
    },
    receiptCheck: {
      title: "Check a receipt",
      description: "Type the code on a Vallo receipt to see whether it is genuine. No account needed.",
    },
    signIn: { title: "Sign in" },
    signUp: { title: "Create your account" },
    forgotPassword: { title: "Reset your password" },
    resetPassword: { title: "Choose a new password" },
    community: {
      title: "Community promise",
      description:
        "What Vallo promises to every person on the platform: honest listings, safe viewings, money held safely, a respectful community, and what we ask of you in return.",
    },
  },
};

export type PublicPageKey = keyof typeof publicMetaEn.pages;
