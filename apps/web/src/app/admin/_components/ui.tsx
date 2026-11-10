import type { CSSProperties, ReactNode } from "react";
import { formatDate, type Dictionary, type Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { CountUp } from "@/components/motion/CountUp";
import { toneForStatus, type StatusTone } from "@/components/ui/StatusPill";
import { ConsoleStatus } from "./chip-state";
import { QUEUE_EMPTY_MARK, queueEmptyKind, type QueueEmptyKind } from "./queue-empty";
import { fill, type AdminCommon } from "./copy";
import { CopyValue } from "@/components/ui/CopyButton";

/** Labels whose value people copy: a reference, id, email, case, ticket or number. */
const COPYABLE_LABEL = /\b(ref|reference|id|email|case|ticket|number|code)\b/i;

/**
 * The console's shared furniture.
 *
 * Server-safe on purpose: no hooks, no client boundary, so a queue page can
 * render its whole list on the server and only hand the decision controls to
 * the browser. Everything here reuses the platform's own glass, chip and badge
 * classes rather than inventing an admin look, because the console is part of
 * Vallo, not a separate product.
 *
 * The pieces are handed out by `adminUi(t, locale)` rather than exported one by
 * one. Every one of them carries copy, and a page that had to thread "Not
 * given" through twenty `DetailRow` call sites would sooner or later miss one.
 * One call at the top of a page binds the locale and the dictionary to all of
 * them at once, which is what keeps a queue from ending up half translated.
 *
 * ----------------------------------------------------------------------------
 * WHY THIS FILE MOVED TO THE SPACING AND TYPE SCALES FIRST.
 *
 * Every screen in the console draws its heading, its empty state, its detail
 * rows and its metric tiles from here. Twenty pages were carrying `mb-5`,
 * `p-4`, `gap-3` and `text-[length:var(--nf-text-body-sm)]` because those were the values this file
 * handed them, so the console's rhythm was set in one place and it was set
 * against no scale at all. Moving this file moves all twenty at once, and every
 * page that stops hand-rolling a tile stops inventing a fifth padding value for
 * it.
 *
 * The type went UP a tier across the board. `text-[length:var(--nf-text-body-sm)]` on a detail value
 * and `text-[length:var(--nf-text-overline)]` on its label is a reading size chosen for a dense table,
 * and this console is not a dense table: it is where somebody decides whose
 * money moves, at eleven at night, and the old sizes made that decision harder
 * to read than the marketing pages that carry no consequence at all. Detail
 * values are `nf-body` now, labels are `nf-overline`, and the icons that go
 * with them grew to match.
 * ----------------------------------------------------------------------------
 */

/**
 * The console no longer owns a status vocabulary.
 *
 * `Tone`, `statusTone` and `TONE_STYLE` used to live here, and were one of four
 * competing implementations across the platform, so the same MORE_INFO_REQUIRED
 * row was one colour in the admin queue and another in the agent's workspace.
 * Everything now routes through `toneForStatus` and `<StatusPill>`, which is the
 * single map; the console's job is to name a status, not to colour it.
 *
 * The two washes below are NOT a status vocabulary. They tint the round glyph
 * on an empty-queue panel and a checklist row, where the meaning is "this is
 * fine" / "this needs a look" and no status is being reported at all.
 */
const SUCCESS_INK: CSSProperties = { color: "var(--nf-state-success)" };

/*
 * `WARNING_WASH` IS GONE, AND ITS ABSENCE IS THE POINT.
 *
 * It was `--nf-state-warning-surface`, and `--nf-state-warning` is defined as
 * `var(--nf-cyan-400)` while `--nf-status-pending` is defined as
 * `var(--nf-state-warning)`. They are the same value under two names. Both
 * users of this wash in this file were FAILURES - a queue that could not be
 * read, and an admission check that did not pass - so both were drawn in the
 * colour the product reserves for "still going through". Neither is. If a
 * genuinely in-flight console state ever needs a wash, it takes the pending
 * token by its own name rather than borrowing the warning one.
 */

/** Nothing has happened here. Not good news, not bad news, not a state. */
const NEUTRAL_INK: CSSProperties = { color: "var(--nf-content-muted)" };


const DANGER_INK: CSSProperties = { color: "var(--nf-state-error)" };

/*
 * THE TINTED PLATES ARE GONE, AND THAT IS FOUR OF THE FIVE THE STANDARD BANS.
 *
 * Each of these glyphs sat in a `grid place-items-center rounded-full` disc
 * filled with a state wash. `docs/ICON_SYSTEM.md` records that a tinted tile
 * behind a glyph came from the retired reference brief and is not part of this
 * system, citing `RECOMMENDATIONS.md` D-2 and D-5, and it is worse than
 * decoration in the light theme: a soft brand tint on white reads as lavender,
 * which is a hue family this brand has banned by name.
 *
 * The argument for the plate was that it stops a lone glyph floating in the
 * middle of an empty panel, which is a real problem and a box is the wrong
 * answer to it. `ComingSoon.tsx` had already arrived at the right one: what
 * stops an object floating is its SIZE and the air around it. So the panel
 * glyphs went up a rung to 40, which is the top of `UI_ICON_SIZES` and exists
 * for exactly this, and the washes become ink.
 *
 * The checklist row's glyph went UP as well, from 14 to 20. Fourteen is not on
 * the scale at all - the rungs are 16, 20, 24, 28, 32, 40 - and it was only
 * that small because it had to fit inside a 24px disc. With the disc gone there
 * is nothing to fit inside, and a tick that decides whether an agent is
 * admitted can afford to be legible.
 */

/** What a metric tile is telling you. Not a status; a temperature. */
export type StatTone = "neutral" | "warning" | "danger" | "success";

const STAT_VALUE_COLOUR: Record<StatTone, string> = {
  neutral: "var(--nf-content-primary)",
  warning: "var(--nf-state-warning)",
  danger: "var(--nf-state-error)",
  success: "var(--nf-state-success)",
};

export type AdminUi = ReturnType<typeof adminUi>;

export function adminUi(t: Dictionary, locale: Locale) {
  const c: AdminCommon = t.admin.common;
  // The status vocabulary is keyed by the machine values the queries return,
  // which arrive as plain strings, so the lookup is widened deliberately and
  // falls back to the raw value rather than to a blank chip.
  const statusNames = c.status as Record<string, string | undefined>;
  /*
   * The per-column vocabulary, straight off the typed dictionary.
   *
   * It used to be widened through `unknown` into an OPTIONAL branch, with an
   * English copy of every word staged in `copy.ts` behind it, because
   * `packages/i18n` was another owner's file and the keys did not exist. They
   * exist now, in all four languages, so the optional read and the staged
   * English have become the one thing they were never meant to be: a second
   * copy of thirty-one strings that nothing keeps in step with the dictionary,
   * and a silent catch for a key deleted by accident. A missing key would have
   * fallen through to English on a Hausa console and nothing would have said
   * so.
   *
   * `Dictionary` is `typeof en`, so every column and every value below is
   * required and exhaustively typed. Deleting one, or adding a value to a
   * column without a word for it, is a compile error here rather than a raw
   * database value on an operator's screen.
   */
  const columnWords = c.columns;

  /*
   * The tone of a metric tile, in words, for anybody who cannot see the colour
   * or the left rule.
   *
   * This was a module constant in English with a note saying the keys belonged
   * to whoever owned the dictionary. It is the ONLY non-visual signal a flagged
   * figure carries, so leaving it in English meant a Hausa operator using a
   * screen reader heard the one part of Rule 13's answer in a language they had
   * not chosen. `neutral` has no word on purpose: an unflagged number is not
   * flagged, and announcing "neutral" after every figure on the money screen
   * would be noise.
   */
  const statToneWord: Record<StatTone, string> = { neutral: "", ...c.statTone };

  /**
   * Lagos time, always, so the server and the browser never disagree on a
   * date, and in the reader's language so the month reads to them. The shared
   * formatter does the work; nothing here reimplements one.
   */
  function when(iso: string | null): string {
    if (!iso) return c.notRecorded;
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) return c.notRecorded;
    return formatDate(new Date(parsed), locale, {
      timeZone: "Africa/Lagos",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * A calendar date with no clock on it.
   *
   * A check-in is a day, not a moment. Running one through `when` above prints
   * "01:00" beside it, because a bare date parses as UTC midnight and Lagos is
   * an hour ahead, which reads to an operator as a time the guest agreed to.
   * Anchoring at midday Lagos removes the question entirely.
   */
  function day(iso: string | null): string {
    if (!iso) return c.notRecorded;
    const parsed = Date.parse(iso.length <= 10 ? `${iso}T12:00:00+01:00` : iso);
    if (Number.isNaN(parsed)) return c.notRecorded;
    return formatDate(new Date(parsed), locale, {
      timeZone: "Africa/Lagos",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  /** Human wording for the canonical machine values. */
  function statusLabel(status: string): string {
    return statusNames[status] ?? status;
  }

  /**
   * A value from a column that is not `status`, named for a person.
   *
   * -------------------------------------------------------------------------
   * FOUR CONSOLE SURFACES WERE PRINTING THE DATABASE AT THE OPERATOR.
   *
   * `label={entry.status}` put `PENDING`, `COMPLETED`, `FAILED` and `REVERSED`
   * on the money screen in shouting capitals. `label={doc.reviewStatus}` put
   * raw lower-case `pending`, `approved`, `rejected` on the identity queue.
   * `label={report.targetType}` and `label={report.category.replace(/_/g," ")}`
   * put `listing` and `off platform payment` on the reports queue. The console
   * is part of Vallo by its own file header and it was showing somebody the
   * schema.
   *
   * WHY NOT JUST DROP THE `label` AND LET `statusLabel` ANSWER, which is what
   * F2-060 proposes. Because `t.admin.common.status` is a single flat map keyed
   * by bare value, and the values collide across columns. `PENDING` in that map
   * reads "Requested", which is right for a booking and wrong for a wallet
   * entry, where it means the money has not settled. Dropping the label would
   * have replaced four shouting-caps chips with one confidently mistranslated
   * one, on the money screen. A value only means something inside its own
   * column, so the lookup is keyed by column as well as by value.
   *
   * THE DICTIONARY BRANCH DOES NOT EXIST YET AND THIS DOES NOT WAIT FOR IT.
   * `packages/i18n` is another owner's, so this reads `t.admin.common.columns`
   * if it is there and otherwise makes the raw value readable: underscores to
   * spaces, one capital at the front, the rest lower case. `PENDING` becomes
   * "Pending" and `off_platform_payment` becomes "Off platform payment", which
   * is not translation and is not pretending to be. It is strictly better than
   * the column, it is honest about being English, and it costs nothing to
   * remove: the moment the keys land, every one of these chips speaks four
   * languages with no change here. The exact keys are in the sprint report.
   */
  function columnLabel(column: string, value: string | null | undefined): string {
    if (!value) return c.notRecorded;
    /* The dictionary, then a readable version of the raw value. The middle
       tier is gone with the staged English above it.

       THE FALLBACK STAYS, and it is not dead code. Three of these columns are
       plain `text` rather than enums, so the database can hold a value nobody
       has written a word for: `reports.target_type` and `reports.category` are
       written by two different modules, and `agent_verification_checks.status`
       is guarded only by a check constraint. A value that arrives without a
       word becomes "Off platform payment" rather than `off_platform_payment`,
       which is still English and still better than the column. */
    const translated = (columnWords as Record<string, Record<string, string | undefined>>)[
      column
    ]?.[value];
    if (translated) return translated;
    const spaced = value.replace(/_/g, " ").trim();
    if (spaced.length === 0) return c.notRecorded;
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
  }

  function StatusChip({
    status,
    label,
    tone,
  }: {
    status?: string;
    label?: string;
    tone?: StatusTone;
  }) {
    return (
      <ConsoleStatus tone={tone ?? toneForStatus(status ?? "")} className="shrink-0">
        {label ?? statusLabel(status ?? "")}
      </ConsoleStatus>
    );
  }

  /**
   * The waiting count as a brand badge, "3 waiting". A queue page hands it to
   * the console's one header (`PageHead`, AD-01) as its `trail`, beside the
   * title. Draws nothing at zero: an empty queue says so in its own panel.
   */
  function WaitingBadge({ count }: { count: number }) {
    if (count <= 0) return null;
    return <span className="nf-badge nf-badge--brand nf-numeric">{fill(c.waiting, { count })}</span>;
  }

  /**
   * The heading the queue pages opened with before they moved onto `PageHead`
   * (AD-01). Kept for the development previews still drawn with it; every live desk is on PageHead.
   */
  function QueueHeader({
    title,
    lede,
    count,
  }: {
    title: string;
    lede: string;
    count?: number;
  }) {
    /* The register's headline (278CC66A): the display title, the count as
       a brand badge beside it, the sub-line under. Same props as before, so
       every desk inherits the frame without a call-site change. */
    return (
      <header className="nf-admin-head">
        <div className="flex flex-wrap items-center gap-inline">
          <h1 className="nf-admin-head__title">{title}</h1>
          {typeof count === "number" && <WaitingBadge count={count} />}
        </div>
        <p className="nf-admin-head__sub">{lede}</p>
      </header>
    );
  }

  /**
   * A section of a page, with its heading and the air under it.
   *
   * Every console page was writing `<h2 className="mb-2 text-[length:var(--nf-text-body)] ...">` by
   * hand and then a list under it, which is how one page ended up with 8px of
   * air under a heading and the next with 12px. One interval, named for the
   * relationship it expresses, decided once.
   */
  function Section({
    title,
    hint,
    action,
    children,
  }: {
    title: string;
    hint?: string;
    action?: ReactNode;
    children: ReactNode;
  }) {
    return (
      <section className="nf-section--tight">
        <div className="flex flex-wrap items-baseline justify-between gap-inline">
          <h2 className="nf-h4">{title}</h2>
          {action}
        </div>
        {hint && <p className="nf-body-sm mt-inline-tight max-w-[68ch] text-content-2">{hint}</p>}
        <div className="mt-heading">{children}</div>
      </section>
    );
  }

  /**
   * One number, named, with a temperature.
   *
   * The escrow, money and payments screens each hand-rolled this tile with
   * their own padding and their own type sizes. A number an operator is meant
   * to scan is the one thing on these pages that should be big, so the value
   * is `nf-h3` rather than the 1.25rem the hand-rolled versions used.
   */
  /**
   * A metric tile.
   *
   * THE TONE WAS CARRIED IN COLOUR AND NOTHING ELSE. A `danger` stat was a rose
   * number and a `warning` stat a cyan one, with nothing else different, and on
   * the money and payments screens these are the headline figures an operator
   * scans. Rule 13: colour is never the only signal.
   *
   * A left rule in the tone answers it, because it survives greyscale, it costs
   * no layout, and it reads down a row of tiles as a shape rather than a hue.
   * The screen-reader name says the same thing in words, so a figure that is
   * flagged is flagged in three ways and not one.
   */
  function Stat({
    label,
    value,
    hint,
    tone = "neutral",
  }: {
    label: string;
    value: string;
    hint?: string;
    tone?: StatTone;
  }) {
    const flagged = tone !== "neutral";
    return (
      /* The rule is an inset shadow rather than a left border: see
         `.nf-admin-stat--flagged` in admin.css for why a 4px border on a 22px
         radius reads as a crescent. The ink travels as a custom property so
         the tone stays a decision here and the geometry stays in the
         stylesheet. */
      <div
        className={`nf-panel nf-panel--card nf-admin-card p-card${flagged ? " nf-admin-stat--flagged" : ""}`}
        style={
          flagged
            ? ({ "--nf-admin-stat-ink": STAT_VALUE_COLOUR[tone] } as CSSProperties)
            : undefined
        }
      >
        <p className="nf-overline">{label}</p>
        <p
          className="nf-numeric nf-h3 mt-inline-tight"
          style={{ color: STAT_VALUE_COLOUR[tone] }}
        >
          {/* A whole count arrives counting up (north star 12, point 7), as
              the overview's figures do; a formatted figure (money, a date)
              stays the string it was given. The server prints the final
              number either way. */}
          {/^\d+$/.test(value) ? <CountUp value={Number(value)} eager /> : value}
          {flagged && <span className="sr-only"> {statToneWord[tone]}</span>}
        </p>
        {hint && <p className="nf-caption mt-inline-tight">{hint}</p>}
      </div>
    );
  }

  /** A row of metric tiles, which is how every money screen opens. */
  function StatRow({ children }: { children: ReactNode }) {
    return (
      <div className="mb-block grid gap-row sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    );
  }

  /**
   * An empty queue, and there are TWO of those.
   *
   * This drew a green circle with a verified tick and the words "all clear" on
   * every one of the nineteen console destinations. Checked against the
   * database: `agent_applications` 0, `reports` 0, `risk_alerts` 0,
   * `message_flags` 0, `escrows` 0, `bookings` 0, `transactions` 0,
   * `payout_accounts` 0, `agent_documents` 0. Not one of those tables has ever
   * held a row. So on day one an operator opens the console and is congratulated
   * nineteen times for clearing work that never arrived.
   *
   * "Nothing has ever arrived here" and "you have cleared everything" are
   * different facts and the second one is a CLAIM. A tick is earned by somebody
   * having done something; it does not belong on a queue nobody has ever used.
   *
   * The never-used state is neutral, carries no tick, and says what will appear
   * here and what puts it there, because that is the primary state of the
   * entire console today and it deserves to be designed as such rather than
   * inherited from the good-news one.
   *
   * `everHadRows` defaults to true so the nineteen call sites that have not
   * been told which state they are in keep the behaviour they had, and a page
   * that can answer the question opts into the honest one.
   *
   * ---------------------------------------------------------------------------
   * AND THERE ARE THREE, BECAUSE A SEARCH THAT MATCHED NOTHING IS NEITHER.
   *
   * Six pages render this with `common.noMatchTitle` when a filter matches no
   * rows, and it drew the emerald tick: "all clear" over a queue that may hold
   * hundreds, none of them dismissed. `everHadRows` was the wrong lever for it
   * and a third value was the wrong shape too, because a boolean cannot carry
   * three answers. So the state is named.
   *
   *   cleared    rows arrived and somebody dealt with them. Emerald, a tick.
   *              The only one of the three that is good news, and the only one
   *              that has to be earned.
   *   never      nothing has ever arrived here. Neutral, a clock. Not a
   *              failure and not an achievement.
   *   no-match   the filter above matched nothing. Neutral, a magnifier,
   *              because what the operator is looking at is the RESULT OF
   *              THEIR OWN QUERY and the queue behind it is untouched.
   *
   * `everHadRows` stays as the boolean it was so the call sites that pass it
   * keep working and mean what they said, and `state` overrides it where a page
   * knows better. Two ways in, one set of three answers.
   */
  function QueueEmpty({
    title,
    body,
    everHadRows = true,
    state,
  }: {
    title: string;
    body: string;
    /** False when this table has never held a row for this queue. */
    everHadRows?: boolean;
    /**
     * Which of the three this is, where the page can say.
     *
     * Overrides `everHadRows`. Pass `"no-match"` whenever the empty list is the
     * answer to a filter rather than a fact about the queue.
     */
    state?: QueueEmptyKind;
  }) {
    const mark = QUEUE_EMPTY_MARK[queueEmptyKind(state, everHadRows)];
    return (
      <div className="nf-panel nf-panel--card nf-admin-card p-card-lg text-center">
        <span
          className="mx-auto flex justify-center"
          style={mark.success ? SUCCESS_INK : NEUTRAL_INK}
        >
          <UiIcon name={mark.icon} size={40} />
        </span>
        <p className="nf-h4 mt-group">{title}</p>
        <p className="nf-body mx-auto mt-row max-w-[48ch] text-content-2">{body}</p>
      </div>
    );
  }

  /**
   * The honest alternative to a fake empty state: when the platform data cannot
   * be reached, say so rather than showing a queue that claims to be clear.
   */
  function QueueUnavailable() {
    return (
      /*
        A READ FAILURE IS ROSE AND IT IS A CROSS.

        This was a BELL in a cyan wash. `WARNING_WASH` is
        `--nf-state-error-surface`'s cyan sibling, `--nf-state-warning-surface`,
        and `--nf-state-warning` is the same token `--nf-status-pending` is
        defined as, so a queue that could not load was drawn in the colour that
        means "in flight" with a glyph that means "you have a notification".
        The rose is now ink rather than a wash, for the reason written above
        the tone constants: the plate itself was the retired brief's, not this
        system's.
      */
      <div className="nf-panel nf-panel--card nf-admin-card p-card-lg text-center">
        <span className="mx-auto flex justify-center" style={DANGER_INK}>
          <UiIcon name="close" size={40} />
        </span>
        <p className="nf-h4 mt-group">{c.unavailableTitle}</p>
        <p className="nf-body mx-auto mt-row max-w-[48ch] text-content-2">{c.unavailableBody}</p>
      </div>
    );
  }

  /**
   * A panel that says something is wrong, rather than that nothing is there.
   *
   * `QueueEmpty` is good news and `QueueUnavailable` is a read failure. Neither
   * fits "the ledger is short by 4,000 naira", which is a finding: real,
   * readable, and the reason somebody is on this screen.
   */
  function QueueAlarm({ title, body }: { title: string; body: string }) {
    return (
      <div className="nf-panel nf-panel--card nf-admin-card p-card-lg text-center">
        <span className="mx-auto flex justify-center" style={DANGER_INK}>
          <UiIcon name="shield-stop" size={40} />
        </span>
        <p className="nf-h4 mt-group">{title}</p>
        <p className="nf-body mx-auto mt-row max-w-[48ch] text-content-2">{body}</p>
      </div>
    );
  }

  /**
   * Label and value, stacked on a phone, paired on wider screens. Each row is
   * its own `dl` with the `dt` and `dd` as direct children, so a section can
   * hold a list or a paragraph between rows without a `ul` ever sitting inside
   * a `dl` (axe: definition-list, W12 F28).
   */
  function DetailRow({ label, value }: { label: string; value: ReactNode }) {
    /* A reference, id, email, case or ticket number carries a copy control (founder,
       10 November 2026, "easy copy" across the admin panel). */
    const copyable = typeof value === "string" && value !== "" && COPYABLE_LABEL.test(label);
    return (
      <dl className="flex flex-col gap-inline-tight border-t border-[var(--nf-brand-edge-soft)] py-row sm:flex-row sm:gap-group">
        <dt className="nf-overline shrink-0 sm:w-48">{label}</dt>
        <dd className="nf-body min-w-0 break-words text-content">
          {value === null || value === "" ? (
            <span className="text-muted">{c.notGiven}</span>
          ) : copyable ? (
            <CopyValue value={value as string} label={`Copy ${label.toLowerCase()}`} message={`${label} copied`} />
          ) : (
            value
          )}
        </dd>
      </dl>
    );
  }

  function DetailSection({ title, children }: { title: string; children: ReactNode }) {
    return (
      <section className="mt-group first:mt-0">
        <h3 className="nf-overline">{title}</h3>
        <div className="mt-inline">{children}</div>
      </section>
    );
  }

  /** One line of the admission checklist: a tick, a cross, and the evidence. */
  function CheckRow({ label, pass, detail }: { label: string; pass: boolean; detail: string }) {
    return (
      <li className="flex items-start gap-inline border-t border-[var(--nf-brand-edge-soft)] py-row">
        {/* Rose and a cross, for the same reason as `QueueUnavailable`: a
            check that did not pass is a failure, and a bell in the pending
            colour said neither. */}
        <span
          aria-hidden="true"
          className="flex shrink-0"
          style={pass ? SUCCESS_INK : DANGER_INK}
        >
          <UiIcon name={pass ? "verified" : "close"} size={20} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="nf-body-sm block font-semibold text-content">{label}</span>
          {/* THE EVIDENCE IS NEVER CLIPPED. This row's own name for `detail` is
              the evidence, and it carried `truncate`: an operator deciding
              whether to admit an agent could not read the thing the decision
              rests on. */}
          <span className="nf-caption block [overflow-wrap:anywhere]">{detail}</span>
        </span>
        <span className="sr-only">{pass ? c.passes : c.needsAttention}</span>
      </li>
    );
  }

  return {
    when,
    day,
    statusLabel,
    columnLabel,
    StatusChip,
    WaitingBadge,
    QueueHeader,
    Section,
    Stat,
    StatRow,
    QueueEmpty,
    QueueUnavailable,
    QueueAlarm,
    DetailRow,
    DetailSection,
    CheckRow,
  };
}
