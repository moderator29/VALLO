"use client";

import { looksNative } from "@/lib/native/platform";

import {
  clearLocalDevice,
  isIosHomeScreenApp,
  readLocalDevice,
  writeLocalDevice,
  type EnrolFailureReason,
} from "./device-state";

/**
 * TURNING A YES INTO A DEVICE THE SERVER CAN REACH.
 *
 * ===========================================================================
 * THE ORDER IS THE WHOLE THING, AND IT IS THE OPPOSITE OF THE OBVIOUS ONE.
 *
 * Nothing in this file may run before a person has said Yes on the Vallo
 * screen. `components/app/push/moments.ts` decides whether that screen is
 * shown; `PushPrompt` shows it; only its Yes handler calls `enrol`. The
 * system prompt is reached on the LAST line of a deliberate sequence, never
 * on a page load, because there is one system prompt per install and a
 * refusal to it is, on iOS, permanent.
 *
 * ===========================================================================
 * THE WEBSITE MUST NOT CHANGE, WHICH IS WHY THERE IS NO STATIC IMPORT OF ANY
 * CAPACITOR PACKAGE HERE.
 *
 * `lib/native/boot.ts` sets the rule for this repository: the same bundle
 * serves the website in a phone browser and the shell on a handset, and a
 * visitor to the website pays for nothing native. `looksNative()` reads an
 * injected global and imports nothing. Below that, the native path reaches
 * the plugin through `Capacitor.registerPlugin`, which is the documented way
 * to call a native plugin WITHOUT importing its JavaScript package.
 *
 * THAT CHOICE ALSO MEANS `@capacitor/push-notifications` IS NOT NEEDED FOR
 * THE WEB BUILD TO COMPILE. It is needed by `cap sync` to put the native
 * implementation into the Android and iOS projects, and it is declared in
 * `package.json` for exactly that. A web build with the package absent still
 * builds and still runs; the native branch simply finds no plugin and says
 * so, which is the same way every other native capability here degrades.
 */

export type EnrolOutcome =
  | { ok: true; deviceRef: string; platform: "web" | "ios" | "android" }
  | {
      ok: false;
      /*
       * See `device-state.ts` for the list and what each one means.
       *
       * "not_configured" and "signed_out" are told apart because they are
       * told apart nowhere else: the first is ours and the person can do
       * nothing, the second is theirs and signing in fixes it. Collapsing them
       * told the founder push was not set up on a deployment where it was.
       */
      reason: EnrolFailureReason;
      /*
       * WHICH STEP FAILED, AND WHAT THE BROWSER CALLED THE ERROR.
       *
       * Every real attempt from the iPhone home screen app on 23 September
       * died in the browser before the register POST was sent (the database
       * logs show the settings page read `push_tokens` thirty times and no
       * write ever arrived), and "That did not work" could not say where. The
       * step and the DOMException name are shown with the failure sentence so
       * the next attempt names its own cause. Neither carries a token or a key.
       */
      step?: EnrolStep;
      detail?: string;
    };

export type EnrolStep =
  | "permission"
  | "key"
  | "worker"
  | "ready"
  | "subscribe"
  | "keys"
  | "register"
  /* Native only: the plugin itself, and the token APNs or FCM hands back. */
  | "plugin"
  | "token";

