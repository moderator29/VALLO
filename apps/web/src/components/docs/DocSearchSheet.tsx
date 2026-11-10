"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import "@/app/css/docs-kit.css";

export { POPULAR_TOPICS } from "./popular-topics";

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
const DocSearchPanel = dynamic(() => import("./DocSearchPanel").then((m) => m.DocSearchPanel), { ssr: false });

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
