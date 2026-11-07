import type { ReactNode } from "react";
import type { BrandIconName } from "@/design-system/icons/BrandIcon";
import type { Icon3DName } from "@/components/ui/icon-3d";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { panelClass } from "@/components/ui/Panel";
import { State } from "@/components/ui/State";

/**
 * THE SCREEN LANGUAGE.
 *
 * One vocabulary for every screen a signed-in person uses. Not a utility bag:
 * a set of decisions taken once, here, so that twenty screens read as one
 * product instead of twenty.
 *
 * ---------------------------------------------------------------------------
 * WHY IT EXISTS
 * ---------------------------------------------------------------------------
 *
 * An audit of the signed-in screens found the same four jobs solved four ways
 * each. Three distinct empty states, at three object sizes (64, 80, 96), two of
 * them wrapped in a card so that a message whose entire job is to say "there is
 * nothing here" arrived inside a bordered box. Four section-heading treatments.
 * Section gaps from 1.25rem to 2rem with no rule behind which was which. Body
 * copy at 0.875rem and labels at 0.75rem across the whole product.
 *
 * Nothing was wrong on its own screen. Together they were the thing the owner
 * kept describing: choked, jam-packed, twenty pages by twenty people.
 *
 * ---------------------------------------------------------------------------
 * THE SURFACE LANGUAGE. Four surfaces, and only four.
 * ---------------------------------------------------------------------------
 *
 * The instruction was not "fewer boxes". It was a better container language:
 * decide what a surface MEANS, then apply it identically everywhere.
 *
 *   GROUND    The page. The default, and the right answer most of the time.
 *             Sections of a screen live here. They are grouped by a heading,
 *             by space and by alignment, never by a border. `Section`.
 *
 *   RAISED    The panel (`panelClass`, SW-C5). Reserved for a discrete OBJECT: a thing you could
 *             pick up and move somewhere else and it would still make sense.
 *             A listing card in a grid. A booking panel. A preview floating
 *             over a map. A section of a page is not an object, so a section
 *             is not raised.
 *
 *   INSET     A run of like things, separated by hairlines. `RowList`. This is
 *             the replacement for a stack of cards: eight cards are eight
 *             borders, eight radii and eight shadows; eight rows are seven
 *             lines. The reference platform uses this everywhere and so do we.
 *
 *   OVERLAY   `Sheet`, `ActionBar`. Temporary depth, above everything, for
 *             what is secondary in the layout but not secondary in importance.
 *
 * THE ONE HARD RULE: A RAISED SURFACE MAY NOT CONTAIN ANOTHER RAISED SURFACE.
 * Maximum nesting depth is one. If something inside a card wants a card, it
 * wants a `RowList` or a `Section`, or it wants to be behind a `Disclosure`.
 *
 * ---------------------------------------------------------------------------
 * NOTHING IS DELETED
 * ---------------------------------------------------------------------------
 *
 * Every capability stays reachable. When a screen is overloaded the answer is
 * hierarchy, grouping and progressive disclosure, never removal. That is what
 * `Disclosure` is for: it moves a secondary block one tap away into a sheet and
 * keeps it in the product. Losing function to gain calm would be a failure.
 *
 * ---------------------------------------------------------------------------
 * LINES
 * ---------------------------------------------------------------------------
 *
 * A line is drawn where two things genuinely need separating, and nowhere else.
 * Between rows of a list: yes. Above a section that begins a new subject: yes.
 * Around a group that a heading already groups: no.
 *
 * ---------------------------------------------------------------------------
 * COLOUR
 * ---------------------------------------------------------------------------
 *
 * Layer-2 semantic tokens only (ADR-002), so every surface here follows the
 * theme. Dark is the default and must feel calm; light is a true light theme,
 * not an inversion. Nothing in this file names a colour.
 */

/* ========================================================================== */
/* THE TYPE SCALE                                                             */
/* ========================================================================== */

/**
 * Five steps, and the hierarchy is carried by TYPE rather than by borders.
 *
 * That last clause is the point of the whole scale. If the steps between
 * display, heading, body, supporting and micro are clear enough, a reader knows
 * what is important without a box being drawn round it, and every border the
 * page then omits is a border it never needed.
 *
 * Every value is a step UP from what it replaced; the previous value is
 * recorded on each line, because "bigger" was asked for three times and the
 * diff is the evidence. Screens pick a ROLE, never a rem value, which is how
 * the platform ends up with one scale instead of the thirty-five arbitrary
 * literals the lint config counted.
 */