/** A short reference for a failure, e.g. `subscribe/NotAllowedError`, or null. */
export function failureReference(outcome: EnrolOutcome): string | null {
  if (outcome.ok || !outcome.step) return null;
  const detail = (outcome.detail ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  return detail ? `${outcome.step}/${detail}` : outcome.step;
}

function errorName(error: unknown): string {
  if (error && typeof error === "object" && "name" in error && typeof error.name === "string") {
    return error.name;
  }
  return "Error";
}

/* A promise that settles within `ms` or rejects with a TimeoutError. Used on
   the two waits that can hang for ever on a worker that never activates. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error("timed out");
      error.name = "TimeoutError";
      reject(error);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/* Two keys are the same key when their bytes are. */
function sameKey(a: ArrayBuffer | null | undefined, b: ArrayBuffer): boolean {
  if (!a) return false;
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

/**
 * How a reply from one of our push routes reads, as a failure, or null when it
 * is not one. A 401 or 403 is ALWAYS "signed_out": the proxy answers
 * `{"code":"sign-in-required"}` and `/api/push/register` answers
 * `{"reason":"signed_out"}`, and both mean no session reached us. A 503 from
 * register is the deployment with no database, which is ours.
 */
export function replyFailure(status: number): EnrolFailureReason | null {
  if (status === 401 || status === 403) return "signed_out";
  if (status === 503) return "not_configured";
  return null;
}

/** What the browser or operating system says right now, without asking. */
export function currentPermission(): "granted" | "denied" | "default" | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (looksNative()) {
    /* The native permission is not readable synchronously, and guessing
       `granted` here would let a caller skip the Vallo screen. F-15: the
       shell reads the real answer at launch (`readNativePermission`, from
       `lib/native/boot.ts`) and it is remembered here; until that read has
       answered, `default` is the honest answer: ask properly. */
    return nativePermissionSeen ?? "default";
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  const state = Notification.permission;
  return state === "granted" || state === "denied" ? state : "default";
}

/**
 * The endpoint of the Web Push subscription this browser holds right now, for
 * `deviceIsLive` in `device-state.ts`. `undefined` on native, where there is
 * no endpoint to compare; `null` when the browser holds no subscription, or
 * cannot say. Asks nothing and changes nothing: no permission prompt, no
 * worker registration.
 */
export async function currentEndpoint(): Promise<string | null | undefined> {
  if (typeof window === "undefined") return null;
  if (looksNative()) return undefined;
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return null;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? subscription.endpoint : null;
  } catch {
    return null;
  }
}

/** For the copy: is this the iPhone home screen app, with its own sign-in? */
export function onIosHomeScreenApp(): boolean {
  if (typeof window === "undefined") return false;
  let displayModeStandalone = false;
  try {
    displayModeStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  } catch {
    displayModeStandalone = false;
  }
  return isIosHomeScreenApp({
    userAgent: navigator.userAgent,
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    displayModeStandalone,
  });
}

/**
 * Enrol this device.
 *
 * MUST BE CALLED FROM A USER GESTURE, IN THE SAME TICK AS THE CLICK.
 * `Notification.requestPermission()` is gated on user activation, and an
 * `await` before it in some browsers loses that activation and the prompt
 * never appears. So the permission is requested FIRST, before the service
 * worker registration and before the key is fetched, even though that is the
 * less natural order to write.
 */
export async function enrol(): Promise<EnrolOutcome> {
  if (typeof window === "undefined") return { ok: false, reason: "unsupported" };
  return looksNative() ? enrolNative() : enrolWeb();
}

async function enrolWeb(): Promise<EnrolOutcome> {
  if (currentPermission() === "unsupported") return { ok: false, reason: "unsupported" };

  /* FIRST, AND SYNCHRONOUSLY FROM THE GESTURE. See the note above. Skipped
     when the permission is already granted: there is nothing to ask, and on
     WebKit `pushManager.subscribe` needs no gesture once it is granted. */
  let permission: NotificationPermission;
  try {
    permission =
      Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  } catch (error) {
    return { ok: false, reason: "failed", step: "permission", detail: errorName(error) };
  }
  if (permission !== "granted") return { ok: false, reason: "permission_denied" };

  let publicKey: string;
  try {
    const response = await fetch("/api/push/key", { cache: "no-store" });

    /*
     * A 401 IS NOT A MISSING KEY. The route is public now, so this should not
     * happen; it is kept because it DID happen, on the live site, to the first
     * device anybody ever tried to register, and a reply this specific must
     * never again be flattened into "not set up".
     */
    const refused = replyFailure(response.status);
    if (refused) return { ok: false, reason: refused, step: "key", detail: String(response.status) };

    const body = (await response.json()) as { configured?: boolean; publicKey?: string };
    if (!body.configured || typeof body.publicKey !== "string") {
      return { ok: false, reason: "not_configured", step: "key" };
    }
    publicKey = body.publicKey;
  } catch (error) {
    /* The fetch itself did not complete: offline, DNS, a proxy. Not a
       statement about our configuration, so it does not claim to be one. */
    return { ok: false, reason: "failed", step: "key", detail: errorName(error) };
  }

  /* ONE WORKER AT `/`, WHICH IS `public/sw.js`, AND IT CARRIES THE PUSH
     HANDLERS ITSELF. Registering the same script at the same scope is
     idempotent: if `ServiceWorkerRegistrar` has already installed it, this
     resolves with the registration that exists rather than replacing it.

     It is called here anyway rather than trusting the registrar, because
     the registrar is production-only and a person granting the permission
     must end up with a worker whatever the build. */
  let registration: ServiceWorkerRegistration;
  try {
    registration = await within(navigator.serviceWorker.register("/sw.js", { scope: "/" }), 15_000);
  } catch (error) {
    return { ok: false, reason: "failed", step: "worker", detail: errorName(error) };
  }
  try {
    /* `ready` never rejects: a worker that fails to activate leaves it
       pending for ever, and the button on "Just a moment" for ever with it.
       Bounded, so the person is told instead. */
    registration = await within(navigator.serviceWorker.ready, 15_000);
  } catch (error) {
    return { ok: false, reason: "failed", step: "ready", detail: errorName(error) };
  }
  await retireLegacyPushWorker();

  const serverKey = urlBase64ToBuffer(publicKey);
  let subscription: PushSubscription;
  try {
    /* An existing subscription is reused rather than replaced, WHEN IT WAS
       MADE WITH TODAY'S KEY. One made against an earlier key would be
       registered happily and then refused by the push service on the first
       send, so it is dropped and a fresh one taken. */
    let existing = await registration.pushManager.getSubscription();
    if (existing && !sameKey(existing.options?.applicationServerKey, serverKey)) {
      await existing.unsubscribe().catch(() => false);
      existing = null;
    }
    subscription =
      existing ??
      (await registration.pushManager.subscribe({
        /* Required by every browser: a push must result in something the
           person can see. It is also the honest description of what this
           feature is for. */
        userVisibleOnly: true,
        applicationServerKey: serverKey,
      }));
  } catch (error) {
    return { ok: false, reason: "failed", step: "subscribe", detail: errorName(error) };
  }

  const json = subscription.toJSON();
  const keys = json.keys ?? {};
  if (!keys.p256dh || !keys.auth) return { ok: false, reason: "failed", step: "keys" };

  return postRegistration({
    platform: "web",
    token: subscription.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    deviceLabel: browserLabel(),
  });
}

/**
 * The Capacitor plugin, reached through the registry rather than imported.
 *
 * `registerPlugin` returns a proxy bound to the native implementation. If the
 * plugin is not in the native project, calls reject, which the catch below
 * turns into `unsupported` rather than a crash.
 */
type NativeReceive = "granted" | "denied" | "prompt" | "prompt-with-rationale";

type PushPlugin = {
  requestPermissions: () => Promise<{ receive: NativeReceive }>;
  checkPermissions?: () => Promise<{ receive: NativeReceive }>;
  register: () => Promise<void>;
  addListener: (
    event: "registration" | "registrationError",
    handler: (payload: { value?: string; error?: unknown }) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
};

async function enrolNative(): Promise<EnrolOutcome> {
  let plugin: PushPlugin;
  let platform: "ios" | "android";
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return { ok: false, reason: "unsupported", step: "plugin" };
    plugin = Capacitor.registerPlugin<PushPlugin>("PushNotifications");
    platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
  } catch (error) {
    return { ok: false, reason: "unsupported", step: "plugin", detail: errorName(error) };
  }

  /* Alert, badge and sound in ONE request. Asking for them separately
     produces several prompts, and each one is a fresh chance to be
     refused. Capacitor's `requestPermissions` asks for all three.

     EVERY FAILURE BELOW NAMES ITS STEP. This used to be one catch that
     answered "unsupported" for anything at all, so a binary built without
     the plugin, a permission call that threw and a token that never came
     all read as "this browser cannot show notifications", and the empty
     `push_tokens` table could not say which. */
  let permission: { receive: NativeReceive };
  try {
    permission = await plugin.requestPermissions();
  } catch (error) {
    /* A binary built without the plugin rejects with UNIMPLEMENTED: that one
       really is "unsupported". Anything else is a failure with a name. */
    return isUnimplemented(error)
      ? { ok: false, reason: "unsupported", step: "plugin", detail: "UNIMPLEMENTED" }
      : { ok: false, reason: "failed", step: "permission", detail: errorName(error) };
  }
  nativePermissionSeen = fromReceive(permission.receive);
  if (permission.receive !== "granted") return { ok: false, reason: "permission_denied" };

  const answer = await nativeToken(plugin);
  if (answer.token === null) return { ok: false, reason: "failed", step: "token", detail: answer.detail };

  return postRegistration({ platform, token: answer.token, deviceLabel: platform === "ios" ? "iPhone" : "Android" });
}

/** Capacitor's refusal for a plugin the native binary does not carry. */
function isUnimplemented(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "UNIMPLEMENTED");
}

