import type { ReactNode } from "react";
import type { BrandIconName } from "@/design-system/icons/BrandIcon";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { EmptyActions } from "@/components/app/EmptyActions";
import { Icon3D } from "@/components/ui/Icon3D";
import { IconPlate } from "@/components/ui/IconPlate";
import type { Icon3DName } from "@/components/ui/icon-3d";
import { stateArtFor, stateGlyphFor } from "@/components/ui/state-art";
import { glyphSrc } from "@/design-system/icons/glyphs";
import { SkeletonText } from "@/components/ui/Skeleton";
import { STATE_TONE, stateRole, type StateKind } from "@/lib/design/voice";

/**
 * ONE STATE KIT (V-97): loading, empty, offline, error and done, in one anatomy.
 *
 * The product grew six families for this: `EmptyState`, `EmptyPanel`,
 * `EmptyActions`, `SystemMoment`, `ResultScreen` and `ResultSheet`, plus the
 * route skeletons. A designer looking for "the empty state" found six. This is
 * the one, and the old names become thin wrappers over it, then go.
 *
 * THE ANATOMY, fixed:
 *   1. a glyph: a lean line glyph on the kind's flat plate; a state that
 *      names an object (`icon`, a BrandIcon name) draws its line twin. The
 *      founder's art (`art`) only where a caller names it.
 *   2. one title, under 40 characters
 *   3. one sentence of body, under 180 characters
 *   4. at most one primary and one secondary action, stacked and full width,
 *      each naming where it goes
 *
 * The words follow `docs/design/VOICE.md`, and `lib/design/voice.ts` holds the
 * rules a machine can check. `scripts/design/state-sweep.mjs` walks the call
 * sites and fails on a long title, a long body, a banned phrase or a state
 * that leaves somebody stuck without a way onward.
 *
 * LOADING has no glyph and no actions: three lines of skeleton and the title
 * as its screen-reader label. An ERROR is announced (`role="alert"`); loading
 * and done report politely (`role="status"`).
 *
 * Server-safe: no hooks, no client boundary.
 */

/* The type roles, as `TYPE.sectionTitle` and `TYPE.body` in
   `components/app/Screen.tsx` spell them. Written out rather than imported,
   because Screen's EmptyState renders this kit and a two-way import is a cycle;
   `lib/design/voice.test.ts` holds them equal. */
export const STATE_TITLE_CLASS = "nf-h3 text-[var(--nf-content-primary)]";
export const STATE_BODY_CLASS = "nf-body text-[var(--nf-content-secondary)]";

export const KIND_GLYPH: Record<Exclude<StateKind, "loading">, UiIconName> = {
  empty: "search",
  offline: "info",
  error: "shield-stop",
  done: "verified",
};

export type StateAction = { href: string; label: string };

export type StateProps = {
  kind: StateKind;
  title: string;
  /** One sentence, true of the state the reader is actually in. Unused by loading. */
  body?: string;
  /** An object name; its line twin is drawn on the plate. Without one, the kind's glyph. */
  icon?: BrandIconName;
  /**
   * The founder's art in place of the plate (its glyph from the set where
   * `state-art.ts` has one, else the 3D object), on an empty or a done.
   * Never derived from `icon` since Grade 1: pass a name to ask for it, for a
   * record moment. Omitted or `false`, the thin line glyph on its plate.
   */
  art?: Icon3DName | false;
  /** The single next thing to do, naming where it goes. */
  primary?: StateAction;
  /** A quiet second way onward. Only drawn beside a primary. */
  secondary?: StateAction;
  /**
   * An action that is not a link (a retry button, a form). The escape hatch the
   * older families need while they are migrated; prefer `primary`.
   */
  action?: ReactNode;
  /** A quiet line under the action, where a link will not do. */
  footnote?: ReactNode;
  /**
   * Loading only: the route's own skeleton, in the shape of the page that is
   * coming, drawn in place of the three default lines.
   */
  children?: ReactNode;
  /**
   * A quiet empty inside a card or a section (a short list with nothing in
   * it yet): the 36px plate and the words in one left-aligned row, no
   * object, no centring. Where a screen is the empty (a whole list or page)
   * leave it off and the full kit draws. One way, two sizes.
   */
  compact?: boolean;
  /**
   * THE STATE IS THE WHOLE PAGE, SO ITS TITLE IS THE PAGE'S HEADING.
   *
   * Measured in Chromium on 13 November 2026, signed out, over 249 member and
   * workspace routes: 37 of them had NO `<h1>` anywhere in the document. On
   * most of those the page is a gate, and the gate is this component: `/host`
   * drew "Host on Vallo" as a `<p class="nf-h3">`, and so did every other
   * `/host/*` page, `/wallet` and its four inner pages, both sign-in screens,
   * `/checkout`, `/pro` and the rest. A screen reader landing there is told
   * the page has no heading at all, and the skip link in `app/layout.tsx`
   * lands the reader in a region with nothing to announce.
   *
   * The default stays a `<p>`, because a state inside a section must not
   * invent a heading level. A page whose whole content is one state passes
   * `heading="h1"`; a state that is a section's whole content passes `"h2"`.
   * The words, the size and the balance are identical either way: this
   * changes the element, never the drawing.
   */
  heading?: "h1" | "h2";
  className?: string;
  "data-testid"?: string;
};

