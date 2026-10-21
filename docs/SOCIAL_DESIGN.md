# AROUND: the social layer, argued from first principles

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

> **This shipped. It is the design record, not a plan.** Corrected 2026-08-09.
> The line "Nothing here is built" below was true on 2026-08-04 and false the
> same week. Live on 2026-08-09: `areas` 7, `posts` 18 (every one
> `author_kind = 'SYSTEM'`, the designed cold start), plus `area_members`,
> `area_moderator_applications`, `social_profiles`, `follows`, `post_media`,
> `post_reactions`, `post_reposts`, `post_views`, `blocks`, `mutes`, `stories`
> and its four companion tables, `events`, `event_attendees`, `badges` and
> `user_badges`. Routes: `/around`, `/around/[slug]`, `/around/new`,
> `/around/manage`, `/around/settings`, `/u`, `/u/[handle]` with its follower
> views, `/post/[id]`, `/stories/[id]`, `/stories/new`, plus `/admin/social`,
> `/admin/moderation` and `/admin/standing`.
>
> Read this to understand WHY the layer is shaped as it is, and read the
> **AMENDMENT** immediately below before anything else, because it records where
> the owner overruled the design. What is still open is
> `RECOMMENDATIONS.md` section 9.

My own recommendation, written after reading `docs/archive/SOCIAL_TODO.md`,
`docs/archive/SOCIAL_LAYER.md`, `docs/BADGES.md`, the full recommendations body,
the gap and dead-end audits, the token system and the live database. All three of
those source documents are now in `docs/archive/` and govern nothing.

The build order that followed from this was `docs/archive/SOCIAL_BUILD.md`. Its
112 checkboxes were never ticked and mean nothing: read the database.

---

## AMENDMENT, 2026-08-04: the owner redirected the design. Read this first.

Two visual passes were built and shown. Both were rejected, and the corrections
below **override this document wherever they disagree with it**. They are
recorded here rather than quietly applied, because a design document that does
not carry the moment it was overruled is a document nobody can trust twice.

**Pass one was too clever.** A vertical "spine" threading every card, notched
corners, node shapes encoding author kind. The owner's judgement: it is an
information-design exercise, not a social product people will use.
**Section 7 of this document is CUT in full.** No spine, no notch, no nodes.

**Pass two was too derivative.** Clean floating cards, but built from X's icon
set and X's furniture, so it read as a dark-mode clone.

**What is wanted:** an ordinary, legible, modern social layer where the LAYOUT is
familiar and the MATERIAL is unmistakably ours. In the owner's words: normal
social layer, people connecting with each other, clean, refined, and it should
look like something that has not existed yet.

The binding corrections:

| Was | Now |
|---|---|
| No follows, standing comes from Correct marks (section 5.3) | **`follows` is back.** Profile stats are Followers, Following, Posts, and counts are public. Applied in `20260804123000` |
| "Seen by 41 around here" as a sentence | A plain **view count**, a mark and a number, in the action row |
| The Spine, the notch, the node system (section 7) | **Cut entirely.** Independent floating cards, 20px radius, 12px gaps |
| No cover photo | **Cover photo, full bleed, BEHIND the profile**, running under the header with the avatar overlapping it from below. Not a floating card in front of the page |
| Reactions: Like, Correct, I dey, Na lie, Save | **Like, Reply, Repost, Views, Share**, plus Save inside the `…` menu |
| Bookmark icon in the card header | **Removed.** The header carries name, handle, time and `…`, nothing else |
| No per-post menu | A `…` popover on every card: Copy link, Save, Not interested, Report post, Mute, Block |
| The State Bar, four cells reading "Light On / Water Running / Road Slow / Safe Quiet" | **Cut.** The owner called it gibberish and is right: a row of two-word status chips reads as debug output. Place state becomes prose in context, never a chip row |
| Areas curated by admins only | **Anyone may propose a place**, an admin approves it, and only then is it public. Members may **apply to moderate** a place they are in. A moderator may hide a post and may **never** delete one. Applied in `20260804120000` |

**Two things carry forward unchanged and they are the ones that matter.**

1. **The stride is the differentiator, not a motif.** ADR-012: every container in
   this product carries a luminous gradient ring on the border box while the fill
   sits on the padding box, brightest at the upper left, matching the light
   direction of the commissioned icon family. Post cards use it. That is what
   makes the feed read as Vallo rather than as a clone, and it is already built.
2. **The reaction marks are an original geometric family**, drawn on a 24 grid
   from three primitives and nothing else: a stroke, a node, a gap. No outline
   heart, no speech bubble, no two-arrow recycle, no eye. Section 7.4's reasoning
   for refusing a nsibidi-derived set still stands; only the drawing changed.

Everything below this line predates the redirect. Sections 3, 5, 6, 8, 10 and 11
are unaffected. Section 7 is void. Section 5.3's cut of `follows` is reversed.

---

~~Nothing here is built. This is for the owner to approve, reject or redirect.~~
**It was approved, redirected once (see the amendment above), and built. Struck
through rather than deleted, because this sentence was still on the page five
days after the layer shipped and it is exactly the kind of line that sends a
fresh session off to rebuild a subsystem.**

---

## 0. The five things I would change, in order of how much they matter

1. **One table, not two.** `gists` and `talks` as separate tables forces a
   `target_type` column into every reaction, repost, report and moderation row
   in the product. One `posts` table with `parent_id` makes the owner's
   headline requirement, liking and reposting and replying to the AI's reply,
   structurally free rather than carefully arranged. Section 5.
