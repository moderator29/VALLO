"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { DOC_DESTINATIONS, type DocDestinationId } from "@/lib/docs/destinations";
import { readDocViewer, type DocViewer } from "@/lib/docs/viewer-actions";
import "./docs-kit.css";

/**
 * A DOCUMENT BUTTON: a real action into the product, styled as every other
 * primary action, that knows who is reading.
 *
 *  - Signed out and the destination needs an account: it goes to sign in and
 *    carries the destination, so the reader arrives there afterwards. A line
 *    beside it says so in advance.
 *  - Identity-aware (Start verification): if the reader's identity document is
 *    already approved it says that instead of pretending there is work to do;
 *    if one is with a reviewer it says where it stands.
 *  - Never a dead end: every state has a link that goes somewhere real and a
 *    sentence that says why.
 *
 * Until the reader's state is known (the first moments after the page loads, or
 * a failed lookup) it is an ordinary link to the destination itself. The
 * product's own gate sends a signed-out visitor to sign in from there, so the
 * button works before, and without, any script.
 */

let viewerPromise: Promise<DocViewer> | null = null;
function loadViewer(): Promise<DocViewer> {
  if (!viewerPromise) {
    viewerPromise = readDocViewer().catch(() => {
      viewerPromise = null;
      return { signedIn: false, identity: "none" as const };
    });
  }
  return viewerPromise;
}

function useDocViewer(): DocViewer | null {
  const [viewer, setViewer] = useState<DocViewer | null>(null);
  useEffect(() => {
    let live = true;
    loadViewer().then((value) => {
      if (live) setViewer(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return viewer;
}

export function signInHref(destination: string): string {
  return `/sign-in?next=${encodeURIComponent(destination)}`;
}

export function DocButton({
  to,
  variant = "primary",
  size = "md",
  full,
}: {
  to: DocDestinationId;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  full?: boolean;
}) {
  const viewer = useDocViewer();
  const dest = DOC_DESTINATIONS[to];
  const signedOut = viewer !== null && !viewer.signedIn && dest.needs !== "none";

  if (viewer?.signedIn && dest.needs === "identity" && viewer.identity === "approved") {
    return (
      <div className="nf-dk-actions__note" role="status" data-testid={`doc-button-${to}`}>
        <UiIcon name="circle-check" size={16} /> Your identity document has been approved, so there is nothing to start.{" "}
        <Link href={dest.href}>See your verification</Link>.
      </div>
    );
  }
  if (viewer?.signedIn && dest.needs === "identity" && viewer.identity === "pending") {
    return (
      <div className="nf-dk-actions__note" role="status" data-testid={`doc-button-${to}`}>
        <UiIcon name="clock" size={16} /> Your identity document is with a reviewer. <Link href={dest.href}>See where it stands</Link>.
      </div>
    );
  }

  return (
    <ButtonLink
      href={signedOut ? signInHref(dest.href) : dest.href}
      variant={variant}
      size={size}
      full={full}
      leadingIcon={dest.icon}
      data-testid={`doc-button-${to}`}
      data-destination={dest.href}
    >
      {dest.label}
    </ButtonLink>
  );
}

/**
 * A row of document buttons, placed at the end of the step they describe or, with
 * `foot`, as the closing panel of a page. The first is the primary action; the
 * rest are secondary. One sentence beneath says what a signed-out reader will
 * meet, for any button that needs an account.
 */
export function DocButtons({
  items,
  title,
  foot = false,
}: {
  items: readonly DocDestinationId[];
  title?: string;
  foot?: boolean;
}) {
  const viewer = useDocViewer();
  const needsAccount = items.some((id) => DOC_DESTINATIONS[id].needs !== "none");
  const signedOut = viewer !== null && !viewer.signedIn;
  const firstGated = items.map((id) => DOC_DESTINATIONS[id]).find((d) => d.needs !== "none");
  return (
    <div className="nf-dk-actions" data-foot={foot || undefined}>
      {title ? <p className="nf-dk-actions__title">{title}</p> : null}
      <div className="nf-dk-actions__row">
        {items.map((id, index) => (
          <DocButton key={id} to={id} variant={index === 0 ? "primary" : "secondary"} />
        ))}
      </div>
      {needsAccount && signedOut && firstGated ? <p className="nf-dk-actions__note">{firstGated.explain}</p> : null}
    </div>
  );
}
