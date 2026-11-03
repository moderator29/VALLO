/**
 * The welcome email: the first thing Vallo ever sends somebody unprompted.
 *
 * WHAT IT IS FOR. Every other message in the catalogue answers something the
 * reader did: a booking, a payment, a code they asked for. This one answers
 * nothing. It arrives because a person confirmed their address, and it is the
 * first time Vallo speaks to them in their inbox, so it is written as a door
 * opening rather than a receipt: their name, what Vallo is in one sentence
 * worth reading, the two sides of the account, three first steps in their own
 * terms, and one lit button that takes them to `/welcome`, the first run
 * screen, whose "Two worlds. One platform." this message echoes.
 *
 * WHY IT HAS ITS OWN DOCUMENT RATHER THAN `compose`. The shared shell in
 * `render.ts` renders a closed set of blocks, which is right for a receipt and
 * too plain for this. The welcome needs the two world tiles, numbered step
 * plates, a lit button with a bright top edge and a bloom, and mobile stacking.
 * It is built INSIDE the same document as every other message
 * (`documentHtml` in `render.ts`: the lockup and the slogan, the white card, the
 * footer with the support and legal links, the one style block with the dark
 * scheme) from the same palette (`theme.ts`), so it is visibly the same
 * family, and it satisfies every structural rule `shell.test.ts` holds the
 * whole catalogue to: tables only, one style block that nothing depends on,
 * every ground painted, the lockup plus the one 3D object every message
 * carries above its headline (`icons.ts`), a hidden inbox line, 600px
 * and fluid.
 *
 * WHO SENDS IT. Not this file. `lib/notify/welcome.ts` (`welcomeOnce`) sends
 * it once, on confirmation, guarded by `profiles.welcomed_at`, and picks the
 * version from `profiles.signup_role`. This file is the design and the
 * words.
 *
 * THE WORDS NEVER CLAIM WHAT NOBODY CAN STAND BEHIND. No counts, no promise
 * about what the platform holds, nothing insured or guaranteed, nothing
 * verified that is not. Every first step resolves to a route that exists, and
 * `welcome-message.test.ts` checks each one against the app directory.
 */

import type { EmailMessage } from "./messages";
import {
  appUrl,
  buttonHtml,
  clip,
  documentHtml,
  escapeHtml,
  footerLinksText,
  footerRows,
  bannerRowHtml,
  socialLinksText,
  greetingName,
  hello,
  heroMarkHtml,
  paintExplicit,
  PREHEADER_MAX,
  siteUrl,
  SUBJECT_MAX,
} from "./render";
import { EMAIL_SHOWS_OBJECT, type EmailKind } from "./icons";
import { FONT_SANS, LEGAL_LINE, LIGHT, LINK, SIGN_OFF } from "./theme";

/**
 * What somebody said they came here to do.
 *
 * Mirrors `public.signup_role`. A DECLARATION and never a permission: choosing
 * "agent" here does not make anybody an agent, which still needs the
 * registration, the ID and a person at Vallo approving it. It decides which
 * welcome this is.
 */
export type SignupRole = "renter" | "buyer" | "landlord" | "seller" | "agent";

export type WelcomeData = {
  name?: string | null;
  /**
   * The public handle, used to greet somebody only when there is no name.
   * Optional: the send site passes the display name today.
   */
  handle?: string | null;
  /** Null when they were never asked, or skipped. That is an ordinary state. */
  role?: SignupRole | null;
};

/**
 * Every path this message may link to, and nothing else.
 *
 * Each one is a page in `apps/web/src/app`, and the test file proves it by
 * looking for the page file. Query strings are allowed on top of a path here.
 */
export const WELCOME_ROUTES = [
  "/welcome",
  "/search",
  "/stays",
  "/saved",
  "/bookings",
  "/safety",
  "/profile/setup",
  "/profile/setup/owner",
  "/verification",
  "/agent/list",
  "/settings/notifications",
  /* The shared footer's support and legal links (`FOOTER_LINKS` in render.ts). */
  "/support",
  "/legal/privacy",
  "/legal/terms",
] as const;

