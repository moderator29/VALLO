"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { SupportResults, SupportSearchField, useSupportSearch } from "@/components/site/support/SupportSearch";
import "@/app/css/docs-kit.css";

/**
 * THE HELP SEARCH SHEET (DOCS_AND_PRESENCE_UPGRADE.md 2.6 and 4.5).
 *
 * It rises from the bottom: a large field, then POPULAR TOPICS as chips,
 * because most people cannot name their problem but recognise it, then a way
 * out for someone in the wrong place entirely. Results come from the one
 * search the platform already has (`useSupportSearch`: Help, Docs, Guides and
 * the legal pages, answered on the device), each naming the document it sits
 * in with the matched words marked.
 *
 * With no network the index cannot load, so instead of an error the chips
 * stay: each one opens a topic page the service worker keeps.
 *
 * The chips are the subjects members write to support about most (live
 * support_tickets by topic, 9 November 2026: bookings, identity checks,
 * account, inspections, safety), plus the money questions every marketplace
 * gets.
 */
export const POPULAR_TOPICS: { label: string; query: string; href: string }[] = [
  { label: "Bookings", query: "booking", href: "/help#bookings" },
  { label: "Verify my ID", query: "verify identity", href: "/help#verification" },
  { label: "Refunds", query: "refund", href: "/help#refunds" },
  { label: "Cancellation", query: "cancel", href: "/cancellations" },
  { label: "Payouts", query: "payout", href: "/help#payouts" },
  { label: "Inspections", query: "inspection", href: "/help#inspections" },
  { label: "List my property", query: "list property", href: "/guides" },
  { label: "Safety", query: "safety", href: "/safety" },
  { label: "My account", query: "account sign in", href: "/help#account" },
];

export function DocSearchSheet({ label = "Search help" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="nf-doc-search-btn nf-tap" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <UiIcon name="search" size={20} label={label} />
      </button>
      {open ? <DocSearchPanel open={open} onOpenChange={setOpen} title={label} /> : null}
    </>
  );
}

function DocSearchPanel({ open, onOpenChange, title }: { open: boolean; onOpenChange(v: boolean): void; title: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [offline, setOffline] = useState(false);
  const listId = useId();
  const { hits, loading, failed, load } = useSupportSearch(query);

  useEffect(() => {
    const read = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);

  const unreachable = offline || failed;
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} closeLabel="Close search" detents={[0.92]} testId="doc-search-sheet">
      <div className="nf-doc-search">
        <SupportSearchField
          value={query}
          onChange={setQuery}
          hits={hits}
          onFocus={load}
          listId={listId}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          placeholder="Search help, guides and policies"
          label="Search help, guides and policies"
          showShortcut={false}
          onOpen={(hit) => {
            close();
            router.push(hit.entry.href);
          }}
        />

        {query.trim() && !unreachable ? (
          loading ? (
            <p className="nf-doc-search__note" role="status">
              Searching...
            </p>
          ) : hits.length > 0 ? (
            <SupportResults hits={hits} listId={listId} activeIndex={activeIndex} onNavigate={close} />
          ) : (
            <p className="nf-doc-search__note" role="status">
              Nothing matches that yet. Try a popular topic below, or ask us.
            </p>
          )
        ) : null}

        {unreachable ? (
          <p className="nf-doc-search__note" role="status">
            You are offline, so search is paused. The popular topics below still open.
          </p>
        ) : null}

        {!query.trim() || unreachable || hits.length === 0 ? (
          <section className="nf-doc-search__topics" aria-labelledby={`${listId}-topics`}>
            <p id={`${listId}-topics`} className="nf-doc-search__eyebrow">
              Popular topics
            </p>
            <div className="nf-doc-chips">
              {POPULAR_TOPICS.map((t) =>
                unreachable ? (
                  <Link key={t.label} href={t.href} className="nf-doc-chip nf-tap" onClick={close}>
                    {t.label}
                  </Link>
                ) : (
                  <button
                    key={t.label}
                    type="button"
                    className="nf-doc-chip nf-tap"
                    onClick={() => {
                      load();
                      setQuery(t.query);
                    }}
                  >
                    {t.label}
                  </button>
                ),
              )}
            </div>
          </section>
        ) : null}

        <Link href="/search" className="nf-doc-search__out nf-tap" onClick={close}>
          <UiIcon name="home" size={18} />
          <span>Looking for a place? Search homes and stays</span>
          <UiIcon name="chevron-right" size={16} />
        </Link>
      </div>
    </Sheet>
  );
}
