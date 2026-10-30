"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/design-system/brand/Logo";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import "./push-prompt.css";

import { failureMessage } from "./device-state";
import { currentPermission, enrol, failureReference, onIosHomeScreenApp } from "./enrol";
import {
  offerVerdict,
  readMemory,
  rememberDecline,
  rememberSystemAsked,
  writeMemory,
  type PushMoment,
} from "./moments";

/**
 * THE SCREEN THAT COMES BEFORE THE SYSTEM PROMPT.
 *
 * ===========================================================================
 * WHY THERE IS A SCREEN AT ALL, WHEN THE SYSTEM ALREADY HAS ONE.
 *
 * Because the system's can only be shown once. On iOS a refusal is effectively
 * permanent; on the web a denied permission cannot be re-prompted from the
 * page. So the expensive question is asked only after a cheap one has already
 * been answered yes. A No here costs nothing and can be asked again in a
 * month. A No there costs the channel for the life of the install.
 *
 * ===========================================================================
 * THREE THINGS THIS COMPONENT WILL NOT DO.
 *
 * IT WILL NOT APPEAR ON A COLD START. It takes a `moment`, and the four
 * moments in `moments.ts` are all immediately after something has gone right
 * for the person. A caller that mounts this on a home screen has misused it,
 * and the moments are a closed union so that misuse has to be deliberate.
 *
 * IT WILL NOT ASK TWICE IN A MONTH, OR THREE TIMES EVER. `offerVerdict`
 * decides, this only renders.
 *
 * IT WILL NOT TOUCH THE SYSTEM PROMPT EXCEPT FROM THE YES HANDLER, in the
 * same tick as the click. `Notification.requestPermission()` is gated on user
 * activation and an await before it can lose the gesture, so `enrol` is
 * called directly from `onClick` with nothing awaited first.
 */

export type PushPromptProps = {
  /** Why now. See `moments.ts`; there are exactly four legitimate answers. */
  moment: PushMoment;
  /**
   * Told what happened, so a caller can say thank you in its own words.
   *
   * "enrolled" means ONLY that `/api/push/register` answered ok for this
   * device, and it always carries the `device_ref` the server named. A
   * permission the browser already holds is "allowed", never "enrolled": that
   * confusion is how a control came to read on over zero rows (see
   * `device-state.ts`).
   */
  onSettled?: (
    outcome: "enrolled" | "allowed" | "declined" | "unavailable",
    deviceRef?: string,
  ) => void;
};

