/**
 * The platform newsletter: Vallo's first letter to everybody with an account.
 *
 * WHAT IT IS FOR. Every other message answers something the reader did. This
 * one answers nothing; it is Vallo speaking to the whole membership at once,
 * so it is written as a letter from people, not a notice: who Vallo is and why
 * it exists, what a member can do today, what is being built next, and how
 * ready the platform is to serve the market. One lit button opens the app.
 *
 * HOW IT IS BUILT. Inside `documentHtml` and `footerRows` in `render.ts`, from
 * the palette in `theme.ts`, exactly as `welcome-message.ts` is, so it inherits
 * the lockup, the fluid 600px column, the footer with the notification
 * settings link, the dark scheme (the `rm-*` classes repaint every ground and
 * ink to the DARK palette in a client that is in dark mode) and the rule that
 * every cell paints its own ground. It adds four banner pictures between the
 * sections and one phone stylesheet. Nothing here depends on the style block.
 *
 * THE BANNERS. Three 1200x480 pictures at
 * `/brand/email/banners/<name>.jpg`, shown at the card's inner width. They
 * are NOT one of the sanctioned tiers in `images.ts` (lockup, one 3D object,
 * glyphs, photos), which is why this message is not in `fixtures.ts`'
 * catalogue and `newsletter-message.test.ts` holds the banners to their own
 * rules: absolute URL, width and height attributes, a real alt, a file on
 * disk of the stated size. The words of the letter never live in a picture:
 * with images blocked the reader loses decoration and nothing else.
 *
 * WHO SENDS IT. Not this file. `public.newsletter_enqueue(campaign)` queues one
 * `platform.newsletter` row per eligible member and the outbox drain renders
 * it through `lib/notify/templates.ts`. Nothing sends automatically.
 *
 * THE WORDS NEVER CLAIM WHAT NOBODY CAN STAND BEHIND. No counts, no dates, no
 * promise about what the platform holds, nothing insured or guaranteed, no
 * return of any kind. The roadmap is written as what is being built, never as
 * a commitment with a date. Every link resolves to a page, and the test file
 * checks each against the app directory.
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
  greetingName,
  paintExplicit,
  PREHEADER_MAX,
  siteUrl,
  SUBJECT_MAX,
} from "./render";
import { FONT_SANS, LEGAL_LINE, LIGHT, LINK, SIGN_OFF } from "./theme";
import { NEWSLETTER_SALE_LINE } from "../money/copy";

/* ----------------------------------------------------------------- routes */

/**
 * Every path this letter may link to, and nothing else. Each is a page in
 * `apps/web/src/app`; the test proves it by looking for the page file.
 */
export const NEWSLETTER_ROUTES = [
  "/home",
  "/search",
  "/stays",
  "/restaurants",
  "/messages",
  "/saved",
  "/verification",
  "/safety",
  "/support",
  /* The shared footer's links (`FOOTER_LINKS` in render.ts). */
  "/settings/notifications",
  "/legal/privacy",
  "/legal/terms",
] as const;

export type NewsletterRoute = (typeof NEWSLETTER_ROUTES)[number];

/** Where the lit button goes. */
export const NEWSLETTER_LANDING: NewsletterRoute = "/home";

/* ---------------------------------------------------------------- banners */

export const BANNER_WIDTH = 1200;
export const BANNER_HEIGHT = 480;
/** The card is 600 wide with 40 either side, so a banner is shown 520 wide. */
export const BANNER_SHOWN_WIDTH = 520;
export const BANNER_SHOWN_HEIGHT = Math.round((BANNER_SHOWN_WIDTH * BANNER_HEIGHT) / BANNER_WIDTH);

export const BANNER_DIR = "/brand/email/banners";

export type BannerName =
  | "newsletter-1"
  | "newsletter-2"
  | "newsletter-3";

export type Banner = {
  name: BannerName;
  /** The headline set on the picture, kept in step with `docs/EMAIL_BANNER_PROMPTS.md`. */
  headline: string;
  /** What a reader with images off is told the picture is. */
  alt: string;
};

export const BANNERS: Readonly<Record<BannerName, Banner>> = {
  "newsletter-1": {
    name: "newsletter-1",
    headline: "A first letter from Vallo",
    alt: "Vallo. A first letter to everyone who has an account.",
  },
  "newsletter-2": {
    name: "newsletter-2",
    headline: "Where we are going",
    alt: "Where we are going.",
  },
  "newsletter-3": {
    name: "newsletter-3",
    headline: "Ready for the market",
    alt: "Ready for the market.",
  },
};

export function bannerPath(name: BannerName): string {
  return `${BANNER_DIR}/${name}.jpg`;
}

/* ------------------------------------------------------------------ words */

type Link = { label: string; path: NewsletterRoute };
type Item = { title: string; body: string; link?: Link };

