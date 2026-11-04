import Link from "next/link";
import { warmBody, warmTitle } from "@/lib/notify/voice";
import type { CSSProperties } from "react";
import { formatDate, getDictionary, type Dictionary, type Locale } from "@vallo/i18n";
import { Amount } from "@/components/ui/Amount";
import { ButtonLink } from "@/components/ui/Button";
import { Icon3D } from "@/components/ui/Icon3D";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { fill } from "@/components/app/threads/when";
import type { NotificationRow } from "@/lib/notify/inbox";
import { notificationHref } from "@/lib/notify/links";
import { readSeverity } from "@/lib/notify/severity";
import { FAMILY_OBJECT, familyOf, figureIn, objectOf, type NotificationFamily } from "../family";
import { lagosTimeLabel } from "@/lib/messages/time";
import "./notification-view.css";

/**
 * ONE NOTIFICATION, DESIGNED FOR ITS FAMILY (north star 16.3, directive D22).
 *
 * Not a generic detail page. Every family shares the spine the spec names, in
 * the order it names it:
 *
 *   what happened   the hero: the family's clay object, the event's own title
 *   when            the Lagos date and time it arrived
 *   who / about     the record it is about, by its noun, as a link
 *   the figure      Money leads with it, large and tabular, read from the
 *                   trigger's own words and only when it states exactly one
 *   the one action  the severity table's verb as the primary button, to the
 *                   record; or, when nothing is asked, a sentence saying so
 *   the timeline    the earlier notices about the same record, real rows
 *
 * and each family changes what LEADS under the hero: Money the figure, Messages
 * the words as a quoted line with Reply, Account a calm callout, Trust and
 * Spaces the event's sentence beside the record it concerns. It never
 * dead-ends: with no link and no verb it says nothing is asked and returns
 * to the list.
 *
 * It PRESENTS what the row holds. The row has no breakdown, actor or object id
 * yet (requests W5-1 and W5-2), so nothing here invents one: a section with no
 * data is simply not drawn.
 */

type Copy = Dictionary["experienceInbox"];

function whenOf(iso: string, locale: Locale): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return `${formatDate(at, locale, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })}, ${lagosTimeLabel(iso)}`;
}

function stepStyle(i: number): CSSProperties {
  return { "--i": Math.min(i, 5) } as CSSProperties;
}

