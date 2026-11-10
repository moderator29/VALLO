import Link from "next/link";

import { SectionHead, counted, type RoommatesCopy } from "@/components/roommates";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { dashboardCounts, nextAction, type NextAction } from "@/lib/features/roommates/home-dashboard";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import type { RoommatesHome } from "@/lib/features/roommates/queries";

const signInTo = (next: string) => `/sign-in?next=${encodeURIComponent(next)}`;

/** The words and the door for one next action. */
export function actionView(action: NextAction, t: RoommatesCopy): { title: string; body: string; cta: string; href: string; icon: UiIconName } {
  const D = t.area.dash;
  switch (action.kind) {
    case "sign-in":
      return { ...D.signIn, href: signInTo(ROOMMATES_ROUTES.home), icon: "user" };
    case "requests":
      return { ...D.requests, href: ROOMMATES_ROUTES.hub, icon: "bell" };
    case "invites":
      return { ...D.invites, href: ROOMMATES_ROUTES.hub, icon: "circle-people" };
    case "viewings":
      return { ...D.viewings, href: ROOMMATES_ROUTES.hub, icon: "calendar-booking" };
    case "profile":
      return { ...(action.started ? D.profileDraft : D.profileNew), href: ROOMMATES_ROUTES.profile, icon: "user-pen" };
    case "matches":
      return { ...D.matches, href: ROOMMATES_ROUTES.discover, icon: "users" };
    case "post":
      return { ...D.post, href: ROOMMATES_ROUTES.create, icon: "door" };
  }
}

const AREAS: readonly { key: keyof RoommatesCopy["area"]["dash"]["areas"]; href: string; icon: UiIconName }[] = [
  { key: "discover", href: ROOMMATES_ROUTES.discover, icon: "search" },
  { key: "groups", href: ROOMMATES_ROUTES.groups, icon: "circle-people" },
  { key: "schools", href: ROOMMATES_ROUTES.campuses, icon: "id-card" },
  { key: "nysc", href: ROOMMATES_ROUTES.nysc, icon: "certificate" },
  { key: "mine", href: ROOMMATES_ROUTES.hub, icon: "house-duplex" },
  { key: "split", href: ROOMMATES_ROUTES.split, icon: "price-tag" },
  { key: "verify", href: ROOMMATES_ROUTES.verify, icon: "shield-check" },
  { key: "safety", href: ROOMMATES_ROUTES.safety, icon: "flag" },
];

/**
 * THE HOME DASHBOARD (server safe). A next best action, real counts from the
 * home read, and a door to each part of the area. The profile steps are the
 * existing cards' job, so this card shows the other actions; with nothing to
 * count it says so instead of drawing zeros.
 */
export function RoommatesDashboard({ home, t }: { home: RoommatesHome; t: RoommatesCopy }) {
  const D = t.area.dash;
  const action = nextAction(home);
  const view = actionView(action, t);
  const c = dashboardCounts(home);
  const counts = [
    c.requests ? counted(c.requests, D.counts.requests) : null,
    c.invites ? counted(c.invites, D.counts.invites) : null,
    c.viewings ? counted(c.viewings, D.counts.viewings) : null,
    c.matches ? counted(c.matches, D.counts.matches) : null,
  ].filter((x): x is string => Boolean(x));
  /* The profile cards above own those two steps. */
  const showNext = action.kind !== "profile";
  return (
    <section className="nf-rmdash" aria-labelledby="rm-dash" data-testid="roommates-dashboard" data-next={action.kind}>
      <SectionHead id="rm-dash" title={D.title} />
      {home.signedIn ? (
        counts.length ? (
          <ul className="nf-rmdash__counts" data-testid="roommates-counts">
            {counts.map((line) => (
              <li key={line} className="nf-rmdash__count">
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="nf-rm-panel__sub" data-testid="roommates-counts-empty">
            {D.countsEmpty}
          </p>
        )
      ) : null}
      {showNext ? (
        <div className="nf-rm-panel nf-rmdash__next" data-testid="roommates-next">
          <span className="nf-rm-plate nf-rm-plate--lg" aria-hidden="true">
            <UiIcon name={view.icon} size={24} />
          </span>
          <div className="nf-rmdash__words">
            <span className="nf-rmdash__kicker">{D.next}</span>
            <h3 className="nf-rm-panel__title">{view.title}</h3>
            <p className="nf-rm-panel__sub">{view.body}</p>
          </div>
          <ButtonLink href={view.href} variant="primary" size="md" arrow data-testid="roommates-next-cta">
            {view.cta}
          </ButtonLink>
        </div>
      ) : null}
      <h3 className="nf-rmdash__kicker">{D.areasTitle}</h3>
      <ul className="nf-rmdash__areas" data-testid="roommates-areas">
        {AREAS.map((a) => {
          const words = D.areas[a.key];
          return (

            <li key={a.href}>
              <Link href={a.href} className="nf-rmdash__area">
                <UiIcon name={a.icon} size={20} />
                <span className="nf-rmdash__area-title">{words.title}</span>
                <span className="nf-rmdash__area-body">{words.body}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
