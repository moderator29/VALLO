"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Composer } from "../feed/Composer";
import { COMPOSE_POST_EVENT } from "../feed/ComposeButton";
import { useSignInHref } from "@/lib/auth/use-sign-in-href";

/**
 * THE POST COMPOSER, MOUNTED ON THE FEED AND IN A PLACE.
 *
 * There is no floating "+" any more (29 October 2026, the founder: "that +
 * remove it like remove it in any area in my app"). The bloom that threw Post,
 * Story and Review out of a glass circle is gone; what it opened stays, each
 * from its own door:
 *
 *   Post    this composer: the header's Create sheet sends "Post" to
 *           `/around?compose=1` (`initialCompose`), and the feed's own compose
 *           control fires `COMPOSE_POST_EVENT`. One composer, one draft.
 *   Story   `/stories/new`, from the same Create sheet.
 *   Review  a finished stay's review form, from Bookings, where the stays are.
 *
 * The name is kept so its callers did not change.
 */

export type BloomArea = { id: string; name: string; city: string };

export type ReviewableStay = {
  bookingId: string;
  title: string;
  dateRange: string;
};

export function CreateBloom({
  signedIn,
  areas,
  currentAreaId,
  initialCompose = false,
  you = null,
}: {
  signedIn: boolean;
  areas: BloomArea[];
  /** Preselected when opened from inside a place. */
  currentAreaId?: string;
  /** Kept for the callers; reviews open from Bookings now. */
  reviewable: ReviewableStay[];
  /** Kept for the preview harness; there is no fan to open. */
  initialOpen?: boolean;
  /**
   * Open the composer on arrival: `/around?compose=1`, where the header's
   * Create sheet sends "Post". Signed out, nothing opens: the composer would
   * only refuse.
   */
  initialCompose?: boolean;
  /** Who is writing, for the composer's top line. */
  you?: { label: string; avatarUrl: string } | null;
}) {
  const signInHref = useSignInHref();
  const router = useRouter();
  const [composing, setComposing] = useState(initialCompose && signedIn);
  /* A soft navigation to `?compose=1` on the page that is already open keeps
     this component mounted, so the prop turning on is answered here (React's
     adjust-state-on-prop-change recipe, not an effect). */
  const [lastCompose, setLastCompose] = useState(initialCompose);
  if (initialCompose !== lastCompose) {
    setLastCompose(initialCompose);
    if (initialCompose && signedIn) setComposing(true);
  }
  const [picking, setPicking] = useState(false);
  const [areaId, setAreaId] = useState<string | undefined>(currentAreaId);
  /* The composer's words, held here rather than in the composer, because the
     composer unmounts with its sheet and a sheet closes on a drag, a flick or
     Back. A post half-written and closed by accident comes back; sending one
     clears it. */
  const [draft, setDraft] = useState("");
  /* The composer's field, so the sheet's first focus is the words rather
     than its Close control. */
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const closeComposer = useCallback(() => {
    setComposing(false);
    /* Take `compose=1` back off the address, so Back does not reopen the
       composer and the Create sheet's Post can open it again from here. */
    const url = new URL(window.location.href);
    if (url.searchParams.has("compose")) {
      url.searchParams.delete("compose");
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    }
  }, [router]);

  /* The feed's own compose control (`ComposeButton`) opens the composer here
     directly, so the page keeps one composer and one draft whichever door was
     used. */
  useEffect(() => {
    const onCompose = () => {
      if (!signedIn) {
        router.push(signInHref);
        return;
      }
      setAreaId(currentAreaId);
      setPicking(false);
      setComposing(true);
    };
    window.addEventListener(COMPOSE_POST_EVENT, onCompose);
    return () => window.removeEventListener(COMPOSE_POST_EVENT, onCompose);
  }, [signedIn, router, signInHref, currentAreaId]);

  const chosen = areas.find((area) => area.id === areaId) ?? null;

  return (
    <>
      <Sheet
        open={composing}
        onOpenChange={(next) => {
          if (!next) closeComposer();
        }}
        title="Post"
        hideTitle
        initialFocus={fieldRef}
        fullPage
      >
            {picking ? (
              <>
              <div className="nf-compose-page__bar">
                <button type="button" className="nf-compose-page__cancel" onClick={() => setPicking(false)}>
                  Back
                </button>
              </div>
              <p className="mb-md text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">
                Who should see it?
              </p>
              <ul className="flex flex-col gap-xs">
                {/* Everybody, first and always present: the destination that
                    needs no membership, so it is the one a person can always
                    get back to. */}
                <li>
                  <button
                    type="button"
                    className="nf-fab__place"
                    onClick={() => {
                      setAreaId(undefined);
                      setPicking(false);
                    }}
                    data-testid="post-to-everyone"
                  >
                    <span className="nf-fab__place-name">Everyone on Vallo</span>
                    <span className="nf-fab__place-city">Seen in every feed</span>
                  </button>
                </li>
                {areas.map((area) => (
                  <li key={area.id}>
                    <button
                      type="button"
                      className="nf-fab__place"
                      onClick={() => {
                        setAreaId(area.id);
                        setPicking(false);
                      }}
                    >
                      <span className="nf-fab__place-name">Around {area.name}</span>
                      <span className="nf-fab__place-city">{area.city}</span>
                    </button>
                  </li>
                ))}
                {areas.length === 0 ? (
                  <li>
                    <Link href="/around/settings" className="nf-fab__place" onClick={closeComposer}>
                      <span className="nf-fab__place-name">Find a place to join</span>
                      <span className="nf-fab__place-city">Then you can post there too</span>
                    </Link>
                  </li>
                ) : null}
              </ul>
              </>
            ) : (
              <>
                {/* THE FULL-PAGE COMPOSER (the feed set): Cancel and Post at
                    the top, the audience control under them, a large field,
                    the tool row. The audience is the place picker this sheet
                    always had, now one tap on the line that says who will
                    see the post. */}
                <Composer
                  page
                  you={you}
                  audience={
                    <button
                      type="button"
                      className="nf-compose-audience"
                      onClick={() => setPicking(true)}
                      data-testid="composer-destination"
                    >
                      <UiIcon name={chosen ? "location" : "compass"} size={14} />
                      {chosen ? `Around ${chosen.name}` : "Everyone on Vallo"}
                      <UiIcon name="chevron-down" size={12} />
                    </button>
                  }
                  areaId={chosen?.id}
                  areaName={chosen?.name}
                  signedIn={signedIn}
                  fieldRef={fieldRef}
                  draft={draft}
                  onDraftChange={setDraft}
                  autoFocus
                  onDone={() => {
                    closeComposer();
                    router.refresh();
                  }}
                />
              </>
            )}
      </Sheet>

    </>
  );
}
