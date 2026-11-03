#!/usr/bin/env node
/**
 * Generate the Vallo Supabase auth email templates.
 *
 * Supabase sends one HTML template per auth action: confirm signup, magic link,
 * recovery, email change, invite. Left at their defaults they are plain and
 * unbranded. This script emits all five from one shell plus a set of composable
 * blocks, so the lockup, the colour and the language stay identical across
 * every message and move in one place when the brand moves, rather than
 * drifting as five hand-edited files.
 *
 * Output: supabase/templates/<name>.html, and beside each one
 * supabase/templates/<name>.txt, the plain-text twin rendered from the SAME
 * block list, so the two cannot drift. Apply the HTML in the Supabase dashboard
 * under Authentication -> Email Templates, or via the Management API. The
 * dashboard takes HTML only; the .txt is the readable source of each message
 * and the text part for the day the Send Email Hook replaces SMTP (see
 * docs/email/AUTH_EMAILS.md). Today a regeneration does not reach production by itself.
 *
 * Run: node scripts/build-auth-emails.mjs
 *
 * WHY THESE FIVE MATTER MORE THAN THE OTHERS.
 *
 * They are the first email anybody ever gets from Vallo. A confirm-signup
 * message arrives before the reader has any opinion of this product at all, so
 * it is not a utility, it is the first impression. It is also the message a
 * phishing kit will imitate, which is why the copy here never asks for
 * anything, never threatens, and always says plainly what happens if the reader
 * does nothing.
 *
 * ONE DESIGN, TWO GENERATORS.
 *
 * `apps/web/src/lib/email/render.ts` builds every transactional message. This
 * script builds these five. They must look like the same product, so every
 * value below is mirrored from `apps/web/src/lib/email/theme.ts`, which is the
 * source of truth and explains why literal hex is correct in an email.
 *
 * The duplication is real and it is deliberate: this is a plain Node script
 * that runs outside the Next build with no TypeScript loader, so it cannot
 * import a `.ts` module. What makes it safe rather than merely tolerated is
 * `apps/web/src/lib/email/shell.test.ts`, which reads theme.ts, this script and
 * the generated files, and fails when a colour here is not a colour there.
 *
 * DARK, LIKE THE PRODUCT (29 September 2026, founder ruling), the same
 * document `render.ts` builds (`documentHtml`): a navy ground, one deep navy
 * card with a hairline edge carrying the lockup band, a luminous brand-blue
 * rule and the message, then the footer with the support and legal links on
 * the ground. The inline layer is dark and complete, `color-scheme: dark`
 * stops Apple Mail inverting it, and every ink keeps AA against its ground
 * written and inverted, so a client that forces its own pass still reads.
 * theme.ts says why, with the measurements.
 *
 * EMAIL CLIENT RULES OBSERVED HERE (do not undo these)
 * - Table layout only. No flex, no grid, no positioning.
 * - Every layout and colour declaration is inline on the element. The single
 *   <style> block re-asserts the dark palette for clients that restyle by
 *   scheme and nothing in it is required for the message to read correctly.
 * - System font stack only, no web fonts.
 * - background-color is always declared BEFORE background-image, because the
 *   Word rendering engine in Outlook drops background-image and keeps the
 *   colour. Every gradient therefore has a deliberate solid fallback.
 * - Container is 600px, fluid below that, and reads on a 360px Android screen.
 * - Every template keeps a plain-text fallback link, because clients strip
 *   buttons, and a hidden preheader so the inbox line is deliberate.
 * - THE MESSAGE MUST READ COMPLETELY WITH EVERY IMAGE BLOCKED. The shell
 *   carries one image, the lockup on its own navy tile, alt "Vallo". Every
 *   other word is live text.
 *
 * COPY RULES (the same ones binding on lib/email/messages.ts)
 * - No em dash characters, anywhere.
 * - No emoji.
 * - British spelling, calm and plain.
 * - No legal or financial promise. Nothing here says money is protected or
 *   guaranteed, and nothing claims a listing has been checked.
 * - Nothing advertises inventory this platform does not have.
 * - English. The product dictionary carries four locales (en, ha, ig, yo) and
 *   is English-first; Supabase renders one template per action with no locale
 *   input, so these are written once, in English, like the transactional
 *   catalogue. See docs/email/AUTH_EMAILS.md, "The language question".
 */

import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Where the files land. `supabase/templates` unless told otherwise.
 *
 * The override exists for one caller: `shell.test.ts` regenerates into a
 * temporary directory and diffs the result against what is committed. These
 * files are committed OUTPUT, and committed output rots in a specific way,
 * somebody fixes a typo in the HTML, the next person runs the generator, and
 * the fix vanishes with no diff to explain it. Comparing a fresh run against
 * the committed copy is the only thing that catches that before it happens.
 */
const OUT_DIR =
  process.env.VALLO_AUTH_EMAIL_OUT_DIR ?? join(__dirname, "..", "supabase", "templates");

