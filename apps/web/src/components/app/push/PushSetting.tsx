"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";

import {
  controlState,
  deviceIsLive,
  failureMessage,
  readLocalDevice,
  refsKeyOf,
} from "./device-state";
import { currentEndpoint, currentPermission, enrol, failureReference, onIosHomeScreenApp, type EnrolOutcome } from "./enrol";
import { PushPrompt } from "./PushPrompt";
import { offerVerdict, readMemory, rememberSystemAsked, writeMemory } from "./moments";

/**
 * THE NOTIFICATION CONTROL ON THE SETTINGS SCREEN.
 *
 * ===========================================================================
 * A SETTINGS SCREEN IS NOT A MOMENT, AND THAT DISTINCTION IS WHY THIS FILE
 * EXISTS RATHER THAN A BARE `<PushPrompt moment="settings_opened" />`.
 *
 * `moments.ts` is about INTERRUPTIONS. It will not offer twice in thirty days
 * and will not offer a third time ever, which is exactly right for a prompt
 * that appears over something a person was already doing. It applies those
 * rules to every moment including `settings_opened`.
 *
 * On `/settings/notifications` that is the wrong answer and it is wrong in a
 * costly direction. Nobody arrives here by accident. A person who said Not
 * now twice and then came looking for the switch a week later would find the
 * screen silent, with no way to turn notifications on and nothing saying why.
 * That is a dead end built out of politeness.
 *
 * So the rules still decide whether the PROMPT is shown, with its careful
 * copy about what will be sent. When they say no, a plain control is shown
 * instead. A person who came to ask us can always say yes.
 *
 * This is recorded as a defect in the inherited design rather than fixed in
 * `moments.ts`, because the four moments are a closed contract with 41 tests
 * behind them and the fault is not in the rules, it is in applying rules
 * about interruption to a screen that is not one.
 *
 * ===========================================================================
 * THE THREE STATES THAT ARE NOT "ASK".
 *
 * GRANTED: there is nothing to ask for, but there may still be something to
 * do. A device whose row was retired from the list below still has the
 * browser permission, so the control stays and re-enrolling is one tap.
 * `/api/push/register` upserts on the token and clears `revoked_at`, so it is
 * safe to press repeatedly and never makes a second row.
 *
 * DENIED: THE SYSTEM PROMPT IS SPENT. On iOS a refusal is effectively
 * permanent and on the web a denied permission cannot be re-prompted from the
 * page at all. Offering a button that leads nowhere would be worse than
 * saying nothing, so the screen says where the only remaining route is: their
 * own browser or phone settings.
 *
 * UNSUPPORTED: an older Android browser, or iOS Safari on a site that has not
 * been added to the home screen, where web push does not exist. Named
 * plainly, with the one thing that would change it.
 */

type Phase =
  /* Before hydration. Nothing is rendered: both inputs are per device and
     neither exists on the server, so rendering anything else here would be a
     hydration mismatch. */
  | "deciding"
  | "prompt"
  | "control"
  | "granted"
  | "denied"
  | "unsupported";

/**
 * What this device says right now, read as an external system.
 *
 * `useSyncExternalStore` rather than an effect, and the choice is not
 * stylistic. The browser's permission state and the prompt memory in
 * `localStorage` are external systems: they exist on the client and not on
 * the server, and React has one supported way to read such a thing without
 * either a hydration mismatch or a set-state-in-effect that triggers a
 * cascading render. `getServerSnapshot` answers "deciding", the client's
 * answer arrives on the hydration pass, and no lint rule has to be disabled
 * to get there.
 *
 * It returns a plain string because `getSnapshot` must return the same value
 * for the same state; a fresh object every call is the documented way to make
 * this hook loop for ever.
 */
function readPhase(): Exclude<Phase, "deciding"> {
  const permission = currentPermission();
  if (permission === "granted") return "granted";
  if (permission === "denied") return "denied";
  if (permission === "unsupported") return "unsupported";

  const verdict = offerVerdict({
    moment: "settings_opened",
    permission,
    memory: readMemory(),
    now: Date.now(),
  });
  return verdict.show ? "prompt" : "control";
}

/* Nothing to subscribe to: a permission change that happens behind the page's
   back arrives on the next load, and a listener that fired on it would have
   nothing more to offer than this screen already does. */
