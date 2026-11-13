import type { MouseEventHandler, ReactNode } from "react";
import { SystemMoment } from "@/app/offline/SystemMoment";
import { STATE_TONE, stateRole, type StateKind } from "@/lib/design/voice";
import { ICON_PLATE_GLYPH, IconPlate } from "@/components/ui/IconPlate";
import { KIND_GLYPH } from "@/components/ui/State";
import { UiIcon } from "@/design-system/icons/UiIcon";

/**
 * THE STATE KIT, FULL SCREEN (V-97): the same anatomy as `State`, drawn on the
 * brand moment that the offline screen and the error boundaries stand on (the
 * lockup over the aurora plate, the glass card on its podium).
 *
 * `SystemMoment` stays as the stage; this is the one way to put a state on it,
 * so a full-screen error and an inline one carry the same parts in the same
 * order: an overline, one title, one sentence of body, anything that belongs
 * with the words (a reference), the actions, and anything the screen honestly
 * needs beneath them (the inspection packs this phone holds).
 *
 * The words follow `docs/design/VOICE.md`; `scripts/design/state-sweep.mjs`
 * reads the literal props here as it does on `State`.
 */
export function StateMoment({
  kind,
  overline,
  title,
  body,
  detail,
  actions,
  children,
  home,
  homeLabel,
  onHome,
  calm = false,
  inset = false,
  offline = false,
  aside,
}: {
  kind: Exclude<StateKind, "loading">;
  overline?: string;
  title: string;
  body: string;
  /** Under the body, above the actions: a reference to quote. */
  detail?: ReactNode;
  /**
   * The `nf-system__actions` block: a primary and at most one secondary
   * action, full width. A block, not two props, because the offline screen's
   * retry is a client component that owns its own pair.
   */
  actions: ReactNode;
  /** What the screen needs under the actions. */
  children?: ReactNode;
  home?: string;
  /** Passed to `SystemMoment`; see there. */
  homeLabel?: string;
  /**
   * A failure screen's handling of the lockup's click (`lib/offline/escape.ts`,
   * 13 November 2026): the same page tries again, another page is a full load.
   */
  onHome?: MouseEventHandler<HTMLAnchorElement>;
  /**
   * A failure that is only slow (13 November 2026): a screen reached after
   * the quiet tries ran out says "Taking longer than usual", so it carries a
   * clock on the brand plate rather than the fault's mark. The role stays.
   */
  calm?: boolean;
  inset?: boolean;
  offline?: boolean;
  aside?: ReactNode;
}) {
  const role = stateRole(kind);
  return (
    <SystemMoment {...(home ? { home } : {})} {...(homeLabel ? { homeLabel } : {})} {...(onHome ? { onHome } : {})} inset={inset} offline={offline} {...(aside ? { aside } : {})}>
      {/* The role sits on a real box: `display: contents` drops an element
          from the accessibility tree in some browsers, and the role with it.
          A block wrapper changes nothing in the card's layout (the card is
          `display: block`, and each line keeps its own top margin). */}
      <div data-state-kind={kind} role={role}>
        {/* THE SMALL MARK (W2, round 5; CRAFT-PRINCIPLES "failure is
            designed"). A success screen leads with a small mark and so does
            a failure: the kind's own glyph on its flat plate, the state's
            colour with the title's words beside it, so colour is never the
            only signal. The card still leads with the brand above it. */}
        <IconPlate size="md" tone={calm ? "brand" : STATE_TONE[kind]} className="nf-system__mark">
          <UiIcon name={calm ? "clock" : KIND_GLYPH[kind]} size={ICON_PLATE_GLYPH.md} />
        </IconPlate>
        {overline && <p className="nf-system__overline">{overline}</p>}
        <h1 className="nf-system__title">{title}</h1>
        <p className="nf-system__body">{body}</p>
      </div>
      {detail}
      {actions}
      {children}
    </SystemMoment>
  );
}