export type WelcomeRoute = (typeof WELCOME_ROUTES)[number];

/** Where the lit button goes: the first run screen, `/welcome`. */
export const WELCOME_LANDING: WelcomeRoute = "/welcome";

type Step = {
  title: string;
  body: string;
  link: { label: string; path: WelcomeRoute; query?: string };
};

type Version = {
  preheader: string;
  /** The one sentence that says we heard what they came for. */
  opening: string;
  steps: readonly [Step, Step, Step];
  /** The one safety sentence, in the calm panel under the button. */
  note: string;
};

/* ------------------------------------------------------------------ words */

/*
 * EVERY WORD THIS EMAIL SAYS OUTSIDE THE PER-ROLE STEPS, IN ONE OBJECT (track H,
 * 25 September 2026), so refining the welcome is editing one data structure
 * and nothing about the markup. The per-role opening, three steps and note are
 * `WELCOME_COPY.versions` further down. `/preview/email/welcome` renders every
 * version from this object on a phone-sized frame.
 */
const CHROME = {
  eyebrow: "Welcome to Vallo",
  /** The second line of the headline, under "Hello <name>." */
  headlineTwo: "Make yourself at home.",
  lede: "One account for homes and stays. Step inside to begin.",
  worlds: [
    { name: "Property", line: "Homes to rent, buy or sell." },
    { name: "Stays", line: "Hotels, shortlets and restaurant tables." },
  ],
  sectionLabel: "Where to begin",
  /** The one primary action. */
  button: "Step inside",
  /*
   * TRUE OF BOTH WAYS THE BUTTON CAN LAND. Signed in, `/welcome` shows the
   * first run (or goes on home once it has been seen). Signed out on another
   * device, it shows the same slides ending on Sign in, so all the reader needs
   * is the address this email went to.
   */
  buttonAfter: "Opening this on another device? Sign in there with this same address.",
  footerReason: "You are receiving this because you created a Vallo account with this address.",
  footerLinkLabel: "Change what Vallo emails you",
  subjectWithName: "Welcome to Vallo, {name}",
  subjectPlain: "Welcome to Vallo",
} as const;

const EYEBROW = CHROME.eyebrow;
const WHAT_VALLO_IS = CHROME.lede;
const BUTTON_LABEL = CHROME.button;
const BUTTON_AFTER = CHROME.buttonAfter;

const PAY_INSIDE =
  "One thing worth knowing from day one: nobody from Vallo will ever ask you to pay outside Vallo. If somebody does, report them from the listing.";

const LISTER_NOTE =
  "Keep your conversations and payments inside Vallo. It is the record both sides can point to if anything is ever in question.";

const FOOTER_REASON = CHROME.footerReason;
const FOOTER_LINK_LABEL = CHROME.footerLinkLabel;

const REGISTER_OWNER: Step = {
  title: "Register as an owner",
  body: "A few short screens about you and the property. A person at Vallo reads every registration before listings go up, so what people see has somebody behind it.",
  link: { label: "Register as an owner", path: "/profile/setup/owner" },
};

/*
 * EVIDENCE, because the closing audit asked and it was right to. The four
 * rungs, in this order, are `VERIFICATION_RUNGS` in `lib/trust/verification.ts`.
 * The tick on a listing is `verified: !row.is_demo && verifiedAgents.has(...)`
 * in `lib/listings/supabase-repository.ts`, fed by `agent_badges.verified`,
 * which migration 20260919230000 defines as `verification_tier >= 1`: one
 * passed identity rung. So the identity check lights the tick; the later rungs
 * do not add anything a reader of a listing sees, and the copy does not say
 * they do.
 */
const VERIFY: Step = {
  title: "Verify who you are",
  body: "Identity, then address, then your payout account, then a check in person. Once a person at Vallo has checked your identity, your listings carry the verified tick.",
  link: { label: "Start verification", path: "/verification" },
};

