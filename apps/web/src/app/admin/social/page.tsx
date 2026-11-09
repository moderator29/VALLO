import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin, adminRefusal } from "@/lib/admin/guard";
import { getSocialQueue } from "@/lib/social/admin-queries";
import { AreaDecision, ModeratorDecision, PauseToggle } from "./SocialDecisions";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { adminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import {
  QueueFilters,
  queueNarrowed,
  readQueueQuery,
  type QueueStatusOption,
} from "../_components/QueueFilters";
import { Constants } from "@/lib/supabase/database.types";

export const metadata: Metadata = {
  title: "Around",
  // Belt and braces alongside robots.ts: a misconfigured crawl file must not be
  // the only thing standing between a search engine and an operations console.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Around, from the console.
 *
 * Two queues that carry owner rulings, and one list that carries the
 * consequences of them:
 *
 *   Places people asked for. Anyone may suggest one, and only a decision here
 *   makes it public. The insert policy on `areas` pins a new row to PROPOSED,
 *   so this really is the only door.
 *
 *   People who asked to look after a place. Only a decision here grants
 *   MODERATOR, and the copy on the control states what that role can and cannot
 *   do, because an operator granting it should not have to remember.
 *
 * Both queues are oldest first, deliberately. A queue sorted newest first is a
 * queue where the oldest item rots quietly while the counter looks healthy.
 *
 * English literals throughout, like the rest of `/admin`. That is the standing
 * decision recorded in R-107: the console is an internal surface for a small
 * team and translating it would be work with no reader.
 */
/**
 * The chips, from `area_status`.
 *
 * Five values, and two of them - ARCHIVED and REJECTED - belong to no bucket on
 * this screen, so choosing one returns nothing. That is deliberate and it is
 * the same call the applications queue makes about DRAFT: the list is built
 * from the enum so it cannot go stale, and an operator who picks one learns
 * something true about where those places are.
 *
 * The words are the console's own status vocabulary, which already carries all
 * five, so a Hausa operator reads Hausa.
 */
function statusFilters(statusNames: Record<string, string | undefined>): readonly QueueStatusOption[] {
  return Constants.public.Enums.area_status.map((value) => ({
    value,
    label: statusNames[value] ?? value,
  }));
}

export default async function AdminSocialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireAdmin();
  if (access.state !== "admin") {
    return (
      <div className="nf-console flex flex-col gap-xl">
        <PageHead title="Around" />
        <div className="nf-panel nf-panel--card nf-admin-card p-lg">
          <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-muted)]">
            {adminRefusal(access)}
          </p>
        </div>
      </div>
    );
  }

  /* The shared queue frame, the eleventh destination to get it. This screen
     read the oldest hundred of each bucket and printed all of them, with no way
     to ask for one place by name. No pager: see the note on `getSocialQueue`. */
  const params = await searchParams;
  const query = readQueueQuery(params);
  const narrowed = queueNarrowed(query);
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ui = adminUi(t, locale);
  const common = t.admin.common;
  const queue = await getSocialQueue({
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  });
  const nothing =
    queue.proposed.length === 0 && queue.applications.length === 0 && queue.open.length === 0;

  /*
    ON THE CONSOLE'S FRAME. This desk wrote its own header at h4 in a bare
    column, so it sat at a different width and two type tiers below every other
    desk, with hand-drawn count boxes beside its section titles (C1 sweep). Now
    the shared header with the waiting count, the console width, and the
    console's badge for each section's count.
  */
  return (
    <div className="nf-console flex flex-col gap-xl">
      <PageHead
        title="Around"
        lede="Places people asked for, and people who asked to look after one."
        trail={<ui.WaitingBadge count={queue.proposed.length + queue.applications.length} />}
      />

      <QueueFilters
        base="/admin/social"
        query={query}
        common={common}
        statuses={statusFilters(common.status as Record<string, string | undefined>)}
        searchPlaceholder="Search by place or city"
      />

      {narrowed && nothing && (
        /* The seventh no-match panel, and the one that was hand-rolled: a card
           with a bold span above a muted one, which is a fourth empty-state
           grammar in a console that has one. Same component and same third
           state as the other six now. */
        <ui.QueueEmpty
          title={common.noMatchTitle}
          body={common.noMatchBody}
          state="no-match"
        />
      )}

      <section>
        <h2 className="mb-sm flex items-center gap-xs text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
          Places waiting
          <span className="nf-badge nf-badge--brand nf-numeric">
            {queue.proposed.length}
          </span>
        </h2>

        {/* Narrowed, the section says nothing: "nothing waiting" is a claim
            about the whole desk and is false to somebody who has just filtered
            to one city. The single no-match panel above answers for the
            screen. */}
        {queue.proposed.length === 0 ? (
          narrowed ? null : (
            <p className="nf-panel nf-panel--card nf-admin-card p-md text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
              Nothing waiting. When somebody suggests a place it lands here.
            </p>
          )
        ) : (
          <ul className="flex flex-col gap-sm">
            {queue.proposed.map((area) => (
              <li key={area.id} className="nf-panel nf-panel--card nf-admin-card p-md sm:p-lg">
                <div className="flex flex-wrap items-baseline gap-x-xs gap-y-2xs">
                  <h3 className="text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">
                    {area.name}
                  </h3>
                  <span className="nf-section-label">
                    {area.kind}
                  </span>
                  <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                    {area.city}, {area.stateCode}
                  </span>
                </div>

                {area.blurb ? (
                  <p className="mt-xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                    {area.blurb}
                  </p>
                ) : null}

                <p className="mt-xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                  Address will be{" "}
                  <span className="nf-numeric">/around/{area.slug}</span>
                  {area.proposerHandle ? (
                    <>
                      {" "}
                      &middot; suggested by{" "}
                      <Link
                        href={`/u/${area.proposerHandle}`}
                        className="text-[var(--nf-brand-secondary)]"
                      >
                        @{area.proposerHandle}
                      </Link>
                    </>
                  ) : null}
                </p>

                <AreaDecision areaId={area.id} name={area.name} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-sm flex items-center gap-xs text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
          People who want to look after a place
          <span className="nf-badge nf-badge--brand nf-numeric">
            {queue.applications.length}
          </span>
        </h2>

        {queue.applications.length === 0 ? (
          narrowed ? null : (
            <p className="nf-panel nf-panel--card nf-admin-card p-md text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
              No applications open.
            </p>
          )
        ) : (
          <ul className="flex flex-col gap-sm">
            {queue.applications.map((application) => (
              <li key={application.id} className="nf-panel nf-panel--card nf-admin-card p-md sm:p-lg">
                <div className="flex flex-wrap items-baseline gap-x-xs">
                  <h3 className="text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">
                    {application.displayLabel ??
                      (application.handle ? `@${application.handle}` : "A member")}
                  </h3>
                  <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                    wants to look after {application.areaName}
                  </span>
                </div>

                <blockquote className="mt-sm border-l-2 border-[var(--nf-border-brand)] pl-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                  {application.reason}
                </blockquote>

                {application.handle ? (
                  <p className="mt-xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                    <Link
                      href={`/u/${application.handle}`}
                      className="text-[var(--nf-brand-secondary)]"
                    >
                      @{application.handle}
                    </Link>{" "}
                    &middot;{" "}
                    <Link
                      href={`/around/${application.areaSlug}`}
                      className="text-[var(--nf-brand-secondary)]"
                    >
                      the place
                    </Link>
                  </p>
                ) : null}

                <ModeratorDecision
                  applicationId={application.id}
                  areaName={application.areaName}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-sm flex items-center gap-xs text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
          Open places
          <span className="nf-badge nf-badge--brand nf-numeric">
            {queue.open.length}
          </span>
        </h2>

        {queue.open.length === 0 ? (
          narrowed ? null : (
            <p className="nf-panel nf-panel--card nf-admin-card p-md text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
              No places are open yet. Approving one above opens it.
            </p>
          )
        ) : (
          <ul className="flex flex-col gap-xs">
            {queue.open.map((area) => (
              <li
                key={area.id}
                className="nf-panel nf-panel--card nf-admin-card flex flex-wrap items-center gap-sm p-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-xs">
                    <Link
                      href={`/around/${area.slug}`}
                      className="flex min-h-11 min-w-0 items-center text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]"
                    >
                      <span className="truncate">{area.name}</span>
                    </Link>
                    {area.status === "PAUSED" ? <ui.StatusChip label="Paused" tone="neutral" /> : null}
                  </div>
                  <p className="nf-numeric mt-3xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                    {area.city} &middot; {area.memberCount} members &middot;{" "}
                    {area.moderatorCount} looking after it
                  </p>
                  {area.moderatorCount === 0 ? (
                    /* The error ink: `--nf-state-warning` is the pending cyan,
                       which says "on its way" about a place nobody watches. */
                    <p className="mt-2xs text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-state-error)]">
                      Nobody is watching this place.
                    </p>
                  ) : null}
                </div>
                <PauseToggle
                  areaId={area.id}
                  paused={area.status === "PAUSED"}
                  name={area.name}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
