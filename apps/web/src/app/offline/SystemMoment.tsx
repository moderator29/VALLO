import Image from "next/image";
import type { MouseEventHandler, ReactNode } from "react";
import { PlainSystemMoment, SystemFrame } from "./SystemFrame";

/**
 * The brand moment.
 *
 * The three moments the product has nothing to show but itself, a crash, a
 * missing page and a dead network, share one anatomy taken from the sign-in
 * render (`docs/design/references/55A56F21`): the lockup over the aurora
 * plate, one glass card with a lit rim standing on a podium, the podium's
 * reflection in the floor. This component is that anatomy; each page puts
 * its own sentence and its own way out inside the card.
 *
 * It lives under `app/offline` because that route is the purest instance
 * (no network, no data, nothing but the moment) and because it is the one
 * folder in this scope; it belongs in `components/app/` and is filed for
 * promotion in the ledger.
 *
 * Server safe, no hooks, so a server page (not found, offline) and a client
 * boundary (the two error files) render the same object.
 *
 * `offline` swaps `next/image` for plain images: the optimiser mints hashed
 * `/_next/image` URLs that the offline cache has no way to hold, whereas the
 * service worker precaches `/pwa/icon-192.png` and runtime-caches `/brand/`
 * on an allowlist, so on a dead network the tile is guaranteed and the plate
 * is there whenever a previous visit fetched it. When it is not, the CSS
 * aurora under it is the designed ground and there is no hole.
 *
 * `inset` is the in-app boundary, where the header above already carries
 * the lockup: the moment fills the content area between header and dock,
 * and the brand is the tile alone rather than a second wordmark under the
 * one in the chrome.
 *
 * THE ANATOMY IS `SystemFrame`, AND THE ROOT ERROR BOUNDARY USES THE PLAIN
 * IMAGES (speed, 6 October 2026). `app/error.tsx` is a client component in
 * the bundle of every route, so whatever it imports is first-load JavaScript
 * everywhere; through this file that was `next/image`'s client runtime
 * (about 15 KB raw) for a screen that only exists after a crash. The boundary
 * draws `PlainSystemMoment` instead, the same anatomy with the plain images
 * the offline variant already uses, and this file (with the optimiser) stays
 * for the server-rendered moments, where it costs the browser nothing.
 */
export function SystemMoment({
  home = "/",
  homeLabel = "Vallo home",
  onHome,
  inset = false,
  offline = false,
  children,
  aside,
}: {
  /** Where the lockup links. Root pages resolve the reader's real home. */
  home?: string;
  /** The lockup's name for a screen reader. The not-found, offline and root
      error screens are written in English and keep the English name; the
      in-app error screen speaks the reader's language and passes theirs. */
  homeLabel?: string;
  /** A failure screen's handling of the lockup's click (`lib/offline/escape.ts`). */
  onHome?: MouseEventHandler<HTMLAnchorElement>;
  inset?: boolean;
  offline?: boolean;
  children: ReactNode;
  /** The quiet line beneath the podium. */
  aside?: ReactNode;
}) {
  if (offline) {
    return (
      <PlainSystemMoment home={home} homeLabel={homeLabel} {...(onHome ? { onHome } : {})} inset={inset} aside={aside}>
        {children}
      </PlainSystemMoment>
    );
  }
  return (
    <SystemFrame
      home={home}
      homeLabel={homeLabel}
      {...(onHome ? { onHome } : {})}
      inset={inset}
      aside={aside}
      plate={<Image src="/brand/photos/bg-blue-wave.jpg" alt="" fill sizes="100vw" priority />}
      brand={
        <>
          <Image
            src="/brand/vallo-icon.png"
            alt=""
            width={104}
            height={104}
            priority
            className={inset ? "nf-system__icon nf-system__icon--sm" : "nf-system__icon"}
          />
          {!inset && (
            <Image
              src="/brand/vallo-wordmark.svg"
              alt="Vallo"
              width={176}
              height={37}
              priority
              className="nf-system__wordmark"
            />
          )}
        </>
      }
    >
      {children}
    </SystemFrame>
  );
}