const SEE_IT: Step = {
  title: "Ask, then go and see it",
  body: "Message the lister from the listing and keep your questions in writing. When you are ready, request an inspection and see the place in person before any money moves.",
  link: { label: "Your plans", path: "/bookings", query: "kind=inspection&from=property" },
};

const VERSIONS: Record<SignupRole | "general", Version> = {
  renter: {
    preheader: "Your account is ready. Here is where we would start looking for somewhere to live.",
    opening: "You told us you are looking for somewhere to live. Here is where we would start.",
    steps: [
      {
        title: "Search where you want to live",
        body: "Filter by area and budget. Where a listing states its total move-in cost, sort by that rather than the rent, because the rent is rarely the whole of what it takes to move in.",
        link: { label: "Search homes to rent", path: "/search", query: "market=rent&sort=move-in-asc" },
      },
      SEE_IT,
      {
        title: "Keep what you like",
        body: "Save homes and searches as you go, so they are waiting for you when you come back.",
        link: { label: "Your saved homes", path: "/saved" },
      },
    ],
    note: PAY_INSIDE,
  },

  buyer: {
    preheader: "Your account is ready. Start with search, and read the title before the price.",
    opening: "You told us you are looking to buy. Here is where we would start, and the one thing we would want you to know first.",
    steps: [
      {
        title: "Search property for sale",
        body: "Filter by area and price, and read each listing's title before its photographs.",
        link: { label: "Browse property for sale", path: "/search", query: "market=buy" },
      },
      {
        title: "Read the title first",
        body: "Every listing for sale states the title the seller claims, or says plainly that none was given. We record the claim and we cannot verify it. Have your lawyer search it at the land registry before any money moves.",
        link: { label: "How Vallo thinks about safety", path: "/safety" },
      },
      {
        title: "See it in person",
        body: "Message the seller inside Vallo, keep every answer in writing, and inspect the property before you commit to anything.",
        link: { label: "Your plans", path: "/bookings", query: "kind=inspection&from=property" },
      },
    ],
    note: PAY_INSIDE,
  },

  landlord: {
    preheader: "Your account is ready. Here is how your property gets onto Vallo.",
    opening: "You told us you have property to let. Here is how it gets onto Vallo.",
    steps: [
      REGISTER_OWNER,
      VERIFY,
      {
        title: "Put the whole cost in",
        body: "When your listing goes up, state the total a tenant needs to move in, not only the rent. Photographs bring people to an inspection; a walkthrough video answers the questions before anybody asks them.",
        link: { label: "Open the listing form", path: "/agent/list" },
      },
    ],
    note: LISTER_NOTE,
  },

  seller: {
    preheader: "Your account is ready. Here is how your property gets onto Vallo, title first.",
    opening: "You told us you have property to sell. Here is how it gets onto Vallo, starting with the part buyers read first.",
    steps: [
      REGISTER_OWNER,
      {
        title: "State the title you hold",
        body: "Buyers read the title before the price. Name the certificate of occupancy, governor's consent or deed you hold, and have the document to hand.",
        link: { label: "Open the listing form", path: "/agent/list" },
      },
      VERIFY,
    ],
    note: LISTER_NOTE,
  },

  agent: {
    preheader: "Your account is ready. Register as an agent or a firm, then list.",
    opening: "You do this for a living, so here is the short route in.",
    steps: [
      {
        title: "Register as an agent or a firm",
        /* EVIDENCE: `agentRegistrationSchema` in `lib/supply/registration.ts`
           (name, phone, experience, agency and legal fee, ID and selfie
           uploads), and `lib/supply/registration-actions.ts`, which files a
           submitted application and creates no `agents` row: insert on
           `public.agents` is admin only, so a person approves every one. */
        body: "Tell us who you are, how long you have done this and what you charge, with your ID and a selfie if you have them to hand. A person at Vallo reads every registration before you can publish.",
        link: { label: "Choose agent or firm", path: "/profile/setup" },
      },
      VERIFY,
      {
        title: "List, and state the full cost",
        body: "Once you are approved, the listing form walks you through a property from the photographs to the total a tenant will actually pay to move in.",
        link: { label: "Open the listing form", path: "/agent/list" },
      },
    ],
    note: LISTER_NOTE,
  },

  general: {
    preheader: "Your account is ready. Two sides, one account, and three good places to begin.",
    opening: "You have not told us what brought you here, and you do not need to. Any of these is a good place to begin.",
    steps: [
      {
        title: "Look for a home",
        body: "Rent or buy, filtered by area and budget, with the full move-in cost shown wherever the lister has stated it.",
        link: { label: "Search homes", path: "/search" },
      },
      {
        title: "Find somewhere to stay",
        body: "Hotels, shortlets and restaurant tables live on the Stays side of the same account.",
        link: { label: "Open Stays", path: "/stays" },
      },
      {
        title: "Have property to let or sell",
        body: "Register as an owner, an agent or a firm. A person at Vallo reads every registration before listings go up.",
        link: { label: "Register your property", path: "/profile/setup" },
      },
    ],
    note: PAY_INSIDE,
  },
};

