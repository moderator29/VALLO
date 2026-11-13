"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { revokeThisPushDevice } from "@/lib/push/devices-actions";
import { looksNative } from "@/lib/native/platform";
import { banner } from "@/lib/ui/toast";

import {
  clearLocalDevice,
  controlState,
  deviceIsLive,
  failureMessage,
  readLocalDevice,
  refsKeyOf,
} from "./device-state";
import {
  currentEndpoint,
  currentPermission,
  failureReference,
  onIosHomeScreenApp,
  readNativePermission,
  type EnrolOutcome,
} from "./enrol";
import type { PushCopy } from "./PushPrompt";
import { canOpenAppSettings, openAppSettings } from "./system-settings";
import { turnOnNotifications } from "./turn-on";

/**
 * THE ONE NOTIFICATIONS SWITCH, AT THE TOP OF SETTINGS > NOTIFICATIONS.
 *
 * ===========================================================================
 * THE SAME CONTROL AS THE FIRST-RUN SCREEN (the founder, 13 November 2026:
 * "Unified once allowed ... no other buttons everywhere").
 *
 *   ON   asks the system if it has not been asked (the shell's prompt, or the
 *        browser's), registers this device, and switches push on for every
 *        kind in one write (`turn-on.ts`). Nothing below has to be touched.
 *   OFF  retires THIS device (`revokeThisPushDevice`), so nothing reaches it.
 *        The kinds below keep their answers for the next time it is on.
 *
 * The per-kind Push cells below it are only ways to turn one kind OFF later;
 * they are on unless somebody turned them off.
 *
 * REFUSED: the system prompt is spent, and only the phone's own Settings can
 * undo it. The switch says so in one line, with Open Settings where the shell
 * can open Vallo's page there (iOS; see `system-settings.ts`). Coming back to
 * the app re-reads the permission, so the line goes once it is allowed.
 *
 * ===========================================================================
 * THE SWITCH MAY NOT READ ON UNLESS THE SERVER HOLDS A LIVE ROW FOR THIS
 * DEVICE (the blind light of 23 September; `device-state.ts`). Permission is
 * a fact about the browser; ON needs `deviceIsLive`: the `device_ref`
 * `/api/push/register` gave THIS device, found among the live refs the page
 * just read from the database. Until that check has run the switch reads off
 * and is held still.
 */

/** A live row of this account's devices, as the page read it. */
export type PushDeviceRef = { id: string; ref: string };

type Permission = ReturnType<typeof currentPermission> | "deciding";

/**
 * The permission, read as an external system: it exists on the client and
 * not on the server, so the server snapshot is "deciding".
 *
 * Coming back to the app (from the phone's Settings, say) re-reads it. In the
 * shell the real answer needs `checkPermissions`, which never prompts.
 */
function subscribe(onChange: () => void): () => void {
  const reread = () => {
    if (document.visibilityState !== "visible") return;
    if (looksNative()) void readNativePermission().then(onChange);
    else onChange();
  };
  if (looksNative()) void readNativePermission().then(onChange);
  document.addEventListener("visibilitychange", reread);
  return () => document.removeEventListener("visibilitychange", reread);
}