2. **A third author kind: `SYSTEM`.** The plan solved the bot correctly with
   `author_kind`. Take it one step further and the cold start problem, which
   the handoff calls the single most likely cause of failure, dissolves. A
   place is never empty because the platform itself posts what it already
   knows. Section 3.
3. **The word "compound" has to go.** In Nigerian property a compound is a
   walled plot with units inside it. We are a property platform. Naming an
   entire area a compound creates a permanent collision with the thing our
   listings actually sit in, and calling Yaba a compound is not how anyone
   speaks. Section 4.
4. **Speak plainly where the action is universal, and speak Nigerian where
   the mechanic is Nigerian.** Like, Reply, Repost, Views, Save: plain. Light,
   I dey, Na lie, Wahala, gist: ours. Half the plan's lexicon is a platform
   performing Nigerianness at people. Section 4.
5. **Do not ship a "spirit of nsibidi" mark set.** Nsibidi is a real script
   with restricted, initiatory contexts. Drawing "in its spirit" for a like
   button is the shallow version the handoff warned about. Design an original
   geometric set from our own geometry, which we can own outright and which
   needs no cultural claim. Section 7.4.

---

## 1. What the current plan gets right, and keeps

These four are load-bearing and I would not touch them.

- **Place-rooted inversion.** You do not follow strangers, you open a place.
  Vallo owns place with verified homes inside it. No global network can copy
  this without our inventory. Everything else serves it.
- **The utility wedge.** Is there light, is there water, is the road passable,
  is it safe. Four questions that govern a Nigerian day, no structural answer
  anywhere, and the aggregate becomes the most valuable unpurchasable fact in
  Nigerian property.
- **A bot reply is just a reply.** Same table, same id space, same code paths.
  Getting this wrong is a rewrite.
- **The three refusals.** No infinite scroll, no public follower counts, no
  stranger DMs by default.

---

## 2. Three assumptions in the current plan that are false against the live database

Verified directly against project `uccixoonmbhrnyczyigt` before writing this.
Each would have failed at migration time.

| Plan says | Reality | What we do instead |
|---|---|---|
| `handle citext unique` | `citext` is **not installed**. Enabling extensions on this project has been blocked before, which is exactly why `pg_cron` is still off | `handle text` stored lowercase, a `unique` index on the column, and a check constraint `handle ~ '^[a-z][a-z0-9_]{2,19}$'`. No extension, no dependency on a toggle we do not control |
| `centre geography(point)` | `postgis` is **not installed** | `centre_lat numeric` and `centre_lng numeric`, exactly as `public.listings` already stores its coordinates. Consistent with the platform, no extension |
| Gist expiry waits on `pg_cron` | `pg_cron` is **not installed** and attempts to enable it have been blocked | Expiry becomes a **read-time filter**, `where expires_at is null or expires_at > now()`. Nothing in the social layer blocks on cron. Cron improves the nightly rollup; it gates nothing |

A fourth, found the same way: `public.notification_kind` has no `social`
value, and in Postgres a newly added enum value **cannot be used in the same
transaction that adds it**. So adding it and using it must be two separate
migrations. This is the class of thing that applies cleanly and then fails at
runtime, which section 6 of the handoff is entirely about.

A fifth, in our favour: `public.reports.target_type` is already `text`, not an
enum, so social target types need no migration at all.

---

## 3. The cold start, which is the real risk

A place with four members and no posts is a dead room, and a dead room kills a
social product faster than any other single cause. The current plan has no
answer. Seeding fake content is forbidden by the owner's own rule 13 and would
be right to forbid.

**The answer is that the platform is a participant.**

`author_kind` gains a third value, `SYSTEM`. A system entry is a real row in
`posts`, written by a trigger or a server action from something that genuinely
happened, and it is likeable, replyable, repostable and reportable like any
other. It has no author and never pretends to have one.

Six system entries, every one sourced from a row that already exists or is one
migration away:

| Entry | Fired by | Why it earns its place |
|---|---|---|
| **This area opened.** "Around Yaba is open. 6 stays are listed here." | Area creation | The first entry in every area, ever. The room is never empty |
| **A stay went live.** Real `ListingCard` inline | `listings` reaching `PUBLISHED` in that area | Supply becomes content, for free, and the agent gets reach without paying for it |
| **The light changed.** "Light came back on around Yaba. 9 residents, 14 minutes ago" | `area_utility_state` flipping | The wedge, narrating itself. This is the entry people come back for |
| **Someone stayed here.** "A guest completed a stay in Yaba this week" (no names, no listing) | `bookings` completing | Proof the place is real and transacting, with zero personal disclosure |
| **A new agent is verified here.** | `agents` approved with a listing in the area | Trust, visible, at the place level |
| **The season.** "December search has opened for Lagos" | `seasons` (R-74) when it lands | Ties the social layer to the demand calendar |

The consequence is that **day one of a new area is a page with six to twelve
real entries on it**, all true, none fabricated, and the first human post lands
into a room that is already alive. This also answers the handoff's point 6
directly: social connects back to booking because supply *is* content.

One rule keeps it honest: **a system entry never outnumbers human entries once
humans are present.** The feed query caps system entries at one in four once an
area has more than twenty human posts in the session window.

---

## 4. The name, and the lexicon, tested honestly

### 4.1 The surface is called Around

`Compound` is cut. `Around` replaces it.