/* ---------------------------------------------------------------- helpers */

/** The whole of the welcome's words: the shared lines and every version. */
export const WELCOME_COPY = { ...CHROME, versions: VERSIONS } as const;

/**
 * The name to greet by: the first name, else the handle, else nobody.
 * `hello()` owns the fallback, so "Hello ," cannot happen here either.
 */
function greeting(data: WelcomeData): string {
  if (greetingName(data.name) !== null) return hello(data.name);
  const handle = (data.handle ?? "").trim().replace(/^@+/, "");
  return hello(handle.length > 0 ? handle : null);
}

/** Wrap plain text to a readable measure, with an optional hanging indent. */
function wrap(text: string, width = 72, indent = ""): string {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line.length === 0) line = word;
    else if (indent.length + line.length + 1 + word.length <= width) line += " " + word;
    else {
      lines.push(indent + line);
      line = word;
    }
  }
  if (line.length > 0) lines.push(indent + line);
  return lines.join("\n");
}

/* ------------------------------------------------------------------- html */

const TEXT = `font-family:${FONT_SANS};`;

/**
 * The welcome's own phone rules, added to the shared style block
 * (`schemeStyle` in render.ts, which carries the dark scheme). Nothing the
 * message depends on lives here: a client that drops the block still gets a
 * complete, legible, fluid message.
 */
const PHONE_STYLE = `
      @media only screen and (max-width: 480px) {
        .wm-h1    { font-size: 27px !important; }
        .wm-hero  { padding: 0 !important; }
        .wm-value { padding: 16px 16px 16px 14px !important; }
        .wm-plate { width: 36px !important; padding-right: 10px !important; }
      }`;

function litButton(label: string, url: string): string {
  return buttonHtml(label, url, { arrow: true, margin: "6px 0 0" });
}

