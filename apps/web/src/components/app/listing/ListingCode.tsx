"use client";

import { useCopyFlash } from "@/lib/ui/use-copy";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";

/**
 * THE CODE A PERSON READS OUT OVER THE PHONE.
 *
 * `VL-` plus six characters, minted by the database the moment a listing goes
 * live. GOVERNING-12 screen four draws it as the thing a searcher typed, and
 * GOVERNING-08 screen four draws it as a panel on the SENT FOR REVIEW screen.
 *
 * ONLY THE FIRST OF THOSE SHIPS, AND THE SECOND IS NOT HERE WAITING FOR A
 * CALLER. The panel was written and then deleted rather than left in the tree,
 * because the render draws it at a moment when the code does not exist: a code
 * is a public handle and a listing in review has no public existence. There is
 * no surface in this product today where a lister meets their code at the
 * scale that panel draws it, and the closest honest one, a "your listing is
 * live" screen, has not been built. An exported component nothing imports is
 * exactly the defect Track N exists to close, and adding a sixth to the list
 * while fixing five of them would have been absurd.
 *
 * ONE MORE THING TRANSLATED RATHER THAN COPIED, recorded rather than quietly
 * changed: the render prints `VL-7K4M-92`, which is eight body characters
 * with an inner hyphen. Ours is six characters and one hyphen, because the
 * brief fixes the format and a render is not a specification.
 *
 * What the wizard does instead of drawing an empty panel is say, in words,
 * that the code arrives when the listing goes live. That is the honest
 * version of the same promise.
 *
 * The copy control is `Button`, which is a rounded rectangle on
 * `--nf-radius-control` and has no capsule variant, so the shape law holds
 * here by construction rather than by inspection.
 */

type Copy = Dictionary["listingReference"];

/**
 * The code itself, set the way a code should be set: wide, monospaced digits,
 * and never wrapped. `/profile/application` already prints the agent
 * reference this way and this is the same house style one size up.
 */
export function ListingCodeText({ code, className = "" }: { code: string; className?: string }) {
  return (
    <span className={`nf-numeric whitespace-nowrap tracking-[0.18em] ${className}`} data-testid="listing-code">
      {code}
    </span>
  );
}

/**
 * The compact form, for a page that is about the property rather than about
 * the code: one line, a label, the code, and a way to take it with you.
 */
export function ListingCodeRow({ code, copy }: { code: string; copy: Copy }) {
  /* Details pass: the one copy path (fallback, tick, a check on the button). */
  const [copied, copyCode] = useCopyFlash();
  const onCopy = () => copyCode(code, "code");

  return (
    <div className="flex flex-wrap items-center gap-sm" data-testid="listing-code-row">
      <span className="nf-caption text-[var(--nf-content-muted)]">{copy.label}</span>
      <ListingCodeText code={code} className="nf-body font-semibold" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        leadingIcon="document"
        done={copied}
        onClick={() => void onCopy()}
        data-testid="listing-code-row-copy"
      >
        {copied ? copy.copied : copy.copy}
      </Button>
    </div>
  );
}