/**
 * EVERY WORD OF THE LETTER, IN ONE OBJECT, so refining it is editing data and
 * `/preview/email/newsletter` shows the result. Nothing in it is a count, a
 * date, a promise or a claim the code cannot back: see the head of this file.
 */
export const NEWSLETTER_COPY = {
  eyebrow: "A letter from Vallo",
  headlineTwo: "This is our first letter to you.",
  lede: "Thank you for opening an account. Here is who we are, what you can do today and what we are building next.",
  subjectWithName: "{name}, a first letter from Vallo",
  subjectPlain: "A first letter from Vallo",
  preheader: "Who we are, what you can do today, and where Vallo is going next.",

  why: {
    heading: "Why Vallo exists",
    paragraphs: [
      "Vallo is a property and stays marketplace built for Nigeria. You can rent a home, look at property for sale, book a hotel or shortlet, and request a table at a restaurant, all from one account.",
      "Looking for somewhere in Nigeria should not mean chasing strangers, paying before you have seen the place, or wondering who is really on the other end of the phone. We are here to set the standard: people you can check, payments that stay inside the app, and a written record both sides can point to.",
      "Everything on Vallo is put there by a person who applied, and a person at Vallo reads each registration before anything goes up. We do not copy listings from anywhere else.",
    ],
  },

  today: {
    heading: "What you can do on Vallo today",
    items: [
      {
        title: "Find a home",
        body: "Search by area and budget. Where a listing states its total move-in cost, you can sort by that rather than the rent, because the rent is rarely the whole of it.",
        link: { label: "Search homes", path: "/search" },
      },
      {
        title: "Stay somewhere",
        body: "Hotels and shortlets, reserved from the same account you use to look for a home.",
        link: { label: "Open Stays", path: "/stays" },
      },
      {
        title: "Ask for a table",
        body: "Request a table at a restaurant. It is free to ask, and the venue accepts or declines.",
        link: { label: "Find a restaurant", path: "/restaurants" },
      },
      {
        title: "Talk before you commit",
        body: "Message the lister inside Vallo and keep every answer in writing. Ask for an inspection and see the place in person before any money moves.",
        link: { label: "Open your messages", path: "/messages" },
      },
      {
        title: "Keep what you like",
        body: "Save homes and searches as you go, so they are waiting when you come back.",
        link: { label: "Your saved homes", path: "/saved" },
      },
    ] satisfies Item[],
  },

  roadmap: {
    heading: "Where we are going",
    lede: "This is what we are building. It is a direction and not a timetable, and we would rather tell you when something is ready than before.",
    items: [
      {
        title: "Quicker on any network",
        body: "We are working on opening Vallo faster, and on keeping what you have saved on screen when your signal drops.",
      },
      {
        title: "Vallo in your language",
        body: "English is where we started. We are bringing Vallo to Yoruba, Hausa and Igbo, so more people can use it in the language they think in.",
      },
      {
        title: "More ways to know who you are dealing with",
        body: "Verification starts with identity and goes on to address, a payout account and a check in person. We are building each step so that what you see on a listing means something.",
      },
      {
        title: "Buying and selling, done carefully",
        body: NEWSLETTER_SALE_LINE,
      },
      {
        title: "More places to stay and eat",
        body: "More hotels, shortlets and restaurants, each listed by the people who run them.",
      },
      {
        title: "A community around places",
        body: "Around is where people share places, posts and stories about where they live. We are building it into somewhere you can ask people who know the neighbourhood.",
      },
    ] satisfies Item[],
  },

  ready: {
    heading: "How we are getting ready to serve the market",
    lede: "Opening the doors is the easy part. These are the things we are putting in place first.",
    items: [
      {
        title: "Trust",
        body: "Anyone who wants to list applies first, and identity is reviewed by a person at Vallo. The verified tick on a listing means that review was passed, and nothing more than that.",
        link: { label: "How verification works", path: "/verification" },
      },
      {
        title: "Safety",
        body: "Vallo itself never holds your money. Keep your conversations and payments inside the app, inspect before you pay, and report anyone who asks you to do otherwise.",
        link: { label: "How Vallo thinks about safety", path: "/safety" },
      },
      {
        title: "Speed",
        body: "Vallo is built to open quickly and to stay usable on a weak connection, because that is how many of us are online.",
      },
      {
        title: "Support",
        body: "If something does not go to plan, write to us from inside the app. A person at Vallo reads what you send.",
        link: { label: "Contact support", path: "/support" },
      },
    ] satisfies Item[],
  },

  button: "Open Vallo",
  buttonAfter: "Opening this on another device? Sign in there with this same address.",
  closing: "Thank you for being here at the start. Tell us what works and what does not; it shapes what we build next.",
  signOffLine: "With thanks,",
  signOffName: "The Vallo team",
  footerReason:
    "You are receiving this letter because you have a Vallo account with a confirmed address. You can turn marketing email off in your notification settings.",
  footerLinkLabel: "Change what Vallo emails you",
} as const;

