# The 27 October brief: what is done and what is not (audit of 28 October 2026)

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
| Extra: social links | Facebook, Instagram, TikTok, LinkedIn as blue and white icons in the footer (landing and all public pages), Contact and Settings, plus `sameAs` |
| Hygiene | Tests, lint and gates green (13,660 tests, 0 lint errors); fixed red items left from before |

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
| 1 | Apply `01-cleanup-now.sql` parts 1 to 3 (0.3) | The connector waited on a confirmation for `DELETE`; Seyi pastes it in the dashboard. Part 4 waits for the deploy |
| 2 | Health check queries 2, 8 and 9 (0.3): anon-executable definer functions, per-row `auth.uid()` policies, foreign keys with no index | Not run |
| 3 | Seven views that run with owner rights (health check finding) | Needs a decision whether intended |
| 4 | Remaining raw uploaders: profile avatar and cover in `AccountHero.tsx`, the listing video poster in `ListingWizard.tsx`, and the two signed-URL uploads (`InspectionSheet`, `AgreementControls`) (1, 4) | Not migrated; signed uploads need a signed-URL variant of the uploader |
| 5 | Test every upload path end to end, and resumable video (4) | Not tested |
| 6 | Research current best practice with web search (2.1 step 2) | Not done |
| 7 | `Sheet` becomes a centred dialog or side panel on desktop; lists become master-detail (2.1 step 3) | Not done |
| 8 | Light theme rebuild in `tokens.css`: surface layers, solid blue, contrast checks, dark-only assets (2.2) | Not done; public pages looked right, signed-in ones unseen |
| 9 | Stickers, icons, empty states, skeletons audit and one consistent set (2.3) | Not done |
| 10 | Every `<Image>` and `<img>` with an aspect box, placeholder and fallback, lazy below the fold (2.4) | Only the 3D door art is done |
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