/* ------------------------------------------------------------------------- *
 * The palette. Mirrored value for value from
 * apps/web/src/lib/email/theme.ts, which resolves them from
 * packages/design-tokens/src/tokens.css.
 *
 * These literals are correct. Do not "fix" them into CSS custom properties:
 * Gmail strips :root declarations, Outlook never supported them, and a var()
 * that resolves to nothing paints text the colour of its background.
 * ------------------------------------------------------------------------- */

/* The palette (DARK in theme.ts): the inline layer every client paints.
   GROUND is also the brand band's navy (HEADER). */
const GROUND = "#010118"; // --nf-ink-950
const CARD = "#000030"; // --nf-ink-850
const PANEL = "#000040"; // --nf-ink-800
const EDGE = "#102D55"; // hairlines
const RIM = "#2768C4"; // the card's rim
const TEXT = "#FFFFFF"; // headings
const BODY = "#D5DEFF"; // body copy, --nf-mist-300
const MUTED = "#8E9CC4"; // small print, --nf-mist-500
const BRAND = "#005FE8"; // the button fill
const HEADER = GROUND; // the brand band

/*
 * The brand blue, as a fill; SKY is the brand blue as text.
 *
 * RE-DERIVED FROM THE LIVE TOKENS ON 22 SEPTEMBER. These were baked before the
 * accent ramp was rotated onto its measured 215.2 degrees of hue, so what this
 * product had been sending was the retired violet. theme.ts carries the full
 * derivation and the measured contrast, and shell.test.ts now reads tokens.css
 * and fails when these three stop matching it, so this copy of the fact cannot
 * go stale on its own again.
 */
const GLOW = "#0C6AEF"; // --nf-electric-400, was #0C39EF
const ELECTRIC = "#0056D0"; // --nf-electric-600, was #0010D0
const SKY = "#5C9FFF"; // --nf-brand-quiet, was #5C7CFF

/* Signature gradients. Solid fallbacks are applied at every call site. */
const BUTTON_GRADIENT = `linear-gradient(180deg,#0A6CF5 0%,${BRAND} 100%)`;
const BUTTON_GLOW = "0 10px 26px -10px rgba(0,95,232,0.7)";
/* The luminous rule under the band, as GRADIENT_CAP in theme.ts. */
const GRADIENT_CAP = `linear-gradient(90deg,${ELECTRIC} 0%,${GLOW} 28%,${SKY} 50%,${GLOW} 72%,${ELECTRIC} 100%)`;

const FONT_SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FONT_MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

const MAX_WIDTH = 600;
const PAD_X = 40;

/* The lockup, hosted from the site Supabase is configured with. Boxes match
   theme.ts so the two generators draw the same line. */
const LOCKUP = "{{ .SiteURL }}/brand/vallo-email-lockup.png";
const LOCKUP_WIDTH = 198;
const LOCKUP_HEIGHT = 56;
const WORDMARK_ALT = "Vallo";

/* The footer links, as FOOTER_LINKS in render.ts. */
const FOOTER_LINKS = [
  ["Help and support", "{{ .SiteURL }}/support"],
  ["Privacy", "{{ .SiteURL }}/legal/privacy"],
  ["Terms", "{{ .SiteURL }}/legal/terms"],
];

/* The slogan, kept in step with SIGN_OFF in apps/web/src/lib/email/theme.ts
   and landing.slogan in packages/i18n. Three copies by design, because this
   generator and the renderer are both dependency-free; the email tests assert
   the rendered templates carry the renderer's value, which is what catches
   the three drifting apart. It caught exactly that on the day the slogan
   changed. */
const SIGN_OFF = "Vallo";
/* The legal line, mirrored from LEGAL_LINE in theme.ts and asserted equal.
   Carries the RC number from 22 September; shell.test.ts asserts that this
   file, theme.ts and company.ts all agree, so the three cannot half update. */
const LEGAL_LINE = "VALLO SPACES LTD (RC 9870413), Plot 5, Zone 6, Dutse Alhaji, Bwari Area Council, FCT, Abuja, Nigeria";

/* ------------------------------------------------------------------------- *
 * Blocks. Each template is a list of these, rendered twice: once as the HTML
 * Supabase sends, once as the plain-text twin. Each HTML primitive is the
 * auth-side twin of a block in render.ts, with the same measurements, so a
 * reader who gets a confirm-signup on Monday and a booking receipt on Tuesday
 * is looking at one product.
 * ------------------------------------------------------------------------- */

const heading = (text) => ({ kind: "heading", text });
const lede = (text) => ({ kind: "lede", text });
const para = (text) => ({ kind: "para", text });
const gap = (h) => ({ kind: "gap", h });
const cta = (label, href) => ({ kind: "cta", label, href });
const codeBox = (intro) => ({ kind: "code", intro });
const notePanel = (title, text) => ({ kind: "note", title, text });
const detailPanel = (rows) => ({ kind: "rows", rows });
const pointList = (items) => ({ kind: "list", items });
const fallbackLink = (href) => ({ kind: "fallback", href });

/** Vertical rhythm. font-size:0 and a matching line-height keep Outlook honest. */
function htmlGap(h) {
  return `<div style="height:${h}px;line-height:${h}px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</div>`;
}

