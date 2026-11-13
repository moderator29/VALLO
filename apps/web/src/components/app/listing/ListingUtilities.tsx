import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { DetailGlyph } from "./DetailGlyph";
import type { Listing } from "@/lib/listings/types";
import type { ListingAccessView } from "@/lib/listings/access-queries";
import { ICON, TYPE } from "@/components/app/Screen";
import { countOf, DEFAULT_LOCALE, type Dictionary, type Locale } from "@vallo/i18n/core";
import { getDictionary } from "@vallo/i18n";

/**
 * Light, water, and getting through the gate.
 *
 * The three questions a Nigerian renter asks before the price, and the reason
 * nobody else can answer them: they are structured columns here, not a tick box
 * called "Backup Power" that flattens Band A and a generator running seven to
 * eleven into the same claim.
 *
 * Unanswered is rendered as unanswered. A host who has not said whether there
 * is light must not have silence read as a yes, so the row says so plainly and
 * points at the one control that gets a real answer: the thread with the agent.
 *
 * The gate block has three states and they are all designed. Before a booking
 * is confirmed the guest is told the details exist and when they arrive. After
 * confirmation the real details are here, read through the caller's own
 * policies. A listing with no gate at all omits the block, because a panel
 * explaining the absence of a gate is noise.
 *
 * ---------------------------------------------------------------------------
 * THE SURFACE CHANGED, THE FACTS DID NOT.
 *
 * This was an `.nf-card` carrying its own `h2`, sitting inside the detail
 * page's glass content sheet: a bordered box inside a bordered box, which is
 * the nesting the whole rebuild exists to remove. It is now a run of hairline
 * rows on the GROUND, with the heading supplied by the page's `Section` so
 * there is exactly one heading treatment for every section of the screen.
 *
 * Objects went from 40px to 56px and the values from 0.9375rem to 1rem, on the
 * shared scale in `Screen.tsx`. No object here sits on a tile, a chip or a
 * ring: the mark sits on the surface with its label beside it.
 * ---------------------------------------------------------------------------
 * ONE ICON FAMILY (13 November 2026). The rows used to carry realistic 3D
 * objects (a generator, a meter, a borehole pump) for a stated answer. The
 * founder asked for the listing page to use one icon family, and these were
 * the only illustrations among line glyphs, so every row now wears its line
 * glyph on the page's one plate, answered or not. The prepaid meter keeps its
 * own row: a fact about how the light is paid for, not a promise.
 * ---------------------------------------------------------------------------
 */

/* The grid, backup and water words live in the dictionary
   (`experienceDetail.utilities`), with the article reasoning below kept
   beside them there (Round 3 sweep, C3). */
type UtilitiesCopy = Dictionary["experienceDetail"]["utilities"];
type Labelled = Record<string, { label: string; detail: string }>;

/**
 * The backup as it belongs inside a sentence, article and all.
 *
 * The first version of this read "Band A and generator and inverter, 24 hours a
 * day", which is two ANDs doing different jobs in one clause and reads as a
 * mistake. A label list and a sentence list are not the same list.
 */

