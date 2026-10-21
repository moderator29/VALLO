"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readInboxPane, type PaneRow } from "@/lib/messages/pane-actions";
import { VerifiedAvatar } from "@/components/messages/VerifiedAvatar";

/**
 * B17: THE MESSAGES SPLIT, FROM 64REM. The inbox list on the left of an open
 * thread, so somebody answering many threads in a row taps the next one
 * instead of going back each time. The URL still changes per thread, so Back
 * and deep links hold. Below 64rem nothing changes and nothing is fetched.
 */
const WIDE = "(min-width: 64rem)";

export function InboxPane({
  fixture,
  currentId,
  label,
}: {
  fixture?: PaneRow[];
  currentId?: string;
  /** The list's name and heading, in the reader's language (`experienceInbox.inbox.pane`). */
  label: string;
}) {
  const pathname = usePathname();
  const [wide, setWide] = useState(false);
  const [fetched, setFetched] = useState<PaneRow[] | null>(null);
  /* The preview harness hands rows in; the app always reads them. */
  const rows = fixture ?? fetched;

  useEffect(() => {
    let media: MediaQueryList | null = null;
    try {
      media = window.matchMedia(WIDE);
    } catch {
      return;
    }
    const read = () => setWide(media!.matches);
    read();
    media.addEventListener("change", read);
    return () => media?.removeEventListener("change", read);
  }, []);

  /* Re-read on each thread change: the one just opened is no longer unread. */
  useEffect(() => {
    if (!wide || fixture) return;
    let cancelled = false;
    void readInboxPane()
      .then((next) => {
        if (!cancelled) setFetched(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [wide, pathname, fixture]);

  if (!wide || !rows || rows.length === 0) return null;
  return (
    <nav className="nf-msg-pane" aria-label={label} data-testid="inbox-pane">
      <p className="nf-section-label nf-msg-pane__label">{label}</p>
      <ul className="nf-msg-pane__list">
        {rows.map((row) => {
          const href = `/messages/${row.id}`;
          /* The preview names its open row; the app reads the address. */
          const current = currentId ? row.id === currentId : pathname === href;
          const unread = row.unread > 0 && !current;
          return (
            <li key={row.id}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className="nf-msg-pane__row"
                data-testid="inbox-pane-row"
                data-kb-row=""
              >
                {/* The person's photo, or their initial on the brand tint,
                    as on the inbox row. */}
                <VerifiedAvatar
                  name={row.name}
                  tier={row.tier ?? "none"}
                  photoUrl={row.avatarUrl ?? undefined}
                  size="sm"
                />
                <span className="nf-msg-pane__body">
                  <span className="nf-msg-pane__top">
                    <span className={`nf-msg-pane__name${unread ? " is-unread" : ""}`}>{row.name}</span>
                    <span className="nf-msg-pane__meta">
                      <span className="nf-msg-pane__when nf-numeric">{row.when}</span>
                      {unread ? <span className="nf-msg-pane__dot" aria-hidden="true" /> : null}
                    </span>
                  </span>
                  {row.title ? <span className="nf-msg-pane__title">{row.title}</span> : null}
                  <span className={`nf-msg-pane__last${unread ? " is-unread" : ""}`}>{row.last}</span>
                  {unread ? <span className="sr-only">{`${row.unread} unread`}</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