/**
 * What the operating system said when it gave no token, as a short word for
 * the failure reference: `timeout` (no answer in ten seconds: no network, or
 * on iOS the app delegate never forwarded the token), `register` (the plugin
 * refused the call), or `os-` and the start of the operating system's own
 * sentence (APNs: a build signed without the `aps-environment` entitlement;
 * FCM: Google Play services missing or a wrong `google-services.json`).
 */
export type NativeTokenAnswer = { token: string } | { token: null; detail: string };

function osDetail(error: unknown): string {
  const text = typeof error === "string" ? error : "";
  const slug = text.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return slug ? `os-${slug}` : "os";
}

/**
 * Ask the plugin for this device's token and wait for it to arrive on the
 * listener. A null token carries the reason, after an error or ten seconds
 * without an answer.
 */
async function nativeToken(plugin: PushPlugin): Promise<NativeTokenAnswer> {
  /* THE TOKEN ARRIVES ON A LISTENER, NOT AS A RETURN VALUE. `register()`
     resolves as soon as the request is made; the token comes back from
     APNs or FCM moments later on the `registration` event. Code that
     treats `register()` resolving as success registers nobody, which is a
     very easy mistake to make and an invisible one. */
  let settle: (value: NativeTokenAnswer) => void = () => undefined;
  const answered = new Promise<NativeTokenAnswer>((resolve) => {
    settle = resolve;
  });
  let done = false;
  /* A handset with no network gets neither event. Ten seconds, then the
     person is told it did not work rather than being left on a spinner. */
  const clock: { timer?: ReturnType<typeof setTimeout> } = {};
  /* Every attempt used to add a fresh `registration` and
     `registrationError` pair and never remove it, so a person who tried
     twice had two listeners posting two registrations. Both handles are
     kept and removed the moment this attempt settles. */
  const handles: Array<Promise<{ remove: () => Promise<void> }>> = [];
  const finish = (value: NativeTokenAnswer): void => {
    if (done) return;
    done = true;
    clearTimeout(clock.timer);
    for (const handle of handles) void handle.then((h) => h.remove()).catch(() => undefined);
    settle(value);
  };

  handles.push(
    plugin.addListener("registration", (payload) => {
      finish(
        typeof payload.value === "string" && payload.value.length > 0
          ? { token: payload.value }
          : { token: null, detail: "empty" },
      );
    }),
    plugin.addListener("registrationError", (payload) => {
      finish({ token: null, detail: osDetail(payload.error) });
    }),
  );
  /* THE LISTENERS ARE IN PLACE BEFORE THE REQUEST IS MADE. iOS emits the
     `registration` event without keeping it for a late listener, and APNs
     answers from its cache almost at once, so a token that arrived before
     the bridge had attached the listener was simply lost. */
  try {
    await Promise.all(handles);
  } catch {
    finish({ token: null, detail: "listener" });
    return answered;
  }
  clock.timer = setTimeout(() => finish({ token: null, detail: "timeout" }), 10_000);
  void plugin.register().catch(() => finish({ token: null, detail: "register" }));
  return answered;
}

