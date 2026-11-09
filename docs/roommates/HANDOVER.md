# Vallo Roommates and Trust and Safety: handover

Branch `claude/fervent-cray-1vzbp1` (draft PR #110, not for merging; CI only).
Updated as the work lands. Sections marked LIVE describe code on the branch;
nothing here claims a device test or a production run that did not happen.

## 1. The one thing the founder does

Paste `supabase/migrations/pending/ROOMMATES_ALL.sql` into the Supabase SQL
Editor and press Run, once. It is safe to run twice and deletes nothing.
Until then every Roommates and Trust and Safety page says "not open on this
server yet" (never sample data).

After it runs, the next session records it: move the file to
`supabase/migrations/20261109000000_roommates_all.sql` and run
`node scripts/check-migrations.mjs --record` on it (the SQL already writes
that version into the live migration list).

What it contains, in order:

| Part | What |
|---|---|
| 0 | Four staff scopes: trust_safety, roommates, circle, analyst |
| 1 | Tables and RLS: institutions, roommate profiles, room posts, interests, groups (members, shortlist, votes, board, costs), viewings, verifications, email codes, saved searches; storage buckets roommate-photos (public) and roommate-evidence (private); saved collections take roommate kinds; a direct chat is allowed between two connected roommates |
| 2 | The matching engine and every read and write (SECURITY DEFINER, caller checked), notifications with the sender's face, saved search alerts, nightly expiry |
| 4 | Write grants on ten Circle tables tidied to match their policies (no change to what members can do; probe db-06) |
| 3 | Feed column for roommate posts, "Good for sharing" on property listings, two Circle categories and three Vallo communities |
| 5 | The schools directory: 55 schools, 50 email domains confirmed from public sources |
| 7 | Trust and Safety: cases, case timeline and evidence, restrictions enforced in the database, appeals, the admin reads and writes, the overview numbers |
| 6 | Bookkeeping: the migration list records this drop and three hand-run migrations of 8 November |

Tested on a local Postgres with the touched parts of the live schema
(`supabase/tests/roommates/local_stub.sql`, then `e2e.sql`,
`e2e_feed.sql`, `e2e_trust.sql`): all pass, twice over.

After the paste, add these to the write-grant allowlist in
`supabase/tests/probes/db-06.sql` (they match the policies exactly):
`institutions idu`, `roommate_group_expenses idu`, `roommate_group_posts id`,
`roommate_group_shortlist id`, `roommate_group_votes idu`,
`roommate_groups u`, `roommate_listings idu`, `roommate_match_weights u`,
`roommate_profiles idu`, `roommate_saved_searches idu`,
`roommate_verifications u`. Every other new table is read-only to members
(writes go through functions).

Four database probes fail on the LIVE data today, before any of this work
is applied, and are not code faults on this branch: `b3-rate-gate` (no
non-demo draft listing exists to exercise), `db-10-step2` and
`new-a4-01-step2` (the SCUML item 17 mandate rule now refuses the probe's
test listing), `db-p2-02` (one probe-raised alert is still open in
`/admin/alerts`; closing it clears the probe).

## 2. Supabase settings after the paste

- Storage buckets are created by the SQL (roommate-photos, roommate-evidence,
  moderation-evidence). Nothing to click.
- The nightly expiry job is scheduled by the SQL when pg_cron is on (it is).
- Staff: a super admin grants the new scopes from `/admin/staff` as usual.
- Email codes use the existing Resend setup (RESEND_API_KEY, EMAIL_FROM).
  No new environment variables.

## 3. Routes

Member: `/roommates` (home), `/roommates/discover` (people, rooms),
`/roommates/p/[userId]`, `/roommates/r/[id]` (+ `/edit`), `/roommates/new`,
`/roommates/profile`, `/roommates/me`, `/roommates/groups`,
`/roommates/groups/new`, `/roommates/groups/[id]`, `/roommates/split`,
`/roommates/verify`, `/roommates/campus`, `/roommates/campus/[slug]`,
`/roommates/nysc`, `/roommates/safety`, `/settings/standing`.

Lister: `/agent/listings/[listingId]/sharing`.

Console (Moderation group): `/admin/cases`, `/admin/cases/[id]`,
`/admin/trust`, `/admin/appeals`, `/admin/roommates`, `/admin/circle`, and
Standing on `/admin/people/[id]`.

Entry points (navigation structure unchanged, rows added): side nav row
after Circle, Profile row, the Create sheet, the Circle home, the feed card,
the property listing page ("Find roommates for this home", "Roommates
sharing here", "Add to group shortlist").

Dev only: `/preview/features/roommates?screen=...` (fictional data).

## 4. Security summary

- People are shown to each other only through database functions that mask
  hidden fields, exclude blocked people and require an active profile.
- Chat only on a mutual yes; the existing message scanner and block rules
  apply unchanged.
- Members can never mark themselves verified (service-role writes after
  checks; codes hashed, five tries, fifteen minutes).
- Verification documents: private bucket, five minute links, kyc_review and
  trust_safety only, every opening audited.
- Staff permissions: `private.case_can` in the database; the screens draw
  buttons from the same answer. Details: `ADMIN_TRUST_SAFETY.md`.

## 5. Testing status

| Check | State |
|---|---|
| SQL end to end on local Postgres | PASS |
| CI Build (includes the claims guard) | PASS |
| CI Advisories (production dependencies) | PASS |
| CI iOS compile (unsigned, simulator) | PASS |
| CI Android debug build | PASS |
| CI Database probes | 124 of 129; db-06 passes after the paste, the other four are live-data states (section 1) |
| Type-check, lint, unit and guard tests | being finished by the agents; see the PR's latest run |
| Screenshots of the real screens | rounds 1 and 2 sent (preview harness, fictional data) |
| iOS and Android devices | NOT TESTED on a device (Capacitor build not run in this session) |

## 6. The 9 November design round (the founder's review pass)

After the first screens shipped, the founder reviewed them and asked for a
deeper pass. All of this is on the branch:

- **Roommates rebuilt** on a shared motion primitive (`MotionScene`): the hero
  is a living scene (the people art over a blurred room, floating 3D objects, a
  spring entrance, a slow breathe, pointer and tilt parallax), the "Your post
  is live" celebration drops the 3D house and bursts confetti once, the
  first-run and promo banners animate, and the verification screen carries the
  same banner. All of it is off under reduced motion / Calm / save-data, and it
  is contained to these feature areas (the app launch screen is untouched).
- **Vallo Circle rebuilt**: the clipped hero and empty tab pill are fixed, the
  hero carries the real community art with an avatar stack and a counting
  member number, the destinations are a grid of 3D icon tiles with whole-word
  labels, and the thread, community cover and post flow (with a "Posted!"
  moment and a type picker) are restyled.
- **Notifications**: every Roommates, Trust and Safety and Circle event lands
  in the inbox in the right lane, with the sender's face, a deep link and an
  action, plus lock-screen wording and an in-app message banner.
- **The feature art**: the founder's seven commissioned images are wired into
  `lib/features/art.ts` (`public/brand/features`, WebP 1x and 2x).
- **Share cards** (`components/share/ShareComposer.tsx`, `ShareSheet.tsx`): our
  own pump.fun-style share card in Vallo blue, opened from the real Share
  controls on a profile, a roommate listing, a roommate profile and a Circle
  post. Background presets (brand auroras + the lister's own photo), a Darken
  toggle, "what to show" toggles, variant tabs, a tinted-initials fallback, and
  the `MediaPill` capsule buttons. The forwarded link is the short Vallo one
  (`/u/<handle>`, `/roommates/r/<id>`, `/circle/p/<id>`); the roommate listing
  card unfurls fully as an image in a chat. **Open decision for the founder:**
  the profile and Circle *pages* are sign-in gated, so their cards do not
  unfurl externally yet; opening `^/u/<handle>$` and `^/circle/p/<id>$` to the
  public (as `/roommates/r/<id>` already is) would fix that, but it makes those
  pages publicly viewable, so it waits on a yes and a public-data check.
- **Icons**: the generic key is now the Vallo house key platform-wide; `search`
  is redrawn to the App Store magnifier; a new `stack` glyph (the App Store
  "Apps" look) leads the Saved "All" tab; content icons are one step smaller
  platform-wide (nav rails unchanged).
- **The chat watermark**: Vallo's mark rests faint behind a quiet assistant or
  messages thread and clears when the conversation starts.

The spec that drove the share and controls work is
`docs/design/SHARE_AND_CONTROLS.md`; the ChatGPT prompts for the art are in
`docs/design/CHATGPT_BANNER_PROMPTS.md`.

## 7. Known limitations

- The profile and Circle share cards do not unfurl externally yet (the open
  decision above).
- Group chat is a group board, not a real-time chat thread (Vallo's
  conversations are two-person).
- Paying each other inside a household is recorded only; Vallo never moves
  that money.
- Two-person approval for permanent suspensions is proposed, not built.
- A property listing's "Good for sharing" is set from the lister's own page,
  not yet inside the listing wizard.
- Native: NOT tested on a physical device in this session (the iOS and Android
  builds compile in CI; the iOS job also hits an occasional Swift Package
  Manager cache flake unrelated to the app).
