"use client";

import { useRef, useState } from "react";

import { RemoteImage } from "@/components/ui/RemoteImage";
import { UiIcon } from "@/design-system/icons/UiIcon";

/**
 * The listing's photographs: a swipe row that snaps, the "2 of 5" counter,
 * and the arrows on a wide screen. No photos: one calm tile that says so,
 * never a stand-in photograph.
 */
export function Gallery({ urls, title, counter, emptyLabel, prevLabel, nextLabel }: { urls: string[]; title: string; counter: string; emptyLabel: string; prevLabel: string; nextLabel: string }) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState(0);

  if (!urls.length) {
    return (
      <div className="nf-rmg nf-rmg--empty" data-testid="listing-gallery">
        <UiIcon name="picture" size={32} />
        <span>{emptyLabel}</span>
      </div>
    );
  }

  const go = (i: number) => {
    const row = rowRef.current;
    if (!row) return;
    const next = Math.max(0, Math.min(urls.length - 1, i));
    row.scrollTo({ left: next * row.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="nf-rmg" data-testid="listing-gallery">
      <div
        ref={rowRef}
        className="nf-rmg__row"
        onScroll={(e) => {
          const row = e.currentTarget;
          const i = Math.round(row.scrollLeft / Math.max(1, row.clientWidth));
          if (i !== at) setAt(i);
        }}
      >
        {urls.map((src, i) => (
          <div key={src} className="nf-rmg__slide">
            <RemoteImage src={src} alt={i === 0 ? title : ""} width={1200} height={900} sizes="(max-width: 768px) 100vw, 720px" priority={i === 0} loading={i === 0 ? "eager" : "lazy"} />
          </div>
        ))}
      </div>
      {urls.length > 1 ? (
        <>
          <span className="nf-rmg__count" aria-live="polite">
            {counter.replace("{n}", String(at + 1)).replace("{total}", String(urls.length))}
          </span>
          <button type="button" className="nf-rmg__nav nf-rmg__nav--prev" aria-label={prevLabel} onClick={() => go(at - 1)} disabled={at === 0}>
            <UiIcon name="arrow-left" size={20} />
          </button>
          <button type="button" className="nf-rmg__nav nf-rmg__nav--next" aria-label={nextLabel} onClick={() => go(at + 1)} disabled={at === urls.length - 1}>
            <UiIcon name="arrow-right" size={20} />
          </button>
        </>
      ) : null}
    </div>
  );
}