export function PushSetting({
  copy,
  devices,
}: {
  copy: PushCopy;
  /** Every live row on this account, from the database. */
  devices?: readonly PushDeviceRef[];
}) {
  const router = useRouter();
  const permission = useSyncExternalStore<Permission>(subscribe, currentPermission, () => "deciding");
  const [busy, setBusy] = useState(false);
  const words = copy.master;

  const registeredRefs = devices?.map((device) => device.ref);
  const refsKey = refsKeyOf(registeredRefs);
  /* The server's word on THIS device, checked after mount because the local
     record and the subscription exist only in the browser. Keyed by the refs
     it was computed against, so a refreshed list re-runs it. */
  const [verified, setVerified] = useState<{ key: string; live: boolean } | null>(null);
  /* A registration that succeeded on this visit, before the list has been
     refreshed to include it. Held with the very array the page had handed
     over then: `router.refresh()` hands over a new one, and from then on the
     list decides, even if its contents look the same. */
  const [confirmed, setConfirmed] = useState<{
    ref: string;
    list: readonly PushDeviceRef[] | undefined;
  } | null>(null);

  useEffect(() => {
    if (permission !== "granted") return;
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
  }, [permission, refsKey]);

  const fail = useCallback(
    (outcome: EnrolOutcome & { ok: false }) => {
      const reference = failureReference(outcome);
      const text =
        failureMessage(outcome.reason, { iosHomeScreenApp: onIosHomeScreenApp(), where: "settings", reference }) +
        (reference ? ` (Reference: ${reference}.)` : "");
      banner.error(
        text,
        outcome.reason === "signed_out"
          ? { action: { label: "Open sign in", run: () => router.push("/sign-in?next=%2Fsettings%2Fnotifications") } }
          : undefined,
      );
    },
    [router],
  );

  /* NOT AWAITED BEFORE THE CALL: `turnOnNotifications` asks for the
     permission on its first line, inside this tap's user activation. */
  const turnOn = () => {
    setBusy(true);
    void turnOnNotifications().then((result) => {
      setBusy(false);
      if (result.kind === "on") {
        /* The ONLY path to ON from a tap: the server answered ok and named
           the row. */
        setConfirmed({ ref: result.deviceRef, list: devices });
        if (result.topicsSaved) banner.success(copy.done.on, { "data-testid": "banner-push-on" });
        else banner.error(copy.done.topicsNotSaved);
        router.refresh();
        return;
      }
      setConfirmed(null);
      setVerified({ key: refsKey, live: false });
      /* Denied or unsupported: the re-render reads the new permission and
         draws the line that says where to go. */
      if (result.kind === "failed") fail(result.outcome);
    });
  };

  const turnOff = () => {
    const local = readLocalDevice();
    const done = () => {
      clearLocalDevice();
      setConfirmed(null);
      setVerified({ key: refsKey, live: false });
      banner.success(copy.done.off, { "data-testid": "banner-push-off" });
      router.refresh();
    };
    if (!local) {
      done();
      return;
    }
    setBusy(true);
    void revokeThisPushDevice({ deviceRef: local.deviceRef })
      .then((result) => {
        setBusy(false);
        if (result.ok) done();
        else banner.error(copy.done.offFailed);
      })
      .catch(() => {
        setBusy(false);
        banner.error(copy.done.offFailed);
      });
  };

  if (permission === "unsupported" || permission === "denied") {
    const blocked = permission === "denied";
    return (
      <div className="nf-push-master" data-push-setting={permission}>
        <Switch
          label={words.label}
          description={blocked ? (looksNative() ? words.blockedPhone : words.blockedBrowser) : words.unsupported}
          checked={false}
          onCheckedChange={() => undefined}
          disabled
          data-testid="push-master"
        />
        {blocked && canOpenAppSettings() ? (
          <Button variant="secondary" size="sm" onClick={openAppSettings} data-testid="push-open-settings">
            {words.openSettings}
          </Button>
        ) : null}
      </div>
    );
  }

  const state =
    permission === "deciding"
      ? "checking"
      : controlState({
          allowed: permission === "granted",
          refsKey,
          registeredRefs,
          confirmed: confirmed ? { ref: confirmed.ref, listRefreshed: confirmed.list !== devices } : null,
          verified,
        });
  const on = state === "on";

  return (
    <div className="nf-push-master" data-push-setting={on ? "on" : state} data-push-registered={on ? "yes" : state === "checking" ? "checking" : "no"}>
      <Switch
        label={words.label}
        description={on ? words.on : state === "checking" ? words.checking : words.off}
        checked={on}
        onCheckedChange={(next) => (next ? turnOn() : turnOff())}
        disabled={busy || state === "checking"}
        data-testid="push-master"
      />
    </div>
  );
}

export default PushSetting;