function htmlBlock(block) {
  switch (block.kind) {
    case "gap":
      return htmlGap(block.h);

    /*
     * Display heading. Matches render.ts heading() exactly. font-family is
     * repeated here rather than inherited from body, because several webmail
     * clients rewrite the document and reset headings to a serif default,
     * which is the most visible way an email looks broken.
     */
    case "heading":
      return `<h1 class="rm-title" style="margin:0 0 16px;font-family:${FONT_SANS};font-size:27px;line-height:1.22;font-weight:700;letter-spacing:-0.022em;color:${TEXT};">${block.text}</h1>`;

    /** The opening paragraph. Matches render.ts paragraph(). */
    case "lede":
      return `<p class="rm-body" style="margin:0;font-family:${FONT_SANS};font-size:16px;line-height:1.65;color:${BODY};">${block.text}</p>`;

    /** A supporting paragraph, one step down in weight of attention. */
    case "para":
      return `<p class="rm-body" style="margin:0;font-family:${FONT_SANS};font-size:15px;line-height:1.6;color:${BODY};">${block.text}</p>`;

    /*
     * The one primary action. Matches render.ts button() exactly.
     *
     * background-color before background-image, so Outlook drops the gradient
     * and keeps a solid brand-blue button with white text rather than white on
     * nothing. Padding sits on the anchor so the whole pill is a tap target on
     * a phone, which is where nearly all of these are opened, and
     * mso-padding-alt repeats the geometry for the Word engine, which ignores
     * padding on an inline-block. #FFFFFF is the text ON brand blue.
     */
    case "cta":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                      <tr>
                        <td align="center" style="border-radius:14px;background-color:${BRAND};background-image:${BUTTON_GRADIENT};box-shadow:${BUTTON_GLOW};mso-padding-alt:16px 34px;">
                          <a href="${block.href}" target="_blank" style="display:inline-block;padding:16px 34px;font-family:${FONT_SANS};font-size:16px;line-height:20px;font-weight:600;letter-spacing:-0.01em;color:#FFFFFF;text-decoration:none;border-radius:14px;">${block.label}</a>
                        </td>
                      </tr>
                    </table>`;

    /*
     * The one-time code, for the flows where Supabase exposes {{ .Token }}.
     *
     * Offered UNDER the button rather than beside it. It is the same action by
     * another route, not a second action, and a reader who distrusts links in
     * email is right to, so this platform gives them a way through that
     * involves pressing nothing. Matches render.ts code(): letter-spacing puts
     * a gap after the last glyph too, so text-indent puts the same amount back
     * on the front and the string sits actually centred.
     */
    case "code":
      return `<p class="rm-muted" style="margin:0 0 10px;font-family:${FONT_SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};">${block.intro}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
                      <tr>
                        <td align="center" class="rm-panel rm-title" bgcolor="${PANEL}" style="background:${PANEL};border:1px solid ${EDGE};border-radius:16px;padding:20px 16px;font-family:${FONT_MONO};font-size:26px;line-height:32px;font-weight:700;letter-spacing:0.2em;text-indent:0.2em;color:${TEXT};">{{ .Token }}</td>
                      </tr>
                    </table>`;

    /*
     * A titled note in an inset panel. Used for the reassurance on recovery
     * and the security warning on email change. The accent is a lit left edge
     * in brand blue rather than a red or amber alert colour, because this
     * brand has no alert hue and inventing one for an email is how a palette
     * starts drifting. Weight and position carry the emphasis.
     */
    case "note":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
                      <tr>
                        <td class="rm-panel" bgcolor="${PANEL}" style="background:${PANEL};border:1px solid ${EDGE};border-left:3px solid ${BRAND};border-radius:16px;padding:18px 20px;">
                          <p class="rm-title" style="margin:0 0 6px;font-family:${FONT_SANS};font-size:14px;line-height:20px;font-weight:700;letter-spacing:-0.01em;color:${TEXT};">${block.title}</p>
                          <p class="rm-body" style="margin:0;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:${BODY};">${block.text}</p>
                        </td>
                      </tr>
                    </table>`;

    /*
     * Label and value rows in one panel. Matches render.ts rows(). Used on the
     * email change template so the reader can audit both addresses before
     * approving anything. word-break is on the value because an email address
     * is one long unbreakable token and will otherwise widen the table past
     * the viewport on a phone.
     */
    case "rows": {
      const cells = block.rows
        .map(
          ([label, value], i) => `<tr>
                            <td width="40%" class="rm-muted rm-rule" style="width:40%;padding:13px 14px 13px 0;${i === 0 ? "" : `border-top:1px solid ${EDGE};`}font-family:${FONT_SANS};font-size:13px;line-height:1.5;vertical-align:top;color:${MUTED};">${label}</td>
                            <td align="right" class="rm-title rm-rule" style="padding:13px 0;${i === 0 ? "" : `border-top:1px solid ${EDGE};`}font-family:${FONT_SANS};font-size:15px;line-height:1.5;font-weight:700;vertical-align:top;word-break:break-all;color:${TEXT};">${value}</td>
                          </tr>`,
        )
        .join("\n                          ");
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
                      <tr>
                        <td class="rm-panel" bgcolor="${PANEL}" style="background:${PANEL};border:1px solid ${EDGE};border-radius:16px;padding:6px 22px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
                          ${cells}
                          </table>
                        </td>
                      </tr>
                    </table>`;
    }

    /*
     * A short list of what is true about this platform. Plain list markup: a
     * screen reader announces a list as a list, and a table of decorative dots
     * as nothing at all.
     */
    case "list": {
      const list = block.items
        .map((item) => `<li class="rm-body" style="margin:0 0 10px;color:${BODY};">${item}</li>`)
        .join("\n                        ");
      return `<ul class="rm-body" style="margin:0;padding:0 0 0 22px;font-family:${FONT_SANS};font-size:15px;line-height:1.6;color:${BODY};">
                        ${list}
                      </ul>`;
    }

    /** Small print with the raw link, for clients that strip the button. */
    case "fallback":
      return `<p class="rm-muted" style="margin:0;font-family:${FONT_SANS};font-size:13px;line-height:1.6;color:${MUTED};">
                      If the button does not work, copy this link into your browser:<br />
                      <a href="${block.href}" target="_blank" class="rm-link" style="color:${SKY};text-decoration:underline;word-break:break-all;">${block.href}</a>
                    </p>`;
  }
  throw new Error(`unknown block ${block.kind}`);
}

/* ------------------------------------------------------------ the text twin */

/** Wrap to a readable measure. Placeholders and URLs are left whole. */
function wrap(text, width = 72) {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line.length === 0) line = word;
    else if (line.length + 1 + word.length <= width) line += " " + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.join("\n");
}

/** Strip the little markup the copy carries (<br />, an anchor) for text. */
function plain(text) {
  return text.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "");
}

function textBlock(block) {
  switch (block.kind) {
    case "gap":
      return null;
    case "heading":
      // Underlined with dashes rather than shouted in capitals: a screen
      // reader spells out an all-caps word letter by letter.
      return `${block.text}\n${"-".repeat(Math.min(block.text.length, 72))}`;
    case "lede":
    case "para":
      return wrap(plain(block.text));
    case "cta":
      return `${block.label}:\n${block.href}`;
    case "code":
      return `${plain(block.intro)}: {{ .Token }}`;
    case "note":
      return `${block.title}\n${wrap(plain(block.text))}`;
    case "rows":
      // "Label: value", one per line. Not column-aligned: alignment padding
      // depends on a monospaced font, and a proportional one turns it into
      // ragged nonsense.
      return block.rows.map(([label, value]) => `${label}: ${value}`).join("\n");
    case "list":
      return block.items.map((item) => wrap(`- ${plain(item)}`)).join("\n");
    case "fallback":
      return `If the button does not work, copy this link into your browser:\n${block.href}`;
  }
  throw new Error(`unknown block ${block.kind}`);
}

/* ------------------------------------------------------------------------- *
 * The shared shell
 * ------------------------------------------------------------------------- */

/**
 * The band of plain facts, on the templates where it belongs.
 *
 * NOT a promise band. It used to be headed "How Vallo protects you" and to
 * claim every listing carried a verified host, which is not true: verification
 * is a ladder most listers have not climbed, and an email is the one surface
 * with no corrective. What is here now is what this platform can actually
 * stand behind, in the same words the transactional emails use.
 *
 * It is deliberately absent from a password reset, where the only job is to get
 * somebody calmly back in.
 */
function factBand(title, lines) {
  const items = lines
    .map((line) => `<li class="rm-body" style="margin:0 0 8px;color:${BODY};">${line}</li>`)
    .join("\n                          ");
  // The band closes the card, so it carries the card's edge and its bottom
  // radius. The card above it drops both, which is why the two are written as
  // one decision in shell() rather than independently here.
  return `<td class="rm-panel rm-pad" bgcolor="${PANEL}" style="background:${PANEL};border-top:1px solid ${EDGE};border-radius:0 0 19px 19px;padding:24px ${PAD_X}px 26px;">
                      <p class="rm-muted" style="margin:0 0 12px;font-family:${FONT_SANS};font-size:11px;line-height:14px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${MUTED};">${title}</p>
                      <ul class="rm-body" style="margin:0;padding:0 0 0 20px;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:${BODY};">
                          ${items}
                      </ul>
                    </td>`;
}

/**
 * The purpose line, at the top of the card under the brand band.
 *
 * It says what this particular email is for, which is the one piece of
 * hierarchy an auth message needs that a transactional one does not: the
 * reader did not ask for this and has half a second to decide it is real.
 * The lockup itself is in the band (`brandBand`).
 */
/**
 * The 3D mark, mirrored from `heroMarkHtml` in apps/web/src/lib/email/render.ts
 * (see `icons.ts` there): one of the founder's objects above the purpose
 * line, a 128 px PNG drawn at 64, sized so a blocked image keeps its box, and
 * alt empty because the headline names the message.
 */
const ICON_SIZE = 64;
const ICON_DIR = join(__dirname, "..", "apps", "web", "public", "brand", "3d", "email");
/**
 * `icon` is [wanted, stand-in]: the wanted object once its PNG exists, the
 * stand-in until then. Rerun this script when the 3D rollout lands a file;
 * `shell.test.ts` fails on the committed templates until somebody does.
 */
function heroMark([want, now]) {
  const name = existsSync(join(ICON_DIR, `${want}.png`)) ? want : now;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                    <tr>
                      <td style="font-size:0;line-height:0;mso-line-height-rule:exactly;">
                        <img src="{{ .SiteURL }}/brand/3d/email/${name}.png" width="${ICON_SIZE}" height="${ICON_SIZE}" alt="" border="0" style="display:block;width:${ICON_SIZE}px;height:${ICON_SIZE}px;border:0;outline:none;text-decoration:none;" />
                      </td>
                    </tr>
                  </table>`;
}

function masthead(purpose) {
  return `<p class="rm-muted" style="margin:0 0 10px;font-family:${FONT_SANS};font-size:11px;line-height:14px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${MUTED};">${purpose}</p>`;
}

/**
 * The brand band, as `brandBandRow` in render.ts: navy three ways under the
 * lit rim, the lockup as one picture carrying its own navy tile, then the
 * luminous brand-blue rule.
 */
function brandBand() {
  return `<tr>
              <td class="rm-base rm-pad" bgcolor="${HEADER}" style="background-color:${HEADER};background-image:linear-gradient(${HEADER},${HEADER});border-top:1px solid ${RIM};border-radius:19px 19px 0 0;padding:24px ${PAD_X}px 22px;">
                <img src="${LOCKUP}" width="${LOCKUP_WIDTH}" height="${LOCKUP_HEIGHT}" alt="${WORDMARK_ALT}" style="display:block;width:${LOCKUP_WIDTH}px;height:${LOCKUP_HEIGHT}px;border:0;outline:none;text-decoration:none;font-family:${FONT_SANS};font-size:22px;line-height:${LOCKUP_HEIGHT}px;font-weight:700;letter-spacing:-0.025em;color:#FFFFFF;" />
              </td>
            </tr>
            <tr><td style="height:2px;line-height:2px;font-size:0;background-color:${BRAND};background-image:${GRADIENT_CAP};mso-line-height-rule:exactly;">&nbsp;</td></tr>`;
}

/**
 * The style block, identical to `schemeStyle` in render.ts down to the class
 * names. Nothing the message depends on lives here: it declares the message
 * dark, re-asserts the dark palette by class for clients that restyle by
 * scheme, puts the palette back where Outlook.com's own dark pass repainted
 * it (`data-ogsb`, `data-ogsc`), and tightens the padding on a phone.
 */
const PALETTE_RULES = `
        .rm-base   { background-color: ${GROUND} !important; }
        .rm-card   { background-color: ${CARD} !important; }
        .rm-panel  { background-color: ${PANEL} !important; }
        .rm-title  { color: ${TEXT} !important; }
        .rm-body   { color: ${BODY} !important; }
        .rm-muted  { color: ${MUTED} !important; }
        .rm-link   { color: ${SKY} !important; }`;
const SCHEME_STYLE = `
      :root { color-scheme: dark; supported-color-schemes: dark; }
      @media (prefers-color-scheme: dark) {${PALETTE_RULES}
      }
      @media (prefers-color-scheme: light) {${PALETTE_RULES}
      }
      .rm-base[data-ogsb]  { background-color: ${GROUND} !important; }
      .rm-card[data-ogsb]  { background-color: ${CARD} !important; }
      .rm-panel[data-ogsb] { background-color: ${PANEL} !important; }
      [data-ogsc] .rm-title, .rm-title[data-ogsc] { color: ${TEXT} !important; }
      [data-ogsc] .rm-body, .rm-body[data-ogsc]   { color: ${BODY} !important; }
      [data-ogsc] .rm-muted, .rm-muted[data-ogsc] { color: ${MUTED} !important; }
      [data-ogsc] .rm-link, .rm-link[data-ogsc]   { color: ${SKY} !important; }
      @media only screen and (max-width: 480px) {
        .rm-pad    { padding-left: 22px !important; padding-right: 22px !important; }
        .rm-outer  { padding-left: 8px !important; padding-right: 8px !important; }
      }`;

/**
 * One shell for all five templates, and the same shell the product's
 * transactional email uses.
 *
 * @param subject   the subject to set beside it in the dashboard, 45 or fewer,
 *                  carried as the document title so it travels with the file
 * @param preheader hidden inbox line, one sentence, 90 or fewer
 * @param purpose   masthead purpose line, so each email announces its job
 * @param blocks    the middle: heading, lede, CTA, panels, fallback link
 * @param facts     optional {title, lines} band of plain, checkable statements
 * @param footnote  the closing sentence, tuned per template
 */
/**
 * The padding after the preheader, mirrored from `PREHEADER_PAD` in
 * apps/web/src/lib/email/render.ts: enough invisible characters to fill any
 * client's preview line, so the lock screen shows the preheader and nothing
 * pulled in from the body behind it.
 */
const PREHEADER_PAD = "&#847;&#8204;&#160;".repeat(60);

function shellHtml({ subject, preheader, icon, purpose, blocks, facts, footnote }) {
  const body = blocks.map(htmlBlock).join("\n                ");
  const links = FOOTER_LINKS.map(
    ([label, href]) =>
      `<a class="rm-link" href="${href}" target="_blank" style="color:${SKY};text-decoration:underline;">${label}</a>`,
  ).join("&nbsp;&nbsp;&middot;&nbsp;&nbsp;");
  return `<!doctype html>
<html lang="en" style="color-scheme:dark;background-color:${GROUND};">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${subject}</title>
    <style>${SCHEME_STYLE}
    </style>
  </head>
  <body class="rm-base" bgcolor="${GROUND}" style="margin:0;padding:0;width:100%;background-color:${GROUND};color:${BODY};font-family:${FONT_SANS};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">
    <!-- The hidden inbox line. The trailing spacer entities stop a client
         pulling the first sentence of body copy in after it, so what the
         reader sees beside the subject is a line somebody wrote. -->
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;max-height:0;max-width:0;overflow:hidden;font-size:1px;line-height:1px;mso-hide:all;">${preheader}${PREHEADER_PAD}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="rm-base" bgcolor="${GROUND}" style="width:100%;background-color:${GROUND};">
      <tr>
        <td align="center" class="rm-outer" style="padding:28px 12px 44px;">
          <!--[if mso]><table role="presentation" width="${MAX_WIDTH}" cellpadding="0" cellspacing="0" align="center"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${MAX_WIDTH}px;width:100%;">
            <tr>
              <td class="rm-card" bgcolor="${CARD}" style="background-color:${CARD};border:1px solid ${EDGE};border-radius:20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                  ${brandBand()}
                  <tr>
                    <td class="rm-card rm-pad" bgcolor="${CARD}" style="background-color:${CARD};${facts ? "" : "border-radius:0 0 19px 19px;"}padding:34px ${PAD_X}px 36px;">
                      ${heroMark(icon)}
                      ${masthead(purpose)}
                      ${body}
                    </td>
                  </tr>
${
  facts
    ? `                  <tr>
                    ${factBand(facts.title, facts.lines)}
                  </tr>
`
    : ""
}                </table>
              </td>
            </tr>
            <!-- The footer sits on the ground OUTSIDE the card, so it reads as
                 small print by position as well as by size. -->
            <tr>
              <td class="rm-pad" style="padding:26px ${PAD_X}px 0;">
                <p class="rm-muted" style="margin:0 0 8px;font-family:${FONT_SANS};font-size:13px;line-height:20px;color:${MUTED};">${footnote}</p>
                <p class="rm-muted" style="margin:14px 0 14px;font-family:${FONT_SANS};font-size:13px;line-height:20px;color:${MUTED};">${links}</p>
                <p class="rm-title" style="margin:0;font-family:${FONT_SANS};font-size:13px;line-height:20px;font-weight:700;letter-spacing:0.02em;color:${TEXT};">${SIGN_OFF}</p>
                <!-- The legal line. The brand is Vallo everywhere a person
                     reads; the company appears only where the law asks who
                     sent this, which is here. -->
                <p class="rm-muted" style="margin:4px 0 0;font-family:${FONT_SANS};font-size:12px;line-height:18px;color:${MUTED};">${LEGAL_LINE}</p>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/**
 * The plain-text twin, from the same blocks in the same order. The preheader
 * is not repeated: in HTML it is a hidden preview line, and in text the reader
 * is already looking at the whole message.
 */
function shellText({ purpose, blocks, facts, footnote }) {
  const parts = [
    "Vallo",
    purpose,
    "",
    blocks
      .map(textBlock)
      .filter((part) => part !== null)
      .join("\n\n"),
    "",
  ];
  if (facts) {
    parts.push(`${facts.title}`, facts.lines.map((line) => wrap(`- ${line}`)).join("\n"), "");
  }
  parts.push(
    wrap(footnote),
    "",
    FOOTER_LINKS.map(([label, href]) => `${label}: ${href}`).join("\n"),
    "",
    SIGN_OFF,
    LEGAL_LINE,
    "{{ .SiteURL }}",
  );
  return parts.join("\n") + "\n";
}

/* ------------------------------------------------------------------------- *
 * The five templates. Each is written for its own moment rather than being the
 * same shell with swapped words: the purpose line, heading, panels and closing
 * sentence all change with the job the email is doing.
 * ------------------------------------------------------------------------- */

/**
 * The facts band, and every line in it is checkable.
 *
 * These are the same three claims `lib/email/messages.ts` makes in the welcome,
 * because they are the ones this platform can stand behind. There is no
 * guarantee here, no promise about money and no claim that anything has been
 * verified: verification on Vallo is a ladder, it is visible on a profile, and
 * most listers have not climbed it.
 */
const FACTS_MARKETPLACE = {
  title: "Worth knowing before you start",
  /*
   * BOTH SIDES, from the content truth sweep of 19 September. This band sat
   * at the foot of the first email anybody ever gets and described a property
   * marketplace and nothing else: three lines about rent, the move-in total
   * and inspecting before paying, on a product whose other half sells nights.
   * A reader invited by a friend to look for a room read a footer that did
   * not know the thing they came for existed.
   *
   * WHAT IT MAY AND MAY NOT SAY. `shell.test.ts` draws the line at the HARM
   * rather than at the nouns: naming what the product is for is allowed, an
   * unstandable count is not, an availability promise ("book a table
   * tonight") is not, a superlative ("the best hotels in Lagos") is not, and
   * "experiences" is banned outright because there is no experiences product
   * here at all: no table, no route, no screen. Every line below is written
   * to that line, and an email cannot be corrected once it has landed.
   */
  lines: [
    /* UX-25: most listings today are examples; the email says what is true. */
    "Message whoever listed a place from inside Vallo, so the conversation stays on the record. Places marked Example are there to show how Vallo works and cannot be rented or booked.",
    "Vallo has two sides on one account. Property is renting, buying and selling; Vallo Stays is hotels, apartments, guest houses, resorts and restaurant tables.",
    "On a tenancy the rent is rarely the whole number. Caution deposit, agency, legal, agreement and service charge are normal here, so the move-in total is printed in full before you commit.",
    "Keep chats and payments inside Vallo. Inspect a property before you pay for it, and pay for a stay at checkout rather than into anybody's account.",
  ],
};

const templates = {
  // Confirm signup: the first email anybody gets from Vallo. Its job is to
  // confirm an address, and its second job is to be obviously real.
  confirmation: {
    subject: "Confirm your Vallo email",
    preheader: "Tap the button or enter the code, and your account is ready.",
    icon: ["envelope", "verified"],
    purpose: "Confirm your email",
    blocks: [
      heading("Confirm your email address"),
      lede(
        "You are one step from a Vallo account. Confirm this address and you can search property, book a stay, hold a table, message a lister and save the places you like.",
      ),
      gap(28),
      cta("Confirm my email", "{{ .ConfirmationURL }}"),
      gap(28),
      codeBox("Or enter this code"),
      gap(28),
      fallbackLink("{{ .ConfirmationURL }}"),
    ],
    facts: FACTS_MARKETPLACE,
    footnote:
      "This confirmation was requested for {{ .Email }}. If it was not you, ignore this message. No account is activated and nothing further happens.",
  },

  // Magic link: quick and frictionless. The link first, everything else out of
  // the way, and one security line rather than a band, because the reader is
  // mid sign-in and wants to be finished.
  "magic-link": {
    subject: "Your Vallo sign-in link",
    preheader: "It works once and expires shortly. Nobody from Vallo will ask for it.",
    icon: ["envelope", "shield"],
    purpose: "Sign in to Vallo",
    blocks: [
      heading("Here is your sign-in link"),
      lede("No password needed. Open this and you are back into Vallo."),
      gap(28),
      cta("Sign in to Vallo", "{{ .ConfirmationURL }}"),
      gap(28),
      codeBox("Or enter this code"),
      gap(24),
      para(
        "This link works once and expires shortly, so use it while it is fresh. It signs in the account for {{ .Email }} and no other.",
      ),
      gap(24),
      notePanel(
        "Nobody should ever ask you for this",
        "Vallo will never ask you for this link, this code or your password. Not by phone, not by message, not by email. If somebody does, they are not us.",
      ),
      gap(24),
      fallbackLink("{{ .ConfirmationURL }}"),
    ],
    footnote:
      "If you did not ask to sign in, ignore this message. The link expires on its own and nothing about your account changes.",
  },

  // Recovery: calm, no urgency, no alarm colour, and an explicit statement that
  // doing nothing is safe. No facts band: the only job is getting somebody back
  // in without worrying them.
  recovery: {
    subject: "Set a new Vallo password",
    preheader: "The link works once. If you did not ask, ignore this.",
    icon: ["passcode-lock", "shield"],
    purpose: "Password reset",
    blocks: [
      heading("Set a new password"),
      lede(
        "Somebody asked to reset the password on this account. If that was you, choose a new one and you are back in.",
      ),
      gap(28),
      cta("Choose a new password", "{{ .ConfirmationURL }}"),
      gap(28),
      codeBox("Or enter this code"),
      gap(26),
      notePanel(
        "If this was not you",
        "There is nothing to do. Your current password still works, this link expires by itself, and your account stays exactly as it is.",
      ),
      gap(24),
      fallbackLink("{{ .ConfirmationURL }}"),
    ],
    footnote: "This reset was requested for {{ .Email }}. The link can only be used once.",
  },

  // Email change: a security confirmation. The reader audits the change before
  // approving it, so both addresses are shown, and the emphasis is on
  // authorising rather than on welcoming.
  "email-change": {
    subject: "Confirm your new Vallo address",
    preheader: "Nothing changes until you approve it from this email.",
    icon: ["envelope", "id-check"],
    purpose: "Security confirmation",
    blocks: [
      heading("Confirm your new email address"),
      lede(
        "A request was made to move your Vallo account to a new address. Check both below, then approve the change.",
      ),
      gap(26),
      detailPanel([
        ["Current address", "{{ .Email }}"],
        ["New address", "{{ .NewEmail }}"],
      ]),
      gap(26),
      cta("Confirm the change", "{{ .ConfirmationURL }}"),
      gap(26),
      notePanel(
        "If you did not request this",
        "Do not open the link. Your address stays as it is until the change is approved. Sign in, change your password, and contact Vallo support if anything still looks wrong.",
      ),
      gap(24),
      fallbackLink("{{ .ConfirmationURL }}"),
    ],
    footnote:
      "This request was made on the account for {{ .Email }}. The change only takes effect once it is confirmed from this message.",
  },

  // Invite: an offer rather than an instruction. Somebody already inside
  // Vallo put this reader's name forward, and the copy is warm about it
  // without promising them anything.
  invite: {
    subject: "You have been invited to Vallo",
    preheader: "Accept it and your account is set up in a moment.",
    icon: ["team", "keys"],
    purpose: "Your invitation",
    blocks: [
      heading("You have been invited to Vallo"),
      lede(
        "Vallo is a Nigerian property marketplace with two sides on one account: renting, buying and selling, and Vallo Stays for hotels, apartments, guest houses, resorts and restaurant tables. Accept below and your account is set up in a moment.",
      ),
      gap(26),
      cta("Accept your invitation", "{{ .ConfirmationURL }}"),
      gap(28),
      pointList([
        "Listings, conversations, bookings and trips all sit in one account.",
        "Your details stay private until you choose to message a lister.",
      ]),
      gap(24),
      para(
        "This invitation was sent to {{ .Email }}. It is personal to you, so please keep the link to yourself.",
      ),
      gap(24),
      fallbackLink("{{ .ConfirmationURL }}"),
    ],
    facts: FACTS_MARKETPLACE,
    footnote:
      "If you were not expecting an invitation, ignore this message. No account is created and nothing further happens.",
  },
};

/**
 * EVERY SURFACE PAINTS ITS OWN GROUND, EXPLICITLY (track H). The mirror of
 * `paintExplicit` in `apps/web/src/lib/email/render.ts`, which this Node script
 * cannot import; `email-dark-paint.test.ts` checks the templates it writes.
 * Each body, table and cell gets its own colour (or its container's) as a
 * `bgcolor` attribute AND an inline `background-color`, so nothing relies on
 * a class and nothing inherits a client's white; and a cell that inherits its
 * colour inherits the container's ground class with it, so the dark scheme
 * repaints the two together.
 */
function paintExplicit(html) {
  const stack = [];
  const HEX = /#[0-9a-fA-F]{6}\b/;
  const GROUND_CLASS = /\brm-(base|card|panel|head)\b/;
  return html.replace(/<(\/?)(body|table|tr|td)\b([^>]*)>/gi, (whole, close, rawTag, attrs) => {
    const tag = rawTag.toLowerCase();
    if (close) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      return whole;
    }
    const style = /\bstyle="([^"]*)"/i.exec(attrs)?.[1] ?? null;
    const classAttr = /\bclass="([^"]*)"/i.exec(attrs)?.[1] ?? null;
    const own =
      (style && /background-color\s*:\s*(#[0-9a-fA-F]{6})/i.exec(style)?.[1]) ||
      (style && /background\s*:\s*(#[0-9a-fA-F]{6})/i.exec(style)?.[1]) ||
      /\bbgcolor="(#[0-9a-fA-F]{6})"/i.exec(attrs)?.[1] ||
      null;
    const parent = [...stack].reverse().find((entry) => entry.bg) ?? null;
    const bg = own ?? parent?.bg ?? null;
    const ownClass = classAttr ? (GROUND_CLASS.exec(classAttr)?.[0] ?? null) : null;
    const cls = own ? ownClass : (ownClass ?? parent?.cls ?? null);
    stack.push({ tag, bg, cls });
    if (!bg || tag === "tr" || !HEX.test(bg)) return whole;
    let next = attrs.replace(/\s*\/?\s*$/, "");
    const selfClose = /\/\s*$/.test(attrs) ? " /" : "";
    if (!/\bbgcolor="/i.test(next)) next += ` bgcolor="${bg}"`;
    if (style === null) next += ` style="background-color:${bg};"`;
    else if (!/background-color\s*:/i.test(style)) {
      const sep = style.trim().length === 0 || style.trim().endsWith(";") ? "" : ";";
      next = next.replace(/\bstyle="([^"]*)"/i, `style="$1${sep}background-color:${bg};"`);
    }
    if (!own && cls && !ownClass) {
      if (classAttr === null) next += ` class="${cls}"`;
      else next = next.replace(/\bclass="([^"]*)"/i, `class="$1 ${cls}"`);
    }
    return `<${rawTag}${next}${selfClose}>`;
  });
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, spec] of Object.entries(templates)) {
  for (const [ext, render] of [
    ["html", (s) => paintExplicit(shellHtml(s))],
    ["txt", shellText],
  ]) {
    const file = `${name}.${ext}`;
    const path = join(OUT_DIR, file);
    writeFileSync(path, render(spec), "utf8");
    process.stdout.write(`wrote supabase/templates/${file} (${statSync(path).size} bytes)\n`);
  }
}
