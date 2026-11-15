"use client";

import { Button } from "@/components/ui/Button";
import { CopyValue } from "@/components/ui/CopyButton";
import { banner } from "@/lib/ui/toast";

/**
 * The moments the quick pill speaks for, each fired the way the product fires
 * it, beside one error so the two voices can be seen apart: the pill at the
 * bottom, the banner at the top.
 */
const MOMENTS = [
  { id: "message", words: "Message copied" },
  { id: "link", words: "Link copied" },
  { id: "code", words: "Code copied" },
  { id: "saved", words: "Saved. It is in Saved." },
  { id: "removed", words: "Removed from Saved." },
  { id: "compare", words: "Added to compare" },
  { id: "photo", words: "Photo saved" },
  { id: "long", words: "Saved on this device. It is in Saved." },
] as const;

export function PillDeck() {
  return (
    <div className="flex flex-col gap-md" data-testid="pill-deck">
      <header className="flex flex-col gap-2xs">
        <h1 className="nf-h2">The quick pill</h1>
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">
          A small confirmation at the bottom of the screen. It comes in, is held for about a second and a half, and
          leaves by itself. Anything that failed, or that can be undone or tried again, stays on the banner at the top.
        </p>
      </header>
      <section className="nf-glass nf-glass--card flex flex-col gap-sm p-md" aria-label="Confirmations">
        <h2 className="nf-h4">Confirmations</h2>
        <div className="flex flex-wrap gap-xs">
          {MOMENTS.map((moment) => (
            <Button key={moment.id} variant="secondary" size="sm" data-testid={`pill-${moment.id}`} onClick={() => banner.quick(moment.words)}>
              {moment.words}
            </Button>
          ))}
        </div>
      </section>
      <section className="nf-glass nf-glass--card flex flex-col gap-sm p-md" aria-label="A reference with its copy control">
        <h2 className="nf-h4">A reference</h2>
        <p className="nf-body">
          <CopyValue value="VAL-2026-0042" kind="code" label="Copy the reference" message="Reference copied" testId="pill-reference" />
        </p>
      </section>
      <section className="nf-glass nf-glass--card flex flex-col gap-sm p-md" aria-label="The other voice">
        <h2 className="nf-h4">The other voice</h2>
        <div className="flex flex-wrap gap-xs">
          <Button variant="secondary" size="sm" data-testid="pill-error" onClick={() => banner.error("We could not update your shortlist just now.")}>
            An error, at the top
          </Button>
        </div>
      </section>
    </div>
  );
}
