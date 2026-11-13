"use client";

import "./badges.css";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandIcon } from "@/design-system/icons/BrandIcon";
import { BadgeMedal } from "./BadgeMedal";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { banner } from "@/lib/ui/toast";
import { motionQuiet } from "@/lib/motion/gate";
import { copyText, shareOrCopy } from "@/lib/ui/clipboard";
import { feedback } from "@/lib/ui/feedback";
import { badgeObject } from "./badge-art";
import type { ProfileBadge } from "./badge-model";

/** The words the moment says, from the server page (`experienceSocial.profile`). */
export type BadgeMomentCopy = {
  overline: string;
  share: string;
  back: string;
  /** "{badge}" is replaced with the badge's name. */
  shareText: string;
  /** Said only once the clipboard has actually taken the words. */
  copied: string;
  /** Said when neither the share sheet nor the clipboard took them. */
  copyFailed: string;
  replayHint: string;
  /** "View on my profile": the way from the moment to the badge on the page. */
  viewProfile: string;
};

/**
 * THE EARNED MOMENT (motion 22, reference 7043, directive D17).
 *
 * A quiet sunburst behind a matte medal, the medal scaling in over 620ms, one
 * pop (1.0 to 1.04 to 1.0 in 180ms) with one heavy haptic, then the
 * achievement named, one line saying what it means, and Share and Back rising
 * in. Tapping the medal plays it once more, and only once: a celebration that
 * can be farmed by tapping is a slot machine.
 *
 * IT IS FOR AN EARNED BADGE ONLY. The caller (`BadgeEarnedHost`, `BadgeRow`)
 * decides that from `badge.earned`, and this refuses anyway: a badge somebody
 * at Vallo gave by hand is never celebrated here, because the celebration says
 * "you did this" and the database says somebody else decided.
 *
 * The line under the title is the badge's own description from the database.
 * Nothing on this screen is written by this file: no count, no streak, no
 * "level", no comparison. Share sends the person's own page, so the recipient
 * sees the real badge on a real profile rather than a picture of one.
 *
 * It is the platform `Sheet` in its full-page form, so Back, Escape, the focus
 * trap and return, drag to close and the scroll lock are all the sheet's.
 */
export function BadgeMoment({
  badge,
  copy,
  shareUrl,
  profileHref,
  onClose,
}: {
  badge: ProfileBadge;
  copy: BadgeMomentCopy;
  /** The person's own public page, or undefined when they have none. */
  shareUrl?: string;
  /**
   * Where the badge lives on the person's own page (`/profile#badges`). When
   * given, the moment offers "View on my profile" as its main action: it closes
   * and takes them there, scrolling to the row when they are already on the page.
   */
  profileHref?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  /* Bumping the key restarts every beat. Allowed once. */
  const [play, setPlay] = useState(0);
  const [replayed, setReplayed] = useState(false);
  const object = badgeObject(badge.objectName);

  /* The heavy haptic lands with the pop: after the 620ms scale-in. Quiet
     motion levels get no timer and no pop, so the page is simply settled. */
  useEffect(() => {
    if (!badge.earned || motionQuiet()) return;
    const timer = window.setTimeout(() => feedback("success"), 620);
    return () => window.clearTimeout(timer);
  }, [badge.earned, play]);

  const replay = () => {
    if (replayed) return;
    setReplayed(true);
    setPlay((n) => n + 1);
  };

  /*
   * The platform's one share path (`lib/ui/clipboard.ts`): the phone's own
   * sheet, then the clipboard. "Copied" is said only AFTER the clipboard has
   * taken it, and only if it did; a cancelled sheet says nothing (D49.3: this
   * used to say "Copied" before, and regardless of, the clipboard's answer).
   */
  const share = async () => {
    const text = copy.shareText.replace("{badge}", badge.name);
    const outcome = shareUrl
      ? await shareOrCopy({ url: shareUrl, title: badge.name, text })
      : (await copyText(text))
        ? "copied"
        : "failed";
    if (outcome === "copied") {
      feedback("select");
      banner.success(copy.copied);
    } else if (outcome === "failed") {
      banner.error(copy.copyFailed);
    }
  };

  const viewProfile = () => {
    if (!profileHref) return;
    onClose();
    const [path, hash] = profileHref.split("#");
    if (pathname === path) {
      /* Already on the page: let the sheet leave, then bring the row into view. */
      window.setTimeout(() => {
        document.getElementById(hash || "badges")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 160);
    } else {
      router.push(profileHref);
    }
  };

  if (!badge.earned) return null;

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={badge.name}
      hideTitle
      fullPage
      testId="badge-moment"
    >
      <div className="nf-medal-moment" key={play}>
        <div className="nf-medal-moment__stage">
          <div className="nf-medal-moment__burst" aria-hidden="true" />
          <button
            type="button"
            className="nf-medal-moment__medal"
            onClick={replay}
            aria-label={replayed ? badge.name : `${badge.name}. ${copy.replayHint}`}
          >
            <BadgeMedal className="nf-medal-moment__art" />
            <span className="nf-medal-moment__object" aria-hidden="true">
              <BrandIcon name={object} fill drawn={96} />
            </span>
          </button>
        </div>
        <p className="nf-medal-moment__overline">{copy.overline}</p>
        <h2 className="nf-medal-moment__title">{badge.name}</h2>
        <p className="nf-medal-moment__line">{badge.description}</p>
        <p className="nf-medal-moment__date">{badge.grantedLabel}</p>
        <div className="nf-medal-moment__actions">
          {profileHref ? (
            <Button variant="primary" size="lg" full onClick={viewProfile} data-testid="badge-view-profile">
              {copy.viewProfile}
            </Button>
          ) : null}
          <Button
            variant={profileHref ? "secondary" : "primary"}
            size="lg"
            full
            leadingIcon="share"
            onClick={() => void share()}
          >
            {copy.share}
          </Button>
          <Button variant="quiet" size="lg" full onClick={onClose}>
            {copy.back}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
