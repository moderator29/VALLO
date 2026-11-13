"use client";

import { looksNative, nativePlatform } from "@/lib/native/platform";

/**
 * THE WAY BACK FROM A REFUSED PERMISSION: the phone's own Settings for Vallo.
 *
 * iOS ONLY, AND WITH NO PLUGIN. `app-settings:` is Apple's URL for an app's
 * own page in the Settings app (`UIApplication.openSettingsURLString`), where
 * Notifications is a row. The Capacitor shell hands any top-level navigation
 * that is not to the app's own origin to `UIApplication.shared.open`
 * (`WebViewDelegationHandler.swift`), so navigating to it opens that page.
 *
 * ANDROID HAS NO EQUIVALENT WITHOUT A PLUGIN. The app details screen needs an
 * `ACTION_APPLICATION_DETAILS_SETTINGS` intent, and Capacitor's Android
 * bridge opens an outside URL only as `ACTION_VIEW`, which no settings screen
 * answers. The project carries no settings plugin (`@capacitor/app` cannot do
 * it), so on Android the Settings line says where to go in words and offers
 * no button that would do nothing.
 */
export function canOpenAppSettings(): boolean {
  return looksNative() && nativePlatform() === "ios";
}

export function openAppSettings(): void {
  if (!canOpenAppSettings()) return;
  window.location.href = "app-settings:";
}