- It is plain English that a Nigerian actually says.
- "Around Yaba", "seen by 41 around here", "what is happening around me". It
  reads naturally in every position the product needs.
- It matches the platform's existing location vocabulary exactly: state, city,
  **area**. The social unit is the area our listings are already in, which
  means no new geography and a clean join later.
- It does not collide with "compound", which keeps meaning what it means to
  every Nigerian renter: a walled plot with units in it. We are a property
  platform. That word is spoken for.

Routes: `/around`, `/around/[slug]`, `/around/[slug]/record`. Table: `areas`.
Tab label: **Around**.

### 4.2 Every word in the plan's lexicon, tested

The test: would someone in Yaba say this, or is it a brand pretending?

| Plan's word | Verdict | Decision |
|---|---|---|
| Compound | Fails. Means a specific, smaller thing in property | **Cut.** Around, area |
| Gist | **Passes strongly.** "What's the gist" is universal here | **Keep** as the composer verb and the post kind |
| Talk (noun, a reply) | Fails. Nobody says "3 talks" | **Cut as a noun.** "Reply". "Talk your mind" survives as the composer placeholder, where it is a verb and it works |
| Echo | Fails. Invented. Nobody says echo | **Cut.** "Repost", which is the owner's own word |
| Correct | **Passes strongly.** "Correct!" is exactly how a Nigerian affirms something true, and it means "this is right", which is what a utility record needs | **Keep**, scoped to answers and utility, not as a universal like |
| I dey | **Passes.** Presence, in one syllable | **Keep**, scoped to utility reports |
| I sabi here | Fails. Forced, and it duplicates Correct | **Cut** |
| Wahala | **Passes** as a label for a problem | **Keep** as a post category, not a post kind |
| Owambe | Fails twice. An owambe is a lavish Yoruba party, not a five-a-side meetup, and it is one ethnic group's word in a national product | **Cut.** "Link up", and deferred out of v1 entirely (section 9) |
| Keep (for save) | Fails. The platform already says Save and has `saved_items`. Two words for one concept is exactly the drift the docs warn about | **Cut.** Save |
| Seen by N around here | **Passes.** Better than "views" and it carries the place | **Keep** |
| Drop gist | **Passes** | **Keep** |

### 4.3 The principle behind those cuts

**Speak plainly where the action is universal. Speak Nigerian where the
mechanic is Nigerian.**

Like, Reply, Repost, Save and Views are the same five actions on every product
ever shipped, and the owner asked for them by those names. Renaming them
teaches a new user five words before they can do anything, and it reads as
costume.

Light, I dey, Na lie, Wahala and gist are ours, because the thing underneath
them is ours. Nobody else has a structural answer to whether there is light in
Ogudu tonight. That is where the culture is load-bearing, and it lands as
warmth rather than performance precisely because it is not everywhere.

---

## 5. Data model, and why it is one table

### 5.1 The single-table argument

`SOCIAL_TODO` proposes `gists` and `talks`. That forces `(target_type,
target_id)` into `social_reactions`, `echoes`, `reports`, every moderation
action, every notification and every count. Five polymorphic joins, five places
to get a foreign key wrong, and no database-level referential integrity on any
of them, because a polymorphic id cannot carry a foreign key.

One `posts` table with a self-referencing `parent_id`:

- Every reaction, repost, report and moderation row carries **one real foreign
  key** to `posts.id`, enforced by the database.
- The owner's requirement, that a user can reply to and like and repost the
  AI's reply, needs **no code at all**. The AI's reply is a row in `posts`. The
  like path does not know or care.
- A quote repost is itself a post with `quoted_post_id`, so a quote repost can
  be liked and replied to for free, which a separate `echoes` table cannot do.
- One counter trigger instead of two. One scanner trigger instead of two. One
  RLS visibility helper instead of two.

The cost is that a root post and a reply share a table with some columns null
on replies. That is a cheap price, enforced by check constraints, for removing
polymorphism from five tables.

### 5.2 The tables

Every table RLS-enabled at creation. Every policy wraps `auth.uid()` in a
scalar subquery for the planner. Every foreign key gets a covering index. All
of these are house rules already learned the hard way.

**`areas`**
`id uuid pk`, `slug text unique`, `kind` (`CITY`,`AREA`,`ESTATE`,`CAMPUS`),
`name text`, `state_code text references states`, `city text`, `area text`,
`centre_lat numeric`, `centre_lng numeric`, `member_count int default 0`,
`post_count int default 0`, `status` (`ACTIVE`,`PAUSED`,`ARCHIVED`),
`opened_at timestamptz`, `created_at`.
Read: anyone, `ACTIVE` only. Write: admin only. The first cities are curated,
not a land grab, which is also the only way moderation stays possible.

**`area_members`**
`(area_id, user_id)` pk, `role` (`MEMBER`,`RESIDENT`,`MODERATOR`),
`residency_source` (`STAY`,`INVITE`,`PRESENCE`,`ADMIN`) nullable,
`residency_verified_at` nullable, `utility_weight numeric default 1.0`,
`notify_utility boolean default true`, `joined_at`.
`RESIDENT` is earned, never claimed. Section 6 is entirely about this.

