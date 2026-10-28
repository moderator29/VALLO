# Calls: audit of 27 October 2026 and the device test script

**Status, plainly: nothing here has been proven on a phone.** LiveKit, FCM and
APNs are unreachable from the build sandbox. What follows is what the audit
found, what was changed, and the exact test that will prove it.

## What the live database says (read 28 October 2026)

- `video_calls` and `admin_review_calls` are **on**.
- `public.calls` and `public.call_participants` **are** in the `supabase_realtime`
  publication, so the foreground ring has its channel.
- Only **3 calls have ever been placed, all CANCELLED**. No call has ever been
  answered on production.
- **`public.push_tokens` has 0 rows.** No phone or browser has ever enrolled for
  push. This is the first thing to fix for a ring that must reach a locked or
  backgrounded phone: with no token there is nothing to send to. The server end
  was checked (the register upsert was run against the live table and works), so
  the failure is on the device: permission, the Firebase file, or the plugin.
  Settings, Notifications shows a failure reference (for example
  `token/os-...` or `plugin`) when enrolment fails: **read it and send it.**
- Production's content security policy already allows `*.livekit.cloud` (checked
  against the live response header), so the signalling socket is not blocked.

## What was wrong, and what changed

| Finding | Change |
|---|---|
| The ring was two tones at a gain of 0.06 (barely audible) made from an audio context with no tap behind it, which Safari, WKWebView and Chrome leave suspended | Gain 0.3, and the first touch, click or key while the screen rings resumes the context (`components/calls/ring.ts`) |
| After Accept, remote audio can be blocked: the first remote track arrives several network round trips after the tap | `room.startAudio()` right after connect, and when the page still refuses (`AudioPlaybackStatusChanged`) the next touch anywhere unlocks it (`media/session.ts`) |
| Voice quality on a weak connection | Opus speech preset (24 kbps) with DTX and RED; video keeps simulcast |
| A ring push waiting for a phone that was off was held **four hours** by every transport, so it could open a dead call hours later, against the doc's own claim that it expires with the 45 second ring | The ring now carries a TTL of at most 45 s (FCM `ttl`, APNs `apns-expiration`, Web Push `TTL`), derived from the notification's own expiry (`lib/push/policy.ts`) |
| Android: a ring used the ordinary channel | A separate `vallo_calls` channel at the highest importance with vibration and lock-screen visibility, created at launch; ring pushes name it (`lib/native/push-taps.ts`, `transport/fcm.ts`) |
| iOS: a ring was an ordinary alert | `interruption-level: time-sensitive` on a ring (breaks through a Focus that allows it) |
| A failed call said only "did not connect": the catch blocks swallowed the cause | One log line per step and the error's name and message, never a token, URL or id (`lib/calls/diagnostics.ts`); read with `window.__valloCallLog()` in a remote inspector, and printed as `[call] ...` |

## What can still not work, by design (must not be claimed)

- No CallKit (iOS) or ConnectionService (Android): **a call cannot ring a
  closed or locked phone like a phone call.** It arrives as a loud push; the
  person taps it and the ringing screen opens (if within 45 s).
- That needs a native project (LiveKit Swift and Kotlin SDKs, PushKit and VoIP
  push, CallKit and ConnectionService). It is not built.

## Device test script (10 minutes, two phones, A calls B)

Prepare: install the **new** build on both (the Android channel is created by
the shell at launch; an iPhone needs nothing native for these web changes).
Sign in as two different test members who share a conversation. Allow
notifications when asked.

1. **Enrolment.** On each phone: Settings, Notifications. Expect "On". If it
   fails, copy the reference shown (for example `token/...`). After success, the
   database must show a row: `select platform, last_seen_at from public.push_tokens;`.
2. **Foreground ring.** Both apps open, B on any screen. A starts a voice call.
   Expect on B: the incoming screen, an **audible** two-tone ring and a
   vibration (Android). Touch the screen if silent: the ring should start at once.
3. **Answer.** B taps Accept. Expect on both: connected within about 5 seconds
   and **sound both ways**. If silent, tap anywhere once: sound should start.
4. **Video call** both ways, mute, camera off, camera switch, end. Camera light
   goes off on both.
5. **Background ring.** B backgrounds the app (home screen, screen on). A calls.
   Expect a heads-up notification on B with sound. Tap it: the ringing screen
   opens. On Android it must come through the **Calls** channel (long press the
   notification, or Settings, Apps, Vallo, Notifications: a "Calls" category).
6. **Locked ring.** Lock B's screen. A calls. Expect a lock-screen notification.
   Tap and unlock: ringing screen if within 45 s.
7. **Late push.** Put B in aeroplane mode, A calls and hangs up, wait 2 minutes,
   turn aeroplane mode off. Expect **no** ring notification for that call (it
   expired); at most the missed-call line in the conversation.
8. **Network change** mid-call (Wi-Fi to mobile data): "reconnecting", then back.
9. **Weak network** (a throttled hotspot): voice should hold at the speech
   bitrate; video drops quality before audio does.
10. **If a call does not connect**, connect the phone to a desktop inspector
    (Chrome `chrome://inspect` for Android, Safari Develop menu for iPhone) and run
    `window.__valloCallLog()`: the last step and its error name say where it broke
    (`join.capture_failed`, `join.token_refused`, `join.connect_failed`,
    `room.disconnected`, `audio.playback blocked`).
