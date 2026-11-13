import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { versioned } from "@/lib/theme/brand-assets";
/*
 * The partial is imported here rather than from globals.css because the partial
 * is not in its ordered import list yet. When `css/system.css` is added to that
 * list, delete this line and nothing else changes: every rule in it is
 * inside `@layer components` and every class name is new, so it has no
 * position in the cascade to lose.
 */
import "@/app/css/system.css";

/**
 * THE BRAND MOMENT'S ANATOMY, WITHOUT AN OPINION ABOUT IMAGES (`SystemMoment`
 * explains the moment itself). The plate and the lockup are passed in, so the
 * optimised version (`SystemMoment`, `next/image`) and the plain one below
 * share one stage, card and podium, and the plain one never imports
 * `next/image`. That matters because `app/error.tsx`, a client component in
 * every route's bundle, draws the plain one: its imports are first-load
 * JavaScript everywhere.
 *
 * Server safe, no hooks.
 */
export function SystemFrame({
  home,
  homeLabel,
  onHome,
  inset,
  plate,
  brand,
  children,
  aside,
}: {
  home: string;
  homeLabel: string;
  /** A failure screen's own handling of the lockup's click (`lib/offline/escape.ts`): a client caller only. */
  onHome?: MouseEventHandler<HTMLAnchorElement>;
  inset: boolean;
  plate: ReactNode;
  brand: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const stageClass = inset ? "nf-system nf-system--inset" : "nf-system";
  const Stage: "main" | "div" = inset ? "div" : "main";
  return (
    /* A night stage in both themes, like the auth screen: the podium and the
       aurora are night artwork (light mode reintroduced 25 September 2026). */
    <Stage id={inset ? undefined : "main"} className={stageClass} data-theme="dark">
      <div className="nf-system__plate" aria-hidden="true">
        {plate}
      </div>
      <div className="nf-aurora" aria-hidden="true" />

      <div className="nf-system__stage">
        <Link href={home} aria-label={homeLabel} className="nf-system__brand nf-tap" onClick={onHome}>
          {brand}
        </Link>

        <div className="nf-panel nf-panel--glass nf-system__card">{children}</div>
        <div className="nf-system__podium" aria-hidden="true" />

        {aside ? <p className="nf-system__aside">{aside}</p> : null}
      </div>
    </Stage>
  );
}

/**
 * The moment with PLAIN images: fixed brand assets at their own sizes, each
 * small (the plate 7 KB, the tile 7 KB, the wordmark 3 KB: the small plate and the vector wordmark, 10 November 2026, so the install of the offline shell stays light on every route), with explicit
 * dimensions so nothing shifts. These are the files the service worker
 * precaches or runtime-caches, which is why the offline variant always used
 * them, and they need no optimiser. The root error boundary uses this one
 * (see above), and `SystemMoment` uses it for `offline`.
 */
export function PlainSystemMoment({
  home = "/",
  homeLabel = "Vallo home",
  onHome,
  inset = false,
  children,
  aside,
}: {
  home?: string;
  homeLabel?: string;
  onHome?: MouseEventHandler<HTMLAnchorElement>;
  inset?: boolean;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <SystemFrame
      home={home}
      homeLabel={homeLabel}
      {...(onHome ? { onHome } : {})}
      inset={inset}
      aside={aside}
      plate={
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/photos/bg-blue-wave-640.jpg" alt="" width={640} height={360} decoding="async" />
      }
      brand={
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            /* THE VERSION STAMP IS PART OF THE ADDRESS (`lib/theme/brand-assets.ts`,
               the brand refresh of 10 November 2026): the icon was redrawn at the
               same path, so the bare address serves whatever a phone already had,
               which is the retired mark. It is also the address the service
               worker does NOT keep: the shell precaches the stamped one, so with
               no network the bare one was a hole where the lockup should be while
               the bytes sat on the phone under the other name. */
            src={versioned("/pwa/icon-192.png")}
            alt=""
            aria-hidden="true"
            width={192}
            height={192}
            className={inset ? "nf-system__icon nf-system__icon--sm" : "nf-system__icon"}
          />
          {!inset && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/brand/vallo-wordmark.svg"
              alt="Vallo"
              width={1664}
              height={352}
              decoding="async"
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