export function ListingUtilities({
  locale = DEFAULT_LOCALE,
  utilities,
  access,
  bookingConfirmed,
  copy = getDictionary(DEFAULT_LOCALE).experienceDetail.utilities,
}: {
  /** The section's words (`t.experienceDetail.utilities`); English by default. */
  copy?: UtilitiesCopy;
  locale?: Locale;
  utilities: Listing["utilities"];
  /** The real gate details, or null when the caller may not see them. */
  access: ListingAccessView | null;
  /** True when this caller holds a confirmed booking on this listing. */
  bookingConfirmed: boolean;
}) {
  if (!utilities) return null;

  const grid = utilities.powerGrid ? (copy.grid as Labelled)[utilities.powerGrid] : undefined;
  const backup = utilities.powerBackup ? (copy.backup as Record<string, string>)[utilities.powerBackup] : undefined;
  const water = utilities.waterSupply ? (copy.supply as Labelled)[utilities.waterSupply] : undefined;
  const hours = utilities.powerBackupHours;

  const powerAnswered = Boolean(grid || backup);
  const nothingAnswered = !powerAnswered && !water && !utilities.hasEstateAccess;
  if (nothingAnswered) return null;

  const runs =
    backup && utilities.powerBackup !== "NONE" && typeof hours === "number"
      ? copy.runs.replace("{backup}", backup).replace("{hours}", countOf(hours, "hours", locale))
      : backup;

  const powerLine = grid
    ? runs
      ? copy.gridWith.replace("{grid}", grid.label).replace("{runs}", runs)
      : grid.label
    : runs
      ? `${runs.charAt(0).toUpperCase()}${runs.slice(1)}`
      : copy.gridNotStated;

  return (
    <dl className="divide-y divide-[var(--nf-panel-hair)]">
      <Row
        notAnswered={copy.notAnswered}
        icon="bolt"
        term={copy.light}
        answered={powerAnswered}
        value={
          powerAnswered ? (
            <>
              <span className="block text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">
                {powerLine}
              </span>
              {grid && <span className={`mt-2xs block ${TYPE.rowMeta}`}>{grid.detail}</span>}
            </>
          ) : null
        }
      />

      {utilities.prepaidMeter && (
        <Row
          notAnswered={copy.notAnswered}
          icon="bolt"
          term={copy.prepaidMeter}
          answered
          value={<span className={`block ${TYPE.body}`}>{copy.prepaidMeterBody}</span>}
        />
      )}

      <Row
        notAnswered={copy.notAnswered}
        icon="droplet"
        term={copy.water}
        answered={Boolean(water)}
        value={
          water ? (
            <>
              <span className="block text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">
                {water.label}
              </span>
              <span className={`mt-2xs block ${TYPE.rowMeta}`}>{water.detail}</span>
            </>
          ) : null
        }
      />

      {utilities.hasEstateAccess && (
        /* The same row anatomy as `Row` below: a <dl>'s <div> may hold only
           <dt> and <dd>, and the object and an inner wrapper sat between them
           here (axe `definition-list` and `dlitem`, Round 3 sweep). The glyph
           floats inside the term, as in every other row. */
        <div className="flow-root py-md">
          <dt className={TYPE.label}>
            <DetailGlyph name="gate" className="float-left mr-sm" />
            {copy.gate}
          </dt>
          <dd className="mt-2xs min-w-0 overflow-hidden">
              {access ? (
                <div data-testid="gate-details">
                  {access.estateName && (
                    <p className="text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">
                      {access.estateName}
                    </p>
                  )}
                  {access.gateDirections && (
                    <p className={`mt-2xs whitespace-pre-wrap ${TYPE.body}`}>
                      {access.gateDirections}
                    </p>
                  )}
                  {access.securityPhone && (
                    <p className={`nf-numeric mt-xs ${TYPE.body}`}>
                      {copy.securityDesk}{" "}
                      <a
                        href={`tel:${access.securityPhone.replace(/\s+/g, "")}`}
                        className="font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline"
                      >
                        {access.securityPhone}
                      </a>
                    </p>
                  )}
                  {access.accessCode && (
                    <p className={`nf-numeric mt-2xs ${TYPE.body}`}>
                      {copy.accessCode} <span className="font-bold">{access.accessCode}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div data-testid="gate-withheld">
                  <p className="flex items-center gap-xs text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">
                    <UiIcon name="lock" size={ICON.inline} className="shrink-0 text-[var(--nf-plate-neutral-ink)]" />
                    {copy.gated}
                  </p>
                  <p className={`mt-2xs ${TYPE.body}`}>
                    {bookingConfirmed ? copy.gatedConfirmed : copy.gatedBefore}
                  </p>
                </div>
              )}
          </dd>
        </div>
      )}
    </dl>
  );
}

function Row({
  icon,
  term,
  answered,
  value,
  notAnswered,
}: {
  notAnswered: string;
  icon: UiIconName;
  term: string;
  answered: boolean;
  value: React.ReactNode;
}) {
  /*
   * A row of a <dl> may be a <div>, but that <div> may hold only <dt> and
   * <dd>. The icon and an inner wrapper used to sit between them (axe
   * `definition-list`, `dlitem`), so assistive tech read the terms as orphans.
   * The icon now floats inside the <dt> and the <dd> is its own formatting
   * context beside it, which keeps the two-column look. Both stay real boxes:
   * older WebKit (the iOS app's web view) drops the role of an element with
   * `display: contents`.
   */
  return (
    <div className="flow-root py-md first:pt-0">
      <dt className={TYPE.label}>
        {/* The line glyph on the page's one plate, floated so the term and
            the answer run beside it. The 3D objects (a generator, a meter, a
            borehole) went on 13 November 2026: the founder asked for one icon
            family, and they were the only illustrations among line glyphs. */}
        <DetailGlyph name={icon} className="float-left mr-sm" />
        {term}
      </dt>
      <dd className="mt-2xs min-w-0 overflow-hidden">
        {answered ? (
          value
        ) : (
          <span className={TYPE.body}>{notAnswered}</span>
        )}
      </dd>
    </div>
  );
}
