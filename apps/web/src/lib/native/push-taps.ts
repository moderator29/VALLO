"use client";

/**
 * A TAP ON A NATIVE NOTIFICATION LANDS WHERE IT SAYS. V-53.
 *
 * Web push taps are routed by the service worker (`public/sw.js`,
 * `notificationclick`). A push delivered to the iOS or Android SHELL never
 * reaches the service worker: the operating system hands the tap to the
 * Capacitor push plugin, which emits `pushNotificationActionPerformed`. Until
 * this file nothing listened, so a tap on a native Vallo notification opened
 * the app wherever it happened to be, and the `href` the drain had carefully
 * put in the payload (`lib/push/transport/fcm.ts` `data.href`,
 * `lib/push/transport/apns.ts`
 * `href`) was read by nobody.
 *
 * The destination is chosen exactly as the service worker chooses it: the
 * button's own href when a button was pressed, otherwise the notification's,
 * and only ever a path on our own origin; anything else lands on the
 * notifications list, which is always a truthful destination.
 *
 * ANDROID'S CHANNEL. From Android 8 a notification must belong to a channel.
 * The server names `vallo_default` on every message; creating it here, at
 * boot, gives it a person-readable name and a high importance, so a
 * notification is not filed under an anonymous fallback channel the person
 * cannot make sense of in Settings.
 *
 * Reached through `Capacitor.registerPlugin`, like `components/app/push/
 * enrol.ts`, so the website never loads a Capacitor package for it.
 */

type ActionEvent = {
  actionId?: string;
  notification?: { data?: Record<string, unknown> };
};

type PushPlugin = {
  addListener: (
    event: "pushNotificationActionPerformed",
    cb: (event: ActionEvent) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
  createChannel?: (channel: {
    id: string;
    name: string;
    description?: string;
    importance?: number;
    visibility?: number;
    vibration?: boolean;
    lights?: boolean;
  }) => Promise<void>;
};

import { sameOriginPath } from "../push/same-origin";

const FALLBACK = "/notifications";

function onOrigin(value: unknown): string | null {
  return sameOriginPath(value);
}

/** Pure: where a native tap goes. */
export function tapDestination(event: ActionEvent): string {
  const data = event.notification?.data ?? {};
  const actionId = typeof event.actionId === "string" ? event.actionId : "tap";
  if (actionId !== "tap") {
    let actions: unknown = data.actions;
    if (typeof actions === "string") {
      try {
        actions = JSON.parse(actions);
      } catch {
        actions = [];
      }
    }
    if (Array.isArray(actions)) {
      for (const action of actions) {
        if (action && typeof action === "object" && (action as { id?: unknown }).id === actionId) {
          const href = onOrigin((action as { href?: unknown }).href);
          if (href) return href;
        }
      }
    }
  }
  return onOrigin(data.href) ?? FALLBACK;
}

export async function startPushTaps(channelName: string): Promise<() => void> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("PushNotifications")) {
    return () => undefined;
  }
  const plugin = Capacitor.registerPlugin<PushPlugin>("PushNotifications");

  if (Capacitor.getPlatform() === "android" && typeof plugin.createChannel === "function") {
    /* 4 is IMPORTANCE_HIGH: it may make a sound and peek on screen. */
    void plugin.createChannel({ id: "vallo_default", name: channelName, importance: 4 }).catch(() => undefined);
    /* An incoming call's ring (`lib/push/transport/fcm.ts` names this channel
       for a ring push): the loudest the system allows, vibrating, shown on the
       lock screen. Without a channel of this exact id Android 8 and above drops
       the ring silently. A channel's importance is fixed once it exists on a
       handset, so this id is never reused for anything quieter. */
    /* A missed call is X's quiet row: importance 2 is LOW, in the shade with
       no sound and no peek. Android decides sound by channel, so this is the
       only way to make it quiet (`lib/push/transport/fcm.ts`). */
    void plugin.createChannel({ id: "vallo_missed", name: "Missed calls", importance: 2 }).catch(() => undefined);
    void plugin
      .createChannel({ id: "vallo_calls", name: "Calls", importance: 5, visibility: 1, vibration: true, lights: true })
      .catch(() => undefined);
  }

  const handle = await plugin.addListener("pushNotificationActionPerformed", (event) => {
    const target = tapDestination(event);
    if (window.location.pathname + window.location.search !== target) {
      /* A full navigation, for the reason `deep-links.ts` gives: the router
         lives in React and this does not. */
      window.location.assign(target);
    }
  });
  return () => {
    void handle.remove().catch(() => undefined);
  };
}
