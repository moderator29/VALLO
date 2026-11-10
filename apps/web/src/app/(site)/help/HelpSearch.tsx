"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { MotionReveal } from "@/components/motion/Reveal";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { countOf } from "@vallo/i18n/core";
import { questionAlias, topicAliases, topicId } from "./topics";
import { NoResults, SupportResults, SupportSearchField, useSupportSearch } from "@/components/site/support/SupportSearch";

export type Faq = {
  category: string;
  q: string;
  a: string;
};

/**
 * Searchable FAQ list.
 *
 * A single text field filters the whole list live, matching against the
 * question, the answer and the category, so "refund" finds everything about
 * money coming back regardless of which section it sits in. Each entry is a
 * native details element inside a glass card: keyboard accessible, no JS
 * needed to open, and the search never traps focus.
 */
export function HelpSearch({
  faqs,
  browse,
  answersLabel,
}: {
  faqs: Faq[];
  /**
   * What a reader who has not typed sees between the field and the answers:
   * the popular topics and the topic cards (the page draws them on the kit).
   * A search replaces it with results, so nothing stands between a query and
   * its answers.
   */
  browse?: ReactNode;
  /** The heading over the full list of answers. */
  answersLabel?: string;
}) {
  const [query, setQuery] = useState("");

  /*
   * A SHORT ANCHOR OPENS ITS ANSWER. `/help#refunds` lands on one question
   * (`HELP_ANCHORS`), and a question is a closed details element, so the
   * landing would show only the question. On arrival, and on every later
   * hash change, the targeted answer is opened; a topic anchor is left
   * alone, because a topic is a list to read, not one answer.
   */
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) el.open = true;
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  /*
   * A TOPIC LINK ALWAYS LANDS. The topic index at the top of the page jumps to
   * `#help-<topic>`; while a search has filtered that topic out, the target is
   * not in the page and the jump went nowhere. So a click on one of those links
   * clears the search first, then scrolls to the section once it has rendered.
   * With no search active the link is left to the browser.
   */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      /* Only a plain primary click is ours to carry: a cmd, ctrl, shift or alt
         click, or a middle click, is the browser's "open this in another tab",
         and taking it over would replace the page the person meant to keep. */
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const link = (event.target as Element | null)?.closest?.('a[href^="#help-"]');
      if (!link || !query) return;
      const hash = link.getAttribute("href") ?? "";
      event.preventDefault();
      setQuery("");
      history.pushState(null, "", hash);
      requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView()));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [query]);

  /* ONE SEARCH: while somebody is searching, the results come from the
     unified index (Help, Docs, Guides, legal), each naming its section. With
     no query the topic list below is exactly as it was. */
  const listId = useId();
  const [active, setActive] = useState(0);
  const { hits, loading, failed, load } = useSupportSearch(query);
  const searching = query.trim().length > 0;
  const visible = faqs;

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const f of visible) if (!seen.includes(f.category)) seen.push(f.category);
    return seen;
  }, [visible]);

  return (
    <div>
      <SupportSearchField
        value={query}
        onChange={setQuery}
        hits={hits}
        onFocus={load}
        listId={listId}
        activeIndex={active}
        setActiveIndex={setActive}
        placeholder="Search help, docs and guides"
        label="Search help, documentation, guides and policies"
        onOpen={(hit) => {
          /* A Help answer opens where it is; anything else is a page to go to. */
          if (hit.entry.section === "help") {
            const row = document.getElementById(`${listId}-${hits.indexOf(hit)}`);
            row?.querySelector("details")?.setAttribute("open", "");
            row?.scrollIntoView({ block: "nearest" });
          } else {
            window.location.assign(hit.entry.href);
          }
        }}
      />
      <p className="mt-inline text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]" role="status">
        {!searching
          ? `${faqs.length} answers, and the docs, guides and policies`
          : loading
            ? "Searching..."
            : `${countOf(hits.length, "results", "en")} across Help, Docs, Guides and policies`}
      </p>

      {searching ? (
        <div className="mt-heading">
          {hits.length > 0 ? (
            <SupportResults hits={hits} listId={listId} activeIndex={active} inline />
          ) : loading ? null : (
            <NoResults failed={failed} />
          )}
        </div>
      ) : (
        <>
      {browse}
      {/* Grouped results */}
      {visible.length > 0 ? (
        <div className="mt-block space-y-block">
          {answersLabel ? <h2 className="nf-h3">{answersLabel}</h2> : null}
          {categories.map((cat) => (
            <MotionReveal as="section" key={cat} id={topicId(cat)} aria-label={cat} className="scroll-mt-28">
              {/* The short anchors for this topic sit on its first line, so
                  `/help#bookings` lands where `#help-booking-a-stay` does. */}
              {topicAliases(cat).map((alias) => (
                <span key={alias} id={alias} className="block scroll-mt-28" aria-hidden="true" />
              ))}
              <h3 className="nf-overline mb-row">{cat}</h3>
              <div className="space-y-row">
                {visible
                  .filter((f) => f.category === cat)
                  .map((f) => (
                    <details key={f.q} id={questionAlias(f.q)} className="nf-panel nf-panel--card nf-m-details group block scroll-mt-28 p-0">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-row p-card-sm font-semibold leading-snug [&::-webkit-details-marker]:hidden">
                        {f.q}
                        <UiIcon
                          name="chevron-down"
                          size={20}
                          className="nf-m-chevron shrink-0 text-[var(--nf-content-muted)]"
                        />
                      </summary>
                      <p className="max-w-measure-body px-group pb-group text-[length:var(--nf-text-row)] leading-[1.6] text-[var(--nf-content-secondary)] sm:px-heading sm:pb-heading">
                        {f.a}
                      </p>
                    </details>
                  ))}
              </div>
            </MotionReveal>
          ))}
        </div>
      ) : null}
        </>
      )}
    </div>
  );
}
