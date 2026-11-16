"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * A desk's explainer, one line on a phone with More to read the rest.
 *
 * Every desk opens with a sentence or three on what it is for. On a 393px
 * screen that was four grey lines between the title and the work, on every
 * desk, every visit. The full text is always in the page (a screen reader
 * reads all of it); the phone draws the first line and offers More only
 * when there is more than a line to show. From 640px up it is drawn whole,
 * as it was. A section's hint (`adminUi().Section`) takes the same fold.
 */
export function PageLede({
  text,
  more = "More",
  less = "Less",
  className = "nf-admin-page-head__lede",
}: {
  text: string;
  more?: string;
  less?: string;
  /** The paragraph's own type: a page lede by default, a section hint where given. */
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    const line = ref.current;
    if (!line) return;
    const measure = () => {
      if (open) return;
      setClipped(line.scrollHeight > line.clientHeight + 1 || line.scrollWidth > line.clientWidth + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const sized = new ResizeObserver(measure);
    sized.observe(line);
    return () => sized.disconnect();
  }, [open, text]);

  return (
    <div className={`nf-admin-lede${open ? " nf-admin-lede--open" : ""}`}>
      <p ref={ref} className={className}>
        {text}
      </p>
      {(clipped || open) && (
        <button
          type="button"
          className="nf-admin-lede__more"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
        >
          {open ? less : more}
        </button>
      )}
    </div>
  );
}
