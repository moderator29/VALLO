"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui/Field";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { initial } from "@/lib/text/initial";
import { searchPeople } from "@/lib/social/people-search-actions";
import type { PersonHit } from "@/lib/social/people-hits";
import "./people-search.css";

type Copy = {
  label: string;
  placeholder: string;
  clear: string;
  searching: string;
  none: string;
  seeAll: string;
};

/**
 * FIND PEOPLE BY @USERNAME, AS YOU TYPE (founder, 9 October 2026: "search
 * people by their username from profile and they pop up their profile").
 *
 *   dropdown  the Profile tab: the first few matches under the field. Tap one
 *             and that person's profile opens. Enter with a match opens the
 *             top one, which is the exact @username when there is one.
 *   page      /u: the same field, but it keeps the page's own full list in
 *             step as you type (the address carries the search, so a search
 *             can be sent, reloaded or gone back to).
 *
 * Both work without a script as a plain form that submits to `/u?q=`.
 */
export function PeopleSearch({
  mode,
  initialQuery = "",
  copy,
}: {
  mode: "dropdown" | "page";
  initialQuery?: string;
  copy: Copy;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  /* The newest answer and what it was for: an answer to anything but what is
     in the box now is not shown, so a slow older search never overwrites a
     newer one. */
  const [result, setResult] = useState<{ q: string; hits: PersonHit[] } | null>(null);
  const [, startTransition] = useTransition();
  const latest = useRef("");
  const typed = value.trim().replace(/^@+/, "");

  useEffect(() => {
    latest.current = typed;
    if (typed.length < 2) {
      if (mode === "page" && value === "" && initialQuery !== "") {
        startTransition(() => router.replace("/u", { scroll: false }));
      }
      return;
    }
    const timer = window.setTimeout(async () => {
      if (mode === "page") {
        startTransition(() => router.replace(`/u?q=${encodeURIComponent(typed)}`, { scroll: false }));
        return;
      }
      const answer = await searchPeople(typed);
      if (latest.current === typed) setResult({ q: typed, hits: answer.ok ? answer.data.hits : [] });
    }, 250);
    return () => window.clearTimeout(timer);
    // The router and the transition starter are stable; the typed text drives the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, mode]);

  const hits = result && result.q === typed ? result.hits : null;
  const busy = mode === "dropdown" && typed.length >= 2 && hits === null;

  const open = hits && hits.length > 0 ? hits[0] : null;

  return (
    <div className="nf-pfind" data-testid="people-search" data-mode={mode}>
      <form
        action="/u"
        method="get"
        onSubmit={(event) => {
          if (mode === "dropdown" && open) {
            event.preventDefault();
            router.push(`/u/${open.handle}`);
          }
        }}
      >
        <TextField
          label={copy.label}
          hideLabel
          leadingIcon="search"
          clearable={copy.clear}
          onClear={() => setValue("")}
          name="q"
          /* Text, not "search": a search input draws the browser's own clear
             button beside ours. The search keyboard still comes from
             inputMode and enterKeyHint. */
          type="text"
          inputMode="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={copy.placeholder}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
      </form>

      {mode === "dropdown" && typed.length >= 2 ? (
        <div className="nf-pfind__panel" role="region" aria-label={copy.label} aria-live="polite">
          {busy && hits === null ? (
            <p className="nf-pfind__note">{copy.searching}</p>
          ) : hits && hits.length === 0 ? (
            <p className="nf-pfind__note">{copy.none.replace("{query}", `@${typed}`)}</p>
          ) : (
            <>
              {(hits ?? []).map((person) => (
                <Link key={person.handle} href={`/u/${person.handle}`} className="nf-pfind__row" data-testid="people-hit">
                  <span className="nf-people__avatar" aria-hidden="true">
                    {person.avatarUrl ? (
                      <RemoteImage src={person.avatarUrl} alt="" width={96} height={96} sizes="46px" />
                    ) : (
                      <span>{initial(person.displayLabel)}</span>
                    )}
                  </span>
                  <span className="nf-pfind__who">
                    <span className="nf-people__name">
                      <span className="truncate-none">{person.displayLabel}</span>
                    </span>
                    <span className="nf-people__handle">@{person.handle}</span>
                  </span>
                </Link>
              ))}
              <Link href={`/u?q=${encodeURIComponent(typed)}`} className="nf-pfind__all nf-section-action">
                {copy.seeAll.replace("{query}", `@${typed}`)}
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
