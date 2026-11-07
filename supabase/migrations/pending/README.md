# What is waiting in pending/ (Survey B, D-09)

Nothing here runs by itself and `check-migrations` ignores this folder. Each
file is pasted by the founder in the Supabase SQL Editor, then the lead checks
it live, moves it to `supabase/migrations/` under its stamped version and
records it in `APPLIED.txt`.

| File | Owner | Decided | Status |
|---|---|---|---|
| `grade1_push_drain_kick_on_enqueue.sql` | Lead | Founder, 7 Nov 2026 (push in seconds) | Sent to the founder as 1-fast-notifications.sql. Waiting. |
| `grade1_staff_sign_in_alerts_only_new_device.sql` | Lead | Founder, 7 Nov 2026 (alerts only on a new device) | Sent as 2-quiet-sign-in-alerts.sql. Waiting. |
| `grade1_voice_notes_and_message_reactions.sql` | Lead, for Agent MSG | Founder, 7 Nov 2026 (voice notes kept for ever, reactions) | Sent as 3-voice-notes-and-reactions.sql. Waiting. |
| `grade1_crash_log.sql` | Lead | Founder, 7 Nov 2026 (own crash log in admin) | Sent as 4-crash-log.sql. Waiting. |
| `newsletter_default_on_2026-11-launch.sql` | Founder | Founder, 4 Nov 2026 | Data, run once by hand. Do not run without the founder's word. |
| `rt01_remove_retired_objects.sql` | Lead | Draft, 13 Oct 2026 | DROPS objects. Never run without the founder's explicit yes. |
| `rt02_remove_v100_renter_passport.sql` | Lead | Applied by hand 29 Oct 2026 | Kept as the record only. Do not run again. |
| `LANDMARKS.md` and `rollback/` | Lead | | Reference only. |