/* ---------------------------------------------------------------- helpers */

export type NewsletterData = {
  name?: string | null;
};

function href(link: Link): string {
  return appUrl(link.path);
}

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

/** "Hi Ada," or "Hi there,", never "Hi ,". */
function greetingLine(name?: string | null): string {
  const first = greetingName(name);
  return first === null ? "Hi there," : `Hi ${first},`;
}

/* ------------------------------------------------------------------- html */

const TEXT = `font-family:${FONT_SANS};`;

const PHONE_STYLE = `
      @media only screen and (max-width: 480px) {
        .nl-h1   { font-size: 27px !important; }
        .nl-hero { padding: 22px 18px 18px !important; }
        .nl-item { padding: 16px 16px 16px 14px !important; }
        .nl-img  { width: 100% !important; height: auto !important; }
      }`;

function bannerHtml(banner: Banner, margin = "0 0 22px"): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:${margin};">
                  <tr>
                    <td class="rm-card" align="center" style="font-size:0;line-height:0;mso-line-height-rule:exactly;border-radius:14px;">
                      <img class="nl-img" src="${siteUrl()}${bannerPath(banner.name)}" width="${BANNER_SHOWN_WIDTH}" height="${BANNER_SHOWN_HEIGHT}" alt="${escapeHtml(banner.alt)}" border="0" style="display:block;width:100%;max-width:${BANNER_SHOWN_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;border-radius:14px;${TEXT}font-size:15px;line-height:20px;color:${LIGHT.muted};" />
                    </td>
                  </tr>
                </table>`;
}

function headingHtml(text: string): string {
  return `<h2 class="rm-title" style="margin:0 0 12px;${TEXT}font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.02em;color:${LIGHT.text};">${escapeHtml(text)}</h2>`;
}

function paragraphHtml(text: string, margin = "0 0 14px"): string {
  return `<p class="rm-body" style="margin:${margin};${TEXT}font-size:16px;line-height:1.65;color:${LIGHT.body};">${escapeHtml(text)}</p>`;
}

/** The one link style in this letter: blue, underlined, with an arrow. */
function linkHtml(link: Link): string {
  return `<a class="rm-link" href="${escapeHtml(href(link))}" target="_blank" style="color:${LINK};text-decoration:underline;text-underline-offset:3px;">${escapeHtml(link.label)}&nbsp;&rarr;</a>`;
}

function itemHtml(item: Item): string {
  const link = item.link
    ? `<p class="rm-link" style="margin:0;${TEXT}font-size:14px;line-height:20px;font-weight:600;color:${LINK};">${linkHtml(item.link)}</p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 12px;">
                  <tr>
                    <td class="rm-panel nl-item" bgcolor="${LIGHT.panel}" style="background-color:${LIGHT.panel};border:1px solid ${LIGHT.edge};border-left:3px solid ${LINK};border-radius:14px;padding:18px 20px 18px 18px;">
                      <p class="rm-title" style="margin:0 0 6px;${TEXT}font-size:16px;line-height:1.4;font-weight:700;letter-spacing:-0.01em;color:${LIGHT.text};">${escapeHtml(item.title)}</p>
                      <p class="rm-body" style="margin:0 ${item.link ? "0 10px" : "0 0"};${TEXT}font-size:15px;line-height:1.6;color:${LIGHT.body};">${escapeHtml(item.body)}</p>
                      ${link}
                    </td>
                  </tr>
                </table>`;
}

function sectionGap(): string {
  return `<div style="height:18px;line-height:18px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</div>`;
}