/** The answer the shell last read from the operating system (F-15). */
let nativePermissionSeen: "granted" | "denied" | "default" | null = null;

function fromReceive(receive: NativeReceive): "granted" | "denied" | "default" {
  return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "default";
}

/**
 * F-15: the real notification permission on a handset, read WITHOUT asking.
 * `checkPermissions` never shows a prompt. Remembered so `currentPermission`
 * stops answering `default` to somebody who already said yes, which offered
 * them the Vallo explainer again.
 */
export async function readNativePermission(): Promise<"granted" | "denied" | "default" | "unsupported"> {
  if (typeof window === "undefined" || !looksNative()) return "unsupported";
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return "unsupported";
    const plugin = Capacitor.registerPlugin<PushPlugin>("PushNotifications");
    if (typeof plugin.checkPermissions !== "function") return "unsupported";
    const { receive } = await plugin.checkPermissions();
    nativePermissionSeen = fromReceive(receive);
    return nativePermissionSeen;
  } catch {
    return "unsupported";
  }
}

/**
 * F-14: at launch, a device that was enrolled before and still has the
 * permission re-registers silently, so a token APNs or FCM rotated is not left
 * stale until the provider answers "gone". It never prompts and never runs for
 * a device that was not enrolled on this install: the rule at the top of this
 * file (nothing before a Yes on the Vallo screen) holds. The server upserts
 * the same token, so an unchanged token is a no-op there.
 *
 * Returns what happened, for the boot log and the test; the person sees
 * nothing either way.
 */
