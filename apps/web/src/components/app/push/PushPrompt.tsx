"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";

import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/design-system/brand/Logo";
import { looksNative } from "@/lib/native/platform";
import { banner } from "@/lib/ui/toast";
import "./push-prompt.css";

import { failureMessage, readLocalDevice } from "./device-state";
import { currentPermission, failureReference, onIosHomeScreenApp, readNativePermission } from "./enrol";
import { offerVerdict, readMemory, rememberDecline, writeMemory } from "./moments";
import { turnOnNotifications } from "./turn-on";

export type PushCopy = Dictionary["experienceSettings"]["notifications"]["push"];

/**
 * THE ONE NOTIFICATIONS SCREEN, AT THE END OF FIRST RUN.
 *
 * ===========================================================================
 * ONE SCREEN, ONE BUTTON, ONE QUIET NOT NOW (the founder, 13 November 2026).
 *
 * Turn on notifications asks the system (the native prompt in the shell, the
 * browser's on the web) and, when it is granted, registers this device and
 * switches push on for every kind in the member's settings in one write
 * (`turn-on.ts`). Nothing else anywhere has to be turned on.
 *
 * Not now, or a refusal of the system prompt, goes on into the app, and this
 * screen never comes back on this device (`moments.ts`). The way back is the
 * Notifications switch on Settings.
 *
 * MOUNTED IN FIRST RUN ONLY. A gate test (`push-mounts.test.ts`) fails the
 * suite if it is mounted anywhere else; the in-flow asks it used to power are
 * gone.
 *
 * ===========================================================================
 * THE SYSTEM PROMPT IS TOUCHED ONLY FROM THE TURN ON HANDLER, in the same
 * tick as the click: `turnOnNotifications` calls `enrol` on its first line.
 */

export type PushPromptProps = {
  copy: PushCopy;
  /**
   * Told what happened, so first run can move on.
   *
   * "enrolled" means ONLY that `/api/push/register` answered ok for this
   * device. "declined" is Not now or a refusal of the system prompt.
   * "unavailable" is a device where the screen was not shown at all: no push
   * here, already refused, already answered, or already registered.
   */
  onSettled?: (outcome: "enrolled" | "declined" | "unavailable", deviceRef?: string) => void;
};

export function PushPrompt({ copy, onSettled }: PushPromptProps) {
  const router = useRouter();
  /* `null` is "not decided yet", which is distinct from "decided not to
     show". */
  const [shown, setShown] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    /* DECIDED AFTER MOUNT, ON THE CLIENT. The permission and the memory are
       per device and neither exists on the server. In the shell the real
       permission is read first (`checkPermissions` never prompts), so a
       phone that already refused Vallo is not shown a button that cannot
       work. */
    let cancelled = false;
    const decide = async () => {
      if (looksNative()) await readNativePermission();
      if (cancelled) return;
      const verdict = offerVerdict({
        permission: currentPermission(),
        registered: readLocalDevice() !== null,
        memory: readMemory(),
      });
      if (verdict.show) setShown(true);
      else {
        setShown(false);
        onSettled?.("unavailable");
      }
    };
    void decide();
    return () => {
      cancelled = true;
    };
    /* `onSettled` is deliberately not a dependency: a caller passing an
       inline function would otherwise re-run this on every render. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function accept(): void {
    setBusy(true);
    /* NOT AWAITED BEFORE THE CALL: `enrol` asks for the permission first. */
    void turnOnNotifications().then((result) => {
      setBusy(false);
      if (result.kind === "on") {
        setShown(false);
        if (result.topicsSaved) banner.success(copy.done.on, { "data-testid": "banner-push-on" });
        else banner.error(copy.done.topicsNotSaved, { "data-testid": "push-problem" });
        onSettled?.("enrolled", result.deviceRef);
        return;
      }
      if (result.kind === "denied" || result.kind === "unsupported") {
        /* The system said no. On into the app; Settings says how to undo it. */
        setShown(false);
        onSettled?.("declined");
        return;
      }
      /* The system said yes and the registration failed. One plain sentence,
         and the screen stays with Try again (a tap on the banner is a fresh
         user activation) and Not now still beside it. */
      const reference = failureReference(result.outcome);
      const text =
        failureMessage(result.outcome.reason, {
          iosHomeScreenApp: onIosHomeScreenApp(),
          where: "prompt",
          reference,
        }) + (reference ? ` (Reference: ${reference}.)` : "");
      banner.error(text, {
        "data-testid": "push-problem",
        action:
          result.outcome.reason === "signed_out"
            ? { label: "Open sign in", run: () => router.push("/sign-in?next=%2Fsettings%2Fnotifications") }
            : { label: "Try again", run: accept },
      });
    });
  }

  function decline(): void {
    writeMemory(rememberDecline(readMemory(), Date.now()));
    setShown(false);
    onSettled?.("declined");
  }

  if (!shown) return null;

  return (
    /* THE FOUNDER'S REFERENCE 1 ("Never miss a moment",
       notification-stack-onboarding.jpg, 7 October): notifications stacked
       in depth, the front one in our mark, then the title, one sentence, and
       one wide capsule with a quiet Not now under it. The stack is a picture
       of what will arrive, so it is hidden from a screen reader. */
    <section className="nf-push-ask" aria-live="polite" data-push-prompt="joined">
      <div className="nf-push-ask__stack" aria-hidden="true">
        <span className="nf-push-ask__card nf-push-ask__card--3" />
        <span className="nf-push-ask__card nf-push-ask__card--2" />
        <span className="nf-push-ask__card nf-push-ask__card--1">
          <span className="nf-push-ask__mark">
            <LogoMark size={22} />
          </span>
          <span className="nf-push-ask__text">
            <span className="nf-push-ask__app">Vallo</span>
            <span className="nf-push-ask__line">{copy.ask.offer}</span>
          </span>
        </span>
      </div>
      <h2 className="nf-push-ask__title">{copy.ask.title}</h2>
      <p className="nf-push-ask__body">
        {copy.ask.body} {copy.ask.later}
      </p>
      <div className="nf-push-ask__actions">
        <Button variant="primary" full onClick={accept} disabled={busy} data-testid="push-ask-turn-on">
          {busy ? copy.ask.busy : copy.ask.turnOn}
        </Button>
        <Button variant="quiet" onClick={decline} disabled={busy} data-testid="push-ask-not-now">
          {copy.ask.notNow}
        </Button>
      </div>
    </section>
  );
}

export default PushPrompt;
