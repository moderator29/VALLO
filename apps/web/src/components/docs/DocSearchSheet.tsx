"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useSupportSearch } from "@/components/site/support/SupportSearch";
import { SECTION_LABEL, type SearchHit } from "@/lib/support/search";
import { POPULAR_TOPICS, markWords } from "@/lib/docs/search-topics";
import "./docs-kit.css";

/**
 * THE SEARCH SHEET. It rises from the bottom with a large input and, under it,
 * the popular topics as chips: most people cannot name their problem, but they
 * recognise it. Typing searches the whole written surface (docs, help, guides,
 * policies) on the device, using the same index as the rest of the platform,
 * grouped by kind, each result naming the document it sits in with the matched
 * words marked.
 *
 * WITH NO NETWORK it does not show an error. The chips are plain links that do
 * not depend on the index, so when the index cannot be fetched the sheet says
 * so in one calm line and leaves the topics where they are.
 */
export function DocSearchButton({ label = "Search" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" leadingIcon="search" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {label}
      </Button>
      <DocSearchSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

function groupHits(hits: SearchHit[]): { section: SearchHit["entry"]["section"]; hits: SearchHit[] }[] {
  const order: SearchHit["entry"]["section"][] = ["docs", "help", "guides", "legal"];
  return order
    .map((section) => ({ section, hits: hits.filter((hit) => hit.entry.section === section) }))
    .filter((group) => group.hits.length > 0);
}

export function DocSearchSheet({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const router = useRouter();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const { hits, loading, failed, load } = useSupportSearch(query);
  const groups = useMemo(() => groupHits(hits.slice(0, 12)), [hits]);
  const searching = query.trim().length > 0;

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} title="Search" description="Docs, help, guides and policies" detents={[0.9]}>
      <div role="search">
        <label htmlFor={inputId} className="sr-only">
          Search documentation, help, guides and policies
        </label>
        <input
          id={inputId}
          type="search"
          className="nf-field"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onFocus={load}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && hits[0]) {
              event.preventDefault();
              close();
              router.push(hits[0].entry.href);
            }
          }}
          placeholder="Search, for example refunds"
        />
      </div>

      {searching && loading && <p className="nf-dk-hit__trail">Searching...</p>}

      {searching && failed && (
        <p className="nf-dk-hit__snippet" role="status">
          Search needs a connection. The topics below still work.
        </p>
      )}

      {searching && !loading && !failed && groups.length === 0 && (
        <p className="nf-dk-hit__snippet" role="status">
          Nothing matches that yet. Try one of the topics, or{" "}
          <Link href="/contact" onClick={close}>
            ask us directly
          </Link>
          .
        </p>
      )}

      {groups.map((group) => (
        <section key={group.section} aria-label={SECTION_LABEL[group.section]}>
          <p className="nf-dk-sheet-label">{SECTION_LABEL[group.section]}</p>
          {group.hits.map((hit) => (
            <Link key={hit.entry.id} href={hit.entry.href} className="nf-dk-hit" onClick={close}>
              <span className="nf-dk-hit__title">{hit.entry.title}</span>
              <span className="nf-dk-hit__trail">{hit.entry.trail}</span>
              {hit.snippet ? (
                <span className="nf-dk-hit__snippet">
                  {markWords(hit.snippet, query).map((part, i) =>
                    part.mark ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>,
                  )}
                </span>
              ) : null}
            </Link>
          ))}
        </section>
      ))}

      <p className="nf-dk-sheet-label">Popular topics</p>
      <ul className="nf-dk-chips" aria-label="Popular topics">
        {POPULAR_TOPICS.map((topic) => (
          <li key={topic.label}>
            <Link href={topic.href} className="nf-dk-chip" onClick={close}>
              {topic.label}
            </Link>
          </li>
        ))}
      </ul>

      <p className="nf-dk-sheet-label">In the wrong place?</p>
      <Link href="/search" className="nf-dk-cross" onClick={close}>
        Looking for a place? Search homes
        <UiIcon name="arrow-right" size={16} />
      </Link>
    </Sheet>
  );
}
