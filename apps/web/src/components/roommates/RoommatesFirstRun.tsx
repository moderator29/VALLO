"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { feedback } from "@/lib/ui/feedback";

import { SkylineArt } from "./RoommatesArt";
import "./roommates-welcome.css";

const KEY = "vallo.roommates.welcome.v1";

/**
 * THE FIRST-RUN WELCOME: full screen, once per person, in the same language
 * as the banner. There is no server seen-state yet (the feature first-run
 * store is a stub), so the device remembers it; storage that is blocked just
 * shows it again, never traps. Escape and Not now both put it away.
 */
export function RoommatesFirstRun({ startHref }: { startHref: string }) {
  const copy = useScopedCopy("roommates");
  const w = copy.welcome.firstRun;
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const go = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) !== "seen") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the device's choice is read after hydration, so server and first client render agree
        setOpen(true);
      }
    } catch {
      /* No storage: the welcome is simply not shown. */
    }
  }, []);

  const close = () => {
    try {
      window.localStorage.setItem(KEY, "seen");
    } catch {
      /* Not remembered; it may show again. */
    }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    go.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  const last = i === w.steps.length - 1;
  const step = w.steps[i]!;
  return (
    <div className="nf-rmfr" data-theme="dark" role="dialog" aria-modal="true" aria-labelledby="rmfr-title" data-testid="roommates-welcome">
      <div className="nf-rmfr__art" aria-hidden="true">
        <SkylineArt />
      </div>
      <div className="nf-rmfr__top">
        <span className="nf-rmfr__label">{w.label}</span>
        <button type="button" className="nf-rmfr__skip" onClick={close}>
          {w.skip}
        </button>
      </div>
      <div className="nf-rmfr__card" key={i}>
        <span className="nf-rmfr__n" aria-hidden="true">
          {i + 1}
        </span>
        <h2 id="rmfr-title" className="nf-rmfr__title">
          {step.title}
        </h2>
        <p className="nf-rmfr__body">{step.body}</p>
      </div>
      <div className="nf-rmfr__foot">
        <ol className="nf-rmfr__dots" aria-hidden="true">
          {w.steps.map((s, n) => (
            <li key={s.title} className="nf-rmfr__dot" data-on={n === i || undefined} />
          ))}
        </ol>
        {last ? (
          <Button
            ref={go}
            variant="primary"
            size="lg"
            full
            leadingIcon="search"
            onClick={() => {
              feedback("select");
              close();
              router.push(startHref);
            }}
          >
            {copy.welcome.findRoommates}
          </Button>
        ) : (
          <Button
            ref={go}
            variant="primary"
            size="lg"
            full
            onClick={() => {
              feedback("select");
              setI(i + 1);
            }}
          >
            {w.next}
            <UiIcon name="chevron-right" size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
