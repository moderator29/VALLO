"use client";

import { useEffect, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import "@/app/css/docs-kit.css";

/**
 * THE TABLE OF CONTENTS CARD (DOCS_AND_PRESENCE_UPGRADE.md 2.4 and 4.4). One
 * numbered row per section with a chevron, and the section being read marked
 * as the reader scrolls (an observer on a thin band a fifth of the way down,
 * the same reading line the docs rail uses). Anchors are the sections' own
 * ids, so a shared link lands on the section. A plain list of links for the
 * keyboard: Tab moves through it, Enter jumps. The mark changes colour and
 * fill only, so nothing reflows; under reduced motion it changes without a
 * fade.
 */
export function DocToc({ sections, title = "Contents" }: { sections: { id: string; title: string }[]; title?: string }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { threshold: 0, rootMargin: "-20% 0px -70% 0px" },
    );
    for (const t of targets) io.observe(t);
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav className="nf-doc-toc" aria-label={title}>
      <p className="nf-doc-toc__title">
        <UiIcon name="clipboard-list" size={16} />
        {title}
      </p>
      <ol className="nf-doc-toc__list">
        {sections.map((s, i) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="nf-doc-toc__row nf-tap" aria-current={active === s.id ? "location" : undefined}>
              <span className="nf-doc-toc__num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="nf-doc-toc__label">{s.title}</span>
              <UiIcon name="chevron-right" size={16} className="nf-doc-toc__chevron" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
