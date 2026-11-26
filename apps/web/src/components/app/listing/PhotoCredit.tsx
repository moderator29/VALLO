import type { PhotoCredit as Credit } from "@/lib/listings/photo-credits";

/**
 * The line under a gallery that says who took the photographs.
 *
 * Shown only where the page is carrying somebody else's work: the example
 * collection's photographs come from Unsplash, whose terms require the
 * photographer to be credited and linked where the photograph appears. A
 * lister's own photograph has no credit row, so this draws nothing at all and
 * the ordinary listing page is unchanged.
 *
 * Quiet by design. It is a courtesy line and an obligation, not a feature: the
 * muted meta type the rest of the detail page uses for its small print, under
 * the gallery rather than over it, and never on top of a photograph.
 *
 * `rel="noopener"` on every link, and `nofollow` with it, because these point
 * off the platform to profiles nobody here vouches for.
 */
export function PhotoCredit({
  credits,
  copy,
}: {
  credits: readonly Credit[];
  copy: { line: string; profile: string };
}) {
  if (credits.length === 0) return null;

  /*
   * The names are rendered one at a time rather than joined into a string,
   * because each one carries its own link to its own profile. The separators
   * are the ones a list takes in English: a comma between, an "and" before the
   * last. `Intl.ListFormat` would need the locale threaded through the page
   * for one line of small print, and this line is at most a handful of names.
   */
  const [before, after] = copy.line.split("{names}");

  return (
    <p className="nf-detail-meta mt-xs text-[var(--nf-content-muted)]" data-testid="photo-credit">
      {before}
      {credits.map((credit, i) => (
        <span key={credit.photographer}>
          {i > 0 && (i === credits.length - 1 ? " and " : ", ")}
          {credit.photographerUrl === null ? (
            credit.photographer
          ) : (
            <a
              href={credit.photographerUrl}
              target="_blank"
              rel="noopener nofollow"
              className="nf-tap underline underline-offset-2"
              aria-label={copy.profile.replace("{name}", credit.photographer)}
            >
              {credit.photographer}
            </a>
          )}
        </span>
      ))}
      {after}
    </p>
  );
}
