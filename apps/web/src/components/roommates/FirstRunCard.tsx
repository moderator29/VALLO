"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { ButtonLink, Button } from "@/components/ui/Button";
import { Icon3D } from "@/components/ui/Icon3D";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { FEATURE_ART } from "@/lib/features/art";
import { feedback } from "@/lib/ui/feedback";

const KEY = "vallo.roommates.firstRun.v1";

/**
 * THE FIRST-RUN CARD ("Find your ideal roommate"): for somebody with no
 * roommate profile, one card that says what happens next in three steps and
 * one Continue into the profile flow. "Not now" puts it away on this device.
 */
export function FirstRunCard({ href }: { href: string }) {
  const copy = useScopedCopy("roommates");
  const w = copy.ui.firstRun;
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the device's choice is read after hydration, so server and first client render agree
      if (window.localStorage.getItem(KEY) === "dismissed") setHidden(true);
    } catch {
      /* No storage: the card simply shows. */
    }
  }, []);
  if (hidden) return null;
  const art = FEATURE_ART.roommatesOnboarding;
  return (
    <section className="nf-rmo" data-theme="dark" aria-labelledby="rmo-title" data-testid="roommates-first-run">
      <span className="nf-rmo__art" aria-hidden="true">
        <Image src={art.src} alt="" fill sizes="(max-width: 768px) 100vw, 560px" style={art.focus ? { objectPosition: art.focus } : undefined} />
      </span>
      <span className="nf-rmo__scrim" aria-hidden="true" />
      <span className="nf-rmo__object" aria-hidden="true">
        <Icon3D name="team" size={72} classic />
      </span>
      <div className="nf-rmo__words">
        <h2 id="rmo-title" className="nf-rmo__title">
          {w.title}
        </h2>
        <p className="nf-rmo__body">{w.body}</p>
        <ol className="nf-rmo__steps">
          {w.steps.map((s, i) => (
            <li key={s}>
              <span className="nf-rmo__n" aria-hidden="true">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <div className="nf-rmo__actions">
          <ButtonLink href={href} variant="primary" size="lg" arrow glow className="nf-rm-sheen" onClick={() => feedback("confirm")} data-testid="first-run-continue">
            {w.cta}
          </ButtonLink>
          <Button
            variant="quiet"
            size="lg"
            onClick={() => {
              feedback("select");
              try {
                window.localStorage.setItem(KEY, "dismissed");
              } catch {
                /* Not kept: it shows again next time. */
              }
              setHidden(true);
            }}
          >
            <UiIcon name="close" size={16} />
            {w.later}
          </Button>
        </div>
      </div>
    </section>
  );
}