export async function refreshNativeRegistration(): Promise<"refreshed" | "skipped" | "failed"> {
  if (typeof window === "undefined" || !looksNative()) return "skipped";
  if (!readLocalDevice()) return "skipped";
  try {
    const permission = await readNativePermission();
    if (permission !== "granted") return "skipped";
    const { Capacitor } = await import("@capacitor/core");
    const plugin = Capacitor.registerPlugin<PushPlugin>("PushNotifications");
    const answer = await nativeToken(plugin);
    if (answer.token === null) return "failed";
    const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
    /* A launch with no session (it expired, or the member signed out) keeps
       the record: forgetting it here meant the next sign-in had nothing to
       re-register, the OS permission was already granted so the Vallo screen
       never asked again, and the phone went quiet with no word anywhere. */
    const outcome = await postRegistration(
      { platform, token: answer.token, deviceLabel: platform === "ios" ? "iPhone" : "Android" },
      { keepWhenSignedOut: true },
    );
    return outcome.ok ? "refreshed" : "failed";
  } catch {
    return "failed";
  }
}

/**
 * THE WORKER THAT USED TO DO THIS JOB, TAKEN OFF ANY HANDSET THAT HAS IT.
 *
 * Push handlers were briefly served from `/api/push/sw` at scope
 * `/api/push/`, to avoid displacing the offline shell at `/`. They now live
 * in `public/sw.js`, and a stale registration at the old scope would hold a
 * push subscription of its own: the row in `push_tokens` would still be live,
 * the old worker would still display, and the person would get TWO
 * notifications for one event with no way to tell which worker to blame.
 *
 * So it is unregistered before the new subscription is taken. Unregistering
 * a registration also drops its push subscription, so nothing is left holding
 * an endpoint.
 *
 * WHETHER ANY DEVICE ACTUALLY HAS ONE: almost certainly none does, because
 * `enrolWeb` above returns `not_configured` and never reaches the register
 * call when there is no VAPID key, and no deployment has ever had one. This
 * runs anyway. "Almost certainly none" is not a thing to build on, and the
 * cost of being wrong is a duplicate notification on somebody's lock screen.
 */