export function State({
  kind,
  title,
  body,
  icon,
  art,
  primary,
  secondary,
  action,
  footnote,
  compact,
  heading,
  className,
  children,
  "data-testid": testId,
}: StateProps) {
  const role = stateRole(kind);
  /* The element the title is drawn as. A page-level state says which heading
     it is; everything else keeps the paragraph it has always been. */
  const Title = heading ?? "p";
  /* GRADE 1 (SW7, UX_SYSTEM section 11): ONE THIN GLYPH. By default every
     state draws the lean line glyph on the kind's plate: the object a call
     site names (`icon`) draws its line twin, and nothing is derived from it
     any more. The founder's art (a glyph from the set, else the 3D object)
     draws only where a caller asks for it by name with `art`, which is kept
     for record moments, and only on an empty or a done. */
  const asked = (kind === "empty" || kind === "done") && art ? art : undefined;
  const object = asked ? stateArtFor(undefined, asked) : undefined;
  const glyph = asked ? stateGlyphFor(undefined, asked) : undefined;

  if (kind === "loading") {
    /* The title is read out, not shown: a live region announces its text, and
       an aria-label on a status region is not reliably spoken. A route that
       draws its own skeleton (the shape of the page that is coming) passes it
       as children; without one, three lines stand in. */
    return (
      <div
        data-testid={testId}
        data-state-kind="loading"
        role={role}
        aria-busy="true"
        aria-live="polite"
        className={children ? className : `flex flex-col px-lg py-section ${className ?? ""}`}
      >
        <span className="sr-only">{title}</span>
        {children ?? <SkeletonText lines={3} />}
      </div>
    );
  }

  if (compact) {
    return (
      <div
        data-testid={testId}
        data-state-kind={kind}
        data-state-size="compact"
        role={role}
        className={`flex items-start gap-md py-sm ${className ?? ""}`}
      >
        {glyph ? (
          // eslint-disable-next-line @next/next/no-img-element -- a 256px transparent glyph at 40px
          <img src={glyphSrc(glyph)} alt="" width={40} height={40} decoding="async" className="size-10 shrink-0 object-contain" aria-hidden="true" />
        ) : (
          <IconPlate size="sm" tone={STATE_TONE[kind]}>
            <UiIcon name={icon ? lineGlyphFor(icon) : KIND_GLYPH[kind]} size={20} />
          </IconPlate>
        )}
        <div className="min-w-0 flex-1 self-center">
          {/* Words only (no `body`): the one sentence is the state, quiet. */}
          <Title className={body ? "nf-body font-semibold text-[var(--nf-content-primary)]" : "nf-body-sm text-[var(--nf-content-secondary)]"}>
            {title}
          </Title>
          {body && <p className="nf-body-sm text-[var(--nf-content-muted)]">{body}</p>}
          {primary ? (
            <div className="mt-sm">
              <EmptyActions primary={primary} {...(secondary ? { secondary } : {})} />
            </div>
          ) : (
            action && <div className="mt-sm">{action}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      data-state-kind={kind}
      role={role}
      className={`flex flex-col items-center px-lg py-section text-center ${className ?? ""}`}
    >
      {/* One glyph, one family (the icon upgrade, 29 September 2026): a
          lean line glyph on the kind's flat plate. A state that names a
          glass object draws that object's line twin (`glass-to-line.ts`);
          the glass objects no longer stand in a state. */}
      {/* ONE STICKER BOX. The 3D object and the line-glyph plate both stand in
          the same 5.5rem square, centred, so the title starts at the same
          height whichever one a state draws (an audit found 88px objects and
          56px plates side by side with titles at different heights). */}
      <span className="grid size-[5.5rem] place-items-center" data-art={glyph ?? object} aria-hidden="true">
        {glyph ? (
          // eslint-disable-next-line @next/next/no-img-element -- a 256px transparent glyph at 88px
          <img src={glyphSrc(glyph)} alt="" width={88} height={88} decoding="async" className="size-[5.5rem] object-contain" />
        ) : object ? (
          <Icon3D name={object} size={88} />
        ) : (
          <IconPlate size="lg" tone={STATE_TONE[kind]}>
            <UiIcon name={icon ? lineGlyphFor(icon) : KIND_GLYPH[kind]} size={24} />
          </IconPlate>
        )}
      </span>
      {/* `balance` stops a centred two-line title leaving a one-word orphan. */}
      <Title className={`mt-block ${STATE_TITLE_CLASS} [text-wrap:balance]`}>{title}</Title>
      {body && <p className={`mt-inline max-w-[42ch] ${STATE_BODY_CLASS}`}>{body}</p>}
      {primary ? (
        <div className="mt-block flex w-full justify-center">
          <EmptyActions primary={primary} {...(secondary ? { secondary } : {})} />
        </div>
      ) : (
        action && <div className="mt-block">{action}</div>
      )}
      {footnote && <div className="mt-group">{footnote}</div>}
    </div>
  );
}
