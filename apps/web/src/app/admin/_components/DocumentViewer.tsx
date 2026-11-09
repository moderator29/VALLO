"use client";

import Image from "next/image";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";

/**
 * A person's identity document, read inside Vallo.
 *
 * WHAT THIS REPLACES, ON THREE DESKS AT ONCE. `/admin/kyc`,
 * `/admin/businesses` and `/admin/agents` each rendered a signed Supabase
 * Storage URL in an anchor with `target="_blank"`. Tapping a NIN, a passport
 * or a CAC certificate opened it on `<project>.supabase.co`: a third party
 * origin, a tab that is not ours, a content security policy that is not ours,
 * an entry in the browser's history and a copy in its disc cache, and a live
 * signed URL sitting in our own DOM for the next ten minutes where anything
 * could read it and anybody could forward it.
 *
 * Nobody leaves Vallo. Least of all carrying somebody else's passport.
 *
 * The bytes now come from `/api/documents/<id>` on our own origin, behind
 * `requireAdmin`, uncached, with one audit row per view, and the signed URL
 * is never minted for a browser at all.
 *
 * WHAT IS HONESTLY NOT DONE YET, SAID HERE RATHER THAN DISCOVERED LATER. An
 * image is drawn in this sheet. A PDF IS NOT, and there is no in-app renderer
 * on this platform today. The sweep's answer is `pdf.js` drawn to a canvas
 * (`docs/research/ON_PLATFORM_SWEEP.md` section 8), and both routes to it
 * need a content security policy change that belongs to whoever is holding
 * `lib/security/csp.ts`: a same-origin frame needs `frame-src 'self'`, and
 * pdf.js needs a worker source. Neither was taken unilaterally.
 *
 * So a PDF is offered as a file from OUR origin instead, which is a smaller
 * departure than the one this replaces (no other company's page, no other
 * company's URL bar, no signed link to forward) and is still a departure. The
 * seam is `DocumentCanvas` below and it is one component wide.
 */

/** How the sheet should draw this one. Decided from the stored extension. */
export type DocumentMediaKind = "image" | "pdf" | "file";

/** Read in the sentence "Vallo does not draw ... on screen yet". */
const WORDS: Record<DocumentMediaKind, string> = {
  image: "photographs",
  pdf: "a PDF",
  file: "this kind of file",
};

function DocumentCanvas({
  documentId,
  media,
  title,
}: {
  documentId: string;
  media: DocumentMediaKind;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  const [upright, setUpright] = useState(0);
  const source = `/api/documents/${documentId}`;

  if (media === "image") {
    if (failed) {
      return (
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">
          The file could not be reached just now. Close this and open it again.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-xs">
        <div className="flex items-center gap-inline">
          <Button type="button" variant="quiet" size="sm" onClick={() => setUpright((turn) => (turn + 90) % 360)}>
            Turn it
          </Button>
          <span className="nf-overline">
            A photographed document is often sideways. Turning it here changes nothing
            that is stored.
          </span>
        </div>
        {/* `unoptimized`, AND THAT IS THE WHOLE POINT OF THIS ELEMENT.
            The optimiser CACHES what it optimises, on the server, on disc.
            This is one person's identity document, served uncached from our
            own route precisely so that nothing outlives the view, and putting
            it through the pipeline would write a copy of somebody's passport
            into a cache directory and leave it there. `unoptimized` emits the
            source directly with no `/_next/image` round trip, which is the
            same decision `RemoteImage` takes for a signed storage URL and
            `CoinImage` takes for remote art.

            `fill` rather than an aspect guess: a photographed document can be
            any shape and the box below is ours, not a stylesheet another
            worker owns, so there is no reason to promise a ratio we do not
            know. */}
        <div className="relative h-[62vh] w-full overflow-hidden rounded-control bg-[var(--nf-surface-sunken)]">
          <Image
            src={source}
            alt={title}
            fill
            unoptimized
            onError={() => setFailed(true)}
            style={{ transform: `rotate(${upright}deg)` }}
            className="object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-xs">
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">
        Vallo does not draw {WORDS[media]} on screen yet, so this one opens with
        whatever reads files on this device. It comes from Vallo and from nowhere
        else: no other company sees that you opened it.
      </p>
      <a
        href={source}
        download
        className="nf-chip w-fit text-[length:var(--nf-text-overline)] font-semibold"
      >
        <UiIcon name="document" size="sm" />
        Save the file
      </a>
    </div>
  );
}

/**
 * The control that opens it. Rendered wherever a desk used to render a link.
 *
 * A button rather than an anchor, deliberately: there is no URL to give it.
 * That is the point.
 */
export function DocumentViewer({
  documentId,
  media,
  label,
  title,
  className,
}: {
  documentId: string;
  media: DocumentMediaKind;
  /** What the control says. Each desk keeps its own wording. */
  label: string;
  /**
   * What the document is, for the sheet's heading and the image's accessible
   * name. NEVER a file name and never a document number: rule 16 holds inside
   * the console as well as outside it.
   */
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        closeLabel="Close"
        detents={[0.92]}
      >
        <DocumentCanvas documentId={documentId} media={media} title={title} />
      </Sheet>
    </>
  );
}
