"use client";

import { useEffect, useState } from "react";
import { BadgeMoment, type BadgeMomentCopy } from "./BadgeMoment";
import { badgeToCelebrate, quietlySeen, type ProfileBadge } from "./badge-model";
import { readAdopting } from "../scoped-storage";

/*
 * SCOPED TO THE ACCOUNT (auditor A2). A phone shared between two people has one
 * localStorage, so a single key meant account B was never shown a moment account
 * A had already seen, and A's list leaked into B's. The key carries the viewer's
 * id, passed down from the server, so each account keeps its own list.
 *
 * THE OLD UNSCOPED LIST IS ADOPTED, ONCE (auditor A7): the first read of this
 * account's empty list takes over what `nf_badges_shown` held and deletes it,
 * so upgrading does not celebrate a recent badge a second time. The host is
 * mounted only for the signed-in owner, so every read here may adopt.
 */
const KEY = "nf_badges_shown";
const keyFor = (viewerId: string) => `${KEY}:${viewerId}`;

function readSeen(viewerId: string): string[] {
  try {
    const raw = readAdopting(window.localStorage, keyFor(viewerId), KEY, true);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(viewerId: string, codes: string[]): void {
  try {
    window.localStorage.setItem(keyFor(viewerId), JSON.stringify(codes.slice(-64)));
  } catch {
    /* Storage can be blocked. The worst case is the moment shows again. */
  }
}

/**
 * THE MOMENT, AT THE TIME IT IS EARNED (motion 22).
 *
 * Mounted on the owner's own profile only. It shows the earned moment once for
 * the newest earned badge this device has not yet shown, and only while the
 * badge is recent (`badgeToCelebrate`): somebody whose badge was awarded a
 * year ago is not congratulated for it today, and an older earned badge is
 * simply remembered so it never plays by accident. A hand-given badge is never
 * shown here; the model refuses it.
 *
 * "Shown" is kept on this device (a per-viewer convenience): the server has no
 * notion of a badge having been seen, and inventing one is Session 2's. The
 * worst case of a cleared store is that a recent badge plays once more, which
 * is a true celebration of a true thing.
 *
 * It waits a beat after the page has painted so it arrives over a settled
 * screen rather than competing with the hero's own entrance.
 */
export function BadgeEarnedHost({
  badges,
  copy,
  shareUrl,
  viewerId,
}: {
  /** The signed-in owner's id, so "shown" is kept per account on a shared phone. */
  viewerId: string;
  badges: readonly ProfileBadge[];
  copy: BadgeMomentCopy;
  shareUrl?: string;
}) {
  const [current, setCurrent] = useState<ProfileBadge | null>(null);

  useEffect(() => {
    const now = Date.now();
    const seen = readSeen(viewerId);
    const old = quietlySeen(badges, seen, now);
    if (old.length > 0) writeSeen(viewerId, [...seen, ...old]);
    const next = badgeToCelebrate(badges, seen, now);
    if (!next) return;
    const timer = window.setTimeout(() => setCurrent(next), 600);
    return () => window.clearTimeout(timer);
  }, [badges, viewerId]);

  if (!current) return null;
  return (
    <BadgeMoment
      badge={current}
      copy={copy}
      shareUrl={shareUrl}
      profileHref="/profile#badges"
      onClose={() => {
        writeSeen(viewerId, [...readSeen(viewerId), current.code]);
        setCurrent(null);
      }}
    />
  );
}