function renderHtml(version: Version, greetingLine: string, icon: EmailKind): string {
  /* THE HERO: a quiet panel carrying the eyebrow, the greeting headline, the
     one-sentence lede and the two sides of the account as two labelled lines.
     The panel is a solid navy rung for every client and carries a brand-blue
     glow only where a gradient is honoured. */
  /* BRIEF (29 October 2026, the founder: "short, clean, mature"): the
     greeting, one line of what Vallo is, one button and one safety line. The
     three step cards, the two sides and the section label are gone; the
     person is one tap from the app, where those live. */
  const hero = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 22px;">
                  <tr>
                    <td class="wm-hero" style="padding:0;">
                      <p class="rm-link" style="margin:0 0 10px;${TEXT}font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${LINK};">${escapeHtml(EYEBROW)}</p>
                      <h1 class="wm-h1" style="margin:0 0 12px;${TEXT}font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.025em;color:${LIGHT.text};"><span class="rm-title" style="color:${LIGHT.text};">${escapeHtml(greetingLine)}</span></h1>
                      <p class="rm-body" style="margin:0;${TEXT}font-size:16px;line-height:1.6;color:${LIGHT.body};">${escapeHtml(WHAT_VALLO_IS)}</p>
                    </td>
                  </tr>
                </table>`;

  return documentHtml({
    title: "Welcome to Vallo",
    preheader: version.preheader,
    htmlAttrs: ' xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"',
    headExtra:
      "\n    <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->",
    extraStyle: PHONE_STYLE,
    card: `${EMAIL_SHOWS_OBJECT ? heroMarkHtml(icon) : bannerRowHtml("welcome-2")}
                ${hero}
                ${litButton(BUTTON_LABEL, appUrl(WELCOME_LANDING))}
                <p class="rm-muted" style="margin:14px 0 30px;${TEXT}font-size:13px;line-height:1.6;color:${LIGHT.muted};">${escapeHtml(BUTTON_AFTER)}</p>
                <!-- The calm panel: one safety sentence and a small round glyph. -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
                  <tr>
                    <td class="rm-panel" bgcolor="${LIGHT.panel}" style="background:${LIGHT.panel};border:1px solid ${LIGHT.edge};border-radius:14px;padding:14px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;"><tr>
                        <td width="34" valign="top" style="width:34px;vertical-align:top;padding-top:1px;">
                          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                            <td class="rm-link" align="center" width="22" height="22" style="width:22px;height:22px;border:1px solid ${LINK};border-radius:11px;${TEXT}font-size:13px;line-height:22px;font-weight:700;text-align:center;color:${LINK};mso-line-height-rule:exactly;">i</td>
                          </tr></table>
                        </td>
                        <td valign="top" class="rm-body" style="vertical-align:top;${TEXT}font-size:14px;line-height:1.6;color:${LIGHT.body};">${escapeHtml(version.note)}</td>
                      </tr></table>
                    </td>
                  </tr>
                </table>`,
    footer: footerRows([FOOTER_REASON], {
      label: FOOTER_LINK_LABEL,
      href: appUrl("/settings/notifications"),
    }),
  });
}


/* ------------------------------------------------------------------- text */

function renderText(version: Version, greetingLine: string): string {
  return (
    [
      "Vallo",
      "",
      EYEBROW,
      "-".repeat(EYEBROW.length),
      "",
      greetingLine,
      "",
      wrap(WHAT_VALLO_IS),
      "",
      `${BUTTON_LABEL}:`,
      appUrl(WELCOME_LANDING),
      wrap(BUTTON_AFTER),
      "",
      wrap(version.note),
      "",
      wrap(FOOTER_REASON),
      `${FOOTER_LINK_LABEL}: ${appUrl("/settings/notifications")}`,
      "",
      ...(socialLinksText() ? [socialLinksText(), ""] : []),
      footerLinksText({ skipSettings: true }),
      "",
      SIGN_OFF,
      LEGAL_LINE,
      siteUrl(),
    ].join("\n") + "\n"
  );
}

/* ----------------------------------------------------------------- public */

/**
 * The welcome, in six versions: five declared roles and the general one.
 *
 * The general version is not a lesser one. It is the honest answer when
 * nothing was declared, and it names both sides rather than guessing.
 */
export function welcome(data: WelcomeData): EmailMessage {
  const version = VERSIONS[data.role ?? "general"] ?? VERSIONS.general;
  const hi = greeting(data);
  const first =
    greetingName(data.name) ?? greetingName((data.handle ?? "").trim().replace(/^@+/, ""));
  const subject = first ? CHROME.subjectWithName.replace("{name}", first) : CHROME.subjectPlain;
  return {
    /* A forty-character first name would push the subject past what a phone
       shows; the plain welcome is the honest fallback, never a cut name. */
    subject: subject.length <= SUBJECT_MAX ? subject : CHROME.subjectPlain,
    preheader: clip(version.preheader, PREHEADER_MAX),
    html: paintExplicit(renderHtml(version, hi, data.role ? `welcome:${data.role}` : "welcome:unstated")),
    text: renderText(version, hi),
  };
}