function subscribe(): () => void {
  return () => {};
}

/**
 * THE CONTROL MAY NOT READ ON UNLESS THE SERVER HOLDS A LIVE ROW FOR THIS
 * DEVICE. THIS IS WHY.
 *
 * On 23 September the founder allowed notifications in the iPhone home screen
 * app, signed in, and the control read as on. `push_tokens` had never held a
 * row. `/api/push/key` was answering 401 to that app (the route was gated and
 * the home screen app keeps a cookie store of its own), the subscribe never
 * happened, and the control had decided it was on from
 * `Notification.permission`. On the first tap it showed a failure note for as
 * long as the page lived; on every load after that permission read "granted",
 * the phase went straight to the granted copy ("Notifications are allowed on
 * this device") and there was no note at all. A light and no words.
 *
 * Permission is a fact about the browser. A later fix read ON from the
 * account's device COUNT, which lights this phone because of a row belonging
 * to a laptop. Now ON needs all of `deviceIsLive` in `device-state.ts`: the
 * `device_ref` that `/api/push/register` gave THIS device, found among the
 * live refs the page just read from the database, with the browser still
 * holding the endpoint that was registered. Until that check has run, the
 * control reads off.
 *
 * Every failed attempt settles the phase and says one plain sentence
 * (`failureMessage`); no failure may leave the screen silent.
 */
type Note = { text: string; signIn: boolean; tone: "done" | "problem" };

