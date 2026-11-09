import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { readPerson } from "@/lib/admin/person-queries";
import { readMemberExtras } from "@/lib/admin/member-queries";
import { MemberSections } from "./MemberSections";
import { MemberStanding } from "./MemberStanding";
import { adminUi } from "../../_components/ui";
import { PageHead } from "../../_components/panels";
import { UpholdControl } from "./UpholdControl";
import { ConsiderStr } from "../../_components/ConsiderStr";
import { InternalNotes } from "../../_components/InternalNotes";
import { CaseHistory } from "../../_components/CaseHistory";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Person file", robots: { index: false, follow: false } };
}

/* The workspaces a person holds, in words: the file printed the role column ("user", "agent"). */
function roleWord(role: string): string {
  const words: Record<string, string> = { user: "Member", agent: "Lister", admin: "Admin", super_admin: "Super admin" };
  return words[role] ?? role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
}

function when(iso: string | null, locale: Locale): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : formatDate(d, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
}

const VIA: Record<string, string> = {
  device: "shares a device",
  mailbox: "shares a mailbox pattern",
  phone: "shares a phone number",
  payout: "shares a payout account",
  nin: "shares a NIN",
};

const LEDE =
  "One person across every desk: who they are, everything that happened, and the other accounts they share something with. Shared numbers are compared inside the database and never shown. Opening this file is recorded in the audit log.";

/**
 * /admin/people/[id]: V-90, THE PERSON FILE.
 *
 * Every fraud decision is a decision about a person, and until this page the
 * facts were spread over nine desks searched by name. The read is one definer
 * function that refuses anyone but staff and writes its own audit row, so the
 * rule that viewing a person's data is recorded (A2-036) holds however the
 * page is reached.
 */
