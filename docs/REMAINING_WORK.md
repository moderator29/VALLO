# The 27 October brief: what is done and what is not (audit of 28 October 2026, updated later the same day)

Checked item by item against `docs/NEXT_SESSION_PROMPT.md`. "Done" means built,
checked in this sandbox and pushed. "Needs device" means built but only a phone
or a real account can prove it. Nothing here is merged to `main`.

## DONE

| Brief item | What exists |
|---|---|
| 0.3 SQL: `03-messages-body-length` | Applied and validated; recorded as `20261028085905` |
| 0.3 SQL: health check (`02`) | Ran 8 of its 11 queries (see "Not done" for the other 3); wallet guard present, `booking_is_paid` correct, no failed cron jobs |
| 0.3 New migration | `my_invite_step` applied, recorded (`20261028095359`), probed live |
| 1 `messageVenue` empty thread | Fixed by taking back a thread whose first message failed (not by a new RPC) |
| 1 `startTransition(async ...)` with no catch | `useSafeTransition` hook; 173 files converted; a dropped connection no longer reaches the error boundary |
| 1 Remaining raw uploaders | Documents (KYC), host documents, supply, agent application, support photos, tenancy evidence, arrival evidence moved to `uploadToStorage` |
| 2.1 Page sweep doc and a failing-on-overflow script | `docs/PAGE_SWEEP.md`; `sweep.mjs` (27 public pages, 270 combinations, all pass) and `preview-sweep.mjs` (289 harness routes, 1,445 + 867 loads) |
| 2.1 One responsive system, documented | `docs/DESIGN_DIRECTION.md` section 5 |
| 2 Stays home desktop and tablet | Four doors across, featured stays as a grid |
| 2 Admin desk tables at tablet width | Scroll inside their own box |
| 2.4 (part) Broken door images | `Icon3D` falls back to a branded glyph plate |
| 2.5 Unlock screen (web) | Device-specific words and glyph; passkey door hidden when the browser has no platform lock; centred on desktop |
| 3.1 Phone code screen | Six-cell input, paste and autofill, resend timer, clear errors |
| 3.1 Wallet opens by itself after verification | Idempotent provisioning, confirmed phone counts, screen sets itself up |
| 3.2 Referral end to end | Audited against the live database; invitee next-step card; `docs/referral/END_TO_END.md` |
| 3.3 Calls (what can be done without a device) | Audible ring, audio unlock, speech-tuned Opus, ring push TTL 45 s, Calls channel, iOS time-sensitive, failure log, `DEVICE_TEST_SCRIPT.md` |
| 4 `docs/FEATURE_BACKLOG.md` | 56 rows with status, value, effort, priority |
| 4 Play readiness walk | No repo gap found; every open item is a credential or a Play Console step |
| 0.3 / 4 Database seams audit (health check 2, 8, 9) | Run. No per-row `auth.uid()` policies; the 21 anon-callable definer functions are public directory, leaderboard and token reads, judged deliberate; 29 foreign keys on growing tables indexed (`20261028132808`); the owner-rights views left as public projections. Recorded in `docs/security/GRANT_STATE.md` |
| 1 / 4 Every raw uploader | Avatar, cover, listing video poster and the two signed-URL uploads (inspection and claim evidence) moved; the uploader gained a tested signed-PUT mode |
| 2.4 Broken pictures everywhere | One guard in the root layout (`ImageFallbackGuard`): any failed `<img>` becomes a quiet tile, including ones that failed before the page woke |
| 2.1 Sheet as a desktop dialog | From 64 rem with a mouse a bottom sheet is a centred dialog; phone, tablet, side panel and page sheets unchanged |
| 2.1 Master-detail for messages | Already existed (`nf-msg-split`, inbox pane beside the thread) |
| 29 Oct: payments partner never named to members | "Our licensed payments partner" platform-wide (wallet, held payments, receipts, chargebacks, three languages); a guard test stops it returning; staff-only admin and code identifiers keep the name |
| 29 Oct: Copy address and Open in Maps | On the listing, stay and restaurant map panels; copies only what the page already shows (the area for a home; the exact address stays private until a viewing is confirmed); the map link uses the area point |
| 29 Oct: 01-cleanup-now.sql parts 1 to 3 | Run by Seyi; cron job active, test functions and retired objects gone, live replacements intact |
| Extra: social links | Facebook, Instagram, TikTok, LinkedIn as blue and white icons in the footer (landing and all public pages), Contact and Settings, plus `sameAs` |
| Hygiene | Tests, lint and gates green (13,660 tests, 0 lint errors); fixed red items left from before |

## 29 OCTOBER, LATER: what the device tests changed (all merged to main except the last block)