function renderHtml(greeting: string): string {
  const c = NEWSLETTER_COPY;

  const hero = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 26px;">
                  <tr>
                    <td class="rm-panel nl-hero" bgcolor="${LIGHT.panel}" style="background-color:${LIGHT.panel};border:1px solid ${LIGHT.edge};border-radius:16px;padding:26px 24px 22px;">
                      <p class="rm-link" style="margin:0 0 12px;${TEXT}font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${LINK};">${escapeHtml(c.eyebrow)}</p>
                      <h1 class="nl-h1" style="margin:0 0 14px;${TEXT}font-size:31px;line-height:1.18;font-weight:700;letter-spacing:-0.025em;color:${LIGHT.text};"><span class="rm-title" style="color:${LIGHT.text};">${escapeHtml(greeting)}</span><br /><span class="rm-link" style="color:${LINK};">${escapeHtml(c.headlineTwo)}</span></h1>
                      <p class="rm-body" style="margin:0;${TEXT}font-size:17px;line-height:1.6;color:${LIGHT.body};">${escapeHtml(c.lede)}</p>
                    </td>
                  </tr>
                </table>`;

  const why = [headingHtml(c.why.heading), ...c.why.paragraphs.map((p) => paragraphHtml(p))].join(
    "\n                ",
  );

  const today = [headingHtml(c.today.heading), ...c.today.items.map(itemHtml)].join("\n                ");

  const roadmap = [
    bannerHtml(BANNERS["newsletter-2"]),
    headingHtml(c.roadmap.heading),
    paragraphHtml(c.roadmap.lede, "0 0 16px"),
    ...c.roadmap.items.map(itemHtml),
  ].join("\n                ");

  const ready = [
    bannerHtml(BANNERS["newsletter-3"]),
    headingHtml(c.ready.heading),
    paragraphHtml(c.ready.lede, "0 0 16px"),
    ...c.ready.items.map(itemHtml),
  ].join("\n                ");

  const closing = `${paragraphHtml(c.closing, "0 0 20px")}
                <p class="rm-body" style="margin:0;${TEXT}font-size:16px;line-height:1.6;color:${LIGHT.body};">${escapeHtml(c.signOffLine)}</p>
                <p class="rm-title" style="margin:2px 0 0;${TEXT}font-size:16px;line-height:1.6;font-weight:700;color:${LIGHT.text};">${escapeHtml(c.signOffName)}</p>`;

  return documentHtml({
    title: "A first letter from Vallo",
    preheader: c.preheader,
    htmlAttrs: ' xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"',
    headExtra:
      "\n    <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->",
    extraStyle: PHONE_STYLE,
    banner: "newsletter-1",
    card: `${hero}
                ${why}
                ${sectionGap()}
                ${today}
                ${sectionGap()}
                ${roadmap}
                ${sectionGap()}
                ${ready}
                <div style="height:14px;line-height:14px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</div>
                ${buttonHtml(c.button, appUrl(NEWSLETTER_LANDING), { arrow: true, margin: "6px 0 0" })}
                <p class="rm-muted" style="margin:14px 0 30px;${TEXT}font-size:13px;line-height:1.6;color:${LIGHT.muted};">${escapeHtml(c.buttonAfter)}</p>
                ${closing}`,
    footer: footerRows([c.footerReason], {
      label: c.footerLinkLabel,
      href: appUrl("/settings/notifications"),
    }),
  });
}

/* ------------------------------------------------------------------- text */

function itemText(item: Item): string {
  const lines = [item.title, wrap(item.body, 72, "  ")];
  if (item.link) lines.push(`  ${item.link.label}: ${href(item.link)}`);
  return lines.join("\n");
}

function heading(text: string): string[] {
  return [text, "-".repeat(text.length), ""];
}

function renderText(greeting: string): string {
  const c = NEWSLETTER_COPY;
  return (
    [
      "Vallo",
      "",
      c.eyebrow,
      "-".repeat(c.eyebrow.length),
      "",
      greeting,
      c.headlineTwo,
      "",
      wrap(c.lede),
      "",
      ...heading(c.why.heading),
      ...c.why.paragraphs.flatMap((p) => [wrap(p), ""]),
      ...heading(c.today.heading),
      ...c.today.items.flatMap((item) => [itemText(item), ""]),
      ...heading(c.roadmap.heading),
      wrap(c.roadmap.lede),
      "",
      ...c.roadmap.items.flatMap((item) => [itemText(item), ""]),
      ...heading(c.ready.heading),
      wrap(c.ready.lede),
      "",
      ...c.ready.items.flatMap((item) => [itemText(item), ""]),
      `${c.button}:`,
      appUrl(NEWSLETTER_LANDING),
      wrap(c.buttonAfter),
      "",
      wrap(c.closing),
      "",
      c.signOffLine,
      c.signOffName,
      "",
      wrap(c.footerReason),
      `${c.footerLinkLabel}: ${appUrl("/settings/notifications")}`,
      "",
      footerLinksText({ skipSettings: true }),
      "",
      SIGN_OFF,
      LEGAL_LINE,
      siteUrl(),
    ].join("\n") + "\n"
  );
}

/* ----------------------------------------------------------------- public */

/** The first platform newsletter, for one member. The name is optional. */
export function platformNewsletter(data: NewsletterData = {}): EmailMessage {
  const c = NEWSLETTER_COPY;
  const greeting = greetingLine(data.name);
  const first = greetingName(data.name);
  const subject = first ? c.subjectWithName.replace("{name}", first) : c.subjectPlain;
  return {
    subject: subject.length <= SUBJECT_MAX ? subject : c.subjectPlain,
    preheader: clip(c.preheader, PREHEADER_MAX),
    html: paintExplicit(renderHtml(greeting)),
    text: renderText(greeting),
  };
}