async function retireLegacyPushWorker(): Promise<void> {
  try {
    const stale = await navigator.serviceWorker.getRegistration("/api/push/sw");
    if (!stale) return;
    if (!stale.scope.endsWith("/api/push/")) return;
    await stale.unregister();
  } catch {
    /* Nothing to do about it and nothing worth telling the person. The worst
       case is the duplicate this is trying to avoid, which is visible and
       which they can report. */
  }
}

async function postRegistration(
  body: {
    platform: "web" | "ios" | "android";
    token: string;
    p256dh?: string;
    auth?: string;
    deviceLabel?: string;
  },
  options: { keepWhenSignedOut?: boolean } = {},
): Promise<EnrolOutcome> {
  try {
    const response = await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    /* THE REGISTER CALL IS WHERE A MISSING SESSION NOW SHOWS UP. With the
       key route open, a home screen app with no session of its own gets the
       key, subscribes, and is refused here. That is "signed_out", not
       "not_saved": the fix is to sign in inside the app, and saying "try
       again in a moment" would send the person round the same loop. */
    const refused = replyFailure(response.status);
    if (refused === "signed_out" && options.keepWhenSignedOut) {
      return { ok: false, reason: refused, step: "register", detail: String(response.status) };
    }
    if (refused) return failedAndForgotten(refused, String(response.status));
    /* PACED IS NOT REFUSED. The route counts calls per account (30 an hour);
       a 429 says "not now", and the row the server already holds is still
       live, so the record of it is kept for the next try. */
    if (response.status === 429) {
      return { ok: false, reason: "not_saved", step: "register", detail: "429" };
    }
    if (!response.ok) return failedAndForgotten("not_saved", String(response.status));
    const result = (await response.json()) as { ok?: boolean; deviceRef?: string };
    if (!result.ok || typeof result.deviceRef !== "string" || result.deviceRef.length === 0) {
      return failedAndForgotten("not_saved", "no-ref");
    }
    /* THE ONLY PLACE A DEVICE IS RECORDED AS ON. The server has just said it
       holds a live row for this token and named it. See `device-state.ts`. */
    writeLocalDevice({
      deviceRef: result.deviceRef,
      endpoint: body.platform === "web" ? body.token : null,
    });
    return { ok: true, deviceRef: result.deviceRef, platform: body.platform };
  } catch (error) {
    return failedAndForgotten("not_saved", errorName(error));
  }
}

/* A failed registration also forgets any earlier one, so a stale record can
   never be the thing that lights the control after a refusal. */
function failedAndForgotten(reason: EnrolFailureReason, detail?: string): EnrolOutcome {
  clearLocalDevice();
  return { ok: false, reason, step: "register", ...(detail ? { detail } : {}) };
}

/**
 * The application server key, as the bytes `subscribe` wants.
 *
 * It arrives as base64url and `applicationServerKey` takes a buffer. Browsers
 * accept a base64 string in some versions and not others, and the failure is
 * an `InvalidCharacterError` that says nothing about which. Converting here
 * works everywhere.
 */
function urlBase64ToBuffer(base64Url: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  /* Built over an explicit ArrayBuffer and returned as one. A Uint8Array
     over a SharedArrayBuffer is not a `BufferSource` as far as the DOM types
     are concerned, and the difference only shows up at the call site. */
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) {
    view[index] = raw.charCodeAt(index);
  }
  return buffer;
}

/**
 * A name for this device, for its owner's eyes only.
 *
 * Coarse on purpose. It is shown back to the person so they can tell their
 * phone from their laptop on the settings screen, and it is never used to
 * identify anybody. A full user agent string would be a fingerprint stored
 * beside a token, which is a great deal more than the job needs.
 */
function browserLabel(): string {
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(agent)) return "iPhone or iPad";
  if (/Android/i.test(agent)) return "Android phone";
  if (/Macintosh/i.test(agent)) return "Mac";
  if (/Windows/i.test(agent)) return "Windows PC";
  return "This device";
}
