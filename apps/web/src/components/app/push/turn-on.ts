"use client";

import { updateSettings } from "@/lib/profile/actions";
import { everyPushOn } from "@/lib/profile/model";

import { enrol, type EnrolOutcome } from "./enrol";
import { readMemory, rememberSystemAsked, writeMemory } from "./moments";

/**
 * THE ONE YES, END TO END (the founder, 13 November 2026: "it should turn on
 * for all notis just that button no back and forth").
 *
 * Both places that can switch notifications on call this and nothing else:
 * the Turn on button at the end of first run (`PushPrompt`) and the master
 * switch on Settings > Notifications (`PushSetting`). It:
 *
 *   1. asks the system (`enrol`: the Capacitor push plugin in the iOS and
 *      Android shell, Web Push in a browser that has it), and registers this
 *      device with `/api/push/register`;
 *   2. when the system said yes, switches push on for EVERY topic in the
 *      member's settings in ONE `updateSettings` write (`everyPushOn`), so
 *      there is no second switch anybody has to find;
 *   3. remembers that the system prompt was reached, so the first-run screen
 *      never asks this device again (`moments.ts`).
 *
 * `enrol` is called on the first line with nothing awaited before it, so the
 * user activation from the tap is still live when the browser asks for the
 * permission (see `enrol.ts`).
 */
export type TurnOnResult =
  /* The device is registered. `topicsSaved` is false when the one settings
     write was refused (signed out, offline): the device is still on, and the
     caller says so. */
  | { kind: "on"; deviceRef: string; topicsSaved: boolean }
  /* The system said no, now or before. */
  | { kind: "denied" }
  /* No push on this device at all. */
  | { kind: "unsupported" }
  /* The system said yes and the registration then failed; the outcome names
     the step for the failure sentence. */
  | { kind: "failed"; outcome: EnrolOutcome & { ok: false }; topicsSaved: boolean };

/**
 * Did the operating system or browser grant the permission, whatever happened
 * after it? Every failure that names a step past the permission request
 * (`key`, `worker`, `subscribe`, `token`, `register` ...) was reached with the
 * permission already given.
 */
export function systemGranted(outcome: EnrolOutcome): boolean {
  if (outcome.ok) return true;
  if (outcome.reason === "permission_denied" || outcome.reason === "unsupported") return false;
  return outcome.step !== undefined && outcome.step !== "permission" && outcome.step !== "plugin";
}

export async function turnOnNotifications(): Promise<TurnOnResult> {
  const outcome = await enrol();
  writeMemory(rememberSystemAsked(readMemory()));

  if (!systemGranted(outcome)) {
    return !outcome.ok && outcome.reason === "unsupported" ? { kind: "unsupported" } : { kind: "denied" };
  }

  const topicsSaved = await saveEveryTopicOn();
  return outcome.ok
    ? { kind: "on", deviceRef: outcome.deviceRef, topicsSaved }
    : { kind: "failed", outcome, topicsSaved };
}

/** The one write. A refusal or a dropped connection is a false, never a throw. */
async function saveEveryTopicOn(): Promise<boolean> {
  try {
    const result = await updateSettings(everyPushOn());
    return result.ok;
  } catch {
    return false;
  }
}
