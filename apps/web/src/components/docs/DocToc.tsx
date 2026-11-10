"use client";

import { useEffect, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import "./docs-kit.css";

/**
 * THE TABLE OF CONTENTS: a card headed CONTENTS, one numbered tappable row per
 * section, the current section marked as the reader scrolls. Every row is a
 * plain anchor (`#section-id`), so it works with no script, survives being
 * shared, and is reachable by keyboard in reading order.
 *
 * "Current" is the last section whose top has passed a line near the top of the
 * viewport, read from an IntersectionObserver. If the observer is missing the
 * list simply carries no mark.
 */
export type DocTocItem = { id: string; heading: string };

export function DocToc({ items, title = "Contents" }: { items: readonly DocTocItem[]; title?: string }) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Map<string, boolean>();
    const pick = () => {
      const first = items.find((item) => seen.get(item.id));
      if (first) setCurrent(first.id);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
        pick();
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;
  return (
    <nav className="nf-dk-toc" aria-label={title}>
      <p className="nf-dk-toc__head">
        <UiIcon name="clipboard-list" size={16} />
        {title}
      </p>
      <ol>
        {items.map((item, index) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={current === item.id ? "true" : undefined}>
              <span className="nf-dk-toc__n">{index + 1}</span>
              <span>{item.heading}</span>
              <UiIcon name="chevron-right" size={16} />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
