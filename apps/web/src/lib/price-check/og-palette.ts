/**
 * THE SHARE IMAGE'S COLOURS, AS LITERALS, AND WHY THAT IS THE RIGHT ANSWER
 * HERE RATHER THAN A RULE BEING DODGED.
 *
 * `nf/no-raw-colour` is an error across `src/lib`, and it is right to be: a
 * literal cannot follow the theme, and dark is the default rather than the
 * only theme. Two things make the Open Graph card the exception, and they are
 * both about the MEDIUM rather than about a migration that has not happened.
 *
 * SATORI RESOLVES NO CSS CUSTOM PROPERTY. `next/og` renders outside the DOM,
 * with no stylesheet and no cascade, so `var(--nf-surface-canvas)` resolves to
 * nothing, and for a colour that means paint nothing. This is the same reason
 * `lib/email/theme.ts` holds literals and is scoped out of the rule by config:
 * Gmail strips `:root` declarations and Outlook's engine never supported them.
 *
 * AND AN OG CARD HAS NO THEME TO FOLLOW. It is rendered once on a server and
 * shown inside somebody else's chat app, which has its own idea of dark and
 * light and will not tell us. One image, dark, stated rather than accidental.
 *
 * ---------------------------------------------------------------------------
 * SO THE LITERALS ARE HERE AND NOT IN THE `.tsx`, AND THAT IS THE POINT.
 *
 * `apps/web/vitest.config.ts` aliases `react` at its react-server entry, so
 * nothing that imports a `.tsx` can be loaded by this suite at all. Literals
 * inside `opengraph-image.tsx` would be untestable, and an untested copy of a
 * token is a copy that drifts: `og-palette.test.ts` reads
 * `packages/design-tokens/src/tokens.css` and asserts every value below is
 * still what the token resolves to. That is the shape `lib/email/shell.test.ts`
 * already uses for the email palette, and it is what earns the disables.
 *
 * The rule's own config names the test for a whole-directory exemption and
 * this file does not meet it - it READS colours rather than being the place
 * others read from - so each line takes a disable with its reason, which is
 * what that config says to do instead.
 */

/** `--nf-surface-canvas` in dark: the page ground. */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property. Held to tokens.css by og-palette.test.ts.
export const OG_CANVAS = "#000612";

/** `--nf-surface-raised` in dark, which is `--nf-ink-750`: the figure's panel. */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property. Held to tokens.css by og-palette.test.ts.
export const OG_PANEL = "#000050";

/** `--nf-content-primary` in dark, which is `--nf-mist-100`. */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property. Held to tokens.css by og-palette.test.ts.
export const OG_INK = "#FFFFFF";

/** `--nf-content-secondary` in dark, which is `--nf-mist-300`: the basis line. */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property. Held to tokens.css by og-palette.test.ts.
export const OG_INK_SECONDARY = "#D5DEFF";

/** `--nf-content-muted` in dark, which is `--nf-mist-500`: the footer. */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property. Held to tokens.css by og-palette.test.ts.
export const OG_INK_MUTED = "#8E9CC4";

/** `--nf-brand-primary` in dark, which is `--nf-electric-300`: the lit rim. */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property. Held to tokens.css by og-palette.test.ts.
export const OG_BRAND = "#0069FE";

/**
 * The avatar initials tones for the unfurl card (`og-centred-card.tsx`) when a
 * subject has no photo: a fixed, closed decorative set (the same spread the
 * in-app tinted-initials tile reads), so one subject keeps one colour. These
 * are a decorative palette, not semantic theme tokens, so they are not held in
 * `OG_PALETTE_SOURCES`; the first is the brand so it stays token-backed.
 */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property; a fixed decorative initials set, not a theme colour.
export const OG_AVATAR_TONES: readonly string[] = [OG_BRAND, "#5C9FFF", "#10B981", "#00C8FF"];

/*
 * THE SHARE CARD FRAME'S EXTRA INKS (spec section 10), for
 * `components/share/og-share-card.tsx`: the card on the canvas, the round
 * status marks, the quiet brand of the chip, and the hairline that draws the
 * stat strip and the meter's empty bars.
 */

/** `--nf-surface-primary` in dark: the card on the canvas. */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property. Held to tokens.css by og-palette.test.ts.
export const OG_CARD = "#000020";

/** `--nf-surface-elevated` in dark: the chip's ground. */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property. Held to tokens.css by og-palette.test.ts.
export const OG_CHIP = "#000040";

/** `--nf-content-link` in dark, which is `--nf-brand-quiet`: the chip's glyph. */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property. Held to tokens.css by og-palette.test.ts.
export const OG_BRAND_QUIET = "#5C9FFF";

/** `--nf-state-success` in dark: a check that holds. */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property. Held to tokens.css by og-palette.test.ts.
export const OG_SUCCESS = "#10B981";

/** `--nf-state-warning` in dark: a check that is missing, and a mid meter. */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property. Held to tokens.css by og-palette.test.ts.
export const OG_WARNING = "#00C8FF";

/** `--nf-border-default` in dark: the stat strip's hairline and an empty bar. */
// eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property. Held to tokens.css by og-palette.test.ts.
export const OG_HAIRLINE = "rgb(255 255 255 / 0.13)";

/**
 * Each literal above beside the LAYER-2 token it was resolved from.
 *
 * Layer 2 only, and that is the rule rather than a preference: ADR-002 says a
 * component reads semantic tokens and never the palette underneath them, and
 * `nf/no-raw-colour` enforces it on the NAMES as well as on the values. Several
 * of these are declared as `var(--nf-mist-100)` and the like, so the test walks
 * the `var()` chain itself rather than this list naming the palette entry, which
 * would be the exact thing the rule forbids written as documentation.
 */
export const OG_PALETTE_SOURCES: readonly { value: string; token: string }[] = [
  { value: OG_CANVAS, token: "--nf-surface-canvas" },
  { value: OG_PANEL, token: "--nf-surface-raised" },
  { value: OG_INK, token: "--nf-content-primary" },
  { value: OG_INK_SECONDARY, token: "--nf-content-secondary" },
  { value: OG_INK_MUTED, token: "--nf-content-muted" },
  { value: OG_BRAND, token: "--nf-brand-primary" },
  { value: OG_CARD, token: "--nf-surface-primary" },
  { value: OG_CHIP, token: "--nf-surface-elevated" },
  { value: OG_BRAND_QUIET, token: "--nf-content-link" },
  { value: OG_SUCCESS, token: "--nf-state-success" },
  { value: OG_WARNING, token: "--nf-state-warning" },
  { value: OG_HAIRLINE, token: "--nf-border-default" },
];

/**
 * A palette literal at an opacity, for the unfurl card's glow and scrim
 * (`components/share/og-centred-card.tsx`). Derived from the held literals
 * above rather than written out again, so a token change reaches the light as
 * well as the ink, and no new colour enters the file.
 */
export function ogAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((part) => parseInt(part, 16));
  // eslint-disable-next-line nf/no-raw-colour -- Satori resolves no custom property; the channels come from the held literals above.
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
