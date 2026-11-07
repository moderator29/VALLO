import { MARK_VIEWBOX, WORDMARK_VIEWBOX } from "@/lib/brand/logo-geometry";
import "@/app/css/auth.css";
import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, MouseEventHandler, ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * THE SLATE SYSTEM: the pieces every door into Vallo is built from.
 *
 * To the references of 29 September (`docs/design/references/2026-09-29`,
 * 12 and 14): a full-bleed top block whose bottom edge is one wide concave
 * arc, the wordmark in spaced capitals inside it with a line under it, and
 * below the arc a big title, labelled fields drawn as soft full-width cards,
 * a full-width pill, an "Or" rule and round provider buttons.
 *
 * THE FOUNDER'S THEME RULE, and every colour below follows it through the
 * `--nf-slate-*` roles in `app/css/auth.css`:
 *
 *   light  what is black in the reference is the BRAND: the top block, the
 *          pill and the focus outline run deep navy to the neon brand blue;
 *          the page is white and the field cards are white on a pale ground.
 *   dark   inverted: the top block is a light surface with a navy wordmark,
 *          the pill is white with navy text, the focus outline is white, and
 *          the page and the cards are dark navy.
 *
 * So the top block carries the artwork for the ground it is on, not for the
 * document: the NIGHT mark on the navy block in light mode, the DAY mark on
 * the paper block in dark mode. Both images are in the markup and the
 * stylesheet shows one; they are pictures only, and the name is on the link.
 *
 * Exported for the other doors (the passcode "Welcome back" screen shares
 * them). Nothing here holds state, so every piece renders on the server.
 * Everything visual lives in `app/css/auth.css` under "THE SLATE SYSTEM";
 * the pieces only need to sit inside an element with the `nf-auth` class,
 * or carry `nf-slate` themselves, for the roles to resolve.
 */

/* The block's bottom edge, in a 390 x 260 box stretched to any width. THE 3D
   GLASS DOOR (30 September, the founder's passcode reference): one
   symmetric bowl, high at both edges and lowest in the middle, where the
   focal object (the avatar ring, the Vallo mark, a 3D icon) sits across it.
   The morph (auth.css, `nf-slate-morph`) starts from a shallower bowl. */
export const SLATE_CURVE_PATH = "M0 0H390V150C340 226 270 256 195 256C120 256 50 226 0 150Z";
const SLATE_EDGE_PATH = "M390 150C340 226 270 256 195 256C120 256 50 226 0 150";

/**
 * The top block. `start` and `end` are the toolbar cells (the auth screens
 * put the way back in `start` and nothing in `end`: language is changed in
 * Settings only); `line` is the sentence under the wordmark.
 *
 * `compact` draws the short version, for a screen whose content is the whole
 * point (the passcode keypad). The block also shortens itself on any auth
 * screen while a field has focus, so the primary button stays above the
 * keyboard (auth.css, "THE KEYBOARD").
 */
export function AuthCurveBlock({
  line,
  start,
  end,
  brandHref = "/",
  brandLabel,
  wordmark,
  compact = false,
  focal,
  id,
}: {
  line?: ReactNode;
  start?: ReactNode;
  end?: ReactNode;
  /** Where the wordmark goes. Null draws it as plain text, not a link. */
  brandHref?: string | null;
  /** The link's accessible name, from the dictionary (`a11y.logoHome`). */
  brandLabel: string;
  /** The spaced-capitals name, from the dictionary (`auth.wordmark`). */
  wordmark: string;
  compact?: boolean;
  /**
   * The object that sits across the bottom of the bowl in its glowing glass
   * ring: the member's face on the passcode, the Vallo mark or a 3D icon on
   * the doors. Decorative (the screen's title names the place).
   */
  focal?: ReactNode;
  id?: string;
}) {
  const word = (
    <>
      {/* The logo (D81) in its own colours, the same in both themes (D82).
          The block is the brand blue, where the blue letters would vanish,
          so the lockup stands on a white plate (`--nf-logo-plate`); the
          artwork itself is never recoloured. The dictionary's spaced name
          stays the link's text for a reader. */}
      <span className="nf-slate-top__plate">
        <Image
          src="/brand/vallo-mark.svg"
          alt=""
          aria-hidden
          width={MARK_VIEWBOX.w}
          height={MARK_VIEWBOX.h}
          priority
          className="nf-slate-top__mark"
        />
        <Image
          src="/brand/vallo-wordmark.svg"
          alt=""
          aria-hidden
          width={WORDMARK_VIEWBOX.w}
          height={WORDMARK_VIEWBOX.h}
          priority
          className="nf-slate-top__word"
        />
      </span>
      <span className="sr-only">{wordmark}</span>
    </>
  );

  return (
    <header
      id={id}
      className={`nf-slate-top${compact ? " nf-slate-top--compact" : ""}${focal ? " nf-slate-top--focal" : ""}`}
    >
      <svg
        className="nf-slate-top__ground"
        viewBox="0 0 390 260"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="nf-slate-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="nf-slate-top__stop-a" />
            <stop offset="0.55" className="nf-slate-top__stop-b" />
            <stop offset="1" className="nf-slate-top__stop-c" />
          </linearGradient>
        </defs>
        <path className="nf-slate-top__shape" d={SLATE_CURVE_PATH} fill="url(#nf-slate-fill)" />
        <path className="nf-slate-top__edge" d={SLATE_EDGE_PATH} fill="none" />
      </svg>

      {/* DEPTH: two soft lights drifting inside the block, clipped by the
          bowl. Decorative; gone while a field has focus on a phone. The
          glass objects that floated here retired on 30 September: the one
          object is now the focal ring across the curve. */}
      {compact ? null : (
        <div className="nf-slate-top__depth" aria-hidden="true">
          <span className="nf-slate-top__light nf-slate-top__light--a" />
          <span className="nf-slate-top__light nf-slate-top__light--b" />
        </div>
      )}

      <div className="nf-slate-top__inner">
        <div className="nf-slate-top__bar">
          <div className="nf-slate-top__start">{start}</div>
          <div className="nf-slate-top__end">{end}</div>
        </div>
        {brandHref ? (
          /* `nf-tap`: the drawn link is 29px tall; the target is 44 (WCAG
             2.5.8 / the platform's own floor), painted nowhere. */
          <Link href={brandHref} aria-label={brandLabel} className="nf-slate-top__brand nf-tap">
            {word}
          </Link>
        ) : (
          <span role="img" aria-label={brandLabel} className="nf-slate-top__brand">
            {word}
          </span>
        )}
        {line ? <p className="nf-slate-top__line">{line}</p> : null}
      </div>
      {focal ? (
        <div className="nf-slate-focal" aria-hidden="true">
          <span className="nf-slate-focal__ring">{focal}</span>
        </div>
      ) : null}
    </header>
  );
}