**`social_profiles`**
`user_id pk references profiles`, `handle text unique`, `bio text` (max 240),
`pronouns text` null, `link text` null, `banner_path text` null,
`home_area_id` null, `like_count int`, `correct_count int`, `repost_count int`,
`contact_policy` (`REQUEST`,`OPEN`) default `REQUEST`,
`pidgin_ok boolean default false`, `handle_claimed_at`, `created_at`,
`updated_at`.
- `handle` lowercase only, `check (handle ~ '^[a-z][a-z0-9_]{2,19}$')`,
  a reserved-word list enforced in the database, and a handle that resembles a
  Vallo official name or an approved agent's registered business name is
  refused at the database level, not in a form.
- `bio` and `link` pass the fraud scanner on write. A bio is the oldest place
  in the world to hide a phone number and an off-platform payment ask.
- A released handle is **locked for 90 days** before anyone else can claim it,
  so a well-known handle cannot be sniped the hour it is dropped.
Read: anyone. Write: self only.

**`posts`** (the one table)
`id uuid pk`, `area_id references areas` (denormalised onto replies too, so an
area feed never walks up the tree), `root_id uuid` self ref null,
`parent_id uuid` self ref null, `depth smallint default 0`,
`author_id uuid` null references `auth.users`,
`author_kind` (`USER`,`BOT`,`SYSTEM`) default `USER`,
`kind` (`LIGHT`,`GIST`,`ASK`,`SHOWCASE`,`REPLY`,`SYSTEM`),
`body text`, `listing_id` null references `listings`,
`quoted_post_id uuid` null self ref,
`utility jsonb` null, `category text` null (Wahala and Ask categories),
`payload jsonb` null (the bot's listing cards and map pins),
`expires_at timestamptz` null,
`reply_count`, `like_count`, `correct_count`, `repost_count`, `seen_count`,
`status` (`LIVE`,`QUARANTINED`,`REMOVED`) default `LIVE`,
`quarantine_reason text` null, `flagged_at` null,
`created_at`, `edited_at` null, `removed_at` null.

Constraints that carry the rules, rather than hoping code remembers them:
- `author_id is null` **iff** `author_kind in ('BOT','SYSTEM')`. This one check
  is what makes the owner's AI requirement work with no special casing.
- `depth = 0` iff `parent_id is null`, and `depth <= 3`, enforced by trigger so
  a thread stays readable at 390px.
- `SHOWCASE` requires `listing_id not null` and `author_kind = 'USER'`, and a
  trigger refuses it unless that listing is `PUBLISHED` **and** owned by an
  `agents` row belonging to the author.
- `LIGHT` requires `utility not null` and a body under 120 characters.
- `listing_id not null` implies `kind in ('SHOWCASE','SYSTEM')`.
- `expires_at` may only be set on `LIGHT` and on future `LINKUP`.

**`post_media`**
`id`, `post_id` cascade, `storage_path`, `width`, `height`, `blurhash`,
`position`, unique `(post_id, position)`, max 4 by trigger.

**`post_reactions`**
`id`, `post_id references posts`, `user_id`,
`mark` (`LIKE`,`CORRECT`,`I_DEY`,`NA_LIE`,`SAVE`), `created_at`,
unique `(post_id, user_id, mark)`.
- `NA_LIE` rows are readable only by their author, moderators and admins. It is
  never a public counter, because shown publicly it becomes a bullying tool.
  Privately it is how the utility record stays honest.
- Counters are maintained by one trigger, so a feed read is one query and never
  a fan-out of counts.

**`post_reposts`**
`post_id`, `user_id`, `area_id`, `created_at`, unique `(post_id, user_id)`.
A plain repost, once per person. A quote repost is a `posts` row with
`quoted_post_id` and may repeat, because it carries new words.

**`post_views`**
`post_id`, `viewer_bucket text`, `nearby boolean`, `seen_on date`,
pk `(post_id, viewer_bucket, seen_on)`.
`viewer_bucket` is `hmac(user_id_or_session, salt_for_today)`. The salt lives
in a `private` table, rotates at midnight Lagos, and **the previous day's salt
is deleted**, so yesterday's buckets are permanently unlinkable to a person.
That is what lets us say "seen by 41 around here" without building a record of
who read what.

**`utility_reports`**
`id`, `area_id`, `user_id`, `post_id` null,
`kind` (`LIGHT`,`WATER`,`ROAD`,`SAFETY`), `state` (`ON`,`OFF`,`PARTIAL`),
`weight numeric`, `conflicted boolean default false`, `reported_at`,
unique `(area_id, user_id, kind, date_trunc('hour', reported_at))`.

**`area_utility_state`** (the live answer, what the Spine renders)
`(area_id, kind)` pk, `state`, `confidence numeric`, `sample_count int`,
`reporter_count int`, `dispute_count int`, `changed_at`, `computed_at`.

**`area_utility_daily`** (the sellable history)
`(area_id, kind, day)` pk, `hours_on numeric`, `sample_count`,
`reporter_count`, `agreement numeric`.

**`blocks`** `user_id`, `other_id`, `created_at`. Bidirectional invisibility.
**`mutes`** `user_id`, `target_kind` (`USER`,`POST`,`AREA`), `target_id`. One-way silence.
**`contact_requests`** `id`, `from_id`, `to_id`, `state`, `created_at`, `decided_at`.
**`bot_invocations`** `id`, `post_id`, `user_id`, `area_id`, `prompt`, `answer`, `input_tokens`, `output_tokens`, `cost_minor`, `refused_reason` null, `created_at`.
**`badges`**, **`user_badges`** per `docs/BADGES.md`, unchanged.

`public.reports` gains `POST` and `SOCIAL_PROFILE` target types with **no
migration**, because the column is already `text`.
`public.notifications` gains a `social` kind, in its **own migration**, used
only from the next one.

### 5.3 What I am cutting from the plan's model

- **`follows`.** The plan itself says counts stay private and standing comes
  from Correct marks. A follow graph with no visible output is a table nobody
  reads and an abuse surface nobody watches. **The place is the subscription.**
  The owner asked for profiles, likes, comments, reposts and views, not
  follows. Cut. `contact_requests` stays, because "reach people nearby and
  message each other" needs it and it is the safe shape.
- **`gist_media` as a separate concept from post media.** Folded in.
- **`echoes`.** Replaced by `post_reposts` plus quote-as-post.
- **Six post kinds.** Ship three human kinds in v1: **Light**, **Gist**,
  **Ask**. Wahala is a `category` on Ask or Gist, not its own kind, because a
  problem report is a question with a subject. Showcase is agent-only and
  arrives in a later slice with its trigger. Link up is deferred (section 9).

---

## 6. The utility record, over-engineered on purpose

The handoff is right: this is the whole wedge and it is gameable. The obvious
attack is an agent with ten accounts reporting "light is on" in an estate they
are selling in. Six defences, layered, because any one of them alone fails.

**1. A single reporter can never move the state.** The state flips only when at
least **two independent reporters** agree inside the window and their weighted
agreement crosses the threshold. One person reporting enters the record and
changes nothing visible. This alone kills the naive single-account attack.

**2. Residency is proven, never claimed.** `area_members.role = 'RESIDENT'` is
earned by exactly one of:
- a **completed booking** at a listing in that area (`bookings` reaching
  completion, which we already record);
- an **invite accepted from an existing weighted resident**, capped at three
  invites per resident per 90 days, so the web of trust cannot be inflated
  faster than it grows;
- **presence over time**: reports across at least fourteen distinct days
  spanning thirty, which is expensive to fake and cheap to check;
- an **admin grant**, audited like every other privileged action.

**3. Conflict of interest cuts weight, it does not raise it.** An account that
is an approved agent, or that holds a `PUBLISHED` listing in the area, has its
`utility_weight` reduced hard and its reports are **labelled in the record**.
The person selling the flat is the last person whose word we take on whether
the estate has light. This is the direct answer to the attack the handoff
names, and it is the opposite of what a naive design would do.

**4. Being wrong costs you.** If your report is contradicted inside the same
window by independent reporters whose combined weight beats yours, your report
is marked `conflicted` and your `utility_weight` decays. Being right restores
it, slowly. **Reputation here is earned by agreeing with reality**, and reality
is the other residents.

**5. You cannot be in five places at once.** Beyond the per-area hourly unique
constraint, a **daily cap across all areas** (twelve reports, any kind, any
area). A person reporting in nine estates in one afternoon is not a resident,
they are a campaign, and this is the cheapest and strongest signal available.

**6. Publish the disagreement, not just the average.** `agreement` is a
first-class column on `area_utility_daily`. An area where residents agree is
trustworthy data. An area where they do not is **shown as contested and never
sold as a report**. The unpurchasable asset is not the average, it is the fact
that we know when to distrust our own number. Any buyer of an estate report who
understands data will pay more for that than for the average.

**And one thing we do not do:** the recompute runs in a **trigger on insert**,
synchronous and bounded, so the live state never waits on a job. `pg_cron`
improves the nightly rollup and gates nothing. (It is installed now, six active
jobs, ADR-014.)

---

## 7. The visual system

This is where `SOCIAL_TODO` is thinnest. It has one motif, the Pulse Line, and
calls it an identity. A motif is not a system. Here is the world.

### 7.1 The Spine: one geometry, three meanings

Every social surface hangs off a **vertical spine**, a rule at 20px from the
leading edge running the full scroll height. It is drawn once per page, as one
element, and everything attaches to it.

It means a different thing on each surface, which is what makes it a system
rather than a decoration:

| Surface | What the spine is |
|---|---|
| `/around/[slug]` | The **area's live state**. Current travelling through it means there is light |
| `/post/[id]` | The **thread's own trunk**. Replies branch off it, indented once per depth, so a three-deep thread is legible at 390px without a single avatar rail |
| `/u/[handle]` | The person's **standing over time**. Badges earned and Correct marks sit as nodes down it, oldest at the bottom |

**The states, and they differ in shape, not only in colour**, because colour
alone excludes colour-blind readers and fails in bright sun on a phone:

| State | Spine |
|---|---|
| Light **on** | 2px solid, `--nf-border-brand`, with a 60px `--nf-state-warning` (bright cyan) gradient segment travelling bottom to top on a 9s loop |
| Light **off** | 1px **dashed**, `--nf-border-subtle`, static and cold |
| **Unknown** | 1px solid, `--nf-border-subtle`, static, and the first card in the feed is the invitation to be the first to say |
| **Contested** | 2px solid with a 3px gap every 40px, and the State Bar cell reads "Residents disagree" |

Motion is one transform on one element, which is what makes it affordable on a
mid-range Android. Under `prefers-reduced-motion` the segment holds at 40 per
cent height and does not travel: the state is then carried entirely by the
line's shape, its colour and the State Bar's text.

### 7.2 The Node: know who is speaking before you read

Each entry attaches to the spine with a 12px stub and an 11px node. **Node
shape encodes author kind.** This is the highest-value legibility decision in
the whole design and it costs nothing:

| Node | Author |
|---|---|
| Filled circle | A person |
| Filled circle with a ring | A person with an **agent** chip |
| Hollow circle | The **platform** (a system entry) |
| Diamond | **The AI** |
| Square | An agent **showcase** |

Scrolling an area page, you can tell supply from conversation from the platform
from the AI without reading a single word. No other social product does this,
because no other social product has four kinds of author.

### 7.3 The State Bar

`SOCIAL_TODO` wants three companion strands beside the spine for water, road
and safety. At 390px that is visual noise and four things competing to be the
line. Instead:

A **44px horizontal strip pinned under the page header**, four cells:
`Light · Water · Road · Safe`. Each cell carries a 2-state mark, a confidence
dot, and a compressed line: "9 residents, 14m". Tapping a cell opens the
record. Long-pressing a cell opens the one-tap report.

The spine carries **Light only**, because light is the one that reads as
current, and because one line saying one thing is legible while four lines
saying four things is a diagram nobody parses on a bus.

### 7.4 Cards, and the Notch

Cards take a single **18px cut corner**. The cut is the silhouette, and the
silhouette is the identity test: a screenshot with the logo cropped out should
still be recognisably ours.

| Entry | Notch | Fill |
|---|---|---|
| Person | Bottom-left | `--nf-surface-primary`, `.nf-card` material |
| Agent showcase | Bottom-**right** | Same, plus the agent chip |
| The AI | Bottom-left, and the notch is **filled** with brand blue | Same |
| System | **No notch** | **No fill**, hairline border only, so the platform recedes and never competes with a person |

The notch is one `clip-path` polygon and one matching border, and it costs
nothing at any size.

**Not nsibidi.** The reaction marks are an original set built from three
primitives that are already the language of this design: a **stroke**, a
**node**, a **gap**.

| Mark | Drawing | Reads as |
|---|---|---|
| **Like** | A filled node | Acknowledgement |
| **Correct** | A node with a stroke passing through it | A tally, an affirmation, without being a tick |
| **I dey** | Two nodes on one stroke | Me, and here |
| **Na lie** | A node with the stroke broken either side | The chain is broken |

All four on a 24 grid, single path, drawn on tap in 240ms via
`stroke-dashoffset`, instant under reduced motion. They are ours outright, they
owe nothing to anyone's sacred script, and they are built from the same three
shapes the spine and the node already use, which is what makes them read as one
family rather than four icons.

I would recommend to the owner, once and then drop it: if genuine Nigerian
visual heritage is wanted in this product, commission it properly from someone
who holds the knowledge, as its own piece of work. Do not have an engineer
approximate a restricted script for a like button.

### 7.5 Typography, colour and motion

- **Area names**: display face, all caps, `--nf-tracking-overline`. "AROUND
  YABA". Confident, geometric, modern, never a fantasy serif.
- **Post body**: the platform sans at `--nf-text-body-lg`, not `--nf-text-body`.
  A post has to be more readable than a UI label, and this is the one place I
  would step the scale up.
- **Counts**: `.nf-numeric`, so a like count does not jitter as it changes and
  it matches the wallet.
- **Colour**: no new tokens outside the family. The spine is
  `--nf-border-brand`, the current is `--nf-state-warning` (bright cyan, which
  is the "look at this" state and reads as current in a wire far better than
  any warm glow), system entries are `--nf-content-muted`, the AI's node is
  `--nf-brand-primary`. Emerald and rose keep their meanings. **No orange, no
  amber, no gold, no purple, no magenta**, and no new hue invented for social.
- **Adire.** `SOCIAL_TODO` proposes an adire resist texture on the canvas at 2
  to 3 per cent. I would hold this back for one reason: the platform already
  has a living ambient canvas, and stacking a second full-bleed texture under
  it is where 3G page weight and low-end Android compositing both go wrong. If
  the owner wants it, it belongs as a token-level canvas override that the data
  saver switch turns off, not as a social-only layer.
- **Motion budget: three animations.** The travelling current, the mark draw,
  the card enter. Anything already on screen at first paint is shown outright
  and never left mid-animation, which this codebase learned the hard way when a
  scroll reveal held the first search result at 56 per cent opacity.

### 7.6 The paper twin

Dark is the default and the operating system does not override it. Light is
designed, not derived:

- Canvas flat neutral, cards pure white, the notch reading as a genuine cut
  with the hairline following the diagonal.
- The spine becomes a 1px neutral rule; the current becomes a deep-cyan segment
  (`--nf-state-warning` already steps down to `#0E6E8C` on paper, which passes
  AA on white where the bright cyan does not).
- Nodes become filled ink rather than glowing.
- No blue-tinted greys anywhere. Brand blue appears only on active, focus and
  call to action.

### 7.7 Every state, designed

No dead ends, no gibberish. Named here so none of them is discovered late.

| Surface | State | What it is |
|---|---|---|
| `/around` | Signed out | The map of open areas, real counts, one honest line about what Around is, sign in to join |
| `/around` | No areas joined | The areas nearest the user's last search, plus every open area by state. Never a blank |
| `/around/[slug]` | **Brand new area, 6am, nothing in it** | Spine present and grey. State Bar reads four "Not reported yet" cells, each tappable. The supply rail shows real listings. One system entry: the area opened. **This is a page, not an empty state** |
| `/around/[slug]` | Session ended | A real terminal card: "That is today around Yaba." Three doors: yesterday, the record, stays here. Never a spinner |
| `/around/[slug]` | Paused by admin | Honest: the area is paused, why, and when it is expected back |
| `/post/[id]` | Post removed | A tombstone in place, so replies do not orphan, saying it was removed and by which side |
| `/post/[id]` | Post quarantined, you are the author | The post, with an honest banner: under review, here is why, here is what happens next |
| `/post/[id]` | Post quarantined, you are anyone else | A 404. Not a "this is hidden" teaser, which is itself a harassment surface |
| `/u/[handle]` | No such handle | Offered as available to claim, if the viewer has no handle yet |
| `/u/[handle]` | Blocked, either direction | 404. Bidirectional invisibility means invisible, not "unavailable" |
| `/compose` | Unconfigured (no Supabase) | The composer renders and says honestly that posting is unavailable, exactly as auth already does |
| Everywhere | Rate limited | The real limit, the real reset time, in one plain sentence |
| Everywhere | Feature flag off | The tab is absent, not a broken page |

### 7.8 Accessibility, answered rather than mentioned

- The spine is `aria-hidden`. **Every state it carries is duplicated as visible
  text** in the State Bar, not as screen-reader-only text, because a state
  worth showing is worth reading.
- Reduced motion: the current stops, the marks snap, the cards appear. All
  three already collapse through the token durations.
- Colour is never the only carrier: line shape changes between on, off, unknown
  and contested.
- Every mark has an accessible name carrying state and count: "Correct, 12,
  not marked".
- The feed's ending is announced through `aria-live="polite"`, because a feed
  that ends is a state change a sighted user sees and a screen reader user
  otherwise walks off.
- Node shape has a text equivalent: every card names its author kind in its
  accessible label ("Posted by Vallo", "Answered by the Vallo assistant").
- Marks meet the 44px touch target the icon buttons already meet, which chips
  currently do not (R-121).

---

## 8. Safety, moderation and the 2am question

"A staffing question" is true and insufficient. Here is what runs when nobody
is watching.

### 8.1 Three visibility states, and what puts a post in each

`LIVE`, `QUARANTINED`, `REMOVED`.

**Quarantined on insert, before it is ever visible**, by the trigger:
- The existing `private.scan_message` classifier, extended to posts, replies and
  bios. A ten-digit account number or off-platform payment steering never
  becomes publicly visible even for a second. The author sees it with an honest
  banner. This is the one class of harm where "review after publication" is the
  wrong default, because the damage is done at first read.
- A post naming what looks like a private individual inside the Wahala
  category. Categories and places, never people.

**Quarantined after the fact:**
- **N reports from distinct accounts with weight**, N scaled to the area's size,
  so a small area is not brigadable by four accounts and a large one is not
  immune.
- A moderator's action.

**Live immediately:** everything else. The default is publication, because a
platform that reviews everything before it appears is not a social product.

**Removal is admin only, always**, and always writes an `audit_log` row with
the actor, the target and the reason. A moderator can quarantine and cannot
remove. That distinction is what makes it safe to grant the role.

### 8.2 Slow mode, which is how a new area survives its first month

A newly opened area launches in **slow mode**:
- Posting requires a **verified phone** (R-67's tier two, which the platform
  wants anyway).
- An account under seven days old has its **first post in that area held** for
  review.
- Bot summons are off until the area has fifty human posts.

Slow mode is a per-area flag an admin lifts. It is a one-time cost per person
and it removes drive-by abuse almost entirely, which is the difference between
one moderator being enough and one moderator being overwhelmed.

### 8.3 The rules that are not obvious until they bite

- **Blocking and the AI.** If A blocks B, and the AI answers on A's post, B can
  still see the AI's reply (it is the platform speaking, not A) but cannot reply
  to it inside A's thread. The thread belongs to its root author.
- **Quote reposts are a dunking vector.** A quote repost of someone who has
  blocked you is refused. Any author can disable quote reposts on their own
  post. Plain reposts stay open, because a plain repost carries no new words.
- **Tombstones.** A removed post leaves a tombstone so its replies do not
  orphan into a thread with no top. Deleting the row would silently delete other
  people's words.
- **Editing.** Fifteen minutes, `edited_at` shown, and **an edit re-runs the
  scanner**. Otherwise the edit window is a hole straight through moderation.
- **Account deletion under NDPA.** Posts are anonymised, not deleted: author
  detached, body retained only where it is a reply that other people's words
  depend on, otherwise removed. **Utility reports survive as weight in the
  aggregate with the individual attribution dropped**, which is both compliant
  and correct, because the aggregate is the asset and it was never personal
  data once it was summed. Export covers posts, replies, marks, reports and
  profile. All three written down before launch, not after.

### 8.4 Rate limits, with numbers

On the durable Postgres limiter that already exists
(`private.consume_rate_limit`), which fails open by design.

| Action | Limit |
|---|---|
| Root post | 5 per hour, 20 per day |
| Reply | 10 per 5 minutes, 60 per day |
| Utility report | 1 per area per kind per hour (database constraint), 12 per day across all areas |
| Reaction | 200 per day |
| Repost | 30 per day |
| Quote repost | 10 per day |
| Area join | 20 per day |
| Contact request | 10 per day |
| Abuse report | 20 per day |
| Handle claim | 1 per 30 days |
| Bot summon | 5 per user per day, 20 per area per hour, plus the monthly ceiling |

---

## 9. What I am cutting, and why

Said plainly so the owner can overrule any of it.

| Cut | Why |
|---|---|
| **Boosted Showcase (paid placement)** | The platform charges no fees anywhere. Selling placement to an agent is charging an agent. This is a direct contradiction inside `SOCIAL_TODO` section 2 and I will not build it silently. It is in section 12 for the owner to decide |
| **Trusted around here (paid local directory)** | A second two-sided marketplace with its own supply, its own reviews, its own moderation and its own fraud surface. That is not a feature of the social layer, it is a different product, and building it here would make both worse |
| **Link up / Owambe** | Meetups between strangers are the highest-liability feature in the whole plan, and they are not the wedge. It ships when there is a moderator watching, not before. Nothing in the schema forecloses it: `expires_at` and the kind enum are already shaped for it |
| **`follows`** | A follow graph with no visible output. The place is the subscription |
| **Three companion strands on the spine** | Noise at 390px. The State Bar says the same thing better |
| **A second full-bleed texture (adire)** | The ambient canvas is already there. Two stacked textures is where low-end Android compositing goes wrong |
| **Six post kinds** | Three in v1. Wahala becomes a category, Showcase arrives with its trigger, Link up is deferred |

---

## 10. The AI in the comments

Summoned by `@vallo` in any post or reply. Visibly a machine, never
impersonating a person, always on a diamond node.

**A reply is a row in `posts` with `author_kind = 'BOT'` and `author_id null`.**
Everything the owner asked for follows with no code: it can be liked, it can be
reposted, it can be quote-reposted, it can be replied to, it can be reported.
The spec in slice 5 proves each of those four separately.

**What makes it different from a chat box in comments: it hands back real
inventory.** `payload jsonb` renders real `ListingCard`s with working Message
and Reserve actions, or a map pin, resolved through the same repository search
`/search` uses. It can only cite listings the tool actually returned.

**Guardrails, non-negotiable.** These extend the ones already proven on
`/api/assistant` rather than inventing a second policy:

- Reads **public area context only**. Never private messages, never another
  user's bookings, wallet or profile. **It never holds a service role.** The
  R-77 pattern applies: tools take no identity argument, they execute against
  the caller's own RLS-bound client resolved server side.
- **One reply per summon.** No follow-ups unless summoned again.
- **Never claims a utility state it cannot source.** If nobody has reported, it
  says nobody has reported and offers the report action, which is both honest
  and more useful than a guess.
- **Every factual claim carries its source.** "Based on 14 reports from 9
  residents in the last 6 hours." An AI that cites its rows is the only kind
  that belongs in a trust product.
- Never arbitrates a dispute, never promises a refund, never quotes a price it
  cannot source from a real listing, never gives medical or legal advice.
  Money, safety and fraud go to support, with the escalation R-91 describes.
- Never replies in a quarantined thread, never replies to a quarantined post,
  and does not take abuse bait.
- Refuses in a new area still in slow mode.
- **Cost**: per-user and per-area limits above, plus a hard monthly kobo
  ceiling read from the settings row, compared against the sum of
  `bot_invocations.cost_minor` for the calendar month, refusing with an honest
  sentence when exceeded. Plus a kill switch on the existing `feature_flags`
  table. An open summon surface is an open spending surface.
- **Voice**: warm, brief, British spelling, Nigerian register, Pidgin when the
  user writes in Pidgin (R-90). Never performing.

---

## 11. How social pays for itself, without charging anyone

The plan's four revenue paths include one that breaks a rule (section 9). Here
are the ones that do not.

1. **Verified utility history per area.** "Gwarinpa: 18.4 hours average daily
   power over 90 days, 212 residents, 91 per cent agreement." Sold as a report
   to landlords, developers and institutional buyers, which is a supplier-side
   sale and charges no guest and no agent for using the platform. Section 6's
   agreement column is what makes it worth paying for.
2. **A power signal on the listing.** A listing in an area with a verified
   record carries it. That is the strongest reason to trust a Vallo listing
   over a WhatsApp one, and it costs nobody anything.
3. **Conversation to booking.** The AI hands back real listings, the supply
   rail sits on every area page, and the area to listing to reserve funnel is
   measured through `events` (R-102). This is the highest intent traffic on the
   platform and it is free.
4. **Supply acquisition.** An agent whose new listing becomes a system entry in
   the area it sits in gets reach for listing well. That is the cheapest supply
   pitch Vallo has, and it is earned rather than sold.

No guest is charged a fee on a stay. The zero-fee rule is untouched.

---

## 12. Open with the owner

Four decisions I should not make alone.

1. **Paid placement.** `SOCIAL_TODO` section 2 proposes selling Boosted
   Showcase to agents. Rule 9 says the platform charges no fees anywhere. Those
   two cannot both be true. My recommendation is to keep rule 9 and drop paid
   placement, and to reach agents through the free system entry instead. Your
   call.
2. **`pg_cron`. RESOLVED 2026-08-04, corrected here 2026-08-09.** It is
   installed and six jobs are active, including badge awarding, the stale
   booking hold sweep and the daily note. This design never blocked on it
   anyway: expiry is a read filter and the recompute is a trigger. ADR-014.
3. **The branch. RESOLVED.** Everything is on `main`, which Vercel deploys.
4. **One city.** I would open Lagos only, and specifically three to five areas
   inside it, not six cities. Moderation is the constraint and it is a person,
   not a query.

---

## 13. The one line

Everyone else built a feed and hoped place would matter. We already own place,
so we are building the living record of a Nigerian neighbourhood, and the
conversation is what happens around it. The platform speaks first, so the room
is never empty.