export default async function PersonFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const x = t.experienceAdmin;
  const ui = adminUi(t, locale);
  const file = await readPerson(id);

  if (file.state !== "ready") {
    return (
      <div className="nf-console">
        <PageHead title="Person file" lede={LEDE} />
        {file.state === "failed" ? (
          <ui.QueueUnavailable />
        ) : (
          <p className="mt-row text-[var(--nf-content-secondary)]">No account has this id.</p>
        )}
      </div>
    );
  }

  const { person } = file;
  /* Only once the person file answered "ready": it is the read that refuses
     scoped staff in the database and writes the person.view audit row, so
     nothing more about this person is read unless it has passed. */
  const extras = await readMemberExtras(person.userId);
  return (
    <div className="nf-console">
      <PageHead title={person.name ?? "A person"} lede={LEDE} />
      <p className="mb-row nf-caption">
        <Link href="/admin/people" className="inline-flex min-h-11 items-center underline underline-offset-2">
          Find another person
        </Link>
      </p>
      {/* SCUML item 6: open an STR case about this person. */}
      <ConsiderStr from="person" id={id} />

      <section className="mt-section-tight nf-panel nf-panel--card nf-admin-card p-card" aria-label="Who">
        <dl className="grid gap-xs text-[length:var(--nf-text-body-sm)] sm:grid-cols-2">
          {person.handle && (
            <div>
              <dt className="nf-caption text-[var(--nf-content-muted)]">Handle</dt>
              <dd>@{person.handle}</dd>
            </div>
          )}
          <div>
            <dt className="nf-caption text-[var(--nf-content-muted)]">Joined</dt>
            <dd>{when(person.joinedAt, locale) || "Not recorded"}</dd>
          </div>
          <div>
            <dt className="nf-caption text-[var(--nf-content-muted)]">Workspaces</dt>
            <dd>{person.roles.map(roleWord).join(", ") || "Member"}</dd>
          </div>
          {person.agent && (
            <div>
              <dt className="nf-caption text-[var(--nf-content-muted)]">As a lister</dt>
              <dd>
                {[person.agent.name ?? "Agent", person.agent.status ? ui.statusLabel(person.agent.status) : null, `verification tier ${person.agent.tier}`]
                  .filter(Boolean)
                  .join(" · ")}
              </dd>
            </div>
          )}
        </dl>
        {person.checks.length > 0 && (
          <ul className="mt-row space-y-inline-tight text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
            {person.checks.map((c, i) => (
              <li key={`${c.kind}-${i}`}>
                {c.kind}: {c.status}
                {c.decidedAt ? ` · ${when(c.decidedAt, locale)}` : ""}
              </li>
            ))}
          </ul>
        )}
        {person.stop && (
          <div className="mt-row border-t border-[var(--nf-divider)] pt-row" data-testid="person-stop">
            <p className="font-semibold text-[var(--nf-status-rejected)]">
              {person.stop.since ? `Stopped since ${when(person.stop.since, locale)}` : "Stopped"}
              {person.stop.fraudUpheldAt ? ` · upheld as fraud on ${when(person.stop.fraudUpheldAt, locale)}` : ""}
            </p>
            <p className="mt-inline-tight nf-body-sm text-[var(--nf-content-secondary)]">{person.stop.fraudNote ?? person.stop.reason}</p>
            {!person.stop.fraudUpheldAt && file.senior && <UpholdControl suspensionId={person.stop.id} userId={person.userId} />}
            {!person.stop.fraudUpheldAt && !file.senior && (
              <p className="mt-inline-tight nf-caption text-[var(--nf-content-muted)]">
                A senior reviewer can uphold this stop as fraud, which puts this person&apos;s identity keys on the deny-list.
              </p>
            )}
          </div>
        )}
      </section>

      {file.matches.length > 0 && (
        <section className="mt-section-tight nf-panel nf-panel--card nf-admin-card p-card" aria-label="Matches" data-testid="person-matches">
          <h2 className="nf-h4">Matches an upheld fraud stop</h2>
          <ul className="mt-row space-y-inline">
            {file.matches.map((m, i) => (
              <li key={i} className="nf-body-sm text-[var(--nf-status-rejected)]">
                The {m.kind === "nin" ? "NIN" : m.kind === "phone" ? "phone number" : "payout account"} {m.sentence}.
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-section-tight nf-panel nf-panel--card nf-admin-card p-card" aria-label="Linked accounts" data-testid="person-linked">
        <h2 className="nf-h4">Linked accounts</h2>
        {file.linked.length === 0 ? (
          <p className="mt-row nf-body-sm text-[var(--nf-content-muted)]">No other account shares a device, mailbox, phone or payout account.</p>
        ) : (
          <ul className="mt-row space-y-inline">
            {file.linked.map((l) => (
              <li key={`${l.userId}-${l.via}`} className="flex flex-wrap items-baseline gap-x-xs nf-body-sm">
                <Link href={`/admin/people/${l.userId}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                  {l.name}
                </Link>
                <span className="text-[var(--nf-content-secondary)]">{VIA[l.via]}</span>
                {l.stoppedOn && (
                  <span className="nf-caption text-[var(--nf-status-rejected)]">
                    stopped on {when(l.stoppedOn, locale)}
                    {l.fraudUpheld ? " for fraud" : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Trust and Safety: restrictions on record, open cases, Restrict and Lift. */}
      <MemberStanding userId={person.userId} when={(iso) => when(iso, locale)} />

      {extras.state === "ok" ? (
        <MemberSections userId={person.userId} extras={extras.data} ui={ui} locale={locale} />
      ) : (
        <section className="mt-section-tight nf-panel nf-panel--card nf-admin-card p-card" aria-label="Member file">
          <p className="nf-body-sm text-[var(--nf-status-rejected)]">
            Verification, listings, agreements, support, devices and notes could not be read just now. Reload to try again.
          </p>
        </section>
      )}

      {/* The timeline is this file's second job: the facts above it are what a
          reviewer needs to decide, and the record of everything is one tap
          away, folded (D25, and COMPONENT_LIBRARY's "admin case history"). */}
      <section className="mt-section-tight" aria-label="Timeline" data-testid="person-timeline">
        <CaseHistory
          title="Everything, newest first"
          hint={x.cases.historyCount.replace("{count}", String(file.timeline.length))}
        >
          {file.timeline.length === 0 ? (
            <p className="nf-body-sm text-[var(--nf-content-muted)]">Nothing recorded yet.</p>
          ) : (
            <ol className="space-y-inline">
              {file.timeline.map((e, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-xs border-t border-[var(--nf-divider)] pt-inline nf-body-sm">
                  <span className="nf-numeric nf-caption text-[var(--nf-content-muted)]">{when(e.at, locale)}</span>
                  <span className="min-w-0 flex-1 break-words">{e.title}</span>
                  <Link href={e.href} className="nf-caption inline-flex min-h-11 items-center text-[var(--nf-content-secondary)] underline underline-offset-2">
                    {e.desk}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </CaseHistory>
        <p className="mt-sm">
          <Link
            href={`/admin/audit?who=all&q=${id}`}
            className="inline-flex min-h-11 items-center nf-caption font-semibold underline underline-offset-2"
          >
            {x.cases.trailLink}
          </Link>
        </p>
      </section>

      <InternalNotes subjectId={id} path={`/admin/people/${id}`} />
    </div>
  );
}