/**
 * A labelled field drawn as a soft full-width card, for a screen that is not
 * one of the auth forms (those use `fields.tsx`, which the same stylesheet
 * paints identically). 16px type, so iOS never zooms the page.
 */
export function AuthFieldCard({
  id,
  label,
  error,
  trailing,
  className,
  ...input
}: Omit<ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  error?: string | undefined;
  /** A control inside the card's right edge, such as a show/hide toggle. */
  trailing?: ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="nf-slate-field">
      <label htmlFor={id} className="nf-slate-field__label">
        {label}
      </label>
      <div className="nf-slate-field__box">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`nf-slate-input${trailing ? " nf-slate-input--trailing" : ""}${className ? ` ${className}` : ""}`}
          {...input}
        />
        {trailing ? <span className="nf-slate-field__trailing">{trailing}</span> : null}
      </div>
      {/* The words go to the one banner; the field keeps its red edge (founder, 7 November 2026). */}
      <FieldProblem id={errorId} message={error} />
    </div>
  );
}

/**
 * The full-width pill: the one primary action on a door. The shared `Button`
 * (spinner, haptics, press) in the Slate dress, so a pending submit keeps its
 * width and says so.
 */
export function AuthPillButton({
  className,
  quiet = false,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "size" | "full"> & {
  /** The secondary pill (the outlined blue pill of the button system), for a second way on. */
  quiet?: boolean;
}) {
  return (
    <Button
      variant={quiet ? "secondary" : "primary"}
      size="lg"
      full
      className={`nf-slate-pill${quiet ? " nf-slate-pill--quiet" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}

/** The pill as a link, for a door that goes somewhere rather than submits. */
export function AuthPillLink({
  href,
  children,
  quiet = false,
  className,
  prefetch,
  onClick,
  testId,
}: {
  href: string;
  children: ReactNode;
  quiet?: boolean;
  className?: string;
  prefetch?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  testId?: string;
}) {
  return (
    <ButtonLink
      href={href}
      variant={quiet ? "secondary" : "primary"}
      size="lg"
      full
      {...(prefetch === undefined ? {} : { prefetch })}
      {...(onClick ? { onClick } : {})}
      {...(testId ? { "data-testid": testId } : {})}
      className={`nf-slate-pill${quiet ? " nf-slate-pill--quiet" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </ButtonLink>
  );
}

/**
 * A round provider button. It carries no words on screen, so `label` is its
 * accessible name ("Continue with Google"), and the mark inside is decorative.
 */
export function AuthSocialButton({
  label,
  children,
  className,
  ...props
}: Omit<ComponentProps<"button">, "aria-label"> & { label: string }) {
  return (
    <button
      type="submit"
      aria-label={label}
      title={label}
      className={`nf-slate-social${className ? ` ${className}` : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** "Or", between two hairlines. */
export function AuthOrRule({ children }: { children: ReactNode }) {
  return (
    <div className="nf-slate-or" aria-hidden="true">
      <span>{children}</span>
    </div>
  );
}

/** The row the round provider buttons sit in, centred. */
export function AuthSocialRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="nf-slate-socials" role="group" aria-label={label}>
      {children}
    </div>
  );
}

/**
 * Google's standard "G", in Google's own four colours: the one mark on these
 * screens the house palette steps aside for, because Google's sign-in
 * branding rules require it. It is a file under `public/brand/third-party/`
 * so no raw colour lives in a component.
 */
export function GoogleMark({ size = 22 }: { size?: number }) {
  return (
    <Image
      src="/brand/third-party/google-g.svg"
      alt=""
      width={size}
      height={size}
      className="nf-slate-social__mark"
      unoptimized
    />
  );
}
