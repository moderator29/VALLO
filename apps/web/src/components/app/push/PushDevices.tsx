"use client";

import { useState, useTransition } from "react";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { revokeAllPushDevices, revokePushDevice } from "@/lib/push/devices-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * THE LIST THAT MAKES THE PERMISSION REVERSIBLE.
 *
 * Without it, push is something a person can switch on and cannot switch off
 * except by uninstalling Vallo. That is not a setting, it is an ultimatum,
 * and it is the reason this component exists before any of the nicer ones.
 *
 * ===========================================================================
 * EVERY STRING ON THE SCREEN IS DECIDED ABOVE THIS FILE, EXCEPT THE VERBS.
 *
 * The rows arrive already formatted by the server component, so this holds no
 * copy of the device data and cannot drift from it. The actions call
 * `revalidatePath` and the page re-renders from the database, which is what
 * stops the screen ever saying a device is still live after it was retired.
 *
 * ===========================================================================
 * CONFIRM THEN ACT, PER ROW, AND `armed` IS ONE PIECE OF STATE RATHER THAN A
 * FLAG PER ROW.
 *
 * Arming a second control disarms the first by construction, so somebody who
 * changes their mind and taps a different row cannot retire the wrong device
 * with the tap that was meant to select it. This is the same pattern as
 * `/settings/devices`, on purpose: two screens about turning devices off
 * should not behave differently.
 *
 * ===========================================================================
 * THERE IS NO TOKEN ON THIS SCREEN AND NONE IN THIS FILE'S PROPS.
 *
 * `ref` is `push_tokens.device_ref`: twelve hex characters the database
 * generates from the token, not reversible, and there so a person with two
 * Android phones can tell their two rows apart. Read it aloud to support if
 * you like. It reaches nobody's handset.
 */

export type PushDeviceView = {
  id: string;
  name: string;
  ref: string;
  lastSeen: string;
  firstSeen: string;
};

type Outcome = { tone: "done" | "problem"; message: string } | null;

export function PushDevices({
  rows,
  readable,
}: {
  rows: PushDeviceView[];
  /** False when the read itself failed. NOT the same as an empty list. */
  readable: boolean;
}) {
  const [armed, setArmed] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [pending, startTransition] = useTransition();

  const run = (key: string, work: () => Promise<Outcome>) => {
    if (armed !== key) {
      setArmed(key);
      setOutcome(null);
      return;
    }
    setArmed(null);
    startTransition(async () => {
      try {
        setOutcome(await work());
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const stopOne = (row: PushDeviceView) =>
    run(row.id, async () => {
      const result = await revokePushDevice({ deviceId: row.id });
      if (!result.ok) return { tone: "problem", message: result.error };
      return {
        tone: "done",
        message:
          result.data.revoked === 0
            ? "That device was already off. The list below is up to date."
            : `${row.name} will not be notified again until you switch it back on from that device.`,
      };
    });

  const stopAll = () =>
    run("all", async () => {
      const result = await revokeAllPushDevices();
      if (!result.ok) return { tone: "problem", message: result.error };
      /* Zero is reported as zero. "Turned every device off" over a list that
         had nothing on it is the screen claiming work it did not do. */
      return {
        tone: "done",
        message:
          result.data.revoked === 0
            ? "There was nothing to turn off."
            : "Every device is off. Open Vallo on any of them and say yes again to switch it back on.",
      };
    });

  if (!readable) {
    return (
      <p role="alert" className="nf-panel nf-panel--card block p-card nf-body-sm text-content">
        We could not read your devices just now. Nothing has changed. Try again in a moment.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="nf-body-sm text-content-2">
        No device is set up for notifications yet. Say yes above on any phone or browser and it
        will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-block">
      <p className="nf-body-sm text-content-2">
        These are the devices Vallo can reach. Turning one off here stops the notifications; it
        does not sign that device out. To sign a device out of your account, use Where you are
        signed in.
      </p>

      {outcome && (
        <p
          role="status"
          data-testid="push-devices-outcome"
          className={`nf-panel nf-panel--card block p-card nf-body-sm ${
            outcome.tone === "problem" ? "text-danger" : "text-content"
          }`}
        >
          {outcome.message}
        </p>
      )}

      <ul className="space-y-row">
        {rows.map((row) => (
          <li key={row.id} className="nf-panel nf-panel--card block p-card" data-testid="push-device-row">
            <p className="nf-body font-semibold text-content">{row.name}</p>

            <dl className="mt-row space-y-row">
              <div className="flex items-center gap-inline-tight">
                <UiIcon name="history" size="xs" />
                <dd className="nf-body-sm text-content-2">Last reached {row.lastSeen}</dd>
              </div>
              <div className="flex items-center gap-inline-tight">
                <UiIcon name="bell" size="xs" />
                <dd className="nf-body-sm text-content-2">Set up {row.firstSeen}</dd>
              </div>
              <div className="flex items-center gap-inline-tight">
                <UiIcon name="key" size="xs" />
                {/* The safe handle, for telling two identical phones apart and
                    for reading out to support. It reaches no handset. */}
                <dd className="nf-caption text-muted">Device {row.ref}</dd>
              </div>
            </dl>

            <Button
              variant={armed === row.id ? "danger" : "secondary"}
              size="sm"
              full
              onClick={() => stopOne(row)}
              disabled={pending}
              data-testid="push-device-stop"
              className="mt-group"
            >
              {pending && armed === null
                ? "Just a moment"
                : armed === row.id
                  ? "Tap again to turn it off"
                  : "Turn this device off"}
            </Button>
          </li>
        ))}
      </ul>

      <Button
        variant={armed === "all" ? "danger" : "secondary"}
        size="sm"
        full
        onClick={stopAll}
        disabled={pending}
        data-testid="push-device-stop-all"
      >
        {pending && armed === null
          ? "Just a moment"
          : armed === "all"
            ? "Tap again to turn every device off"
            : "Turn every device off"}
      </Button>
      <p className="nf-caption text-muted">
        Use this if a phone is lost. It stops notifications on every device, including this one.
      </p>
    </div>
  );
}

export default PushDevices;