export function NotificationFullView({
  row,
  before,
  after,
  copy,
  locale,
}: {
  row: NotificationRow;
  before: NotificationRow[];
  after: NotificationRow[];
  copy: Copy;
  locale: Locale;
}) {
  const v = copy.notificationView;
  const href = notificationHref(row.href);
  const family: NotificationFamily = familyOf({ kind: row.kind, title: row.title, href });
  const verdict = readSeverity({ kind: row.kind, title: row.title, href });
  const objectKey = objectOf(href);
  const objectNoun = v.objects[objectKey];
  const minor = figureIn(row.title, row.body);
  const verb = verdict.severity === "action" && verdict.verb ? copy.notifications.verbs[verdict.verb] : null;
  const timeline = [...before, row, ...after];

  return (
    <article className="nf-nview" aria-label={warmTitle(row.title)} data-family={family} data-testid="notification-view">
      {/* ----------------------------------------------------- what happened */}
      <header className="nf-island nf-nview__hero" style={stepStyle(0)}>
        <span className="nf-nview__object" aria-hidden="true">
          <Icon3D name={FAMILY_OBJECT[family]} size={56} />
        </span>
        <p className="nf-nview__family nf-overline">{copy.notifications.families[family]}</p>
        <h1 className="nf-nview__title nf-h2">{warmTitle(row.title)}</h1>
        <p className="nf-nview__when nf-body-sm nf-numeric">{whenOf(row.created_at, locale)}</p>
        {family === "money" && minor !== null ? (
          <div className="nf-nview__figure" data-testid="notification-view-figure">
            <p className="nf-nview__figure-label nf-body-sm">{v.amount}</p>
            <p className="nf-nview__figure-value nf-numeric">
              <Amount minorUnits={minor} locale={locale} showFraction={minor % 100 !== 0} />
            </p>
          </div>
        ) : null}
      </header>

      {/* ------------------------------------- the family's lead, under the hero */}
      {row.body ? (
        <p
          className={`nf-nview__lead nf-body${family === "messages" ? " nf-nview__lead--quote" : ""}${family === "account" ? " nf-nview__lead--calm" : ""}`}
          style={stepStyle(1)}
        >
          {warmBody(row.body)}
        </p>
      ) : null}

      {/* ----------------------------------------------- key-value details */}
      <section className="nf-panel nf-panel--card nf-nview__card" aria-label={v.whatHappened} style={stepStyle(2)}>
        <dl className="nf-nview__rows nf-body-sm">
          <div className="nf-nview__row">
            <dt>{v.received}</dt>
            <dd className="nf-numeric">{whenOf(row.created_at, locale)}</dd>
          </div>
          {href ? (
            <div className="nf-nview__row">
              <dt>{v.about}</dt>
              <dd>{objectNoun}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* ---------------------------------------------------- the one action */}
      <section className="nf-nview__action" aria-label={v.nextHeading} style={stepStyle(3)}>
        <p className="nf-nview__action-label nf-overline">{v.nextHeading}</p>
        {href && verb ? (
          <>
            <ButtonLink href={href} variant="primary" size="lg" full data-testid="notification-view-action">
              {verb}
            </ButtonLink>
            <Link href={href} className="nf-nview__object-link nf-body-sm">
              <span>{fill(v.openObject, { object: objectNoun })}</span>
              <UiIcon name="chevron-right" size={16} />
            </Link>
          </>
        ) : href ? (
          <ButtonLink href={href} variant="primary" size="lg" full data-testid="notification-view-action">
            {fill(v.openObject, { object: objectNoun })}
          </ButtonLink>
        ) : (
          <>
            {/* "Nothing is asked of you" is only true when the notice does not
                ask anything. An action notice with no record to open (no link)
                must not say so, so the sentence is drawn for the other
                severities only (auditor A3, S4). */}
            {verdict.severity !== "action" ? <p className="nf-nview__nothing nf-body-sm">{v.nothingAsked}</p> : null}
            <ButtonLink href="/notifications" variant="secondary" size="lg" full>
              {v.backToList}
            </ButtonLink>
          </>
        )}
      </section>

      {/* ---------------------------------------------------------- timeline */}
      <section className="nf-panel nf-panel--card nf-nview__card" aria-label={v.timelineHeading} style={stepStyle(4)}>
        <h2 className="nf-overline nf-nview__action-label nf-nview__card-title">{v.timelineHeading}</h2>
        {timeline.length > 1 ? (
          <ol className="nf-nview__timeline" data-testid="notification-view-timeline">
            {timeline.map((n) => (
              <li
                key={n.id}
                className="nf-nview__step"
                {...(n.id === row.id ? { "aria-current": "step" as const } : {})}
              >
                <p className="nf-nview__step-title nf-body-sm">
                  {n.id === row.id ? (
                    <>
                      <span className="sr-only">{v.timelineNow}: </span>
                      {warmTitle(n.title)}
                    </>
                  ) : (
                    <Link href={`/notifications/${n.id}`}>{warmTitle(n.title)}</Link>
                  )}
                </p>
                <p className="nf-nview__step-time nf-caption nf-numeric">{whenOf(n.created_at, locale)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="nf-nview__nothing nf-body-sm">{v.timelineEmpty}</p>
        )}
      </section>

      {/* ------------------------------------------------------ preferences */}
      <Link
        href="/settings/notifications"
        className="nf-nview__object-link nf-body-sm"
        style={stepStyle(5)}
        data-testid="notification-view-preferences"
      >
        <span>{getDictionary(locale).experienceAccount.settings.notificationsNav.fromNotice}</span>
        <UiIcon name="chevron-right" size={16} />
      </Link>
    </article>
  );
}
