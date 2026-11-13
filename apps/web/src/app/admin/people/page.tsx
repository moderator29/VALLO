import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { searchPeople } from "@/lib/admin/member-queries";
import { adminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import { Button, ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "People", robots: { index: false, follow: false } };

const LEDE =
  "Find anybody on Vallo by name, @handle, email address or account id, then open their file: who they are, verification, listings, agreements, support, reports, devices and the team's notes. Opening a file is recorded in the audit log; searching is not, and shows names only.";

const BY_WORD = { id: "account id", email: "email address", handle: "handle", name: "name" } as const;

/**
 * /admin/people: THE MEMBER SEARCH.
 *
 * The person file (V-90) was reachable only from a stop, a booking or a
 * listing's lister, so a member who rang in without any of those could not be
 * found at all. This is the front door to it. Admins only: `searchPeople`
 * refuses scoped staff, as the person file does.
 *
 * A plain GET form, so it works without JavaScript and a search can be sent to
 * a colleague as a link. No email or phone number is printed in the results.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const ui = adminUi(getDictionary(locale), locale);
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  const read = await searchPeople(q);

  return (
    <div className="nf-console" data-testid="people-desk">
      <PageHead title="People" lede={LEDE} />

      <form method="get" action="/admin/people" role="search" className="nf-panel nf-panel--card nf-admin-card p-card">
        <label htmlFor="people-q" className="nf-label">
          Name, @handle, email or account id
        </label>
        <div className="mt-inline flex flex-wrap gap-xs">
          <input
            id="people-q"
            name="q"
            type="search"
            enterKeyHint="search"
            defaultValue={q}
            autoComplete="off"
            spellCheck={false}
            className="nf-field min-h-11 min-w-0 flex-1 basis-60"
          />
          <Button type="submit" variant="primary">
            Search
          </Button>
          {q && (
            <ButtonLink href="/admin/people" variant="quiet">
              Clear
            </ButtonLink>
          )}
        </div>
      </form>

      <section className="mt-section-tight nf-panel nf-panel--card nf-admin-card p-card" aria-labelledby="people-results">
        {read.state === "forbidden" ? (
          <p id="people-results" className="nf-body-sm text-[var(--nf-content-secondary)]">
            Searching members is for admins. Your access covers named desks only.
          </p>
        ) : read.state !== "ok" ? (
          <>
            <h2 id="people-results" className="nf-h4">
              Results
            </h2>
            <p className="mt-row nf-body-sm text-[var(--nf-status-rejected)]">The search could not run just now. Nothing was changed. Try again.</p>
          </>
        ) : (
          <>
            <h2 id="people-results" className="nf-h4">
              {!q ? "Newest members" : read.data.term ? `Matching that ${BY_WORD[read.data.term.by]}` : "Results"}
            </h2>
            {q && !read.data.term && (
              <p className="mt-row nf-body-sm text-[var(--nf-content-secondary)]">
                Type at least two letters of a name, an @handle, a full email address or an account id.
              </p>
            )}
            {read.data.emailUnavailable && (
              <p className="mt-row nf-body-sm text-[var(--nf-content-secondary)]">
                Looking up an email address is not switched on in this database. Search by name or handle instead.
              </p>
            )}
            {!q && read.data.hits.length === 0 && (
              <p className="mt-row nf-body-sm text-[var(--nf-content-muted)]">
                Nobody has signed up yet. Each new member appears here, newest first, the moment their account exists.
              </p>
            )}
            {read.data.term && read.data.hits.length === 0 && !read.data.emailUnavailable && (
              <p className="mt-row nf-body-sm text-[var(--nf-content-muted)]">Nobody matches that {BY_WORD[read.data.term.by]}.</p>
            )}
            {read.data.hits.length > 0 && (
              <ul className="mt-row space-y-inline">
                {read.data.hits.map((p) => (
                  <li
                    key={p.userId}
                    className="flex flex-wrap items-baseline gap-x-xs gap-y-3xs border-t border-[var(--nf-divider)] pt-inline nf-body-sm [overflow-wrap:anywhere]"
                  >
                    <Link href={`/admin/people/${p.userId}`} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
                      {p.name ?? "No name given"}
                    </Link>
                    {p.handle && <span className="text-[var(--nf-content-secondary)]">@{p.handle}</span>}
                    {p.roles.map((r) => (
                      <span key={r} className="nf-badge">
                        {r === "super_admin" ? "Super admin" : r === "admin" ? "Admin" : r === "agent" ? "Lister" : r}
                      </span>
                    ))}
                    {p.lister && (
                      <span className="nf-caption text-[var(--nf-content-secondary)]">
                        lister {ui.statusLabel(p.lister.status ?? "")} · tier {p.lister.tier}
                      </span>
                    )}
                    <span className="nf-caption text-[var(--nf-content-muted)]">joined {ui.day(p.joinedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            {read.data.capped && (
              <p className="mt-row nf-caption text-[var(--nf-content-muted)]">
                The first 25 matches are shown, newest first. Add a surname or use the handle to narrow it.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
