import Link from "next/link";
import type { Metadata } from "next";
import { lookup } from "@/lib/admin/lookup-reads";
import { PageHead, Panel } from "../_components/panels";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Lookup", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const KIND_WORD: Record<string, string> = {
  ticket: "a support ticket reference",
  uuid: "an id",
  email: "an email address",
  listing: "a listing code",
  agent: "an agent's code",
  payment: "a payment reference",
  error: "an error reference",
  text: "a word",
};

/**
 * THE CONSOLE'S ONE LOOKUP BOX (C6). Ctrl K or Cmd K, paste whatever the
 * caller read out, and get typed results from every desk this viewer may
 * open. A desk they may not open is named as skipped, never searched.
 */
export default async function LookupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";
  const result = q.trim() ? await lookup(q) : null;

  return (
    <div className="nf-console">
      <PageHead
        title="Lookup"
        lede="Paste a ticket reference, a booking or member id, an email address, a listing code, an agent's VA- code, a payment reference or an error reference. Press Ctrl K (Cmd K on a Mac) from any desk."
      />
      <form method="get" action="/admin/lookup" role="search" className="mb-block flex flex-wrap gap-xs">
        <label className="sr-only" htmlFor="lookup-q">
          What to look up
        </label>
        <input id="lookup-q" name="q" type="search" enterKeyHint="search" defaultValue={q} className="nf-field min-w-0 flex-1" autoFocus />
        <Button type="submit" variant="primary">
          Look up
        </Button>
      </form>
      {result ? (
        <Panel title={`Results for ${KIND_WORD[result.kind] ?? "this"}`}>
          {result.kind === "text" ? (
            <p className="nf-body">
              That reads as a word, not a reference. Search it on a desk instead, or paste the exact reference.
            </p>
          ) : result.hits.length === 0 ? (
            <p className="nf-body">Nothing matched on the desks you can open.</p>
          ) : (
            <ul className="nf-admin-queue" data-testid="lookup-hits">
              {result.hits.map((hit) => (
                <li key={`${hit.kind}-${hit.href}`} className="nf-admin-queue-row">
                  <p className="flex flex-wrap items-center gap-xs">
                    <StatusBadge tone="neutral">{hit.kind}</StatusBadge>
                    <Link href={hit.href} className="inline-flex min-h-11 items-center font-semibold text-[var(--nf-content-link)] underline-offset-2 hover:underline">
                      {hit.title}
                    </Link>
                  </p>
                  <p className="nf-caption">{hit.sub}</p>
                </li>
              ))}
            </ul>
          )}
          {result.kind === "error" ? (
            <p className="nf-caption mt-row">
              An error reference is the first characters of the crash report&apos;s digest. With crash reporting on
              (SENTRY_DSN), search the report by it; the server log carries the full digest too.
            </p>
          ) : null}
          {result.skipped.length > 0 ? (
            <p className="nf-caption mt-row">Not searched, because your access does not include them: {result.skipped.join(", ")}.</p>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
