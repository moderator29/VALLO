import Link from "next/link";

import { PageFrame } from "@/components/app/PageFrame";
import {
  CardGrid,
  RoomCardView,
  RoommateCardView,
  RoommatesEmpty,
  SectionHead,
  counted,
  fill,
  institutionKind,
  lagosDay,
  placeText,
  stateName,
  type RoommatesCopy,
} from "@/components/roommates";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ROOMMATES_ROUTES, type InstitutionRef } from "@/lib/features/roommates/model";
import type { InstitutionPage } from "@/lib/features/roommates/queries";

/**
 * THE SCHOOLS (server safe). The directory: a search that works without a
 * script (a GET form), the schools grouped by state. A school's page: who it
 * is, the live counts, rooms near it, students there, and the school email
 * check.
 */
export function CampusDirectoryView({ live, items, q, t: copy }: { live: boolean; items: InstitutionRef[]; q: string; t: RoommatesCopy }) {
  const groups = new Map<string, InstitutionRef[]>();
  for (const s of items) {
    const key = stateName(s.stateCode) ?? "";
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  return (
    <PageFrame title={copy.campus.title} subtitle={copy.ui.campus.subtitle} fallback={ROOMMATES_ROUTES.home} width="wide">
      <div className="nf-rmp" data-testid="roommates-campuses">
        <form role="search" method="get" action={ROOMMATES_ROUTES.campuses} className="nf-rmd-search">
          <span className="nf-rmd-search__glyph" aria-hidden="true">
            <UiIcon name="search" size={20} />
          </span>
          <label htmlFor="rm-campus-q" className="sr-only">
            {copy.ui.campus.search}
          </label>
          <input id="rm-campus-q" name="q" type="search" className="nf-rmd-search__input" defaultValue={q} maxLength={60} placeholder={copy.ui.campus.search} enterKeyHint="search" />
          <button type="submit" className="nf-rmd-search__go" aria-label={copy.ui.campus.search}>
            <UiIcon name="arrow-right" size={20} />
          </button>
        </form>
        {!live ? (
          <RoommatesEmpty icon="info">{copy.notOpen}</RoommatesEmpty>
        ) : !items.length ? (
          <RoommatesEmpty icon="id-card">{q ? copy.ui.campus.none : copy.ui.emptyCampuses}</RoommatesEmpty>
        ) : (
          ordered.map(([state, schools]) => (
            <section key={state || "other"} className="nf-rm-section" aria-label={state || copy.campus.title}>
              {state ? <SectionHead title={state} count={String(schools.length)} /> : null}
              <ul className="nf-rmp-schools">
                {schools.map((s) => (
                  <li key={s.id}>
                    <Link href={ROOMMATES_ROUTES.campus(s.slug)} className="nf-rmp-school">
                      <span className="nf-rm-plate" aria-hidden="true">
                        <UiIcon name="id-card" size={20} />
                      </span>
                      <span className="nf-rmp-school__words">
                        <span className="nf-rmp-school__name">{s.name}</span>
                        <span className="nf-rmp-school__meta">{[s.shortName, institutionKind(s.kind, copy), s.city].filter(Boolean).join(" · ")}</span>
                      </span>
                      <UiIcon name="chevron-right" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </PageFrame>
  );
}

export function CampusView({ page, t: copy, now }: { page: InstitutionPage; t: RoommatesCopy; now: number }) {
  const today = lagosDay(now);
  const s = page.institution;
  if (page.state !== "ok" || !s) {
    return (
      <PageFrame title={copy.campus.title} fallback={ROOMMATES_ROUTES.campuses} width="narrow">
        <RoommatesEmpty icon={page.state === "not-open" ? "info" : "id-card"} action={<ButtonLink href={ROOMMATES_ROUTES.campuses} variant="secondary" size="md">{copy.ui.campusCta}</ButtonLink>}>
          {page.state === "not-open" ? copy.notOpen : copy.ui.campus.notFound}
        </RoommatesEmpty>
      </PageFrame>
    );
  }
  const short = s.shortName ?? s.name;
  return (
    <PageFrame title={s.name} fallback={ROOMMATES_ROUTES.campuses} width="wide">
      <div className="nf-rmp" data-testid="roommates-campus">
        <header className="nf-rmc-head" data-theme="dark">
          <span className="nf-rm-plate nf-rm-plate--lg" aria-hidden="true">
            <UiIcon name="id-card" size={26} />
          </span>
          <div className="nf-rmc-head__words">
            <p className="nf-rm-eyebrow">{institutionKind(s.kind, copy)}</p>
            <h2 className="nf-rmc-head__name">{s.name}</h2>
            <p className="nf-rmc-head__place">
              <UiIcon name="pin" size={16} />
              {placeText(s.city, stateName(s.stateCode)) ?? short}
            </p>
          </div>
          <dl className="nf-rmc-head__stats">
            <div>
              <dt>{copy.ui.statTiles.people}</dt>
              <dd>{counted(page.people, copy.ui.campus.people)}</dd>
            </div>
            <div>
              <dt>{copy.ui.statTiles.rooms}</dt>
              <dd>{counted(page.roomsCount, copy.ui.campus.rooms)}</dd>
            </div>
          </dl>
        </header>

        {s.emailVerifyOn ? (
          <section className="nf-rm-panel nf-rmp-strip" aria-labelledby="rmc-verify">
            <span className="nf-rm-plate nf-rm-plate--lg" aria-hidden="true">
              <UiIcon name="mail" size={24} />
            </span>
            <div className="nf-rmp-strip__words">
              <h2 id="rmc-verify" className="nf-rm-panel__title">
                {copy.ui.campus.verifyTitle}
              </h2>
              <p className="nf-rm-panel__sub">{copy.ui.campus.verifyBody}</p>
            </div>
            <ButtonLink href={ROOMMATES_ROUTES.verify} variant="primary" size="md" arrow>
              {copy.ui.campus.verifyCta}
            </ButtonLink>
          </section>
        ) : null}

        <section className="nf-rm-section" aria-labelledby="rmc-rooms">
          <SectionHead id="rmc-rooms" title={fill(copy.campus.roomsNear, { name: short })} more={page.rooms.length ? `${ROOMMATES_ROUTES.discover}?mode=rooms&school=${s.id}` : undefined} moreLabel={copy.home.seeAll} />
          {page.rooms.length ? (
            <CardGrid kind="rooms">
              {page.rooms.map((r) => (
                <li key={r.id}>
                  <RoomCardView room={r} t={copy} today={today} />
                </li>
              ))}
            </CardGrid>
          ) : (
            <RoommatesEmpty icon="bed" action={<ButtonLink href={`${ROOMMATES_ROUTES.create}?kind=room_offer`} variant="secondary" size="md">{copy.ui.offerRoom}</ButtonLink>}>
              {copy.ui.campus.noRooms}
            </RoommatesEmpty>
          )}
        </section>

        <section className="nf-rm-section" aria-labelledby="rmc-students">
          <SectionHead id="rmc-students" title={fill(copy.campus.studentsAt, { name: short })} more={page.students.length ? `${ROOMMATES_ROUTES.discover}?school=${s.id}` : undefined} moreLabel={copy.home.seeAll} />
          {page.students.length ? (
            <CardGrid>
              {page.students.map((p) => (
                <li key={p.userId}>
                  <RoommateCardView card={p} t={copy} />
                </li>
              ))}
            </CardGrid>
          ) : (
            <RoommatesEmpty icon="users" action={<ButtonLink href={ROOMMATES_ROUTES.profile} variant="secondary" size="md">{copy.profile.create}</ButtonLink>}>
              {page.people > 0 ? copy.ui.campus.studentsHidden : copy.ui.campus.noStudents}
            </RoommatesEmpty>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