export function PushSetting({
  registeredRefs,
  registeredDevices: _legacyCount,
}: {
  /** `device_ref` of every live row on this account, from the database. */
  registeredRefs?: readonly string[];
  /** @deprecated An account-wide count cannot say anything about THIS device. */
  registeredDevices?: number;
} = {}) {
  void _legacyCount;
  const router = useRouter();
  const observed = useSyncExternalStore<Phase>(subscribe, readPhase, () => "deciding");
  /* What the person has since done on this screen, which outranks what the
     browser said when the page loaded. */
  const [settled, setSettled] = useState<Phase | null>(null);
  const phase = settled ?? observed;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  /* The server's word on THIS device, checked after mount because the local
     record and the subscription exist only in the browser. `null` while the
     check is running, which reads as off. Keyed by the refs it was computed
     against, so a refreshed list (a device retired below) re-runs it. */
  const refsKey = refsKeyOf(registeredRefs);
  const [verified, setVerified] = useState<{ key: string; live: boolean } | null>(null);
  /* A registration that succeeded on this visit, before the list has been
     refreshed to include it. Held with the very array the page had handed
     over at that moment: `router.refresh()` hands over a new one, and from
     then on the list decides, even if its contents look the same. */
  const [confirmed, setConfirmed] = useState<{
    ref: string;
    list: readonly string[] | undefined;
  } | null>(null);

  useEffect(() => {
    if (phase !== "granted") return;
    let cancelled = false;
    void currentEndpoint().then((endpoint) => {
      if (cancelled) return;
      setVerified({
        key: refsKey,
        live: deviceIsLive({
          permission: currentPermission(),
          local: readLocalDevice(),
          currentEndpoint: endpoint,
          liveRefs: registeredRefs,
        }),
      });
    });
    return () => {
      cancelled = true;
    };
    /* `registeredRefs` is read through `refsKey`, which is its value. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, refsKey]);

  const fail = useCallback((outcome: EnrolOutcome & { ok: false }) => {
    const reference = failureReference(outcome);
    setNote({
      text:
        failureMessage(outcome.reason, { iosHomeScreenApp: onIosHomeScreenApp(), where: "settings", reference }) +
        (reference ? ` (Reference: ${reference}.)` : ""),
      signIn: outcome.reason === "signed_out",
      tone: "problem",
    });
  }, []);

  /* NOT AWAITED BEFORE THE CALL. `enrol` requests the permission on its first
     line precisely so the user activation from this click is still live when
     it does; an await before it loses the gesture in some browsers and the
     system prompt never appears. */
  const turnOn = useCallback(() => {
    setBusy(true);
    setNote(null);
    void enrol().then((outcome) => {
      writeMemory(rememberSystemAsked(readMemory()));
      setBusy(false);
      if (outcome.ok) {
        /* The ONLY path to ON from a tap: the server answered ok and named
           the row. */
        setSettled("granted");
        setConfirmed({ ref: outcome.deviceRef, list: registeredRefs });
        setNote({ text: "This device is registered. It is on the list below.", signIn: false, tone: "done" });
        /* The list is server-rendered from the database, so it is refreshed
           rather than patched. */
        router.refresh();
        return;
      }
      setConfirmed(null);
      setVerified({ key: refsKey, live: false });
      if (outcome.reason === "permission_denied") {
        setSettled("denied");
        return;
      }
      /* THE PHASE IS SETTLED ON EVERY FAILURE, and a sentence is always
         shown. Leaving it to `Notification.permission` is how the screen
         drew the allowed copy over a failed attempt. */
      setSettled("control");
      fail(outcome);
    });
  }, [router, refsKey, registeredRefs, fail]);

  if (phase === "deciding") return null;

  if (phase === "prompt") {
    return (
      <PushPrompt
        moment="settings_opened"
        onSettled={(outcome, deviceRef) => {
          if (outcome === "enrolled" && deviceRef) {
            setSettled("granted");
            setConfirmed({ ref: deviceRef, list: registeredRefs });
            router.refresh();
            return;
          }
          /* A No here is honoured as a No, and the plain control stays so the
             screen is not a dead end. A failure keeps the prompt on screen
             with its own sentence, so it does not arrive here. */
          setSettled(outcome === "unavailable" || outcome === "allowed" ? readPhase() : "control");
        }}
      />
    );
  }

  if (phase === "unsupported") {
    return (
      <p className="nf-body-sm text-content-2" data-push-setting="unsupported">
        This browser cannot show notifications. On an iPhone, add Vallo to your home screen and
        open it from there, and the option will appear.
      </p>
    );
  }

  if (phase === "denied") {
    return (
      <p className="nf-body-sm text-content-2" data-push-setting="denied">
        Notifications are blocked for Vallo on this device. We cannot ask again from here: the
        only way back is your own settings. In a browser, open the padlock or the site settings
        beside the address and allow notifications. On a phone, find Vallo in the system settings
        and switch notifications on.
      </p>
    );
  }

  /*
   * `allowed` is a browser fact. `registered` is the server's word about this
   * device. The control only ever reads ON when both are true.
   */
  const allowed = phase === "granted";
  const state = controlState({
    allowed,
    refsKey,
    registeredRefs,
    confirmed: confirmed ? { ref: confirmed.ref, listRefreshed: confirmed.list !== registeredRefs } : null,
    verified,
  });
  const registered = state === "on";
  const checking = state === "checking";

  return (
    <div
      className="space-y-row"
      data-push-setting={registered ? "granted" : "control"}
      data-push-allowed={allowed ? "yes" : "no"}
      data-push-registered={registered ? "yes" : checking ? "checking" : "no"}
    >
      <p className="nf-body-sm text-content-2">
        {registered
          ? "Notifications are on for this device. Vallo can reach it."
          : checking
            ? "Checking whether this device is registered."
            : allowed
              ? "You have allowed notifications on this device, but it is not registered, so nothing will reach it. Turn it on below."
              : "Get told when a host answers, when somebody writes back, and when money moves. Nothing at night unless it is about your money."}
      </p>
      {/* A "done" note is shown only while the control reads on: once the
          refreshed list has had its say, a success sentence under an off
          control would be the blind light again in words. */}
      {note && (note.tone === "problem" || registered) && (
        <p
          role={note.tone === "problem" ? "alert" : "status"}
          className="nf-body-sm text-content"
          data-push-note={note.tone}
        >
          {note.text}
          {note.signIn ? (
            <>
              {" "}
              <Link href="/sign-in?next=%2Fsettings%2Fnotifications" className="underline">
                Open sign in
              </Link>
            </>
          ) : null}
        </p>
      )}
      <Button variant="secondary" size="sm" full onClick={turnOn} disabled={busy} data-testid="push-turn-on">
        {busy ? "Just a moment" : registered ? "Register this device again" : "Turn on for this device"}
      </Button>
    </div>
  );
}

export default PushSetting;