export const TYPE = {
  /**
   * A screen's own answer: the price on a property, and nothing else.
   *
   * THIS USED TO BE THE ONE ARBITRARY SIZE IN THE FILE, and its comment argued
   * that the arbitrariness was deliberate: `nf-display` was a landing-page size
   * and would set a rent above the title it belongs to, so there was nothing
   * between `nf-h1` and it to reach for. That was true and it was a hole in the
   * scale rather than an exception to it. `--nf-text-h0` is now that rung, at
   * exactly the 40 to 52px this was already drawing, so the role is a class like
   * every other one below it.
   */
  display: "nf-h0 text-[var(--nf-content-primary)]",
  /** Section headings. `nf-h3`, which is 1.1875rem on a phone and 1.4375 up. */
  sectionTitle: "nf-h3 text-[var(--nf-content-primary)]",
  /** The lead sentence of a block, and every empty-state body. 1.0625rem. */
  bodyLg: "nf-lede",
  /** Ordinary copy inside rows and panels. 1rem, up from 0.875. */
  body: "nf-body text-[var(--nf-content-secondary)]",
  /** A row's own title: the thing being named. */
  rowTitle: "nf-body font-semibold text-[var(--nf-content-primary)]",
  /** The supporting line under a row title. */
  rowMeta: "nf-body-sm text-[var(--nf-content-muted)]",
  /** Fact labels. Was 0.75rem, and usually shouted in uppercase as well. */
  label: "nf-body-sm font-semibold text-[var(--nf-content-muted)]",
  /** Micro: timestamps and counters, where small is genuinely correct. */
  caption: "nf-caption",
} as const;

/**
 * Icon sizes, on the 4px grid, floor of 20.
 *
 * A 16px glyph beside 1rem text reads as an apology for being there, and 16 was
 * the platform's most common inline size before this. Icons are never given a
 * container: no tile, no chip, no plate, no ring. The glyph sits on the surface
 * with its label beside or beneath it.
 */
export const ICON = {
  /** Inline with a line of text. Was 16. */
  inline: 20,
  /** Leading a row in a list. Was 16 to 20. */
  row: 24,
  /** Beside a section heading, or the mark on a fact. Was 16 to 20. */
  section: 28,
} as const;

/**
 * The gap between sections, as one class, applied by `Stack`.
 *
 * Chosen per screen is how the 1.25 / 1.5 / 1.75 / 2rem spread happened, so it
 * is not chosen per screen any more.
 *
 * It was `space-y-9 sm:space-y-11`, which is 36px stepping to 44px at exactly
 * one breakpoint. `section-tight` is the platform's own interval between two
 * subsections of a long page, it is a clamp from 32 to 48, and it grows
 * continuously instead of jumping at 640px. The screens using it therefore
 * breathe more at the top end than they used to and never reflow on the way.
 */
export const SECTION_GAP = "space-y-section-tight";

/* ========================================================================== */
/* SECTION: the GROUND surface                                                */
/* ========================================================================== */

/**
 * A section of a screen. Deliberately not a card.
 *
 * The heading, the space around it and the alignment of what is inside are what
 * group the content. A border around the group as well is the second container
 * the owner keeps pointing at, and it is the single most repeated piece of
 * noise in the product.
 *
 * `divided` draws ONE hairline above, for where a run of sections needs the eye
 * helped along. Space first, line only when space is not enough.
 */
