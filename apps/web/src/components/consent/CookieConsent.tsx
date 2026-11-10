"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { banner } from "@/lib/ui/toast";
import { readConsent } from "@/lib/consent/consent";
import { saveConsent } from "@/lib/consent/consent-save";
import "@/app/css/cookie-consent.css";

export type CookiesCopy = Dictionary["cookies"];

/**
 * THE COOKIE CHOICE, drawn lazily (`CookieGate`, `CookieSettingsButton`).
 *
 * Two surfaces over one choice. FIRST VISIT: a quiet bar at the foot of the
 * page, never a wall, with three buttons of equal weight and equal size:
 * Accept all, Only necessary, Choose. CHOOSE (and the Settings row, and the
 * footer's Cookie settings): a sheet with a focus trap, Escape and a close,
 * one switch per optional kind, and the same equal-weight buttons.
 *
 * No dark pattern: the buttons are the same variant, size and order of
 * attention; "Only necessary" is one tap; closing the sheet without a choice
 * means Only necessary (nothing optional is ever on by default); the switches
 * start OFF unless the person already said yes. The confirmation is a banner
 * from `lib/ui/toast.ts`.
 */
export default function CookieConsent({ copy, start, onDone }: { copy: CookiesCopy; start: "bar" | "sheet"; onDone(): void }) {
  const [view, setView] = useState<"bar" | "sheet">(start);
  const [saved] = useState(() => readConsent());
  const [preferences, setPreferences] = useState(saved?.preferences ?? false);
  const [analytics, setAnalytics] = useState(saved?.analytics ?? false);
  const titleId = useId();

  const finish = (choice: { preferences: boolean; analytics: boolean }) => {
    saveConsent(choice);
    banner.success(copy.saved);
    onDone();
  };

  /* Escape closes the bar as Only necessary would: the sheet has its own handling. */
  useEffect(() => {
    if (view !== "bar") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish({ preferences: false, analytics: false });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  if (view === "bar") {
    return (
      <section className="nf-cookie-bar" role="region" aria-labelledby={titleId}>
        <h2 id={titleId} className="nf-cookie-bar__title">
          {copy.banner.title}
        </h2>
        <p className="nf-cookie-bar__body">
          {copy.banner.body}{" "}
          <Link href="/cookies" className="nf-cookie-bar__link">
            {copy.banner.policy}
          </Link>
        </p>
        <div className="nf-cookie-bar__actions">
          <Button size="md" onClick={() => finish({ preferences: true, analytics: true })}>
            {copy.banner.acceptAll}
          </Button>
          <Button size="md" onClick={() => finish({ preferences: false, analytics: false })}>
            {copy.banner.onlyNecessary}
          </Button>
          <Button size="md" onClick={() => setView("sheet")}>
            {copy.banner.choose}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) finish({ preferences: saved?.preferences ?? false, analytics: saved?.analytics ?? false });
      }}
      title={copy.sheet.title}
      description={copy.sheet.intro}
      detents={[0.92]}
      closeLabel={copy.sheet.close}
      testId="cookie-sheet"
      footer={
        <div className="nf-cookie-sheet__actions">
          <Button size="md" onClick={() => finish({ preferences: true, analytics: true })}>
            {copy.sheet.acceptAll}
          </Button>
          <Button size="md" onClick={() => finish({ preferences: false, analytics: false })}>
            {copy.sheet.onlyNecessary}
          </Button>
          <Button size="md" onClick={() => finish({ preferences, analytics })}>
            {copy.sheet.save}
          </Button>
        </div>
      }
    >
      <div className="nf-cookie-sheet">
        <div className="nf-cookie-sheet__row">
          <div className="nf-cookie-sheet__text">
            <h3 className="nf-cookie-sheet__h">{copy.sheet.necessaryTitle}</h3>
            <p>{copy.sheet.necessaryBody}</p>
          </div>
          <span className="nf-cookie-sheet__always">{copy.sheet.necessaryAlways}</span>
        </div>
        <div className="nf-cookie-sheet__row">
          <div className="nf-cookie-sheet__text">
            <h3 className="nf-cookie-sheet__h">{copy.sheet.preferencesTitle}</h3>
            <p>{copy.sheet.preferencesBody}</p>
          </div>
          <Switch checked={preferences} onCheckedChange={setPreferences} aria-label={copy.sheet.preferencesTitle} />
        </div>
        <div className="nf-cookie-sheet__row">
          <div className="nf-cookie-sheet__text">
            <h3 className="nf-cookie-sheet__h">{copy.sheet.analyticsTitle}</h3>
            <p>{copy.sheet.analyticsBody}</p>
          </div>
          <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label={copy.sheet.analyticsTitle} />
        </div>
        <p className="nf-cookie-sheet__policy">
          <Link href="/cookies">{copy.sheet.policy}</Link>
        </p>
      </div>
    </Sheet>
  );
}