- **Calls.** The mic error ("AudioSession category is not compatible with audio capture") came from the ring leaving Safari's audio session "ambient"; the ring no longer touches it, capture asks for play-and-record and retries once, and the session is handed back after a call. Accept, decline and end answer on the tap (the server hears in the background; `markLocallyOver` stops a late "still ringing" redrawing a hung-up call). The caller sees their own mirrored camera before anyone answers. The speaker button is phone-only and says Speaker or Phone. "Calling" until the callee's app shows the ring, then "Ringing" (`call_participants.ring_delivered_at`, `call_ring_delivered`). The caller's photo is on every call screen. A missed call is a quiet push (`vallo_missed` Android channel).
- **Messages.** No name above bubbles, bare header glyphs, no "Direct message" or "Phone confirmed" lines, and on desktop the thread fills its pane with a thin scrollbar.
- **Videos.** `SafeVideo` (retry once, a sentence and an open link, muted autoplay fallback, first frame on iOS) everywhere a non-call video plays; Show Me clips are size-checked, location-stripped and no longer freeze the button. An expired signed link is refreshed once (`refreshMediaUrl`, buckets allow-listed, signed under the caller's own session).
- **Push enrolment.** `push_tokens` is still empty, so the cause is on the device. Every attempt now writes a reference (step and error name, never a token) to `public.push_enrol_log` through `/api/push/enrol-log`: read it with `select created_at, platform, ok, reason, step, detail from public.push_enrol_log order by created_at desc;`.
- **Sign-up phone step.** A new account (made on or after 29 October 2026) confirms a mobile number at `/sign-up/phone` before any member screen, while a code can actually arrive: the `phone_confirmation` flag is on (applied) and the step appears as soon as `TERMII_API_KEY` and `TERMII_SENDER_ID` are set in Vercel. With no vendor wired nobody is locked out.
- **Idle lock.** Already stricter than 30 minutes: the passcode locks after 5 minutes idle or hidden, a new tab or a reopened app asks for it at once, and the server's unlock lapses at 15.
- **Founder items.** Termii keys in Vercel; the iPhone and Android push references (or read `push_enrol_log`); Apple review; translations (ha, ig, yo); LinkedIn `/in/` versus a company page; `01-cleanup` part 4.

## NEEDS A DEVICE OR A REAL ACCOUNT (built, unproven)

1. Calls: ring, answer, sound both ways, background and locked ring, late push (`docs/video-calling/DEVICE_TEST_SCRIPT.md`).
2. Push enrolment: `push_tokens` has 0 rows; the failure reference on the phone says why.
3. Wallet opening at Payluk after a real phone confirmation (Payluk is unreachable from here).
4. Invite flow with a real invitee and a real SMS code.
5. Signed-in screens in light and dark at the five widths (217 pages marked "needs session").
6. Settings "Follow Vallo" group (signed-in, not seen).
7. The invite next-step card (not seen on screen).

## NOT DONE

| # | Item (brief section) | Why it is open |
|---|---|---|
| 1 | ~~Apply `01-cleanup-now.sql` parts 1 to 3 (0.3)~~ | **Done 29 October by Seyi in the dashboard and confirmed in the database.** (Was blocked on the connector.) It stops on any `DELETE` or `DROP` and asks a confirmation that never reaches the session, twice. Approve the Supabase prompt when it appears, or paste the file in the dashboard SQL editor. Part 4 (old renter passport) waits for the deploy |
| 6 | Research current best practice with web search (2.1 step 2) | Not done |
| 8 | Light theme rebuild in `tokens.css`: surface layers, solid blue, contrast checks, dark-only assets (2.2) | Not done; public pages looked right, signed-in ones unseen |
| 9 | Stickers, icons, empty states, skeletons audit and one consistent set (2.3) | Not done |
| 11 | Native biometry type via the Capacitor plugin (2.5) | Needs a native build |
| 12 | Containers, buttons, forms, sheets audit; logo placement audit; landing page redesign; remove backend-only labels from the front end (2.6) | Not done |
| 13 | Country code picker in the phone screen (3.1) | Nigeria only: the server accepts Nigerian numbers only, so a picker would be a control that cannot act |
| 14 | Wallet screen audit for a clean balance and actions; remove backend-only options (3.1) | Not done |
| 15 | Calls: TURN and ICE review, iOS notification category, Android full-screen intent and ConnectionService, PushKit and CallKit (3.3) | Review not done; the rest need a native project |
| 16 | Find the cause of push enrolment failing on every device (3.3) | Needs a phone and the failure reference |
| 17 | Measure app open speed against 0.5 s (4) | Not measurable from the sandbox |
| 18 | Database seams audit: RLS, indexes, foreign keys, search paths, storage policies, silent server actions (4) | Only the health check was run |
| 19 | Build the 50 to 60 features (4) | Backlog written, none built |
| 20 | Hausa, Igbo, Yoruba: new unlock, wallet and invite strings are English | Needs a translator |
| 21 | Double audit on every area (rule 4) | Pass 1 (build, tests) done each time; pass 2 (adversarial read) done on the main changes, not on all 173 converted files |
| 22 | LinkedIn address is a personal `/in/` profile, not a company page | Founder to confirm |

## Founder items (section 5, not mine to decide)

Kareem's name order; Apple review result (inquiry due from 28 October 10:00); CAC share transfer filing; Paystack live activation and SCUML; moving the Vercel project; rotating every credential pasted in chat.