export function Section({
  title,
  description,
  action,
  divided,
  children,
  className,
  headingLevel: Heading = "h2",
  id,
}: {
  /** Omit for a lead block that is content only. */
  title?: string;
  description?: string;
  /** The quiet action for this section. At most one. */
  action?: ReactNode;
  divided?: boolean;
  children: ReactNode;
  className?: string;
  headingLevel?: "h2" | "h3";
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`${divided ? "nf-hairline pt-section-tight" : ""} ${className ?? ""}`}
    >
      {(title || action) && (
        /* `mb-heading` is the platform's one answer to "how much room goes
           between a heading and the thing it heads". It was mb-4, which is 16
           and the interval for two siblings INSIDE a group, so a section title
           sat as close to its content as two rows of a list sit to each other
           and the grouping had to be carried by weight alone. */
        <div className="mb-heading flex items-baseline justify-between gap-md">
          <div className="min-w-0">
            {title && <Heading className={TYPE.sectionTitle}>{title}</Heading>}
            {description && <p className={`mt-row ${TYPE.body}`}>{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A screen's sections, on the one platform rhythm. */
export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`${SECTION_GAP} ${className ?? ""}`}>{children}</div>;
}

/* ========================================================================== */
/* EMPTY STATE                                                                */
/* ========================================================================== */

/**
 * The empty state. One shape, every screen.
 *
 * The platform has no listings yet, so a real person meets this composition
 * more often than any other in the product. It is therefore a first-class
 * screen, not a fallback.
 *
 * Three rules, and they are the owner's:
 *
 *   1. NO CONTAINER. The object and the words sit on the ground. Two of the
 *      three shapes this replaces wrapped themselves in an `.nf-card`, putting
 *      a bordered box around a message whose whole job is to say the box is
 *      empty.
 *   2. IT MUST BE TRUE. No invented counts, no fabricated testimonials, no
 *      promise of content that does not exist. The body describes the state the
 *      reader is actually in.
 *   3. ONE ACTION, at full strength, and a quiet text link at most beside it.
 *
 * GRADE 1 (SW7): one thin glyph. The default is the named object's line twin
 * on the kind's plate (`State`), never a 3D object derived from `icon`; a
 * caller that wants the founder's art for a record moment names it with `art`.
 */
export function EmptyState({
  icon,
  art,
  title,
  body,
  action,
  secondary,
  className,
  "data-testid": testId,
}: {
  icon: BrandIconName;
  /** The founder's art, asked for by name (record moments); see `State`'s `art`. */
  art?: Icon3DName | false;
  title: string;
  /** One or two sentences, true of the state the reader is actually in. */
  body: string;
  /** The single next thing to do. Omit where there honestly is not one. */
  action?: ReactNode;
  /** A quiet text link. Never a second button competing with the first. */
  secondary?: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  /* V-97: the anatomy now lives in the one State kit, and this is a thin
     wrapper over it while the call sites move. The glyph, the balanced title
     and the one-step-down body are the kit's; the reasons for each are
     recorded in `components/ui/State.tsx`. */
  return (
    <State
      kind="empty"
      icon={icon}
      {...(art !== undefined ? { art } : {})}
      title={title}
      body={body}
      action={action}
      footnote={secondary}
      {...(className ? { className } : {})}
      {...(testId ? { "data-testid": testId } : {})}
    />
  );
}

/* ========================================================================== */
/* ROW LIST: the INSET surface                                                */
/* ========================================================================== */

/**
 * A run of like things, separated by hairlines.
 *
 * The replacement for a stack of cards, and the pattern the reference platform
 * uses throughout. `boxed` puts ONE surface around the whole list, for where
 * the list needs to read as a single object against the page: one container for
 * n rows rather than n containers for n rows.
 */
export function RowList({
  children,
  boxed,
  inset = true,
  className,
  "data-testid": testId,
}: {
  children: ReactNode;
  /** Put ONE glass surface around the whole list. See `Surface`. */
  boxed?: boolean;
  /**
   * Inset the dividers so they clear the leading glyph column.
   *
   * On by default, because it is what makes a boxed list read as one object
   * with parts. Turn it off for a list with no leading glyphs, where an
   * indented line would look like a mistake rather than an alignment.
   */
  inset?: boolean;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    /* Boxed, the list is the shared panel (SW-C5): the 10px container corner
       and the lit edge come from the panel, never from a utility here. `block`
       and `py-0` keep the list's own flow and rhythm, so nothing moves. */
    <ul
      data-testid={testId}
      className={`nf-rows ${inset ? "nf-rows--inset" : ""} ${
        boxed ? panelClass({ variant: "card", className: "block overflow-hidden py-0 px-lg sm:px-xl" }) : ""
      } ${className ?? ""}`}
    >
      {children}
    </ul>
  );
}

/**
 * One row of a `RowList`.
 *
 * `nf-row` carries the geometry: 56px minimum, which is the comfortable end of
 * the accessible range rather than the 44px floor, because this product is used
 * one-handed on a phone. Several of the `py-3.5` rows this replaces were under
 * the floor entirely.
 */
export function Row({
  children,
  className,
  tappable,
}: {
  children: ReactNode;
  className?: string;
  /** The whole row is the target, not the label inside it. */
  tappable?: boolean;
}) {
  return (
    <li className={`nf-row ${tappable ? "nf-row--tap" : ""} ${className ?? ""}`}>{children}</li>
  );
}

/* ========================================================================== */
/* SURFACE: the RAISED surface, and the only place its geometry is decided    */
/* ========================================================================== */

/**
 * One large, calm, generous glass surface.
 *
 * THE MATERIAL IS THE PANEL. Since the platform sweep (SW-C5) the raised
 * surface is the console's panel card: the 10px container corner, the per-side
 * lit edge, the catchlight and the halo, all from the shared layer. What this
 * primitive decides is the SCALE and what goes inside.
 *
 * ONE CONTAINER PER GROUP, NOT ONE PER ITEM. This is the whole idea and it is
 * most of why the reference platform's screens feel calm: their settings screen
 * puts account information, profile switching, payments and history inside a
 * SINGLE rounded surface separated by hairlines, where we would have drawn four
 * cards. Two or three surfaces per screen against our eight or nine. If you are
 * about to render two of these next to each other, they are almost certainly
 * one of these with a `RowList` inside it.
 *
 * BIG PADDING. The corner is the panel's (10px); `p-card` stepping to
 * `p-cell`, against the `p-4`/`p-5` and medium radius that was everywhere. A
 * surface should feel roomy. If it feels tight it is holding too much, not
 * padded too little. Those two are the scale's own names for "the inside of an
 * ordinary card" and "the inside of a part of a grouped surface", which is 24
 * and 32; they were typed as `p-6 sm:p-8` and meant exactly that.
 *
 * NO SECOND BORDER. The glass already reads as a LIFT off the canvas through
 * its rim and its elevation, so nothing here adds a visible outline on top of
 * that. An outlined box and a lifted surface are two different container
 * languages and drawing both at once is what makes a card look heavy.
 *
 * THE LABEL GOES OUTSIDE. A heading inside the surface costs a line of padding
 * and makes the surface look busier than it is. `Section` puts the title above,
 * small and quiet, and the surface holds only content. That pairing - label
 * outside, content inside - is the standard composition.
 *
 * NOTHING NESTED. Inside one of these you find rows, text and controls. You do
 * not find another one. That is the one hard rule of the surface language and
 * it has no exceptions.
 */
export function Surface({
  children,
  className,
  tone = "card",
  "data-testid": testId,
}: {
  children: ReactNode;
  className?: string;
  /**
   * `card` is the raised surface above. `glass` is the register's rows card
   * (the settings and admin renders): the same object made of glass, with the
   * brand hairline and the lit rim, for the one surface a screen is built
   * around. Off by default; the card every screen draws is unchanged.
   */
  tone?: "card" | "glass";
  "data-testid"?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={`${
        tone === "glass"
          ? "nf-glass nf-surface--glass rounded-[var(--nf-radius-xl)]"
          : panelClass({ variant: "card", className: "block" })
      } p-card sm:p-cell ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/**
 * The glyph tile the renders draw at the leading edge of a row: a glass square
 * holding a line glyph in the quiet brand ink (Account Information, Payment
 * Methods, Log Out on the settings render). Decorative by definition, because
 * the row's title names the thing; a second announcement would be noise.
 *
 * It is the ONE container an icon gets on the platform, and it is allowed
 * because the renders draw it, on the founder's identical-to-images ruling;
 * the note beside `ICON` above still holds everywhere the renders do not.
 */
export function RowGlyph({ icon, className }: { icon: UiIconName; className?: string }) {
  return (
    <span aria-hidden="true" className={`nf-row-glyph ${className ?? ""}`}>
      <UiIcon name={icon} size={ICON.row} />
    </span>
  );
}

/* ========================================================================== */
/* FACTS                                                                      */
/* ========================================================================== */

export type Fact = {
  /** What the number or word is. Sentence case, never shouted in caps. */
  label: string;
  /** The answer. A node so a value can carry an inline mark. */
  value: ReactNode;
  /** One clarifying line under the value, where the value needs one. */
  note?: string;
  icon?: UiIconName;
};

/**
 * The key facts of a thing, on a grid.
 *
 * Label above value, aligned in columns. No chip, no tile, no bordered cell:
 * the grid does the grouping, which is the whole argument for alignment over
 * containers. Two columns on a phone so nothing is squeezed, three from `sm`.
 *
 * A fact with no answer is not rendered at all. Nothing here prints a zero or a
 * dash in place of something nobody stated, because "not stated" and "none" are
 * different facts and only one of them is news. Callers build the array by
 * filtering, so the grid never has to decide what an absence means.
 */
export function FactGrid({ facts, className }: { facts: Fact[]; className?: string }) {
  if (facts.length === 0) return null;
  return (
    /*
       `gap-y-lg`, and it was `gap-y-xl`.

       A fact here is a label and one short answer: about two lines of type. The
       row gap was larger than the rows themselves, so "The details" on a
       listing spread eight small facts down most of a phone screen and read as
       eight separate things rather than as one block of specification. The
       horizontal gap stays where it is, because columns need to be told apart
       and rows in the same table do not. */
    <dl
      className={`grid grid-cols-2 gap-x-lg gap-y-lg sm:grid-cols-3 ${className ?? ""}`}
      data-testid="fact-grid"
    >
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className={`flex items-center gap-inline ${TYPE.label}`}>
            {fact.icon && <UiIcon name={fact.icon} size={ICON.inline} className="shrink-0" />}
            {fact.label}
          </dt>
          {/* The answer sits one step down, at body rather than body-lg. A
              specification grid is scanned, not read: at the lede size eight
              answers competed with the section heading above them, which is the
              "everything is too big" complaint in one element. Semibold at body
              size still separates the answer from its label without shouting. */}
          <dd className="mt-inline-tight nf-body font-semibold leading-snug text-[var(--nf-content-primary)]">
            {fact.value}
          </dd>
          {fact.note && <p className={`mt-inline-tight ${TYPE.caption} leading-snug`}>{fact.note}</p>}
        </div>
      ))}
    </dl>
  );
}
