/**
 * CALL-KIT BRIDGE SPEC: what the JS side sends to the native shell for
 * CallKit (iOS) and ConnectionService / full-screen call intent (Android),
 * and what the native side sends back.
 *
 * The web layer owns the call lifecycle (call-store, CallLayer, CallStage);
 * the native layer owns the OS call UI (the lock-screen answer button, the
 * system call screen, the audio route, the proximity sensor, and the
 * "ongoing call" status bar). This file is the contract between them.
 *
 * Neither side stores the token. Join credentials stay in CallStage's
 * closure; the native side never sees them. The bridge carries only what the
 * OS needs to draw and route the call, never a secret.
 *
 * IMPLEMENTATION NOTE: the native Swift (CXProvider) and Kotlin (notification
 * + AudioManager) plugins live in `native/ios/ValloCallKit/` and
 * `native/android/vallocallkit/`. After `cap sync`, copy them into the
 * generated native project per `native/README.md`. The native plugins
 * register under the name "ValloCallKit" on both platforms.
 */

import type { CallKind, CallRole } from "@/lib/calls/types";

/* ------------------------------------------------------------------ types */

/** What the web side tells the native shell about a call that just started. */
export type ReportNewCallPayload = {
  /** The Vallo call id (a UUID). The native side uses it as the CXCall UUID on iOS. */
  callId: string;
  /** The other person's display name, for the lock screen and the system call UI. */
  displayName: string;
  /** Whether video is part of the call. Tells CallKit to offer the video button. */
  kind: CallKind;
  /** This person's role: the system UI labels it "incoming" for callee/subject. */
  role: CallRole;
  /** True when this person placed the call (outgoing on the system UI). */
  isOutgoing: boolean;
  /** The other person's profile photo URL, for the Contacts-style circle on
   *  Android's full-screen intent. iOS uses the Contacts framework instead. */
  avatarUrl: string | null;
  /** Whether the call supports holding (always false for Vallo 1.x). */
  supportsHold: boolean;
  /** Whether the call supports grouping (always false for Vallo 1.x). */
  supportsGrouping: boolean;
};

/** Audio session configuration for the native side. */
export type AudioSessionConfig = {
  /** "voiceChat" on iOS (AVAudioSession.Category), "communication" on
   *  Android (AudioManager.MODE_IN_COMMUNICATION). The native side picks
   *  the right constant for its platform from this single value. */
  mode: "voiceChat" | "videoChat";
  /** The initial output: "earpiece" for a voice call, "speaker" for video. */
  preferredOutput: "earpiece" | "speaker";
};

/** Mid-call updates the web side pushes to the native shell. */
export type UpdateCallPayload = {
  callId: string;
  /** The call connected: start the system timer and switch to the connected state. */
  connected?: boolean;
  /** The call ended: tell the OS to tear down. */
  ended?: boolean;
  /** The end reason, as CXCallEndedReason / DisconnectCause. */
  endReason?: "remoteEnded" | "failed" | "unanswered" | "declinedElsewhere" | "answeredElsewhere";
  /** The other person's mic mute changed (drawn on Android's notification). */
  remoteMuted?: boolean;
  /** Audio route changed from the web side (speaker toggled in the glass sheet). */
  preferredOutput?: "earpiece" | "speaker";
};

/** Events the native shell fires back to the web side. */
export type NativeCallEvent =
  /** The user answered on the lock screen or the system call UI. */
  | { event: "answerCall"; callId: string }
  /** The user declined or ended from the system UI. */
  | { event: "endCall"; callId: string }
  /** The user toggled mute from the system UI (CarPlay, AirPods long press). */
  | { event: "setMuted"; callId: string; muted: boolean }
  /** The user toggled the speaker from the system UI. */
  | { event: "setAudioRoute"; callId: string; output: "earpiece" | "speaker" | "bluetooth" }
  /** The user tapped the video button on the CallKit UI (iOS only). */
  | { event: "setVideo"; callId: string; on: boolean }
  /** Audio session was interrupted (another app took it). */
  | { event: "audioInterrupted"; callId: string }
  /** Audio session resumed after an interruption. */
  | { event: "audioResumed"; callId: string };

/* ---------------------------------------------------------- the bridge */

/**
 * The Capacitor plugin interface. Registered as "ValloCallKit" on both
 * platforms. Each method returns a promise that resolves when the native
 * side has processed it; the web side does not wait for the OS call UI to
 * finish its animation.
 */
export interface ValloCallKitPlugin {
  /** Report a new call to the OS. iOS: `CXProvider.reportNewIncomingCall` for
   *  incoming, `CXCallController.requestTransaction` with a start action for
   *  outgoing. Android: starts the full-screen call activity for incoming,
   *  or the in-app call notification for outgoing. */
  reportNewCall(payload: ReportNewCallPayload): Promise<void>;

  /** Configure the audio session before media capture starts. iOS:
   *  `AVAudioSession.setCategory(.playAndRecord)` with the right mode.
   *  Android: `AudioManager.setMode`. */
  configureAudio(config: AudioSessionConfig): Promise<void>;

  /** Push a mid-call update to the OS. The fields that are set are the
   *  ones that changed. */
  updateCall(payload: UpdateCallPayload): Promise<void>;

  /** The web side is done with this call. The native side ends its
   *  CXCallAction / ConnectionService connection if it has not already. */
  endCall(payload: { callId: string }): Promise<void>;

  /** Ask whether CallKit / ConnectionService is available on this device
   *  and version. Returns false in a browser, on a simulator with no
   *  telephony, or when the entitlement is missing. */
  isAvailable(): Promise<{ available: boolean }>;

  /** Register a listener for events from the native call UI. */
  addListener(event: "callEvent", handler: (event: NativeCallEvent) => void): Promise<{ remove: () => void }>;
}

/**
 * The data the native side needs from a VoIP push (iOS PushKit, Android
 * high-priority FCM data message) to show the system call UI before the
 * web view is awake. This is what the push payload carries for a call ring.
 *
 * iOS: the Notification Service Extension hands this to CXProvider;
 * Android: the FirebaseMessagingService starts the full-screen intent.
 */
export type VoipPushData = {
  /** Always "vallo_call". The native side checks this before acting. */
  type: "vallo_call";
  callId: string;
  callerName: string;
  callerAvatarUrl: string | null;
  kind: CallKind;
  /** ISO timestamp: the ring expires and the push should be discarded. */
  ringExpiresAt: string;
  /** The deep link the tap opens: `/messages/<id>?call=<callId>`. */
  href: string;
};