export function PushPrompt({ moment, onSettled }: PushPromptProps) {
  /* One piece of state rather than three, so deciding to show the prompt is
     a single transition and cannot half apply. `null` means "not decided
     yet", which is distinct from "decided not to show". */
  const [shown, setShown] = useState<{ offer: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ text: string; signIn: boolean } | null>(null);

  useEffect(() => {
    /* DECIDED AFTER MOUNT, ON THE CLIENT, AND THERE IS NO OTHER OPTION.
       Both inputs are per device and neither exists on the server: the
       permission state is a browser or operating system fact, and the memory
       is in `localStorage`. Computing this during render would make the
       server produce "unsupported" and the client produce something else,
       which is a hydration mismatch. The lint rule's suggested alternatives
       are for state that could be derived during render; this cannot be. */
    const verdict = offerVerdict({
      moment,
      permission: currentPermission(),
      memory: readMemory(),
      now: Date.now(),
    });
    if (verdict.show) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      setShown({ offer: verdict.offer });
    } else {
      onSettled?.(verdict.because === "granted" ? "allowed" : "unavailable");
    }
    /* `onSettled` is deliberately not a dependency: a caller passing an
       inline function would otherwise re-run this on every render and could
       re-show a prompt that was just dismissed. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment]);

  const accept = useCallback(() => {
    setBusy(true);
    setFailed(null);
    /* NOT AWAITED BEFORE THE CALL. `enrol` requests the permission on its
       first line precisely so the user activation from this click is still
       live when it does. */
    void enrol().then((outcome) => {
      writeMemory(rememberSystemAsked(readMemory()));
      setBusy(false);
      if (outcome.ok) {
        setShown(null);
        onSettled?.("enrolled", outcome.deviceRef);
        return;
      }
      if (outcome.reason === "permission_denied") {
        /* The system prompt is now spent. Saying so plainly is better than
           a cheerful dismissal, because the only way back is their own
           settings and they should know that now rather than wonder later
           why nothing arrives. */
        setShown(null);
        onSettled?.("declined");
        return;
      }
      /* Every failure says one plain sentence and the prompt stays, so the
         person is never left with a closed prompt and a silent screen. */
      const reference = failureReference(outcome);
      setFailed({
        text:
          failureMessage(outcome.reason, {
            iosHomeScreenApp: onIosHomeScreenApp(),
            where: "prompt",
            reference,
          }) + (reference ? ` (Reference: ${reference}.)` : ""),
        signIn: outcome.reason === "signed_out",
      });
    });
  }, [onSettled]);

  const decline = useCallback(() => {
    writeMemory(rememberDecline(readMemory(), Date.now()));
    setShown(null);
    onSettled?.("declined");
  }, [onSettled]);

  if (!shown) return null;

  return (
    /* THE FOUNDER'S REFERENCE 1 ("Never miss a moment",
       notification-stack-onboarding.jpg, 7 October): notifications stacked
       in depth, the front one in our mark carrying the very line this moment
       offers, then the title, one muted line, the promises as plated rows,
       and one wide capsule. The stack is a picture of what will arrive, so it
       is hidden from a screen reader; the words under it say it all. */
    <section className="nf-push-ask" aria-live="polite" data-push-prompt={moment}>
      <div className="nf-push-ask__stack" aria-hidden="true">
        <span className="nf-push-ask__card nf-push-ask__card--3" />
        <span className="nf-push-ask__card nf-push-ask__card--2" />
        <span className="nf-push-ask__card nf-push-ask__card--1">
          <span className="nf-push-ask__mark">
            <LogoMark size={22} />
          </span>
          <span className="nf-push-ask__text">
            <span className="nf-push-ask__app">Vallo</span>
            <span className="nf-push-ask__line">{shown.offer}</span>
          </span>
        </span>
      </div>
      <h2 className="nf-push-ask__title">Get told, not left guessing</h2>
      {/* EXACTLY WHAT WILL BE SENT, BEFORE THE PROMPT AND NOT AFTER.
          A person who knows what they are agreeing to says yes more often
          and regrets it less. */}
      <ul className="nf-push-ask__rows">
        {PROMISES.map((row) => (
          <li key={row.text} className="nf-push-ask__row">
            <span className="nf-push-ask__plate" aria-hidden="true">
              <UiIcon name={row.icon} size={20} />
            </span>
            {row.text}
          </li>
        ))}
      </ul>
      {failed ? (
        <p role="alert" data-push-note="problem" className="nf-body-sm mt-sm text-[var(--nf-state-error)]">
          {failed.text}
          {failed.signIn ? (
            <>
              {" "}
              <Link href="/sign-in?next=%2Fsettings%2Fnotifications" className="underline">
                Open sign in
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="nf-push-ask__actions">
        <Button variant="primary" full onClick={accept} disabled={busy}>
          {busy ? "Just a moment" : "Yes, tell me"}
        </Button>
        {/* Not now, never Cancel. It is a real answer and it is honoured for
            thirty days. */}
        <Button variant="quiet" onClick={decline} disabled={busy}>
          Not now
        </Button>
      </div>
    </section>
  );
}

/** What will be sent, as the reference's plated rows. Unchanged words. */
const PROMISES: { icon: UiIconName; text: string }[] = [
  { icon: "bell", text: "Bookings, messages and money." },
  { icon: "moon", text: "Nothing at night unless it is about your money." },
  { icon: "settings-gear", text: "Off again whenever you like, in Settings." },
];

export default PushPrompt;
