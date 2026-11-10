"use client";

import Link from "next/link";
import { POPULAR_TOPICS } from "@/components/docs/popular-topics";

/**
 * POPULAR TOPICS (R100) on the help centre itself: the same chips as the
 * search sheet, read from the sheet's own list so the two never disagree.
 * A client file only because the list lives in a client module, and a server
 * page cannot read a client module's data. Plain links: each lands on its
 * answer (`/help#refunds`) or its page with no script needed to follow it.
 */
export function PopularTopics({ id }: { id: string }) {
  return (
    <section aria-labelledby={id} className="grid gap-sm">
      <h2 id={id} className="nf-doc-search__eyebrow">
        Popular topics
      </h2>
      <div className="nf-doc-chips">
        {POPULAR_TOPICS.map((topic) => (
          <Link key={topic.label} href={topic.href} className="nf-doc-chip nf-tap">
            {topic.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
