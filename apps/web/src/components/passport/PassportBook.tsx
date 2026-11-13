import { LogoMark } from "@/design-system/brand/Logo";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { TierBadge } from "@/components/trust/TierBadge";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { LACE_TILE, rosettePaths, wavePaths } from "@/lib/passport/identity";
import type { PassportCopy, PassportView } from "@/lib/passport/view";
import "./vallo-passport.css";

/**
 * THE VALLO PASSPORT, AS A DOCUMENT.
 *
 * A premium identity page: the brand mark and the member's photograph, their
 * name, role, the day they joined and a passport-style number made from the
 * account id; the verification level; the counts Vallo recorded; and, along
 * the foot, two machine-readable lines made only from what is shown above.
 * Behind everything, a security pattern (waves and a rosette) drawn from the
 * same number, so every passport has its own lace.
 *
 * It draws what it is given and nothing more: a line the owner switched off is
 * not in the view, so there is nothing here to hide. Server-safe (no state, no
 * effects), so the owner's live preview can use it from a client component as
 * well.
 */
export function PassportBook({
  view,
  copy,
  off = false,
  testId = "passport-book",
  hideLevel = false,
  hideFigures = false,
}: {
  view: PassportView;
  copy: PassportCopy;
  /** The owner's preview when the passport is off: drawn faded. */
  off?: boolean;
  testId?: string;
  /**
   * A visitor's page draws the counts (rentals, stays, reviews) as the stats
   * row under the book, and the identity check as a dated row that opens, so
   * the book leaves them out there: a number is never printed twice. The
   * owner's preview keeps both, because the switches beside it are about
   * exactly those lines.
   */
  hideLevel?: boolean;
  hideFigures?: boolean;
}) {
  const rings = rosettePaths(view.number);
  const waves = wavePaths(view.number);
  const laceId = `vp-lace-${view.number}`;
  const shownStats = hideFigures ? view.stats.filter((s) => !s.figure) : view.stats;
  const figureStats = shownStats.filter((s) => s.figure);
  const figures = figureStats.length;
  const lastFigure = figureStats[figureStats.length - 1]?.key;
  return (
    <article
      className={off ? "nf-vp nf-vp--off" : "nf-vp"}
      aria-label={`${copy.title}: ${view.name}`}
      data-testid={testId}
    >
      {/* The security pattern: lace that tiles under everything, and a rosette
          at the top corner. Decorative: the words are the document. */}
      <svg className="nf-vp__lace" aria-hidden="true" focusable="false">
        <defs>
          <pattern id={laceId} width={LACE_TILE.width} height={LACE_TILE.height} patternUnits="userSpaceOnUse">
            {waves.map((d, i) => (
              <path key={i} className="nf-vp__wave" d={d} />
            ))}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${laceId})`} />
      </svg>
      <svg className="nf-vp__rosette" viewBox="-60 -60 120 120" aria-hidden="true" focusable="false">
        {rings.map((d, i) => (
          <path key={i} className="nf-vp__ring" d={d} />
        ))}
        <circle className="nf-vp__seal" r="14" />
      </svg>

      <header className="nf-vp__top">
        <LogoMark size={36} title="Vallo" />
        <div className="nf-vp__brand">
          <span className="nf-vp__brand-name">VALLO SPACES</span>
          <span className="nf-vp__kind">{copy.documentKind}</span>
        </div>
      </header>

      <div className="nf-vp__main">
        <div className="nf-vp__photo" data-testid="passport-photo">
          {view.photo ? (
            <RemoteImage src={view.photo} alt={view.photoAlt} width={192} height={256} sizes="144px" />
          ) : (
            <span aria-hidden="true">{view.initial}</span>
          )}
        </div>
        <dl className="nf-vp__fields">
          <div className="nf-vp__field">
            <dt className="nf-vp__label">{copy.nameLabel}</dt>
            <dd className="nf-vp__value nf-vp__value--name" data-testid="passport-name">
              {view.name}
            </dd>
          </div>
          {view.role ? (
            <div className="nf-vp__field">
              <dt className="nf-vp__label">{copy.roleLabel}</dt>
              <dd className="nf-vp__value" data-testid="passport-role">
                {view.role}
              </dd>
            </div>
          ) : null}
          {view.joined ? (
            <div className="nf-vp__field">
              <dt className="nf-vp__label">{copy.joinedLabel}</dt>
              <dd className="nf-vp__value" data-testid="passport-joined">
                {view.joined}
              </dd>
            </div>
          ) : null}
          <div className="nf-vp__field">
            <dt className="nf-vp__label">{copy.numberLabel}</dt>
            <dd className="nf-vp__value nf-vp__value--number" data-testid="passport-number">
              {view.number}
            </dd>
          </div>
        </dl>
      </div>

      {view.level && !hideLevel ? (
        <div className="nf-vp__level" data-testid="passport-level" data-tier={view.level.tier}>
          <span className="nf-vp__level-mark" aria-hidden="true">
            {view.level.tier === "none" ? <UiIcon name="user" size={18} /> : <TierBadge tier={view.level.tier} size={24} decorative />}
          </span>
          <span className="nf-vp__level-text">
            <span className="nf-vp__label">{copy.levelLabel}</span>
            <span className="nf-vp__level-name">{view.level.label}</span>
            <span className="nf-vp__level-meaning">{view.level.meaning}</span>
          </span>
        </div>
      ) : null}

      {shownStats.length > 0 ? (
        <ul className="nf-vp__stats" aria-label={copy.recordLabel} data-testid="passport-stats">
          {shownStats.map((stat) => (
            <li
              key={stat.key}
              className={
                !stat.figure
                  ? "nf-vp__stat nf-vp__stat--wide"
                  : figures % 2 === 1 && stat.key === lastFigure
                    ? "nf-vp__stat nf-vp__stat--odd"
                    : "nf-vp__stat"
              }
              data-testid={`passport-stat-${stat.key}`}
            >
              <span className="nf-vp__label">{stat.label}</span>
              <span className={stat.figure ? "nf-vp__stat-value" : "nf-vp__stat-value nf-vp__stat-value--text"}>{stat.value}</span>
              {stat.sub ? <span className="nf-vp__stat-sub">{stat.sub}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Two lines of type for a machine, made from the fields above. Not
          read aloud: everything in them is already said in words. */}
      <p className="nf-vp__mrz" aria-hidden="true" data-testid="passport-mrz">
        {view.mrz[0]}
        {"\n"}
        {view.mrz[1]}
      </p>
    </article>
  );
}
