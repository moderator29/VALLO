# FEED AND CIRCLE: the research pass (Agent FEATURES, 7 November 2026)

The founder's brief (`FEED_AND_CIRCLE_BRIEF.md`, part 12) asks for 100 or
more recommendations across 12 areas, each with what, why, where, how,
whether it exists, the layer and a priority, deduplicated and ordered. This is
that pass. Every "Exists" cell was checked against the code in this tree and
the live database (project uccixoonmbhrnyczyigt, read only) on 7 November
2026. The strengths of Pinterest, Instagram, Reddit, LinkedIn, Airbnb and
editorial magazines are named where they teach something; nothing copies
their branding.

**Legend.** Exists: **Yes** (built, keep), **Part** (some of it, upgrade),
**No** (new). Layer: DB (SQL for the founder), Srv (server reads and
actions), UI (screens and components), Nat (native shell). Owner: FE (Agent
FE), FT (Agent FEATURES), NA (Agent NATIVE), PG (Agent PAGES), L (lead).
Priority: **P0** build now (the brief cannot ship without it), **P1** next,
**P2** later.

## What the live database already gives Circle (the most important finding)

Circle is not built from nothing. The tree already has, live:

| Need in the brief | Already there | State |
|---|---|---|
| Neighbourhoods with members, residents, moderators | `areas` (CITY, AREA, ESTATE, CAMPUS; `member_count`, `post_count`, `slow_mode`), `area_members` (MEMBER, RESIDENT, MODERATOR; residency source), `area_moderator_applications`, `/around/[slug]` | Live, in use |
| Discussions and questions | `posts` (kinds GIST, ASK, REPLY, SHOWCASE, SYSTEM, STORY), threads to depth 3 (`private.place_post`), counters, edit guard, scan, rate limit | Live |
| Reactions and saves | `post_reactions` (LIKE, SAVE), `post_reposts`, `post_views` | Live |
| Events and meetups | `events` (area, host, title, starts, venue kind, capacity, status with HELD moderation), `event_attendees` (GOING, WAITLIST, WITHDRAWN), `private.can_see_event`, the moderation desk counts held events | Tables and RLS live, **no member screen at all** |
| Professional credibility | `agents` (verified, verification_tier, role), `credentials` (registry checks with source and checker), `firms`, `businesses` with verification checks, `person_badge` | Live, never shown as a professional profile |
| Moderation | `reports`, `blocks`, `mutes` (any target kind), held states, the admin moderation reads | Live |
| Property-powered posts | `posts.listing_id`, `payload.listingIds` (cited listings), a listing plate in `PostCard` | **Broken** (next row) |

**A live bug found on the way.** `readPostListings` in
`lib/social/posts-queries.ts` selects `price_per_night_minor` and
`price_period` from `listings`. Neither column exists (checked live), so the
read errors, returns an empty map, and the listing plate on a post can never
render. 0 of 137 live posts carry a `listing_id` today, which is why nobody
saw it. Fixed in job 4 (FT, with the lead's word on the file).

**A gap found on the way.** `posts_insert_self` lets a GIST or ASK post carry
any `listing_id`, including a draft or a rejected listing. Job 4's SQL adds a
check: an attached listing must be PUBLISHED when the post is written.

## 1. Visual design (Feed and Circle)

| # | What | Why | Where | How | Exists | Layer | Owner | P |
|---|---|---|---|---|---|---|---|---|
| V1 | Smaller, refined action icons (comment, repost, bookmark) at the content stroke weight, 18px glyph in a 44px target | Founder: "smaller and refined" | `PostCard`, `ActionPill` | Icon size token, never a thinner stroke (ruling) | Part | UI | FE | P0 |
| V2 | Feed hero card: full bleed photo, soft 22px corners, a scrim only at the foot for the author and title | Reference left phone; Airbnb's imagery leads | `PostCard` showcase variant | One `object-fit: cover` image, gradient scrim token, no glass | Part | UI | FE | P0 |
| V3 | Circle banner: Vallo's own deep navy, a real listing photo as the house, member avatars orbiting, LIVE counts | Founder: more beautiful than the reference, counts never mock | `/circle` hero | FE draws; FT feeds counts from `circle_home_stats()` | No | UI+Srv | FE+FT | P0 |
| V4 | Two visual languages: Feed is image led; Circle is type led (title first, a smaller image, a topic chip) | Part 6: the two must feel different | Post cards per surface | A `variant` prop: `feed` and `circle` | No | UI | FE | P0 |
| V5 | Editorial type scale for Circle titles (Poppins 600, 20 to 22px, two lines then clamp) | Magazines: hierarchy by type | Circle cards | Existing tokens, `line-clamp-2` | No | UI | FE | P1 |
| V6 | Asymmetric photo grid for 2 to 4 images ("+3" on the last tile) | Reference second post; Pinterest | `MediaRail` | CSS grid templates by count | Part | UI | FE | P1 |
| V7 | One accent with meaning: the selected tab, Join, Follow; every other chip ink and grey | UX_SYSTEM section 6 | Both | Audit the chip colours | Part | UI | FE | P0 |
| V8 | Skeletons in each card's own shape (hero, discussion, question, event) | Waiting looks designed | Feed, Circle | `Skeleton` per variant | Part | UI | FE | P1 |
| V9 | Empty states with one glyph, one line, one action per section ("No questions here. Ask the first one") | Empty is a door | Circle sections | `EmptyState` | Part | UI | FE+FT | P0 |
| V10 | Light mode first class: white cards on a paper canvas, hairline brand edges, shadows that read on white | Founder: refined light mode | Both | Tokens | Part | UI | FE | P0 |
| V11 | Verified tick only where a real check passed (agents.verified, credentials row, business check) | Trust; never decorative | Author lines | `author-badges.ts` already derives it | Yes | Srv | keep | P0 |
| V12 | Question cards visually distinct: a "Question" eyebrow, answer count as the lead stat, "Answered" mark when one is accepted | Part 3: Ask is visually distinct | Circle | Variant on the Circle card | No | UI | FE+FT | P0 |

## 2. Navigation and structure

| # | What | Why | Where | How | Exists | Layer | Owner | P |
|---|---|---|---|---|---|---|---|---|
| N1 | Bottom bar centre icon becomes the Circle icon (polished, as in the reference), structure unchanged | Founder | `MobileTabBar` | Swap the centre glyph and its href only | No | UI | FE | P0 |
| N2 | One Circle row in the side nav after Feed | Approved addition | `nav-model.ts` | Additive row, `/circle` | No | UI | FT (one line) | P0 |
| N3 | A button from Feed into Circle (masthead lens) and from Circle into Feed (header) | Founder: each enters the other | `FeedMasthead`, Circle header | The lens switch goes live; Circle header has "Feed" | Part | UI | FE+FT | P0 |
| N4 | Circle sections as tabs: For you, Discussions, Ask, Neighbourhoods, Insights, Professionals, Opportunities, Guides, Events, with search at the end | Part 3; reference right phone | `/circle?tab=` | `UnderlineTabs`, the tab in the URL so Back and links land | No | UI+Srv | FT | P0 |
| N5 | Feed categories: For you, Following, Properties, Stays, Restaurants, Neighbourhoods (only those that have real content) | Part 1 | Feed masthead chips | Existing For you and Friends tabs extended | Part | UI+Srv | FE | P0 |
| N6 | Community pages at `/circle/c/[slug]`, neighbourhoods reuse `/around/[slug]` content inside the Circle frame | No duplicate places | Routes | `circle_communities.area_id` links a community to its area | No | Srv+UI | FT | P0 |
| N7 | Every Circle page on PageFrame with Back in the header, never floating | E2 | All Circle routes | PageFrame | No | UI | FT | P0 |
| N8 | Tablet and desktop: Circle in two columns (sections left, rail of communities and events right) | E2: use the width | `/circle` | CSS grid at 768 and 1280 | No | UI | FT | P1 |
| N9 | Tab state and scroll position restored on Back | People lose their place | Feed, Circle | `previous-entry.ts` pattern | Part | Srv | FE | P1 |
| N10 | Route parents and labels for every new route | Back must land right | `lib/nav/*` | Additive lines | No | Srv | FT | P0 |

## 3. Discovery and search

| # | What | Why | Where | How | Exists | Layer | Owner | P |
|---|---|---|---|---|---|---|---|---|
| D1 | Circle For you: trending discussions (helpful marks and answers in 7 days), popular questions, then recommended communities | Part 3 | `/circle` | `circle_trending(limit)` ordered by helpful and answer counts, no hidden engagement score | No | DB+Srv | FT | P0 |
| D2 | Unanswered sort and filter for questions | Reddit's strength: get people answered | Ask tab | `answer_count = 0` | No | Srv | FT | P0 |
| D3 | Sort newest, popular, unanswered on every community | Part 5 | Community page | Query param | No | Srv+UI | FT | P0 |
| D4 | Recommended communities from the member's areas, interests and role | Get people in | Circle home | Rule based: same area, matching category; explain why ("Because you joined Yaba") | No | Srv | FT | P1 |
| D5 | Small creators get seen: one slot in every ten for a member with under 50 followers | Part 2.5 | Feed For you | Interleave rule in the read | No | Srv | FE | P2 |
| D6 | "Tune your feed": hide a topic, see less of an author, reset | Control without a black box | Feed menu | `mutes` (target_kind topic, author) exists | Part | Srv+UI | FE | P1 |
| D7 | Circle search: discussions, questions, communities, professionals, neighbourhoods; recent searches | Part 2.6 | Circle search sheet | Postgres full text over title and body with RLS | No | DB+Srv+UI | FT | P1 |
| D8 | Hashtags and topics as chips that open a topic view | Organised, not dumped | Posts | Parse on write into `post_topics`; no free hashtag spam (max 3) | No | DB+Srv | FT | P2 |
| D9 | Trending neighbourhood talk rail on the Feed ("Lekki this week") | Feed to Circle bridge | Feed | Reads D1 per area | No | Srv+UI | FE+FT | P1 |
| D10 | People search connected to the existing `/around/people` and agents directory | One search, not three | Search | Reuse `people-discovery.ts` | Part | Srv | FE | P1 |
| D11 | "Ask about this area" from any listing page, prefilled with the area | Vision: discover, then ask | Listing page | Deep link `/circle/ask?area=` | No | UI | FT | P0 |

## 4. Creation flows

| # | What | Why | Where | How | Exists | Layer | Owner | P |
|---|---|---|---|---|---|---|---|---|
| C1 | Ask the Community on StepFrame: question, topic, details and photos, place or listing, preview, publish, confirmation with Follow on | Part 8 | `/circle/ask` | StepFrame, posts kind ASK with `community_id` | No | Srv+UI | FT | P0 |
| C2 | Create a community on StepFrame: name, description, category, cover, visibility, rules, preview, create, open | Part 8 | `/circle/new` | `circle_create_community()` RPC, the creator becomes owner | No | DB+Srv+UI | FT | P0 |
| C3 | Start a discussion in a community (title plus body, topic chip) | Part 3 | Community page | posts kind GIST with `community_id` and `title` in payload | No | Srv+UI | FT | P0 |
| C4 | Drafts that survive interruption for Ask, discussion and community | Part 8 | All three flows | Local draft by flow key (per viewer convenience, the same as the listing wizard) | Part | UI | FT | P0 |
| C5 | Attach a genuine listing to a Feed post (search my saves, my listings, or paste a Vallo link) | Founder | Composer | `post_listing_options()` read; `posts.listing_id` | Part | Srv+UI | FT (data) + FE (picker) | P0 |
| C6 | Post types in the composer: text, photos, listing, question, tip, recommendation; contextual fields per type | Part 2.1 | Composer | Extend `COMPOSABLE_KINDS` with payload type | Part | Srv+UI | FE | P1 |
| C7 | Poll (2 to 4 options, closes in 1 to 7 days, one vote) | Part 2.1 | Composer | `post_poll_options`, `post_poll_votes` with RLS | No | DB+Srv+UI | FT | P2 |
| C8 | Create an event in a community or neighbourhood: title, when, venue kind, capacity, preview | Part 3 Events | `/circle/events/new` | Existing `events` table and `events_insert_self` | Part (DB only) | Srv+UI | FT | P1 |
| C9 | The universal top banner after every publish with "View" | Part 8 | All flows | `banner.success` with action | Yes | UI | keep | P0 |
| C10 | Preview step shows exactly the card others will see | Confidence before posting | Ask, discussion, community | Render the real card component | No | UI | FT | P0 |
| C11 | Professional profile setup on StepFrame: headline, what you do, areas served, years, links; credentials pulled from the real checks | Part 3 Professionals | `/circle/pro/setup` | `professional_profiles` table | No | DB+Srv+UI | FT | P1 |

## 5. Interactions

| # | What | Why | Where | How | Exists | Layer | Owner | P |
|---|---|---|---|---|---|---|---|---|
| I1 | Helpful mark on answers and discussion replies (one per person, undo) | The reputation that rewards help | Circle threads | `post_helpful` table, counter on posts | No | DB+Srv+UI | FT | P0 |
| I2 | Accept an answer (question author only, one, changeable) | Ask the Community | Question page | `circle_questions.accepted_answer_id` via RPC | No | DB+Srv+UI | FT | P0 |
| I3 | Follow a question (get told about answers) | Part 3 | Question page | `circle_follows` (kind question) | No | DB+Srv+UI | FT | P0 |
| I4 | Join, leave, request to join a private community | Part 5 | Community page | `circle_memberships` status | No | DB+Srv+UI | FT | P0 |
| I5 | Replies nested to depth 3 with likes | Part 2.3 | Threads | Exists (`place_post`, `post_reactions`) | Yes | Srv | keep | P0 |
| I6 | Report, hide, mute, block from every card and member row | Part 2.3 | Both | `ReportSheet`, `mutes`, `blocks` exist | Yes | UI | keep, wire into Circle | P0 |
| I7 | Save a discussion or question | Part 5 | Circle cards | `post_reactions` mark SAVE exists | Yes | Srv | keep | P0 |
| I8 | Share a discussion as a universal link with a clean preview | Part 9 | Circle pages | Existing `share_links` and OG route for posts | Part | Srv | FT | P1 |
| I9 | Mentions with a picker limited to people who can see the post | Part 2.3 | Composer | `mentions-schema.ts` exists | Part | Srv+UI | FE | P1 |
| I10 | Going, waitlist and withdraw on events, with a reminder the day before | Part 3 Events | Event page | `event_attendees` exists; reminder through the junction | Part | Srv+UI | FT | P1 |
| I11 | Count animation on react and helpful (transform and opacity, reduced motion respected) | Counts that feel alive | Both | `motion.css` | Part | UI | FE | P1 |

## 6. Community (Circle core)

| # | What | Why | Where | How | Exists | Layer | Owner | P |
|---|---|---|---|---|---|---|---|---|
| M1 | `circle_communities`: topic communities (Landlords in Lagos, First-time renters, Short let hosts, Investors, Interior and design) beside the neighbourhoods | Part 3 | DB | New table, optional `area_id` for a neighbourhood community | No | DB | FT | P0 |
| M2 | Seed communities created by staff, clearly labelled "Started by Vallo" | A community with nobody in it is a dead room | `/circle` | Staff RPC; never fake members or posts | No | DB+Srv | FT | P0 |
| M3 | Neighbourhoods tab lists the existing `areas` (Lekki, Ikoyi, VI, Ikeja, Yaba, Ajah, Abuja, Port Harcourt, Enugu, Ibadan as they exist), with real member and post counts | Part 3, reuse | Circle | `areas` with status ACTIVE | Part | Srv+UI | FT | P0 |
| M4 | Neighbourhood facts shown as verified only when sourced (flood facts, commute reports, power bands with their source) | Part 3 rule | Neighbourhood page | `flood-facts.ts`, `commute_reports`, `area_pulses` exist | Part | Srv+UI | FT | P1 |
| M5 | Community rules shown before the first post, accepted once | Healthy rooms | Community page | `circle_memberships.rules_accepted_at` | No | DB+UI | FT | P0 |
| M6 | Owner and moderators: pin, remove, approve join requests, edit rules | Part 5 | Community manage page | `circle_memberships.role` (owner, moderator, member) | No | DB+Srv+UI | FT | P1 |
| M7 | Member directory with search, roles shown, professionals marked | Part 5 | Community page | `circle_community_members()` RPC | No | Srv+UI | FT | P1 |
| M8 | Announcements pinned at the top of a community | Part 5 | Community page | `posts.payload.pinned` by owner or moderator through RPC | No | DB+Srv+UI | FT | P1 |
| M9 | Private communities: content visible to members only, the page shows name, description and Request to join | Part 11 | RLS | `private.can_see_community()` inside `posts_select` | No | DB | FT | P0 |
| M10 | Slow mode and posting limits per community (reuse the area idea) | Calm rooms | DB | `slow_mode` column, existing `limit_member_inserts` trigger | Part | DB | FT | P2 |
| M11 | Guides and Learning: Vallo's own guides (`lib/guides/articles.ts`, `/guides`) surfaced in Circle, plus member guides marked as members' | Part 3 | Guides tab | Read the articles; community posts with type guide | Part | Srv+UI | FT | P1 |
| M12 | Market Insights: verified data only from Vallo's own records (price check bands, listing counts, search demand) labelled with source and date; member opinion in a separate, labelled list | Part 3 rule: no invented statistics | Insights tab | `price_check`, `demand/queries.ts` | Part | Srv+UI | FT | P1 |
| M13 | Opportunities: moderated posts (land for sale, partnership, roles), every one HELD for review first, a disclosure line required, no returns promised | Part 3: not an unmoderated board | Opportunities tab | posts with type opportunity insert HELD; the moderation desk exists | No | DB+Srv+UI | FT | P1 |
| M14 | Events and Meetups tab: upcoming LIVE events from communities and areas | Part 3 | Events tab | `events` exists | Part | Srv+UI | FT | P1 |

## 7. Professional credibility

| # | What | Why | Where | How | Exists | Layer | Owner | P |
|---|---|---|---|---|---|---|---|---|
| P1 | Professional profile: headline, kind (agent, landlord, developer, architect, designer, manager, surveyor, lawyer), areas served, years, portfolio links | Part 3 | Profile and Professionals tab | `professional_profiles` | No | DB+Srv+UI | FT | P1 |
| P2 | Credentials shown only from a real check: `agents.verified`, a `credentials` row with its source, a business verification | Never automatic verification | Profile | Read existing tables; label "Checked by Vallo against the register on 3 Oct 2026" | Part | Srv+UI | FT | P1 |
| P3 | Helpful answers count as the reputation line ("42 helpful answers in Lekki"), never a score | No meaningless scores; V-21 | Profile, author line | Count of helpful marks received, by community | No | Srv | FT | P1 |
| P4 | The listing host's ratings summary (C2) on the professional profile | One trust story | Profile | C2 work | No | Srv+UI | FT | P1 |
| P5 | "Ask a professional" from the Professionals tab opens a chat with context | Professional interactions | Professionals tab | Existing message door | Part | UI | FT | P2 |
| P6 | Expert answers marked when the answerer is a verified professional in that field | Expert contributions on Circle home | Threads | Join profile and verification | No | Srv+UI | FT | P1 |
| P7 | Professionals directory filter by kind, area, verified only | Find help | Professionals tab | RPC with filters | No | Srv+UI | FT | P1 |

## 8. Property integration

| # | What | Why | Where | How | Exists | Layer | Owner | P |
|---|---|---|---|---|---|---|---|---|
| R1 | Fix the post listing read (nonexistent columns) | Live bug: the plate never renders | `posts-queries.ts` | Select `rate_minor, rent_amount_minor, rent_period, sale_price_minor, listing_intent, bedrooms, bathrooms` | Part (broken) | Srv | FT (lead approves the file) | P0 |
| R2 | Embedded listing card: photo, title, area, price, beds and baths, two key amenities, verification where real, View property, Save | Founder | Post cards | FE draws `PostListingCard`; FT the data | Part | Srv+UI | FE+FT | P0 |
| R3 | An attached listing must be PUBLISHED at write time; a listing taken down later renders the post as words only | Never fake listing data | DB | Trigger on posts | Part | DB | FT | P0 |
| R4 | Attach from Saved, from my listings, or by pasting a Vallo listing link | Easy, genuine | Composer | `post_listing_options()` read | No | Srv+UI | FT+FE | P0 |
| R5 | "Ask the community about this place" on a listing (C1 prefilled with the listing) | Vision | Listing page | Deep link | No | UI | FT | P0 |
| R6 | Been there (from Circle v2): "2 people in this community stayed here", only with their yes | Trust from people | Listing page | `circle_shares` opt in | No | DB+Srv+UI | FT | P2 |
| R7 | Questions attached to a listing appear on the listing's page ("3 questions about this area") | Close the loop | Listing page | Read questions with that `listing_id` or area | No | Srv+UI | FT | P1 |
| R8 | Neighbourhood page shows live listings in that area | Discovery from community | Neighbourhood page | Existing search read by area | Part | Srv+UI | FT | P1 |
| R9 | Viewing buddy (from Circle v2): send the existing viewing safety share to someone you know on Vallo | Safety at viewings | Viewing page | `inspection_safety_shares` exists | Part | Srv+UI | FT | P2 |

## 9. Notifications and deep links

| # | What | Why | Where | How | Exists | Layer | Owner | P |
|---|---|---|---|---|---|---|---|---|
| T1 | An answer to your question opens that answer in the thread | Part 9 | `/circle/q/[id]#answer` | Trigger on posts insert with parent a question, `notify` kind social | No | DB | FT | P0 |
| T2 | An answer on a question you follow (batched, one per hour per question) | Part 9 | Same | `notify_once` key by hour | No | DB | FT | P0 |
| T3 | Your answer marked helpful or accepted | Reward help | Same | Trigger on `post_helpful` and accept RPC | No | DB | FT | P1 |
| T4 | A join request to your private community, and its answer | Part 9 | Manage page, community page | RPC writes the notice | No | DB | FT | P1 |
| T5 | An event reminder the day before for people going | Part 9 | Event page | Cron function, `notify_once` | No | DB | FT | P1 |
| T6 | Replies, mentions, followers: keep the existing `notify_post_insert` and `notify_follow` | No duplicates | DB | Keep | Yes | DB | keep | P0 |
| T7 | Every Circle notice uses the A4 header voice: "Ask in Lekki" / "Tunde answered your question" | One voice | Copy | `lib/notify` words | No | DB | FT | P0 |
| T8 | Universal links for communities, questions, events (`/circle/...`) | Part 9 | Deep links | Add the paths to the existing link map with NATIVE | Part | Nat | NA via L | P1 |
| T9 | Push `thread-id` per question and community so a phone groups them | Lock screen calm | Push | NATIVE's rich push payload | No | Nat | NA via L | P1 |

## 10. Performance and Capacitor

| # | What | Why | Where | How | Exists | Layer | Owner | P |
|---|---|---|---|---|---|---|---|---|
| F1 | Cursor pagination on every Circle list (20 a page), no offset | Long lists on budget Android | Srv | Keyset on `(created_at, id)`, the `posts-cursor.ts` pattern | Part | Srv | FT | P0 |
| F2 | One RPC for the Circle home counts and sections, not six round trips | Speed | `/circle` | `circle_home_stats()` | No | DB+Srv | FT | P0 |
| F3 | Counts cached for 60 seconds on the server, live on a pull | Live without load | Srv | `unstable_cache` per the tree's cache pattern, or a plain short revalidate | No | Srv | FT | P1 |
| F4 | Images through the existing image pipeline with sizes per card | Memory | Cards | `lib/images` | Yes | UI | keep | P0 |
| F5 | The banner animation on transform and opacity only, paused off screen and with reduced motion | Battery and comfort | Banner | IntersectionObserver | No | UI | FE | P0 |
| F6 | Virtualise long threads over 200 replies | Budget Android | Threads | Windowing only past the threshold | No | UI | FE | P2 |
| F7 | Offline: Circle home and the last opened question readable offline | Weak network | Offline layer | NATIVE's offline cache | No | Nat | NA via L | P2 |
| F8 | Drafts survive the app going to the background mid flow | Part 10 | Flows | C4 | Part | UI | FT | P0 |

## 11. Accessibility

| # | What | Why | Where | How | Exists | Layer | Owner | P |
|---|---|---|---|---|---|---|---|---|
| A1 | Tabs are a real tablist with arrow keys; the selected tab announced | Screen readers | Circle tabs | `UnderlineTabs` | Yes | UI | keep | P0 |
| A2 | Counts announced as words ("1,204 members"), not "1.2K" alone | Clarity | Banner | `aria-label` with the full number | No | UI | FE+FT | P0 |
| A3 | Helpful and accept buttons are labelled toggles with their state | Clarity | Threads | `aria-pressed` | No | UI | FT | P0 |
| A4 | Every step on StepFrame focuses its title on arrival | Part 8 | Flows | StepFrame does this | Yes | UI | keep | P0 |
| A5 | Text scales to 200 percent without overlap; no fixed heights on cards | Older users | Both | Min heights only | Part | UI | FE+FT | P1 |
| A6 | Contrast checked on the dark banner in both themes | WCAG AA | Banner | Tokens | No | UI | FE | P0 |
| A7 | Reduced motion: the banner holds still, tabs cross fade | Ruling | Both | `prefers-reduced-motion` | Part | UI | FE | P0 |

## 12. Trust and safety

| # | What | Why | Where | How | Exists | Layer | Owner | P |
|---|---|---|---|---|---|---|---|---|
| S1 | RLS: private community content to members only, inside `posts_select` (replace the one permissive policy, never add a second that ORs) | A second policy leaks | DB | Found in v2: `posts_select` is one permissive policy | No | DB | FT | P0 |
| S2 | Only owners edit a community; moderators remove posts; nobody edits another's post | Part 11 | DB | RPCs with role checks | No | DB | FT | P0 |
| S3 | Phone confirmed to create a community or post an opportunity | Accountability, not at sign-up (ruling) | Flows | `confirmed_phones` and the phone gate | Part | Srv | FT | P0 |
| S4 | Opportunities held for review, disclosure required, no returns language (scan words like "guaranteed returns") | Not an investment board | DB + scan | `scan_post` and a word list | Part | DB | FT | P1 |
| S5 | Blocked people never see each other in Circle (cards, member lists, answers) | Safety | All reads | `private.blocked_with` already in `posts_select` | Part | DB | FT | P0 |
| S6 | Report reasons for Circle (spam, scam, harassment, false information, unsafe deal) into the existing `reports` | One desk | ReportSheet | New target types | Part | Srv | FT | P0 |
| S7 | New communities created by members start PROPOSED or LIVE with a 3 a week limit per person | Stop spam rooms | DB | Rate limit in the RPC | No | DB | FT | P0 |
| S8 | Market Insights never shows a figure without its source and date | Part 3 | Insights | Render rule plus a test | No | Srv+UI | FT | P1 |
| S9 | Professionals never self verify: the tick only from `agents.verified` or a `credentials` row with a checker | Part 3 | Profile | Read only | Part | Srv | FT | P1 |
| S10 | No names in logs from any Circle path | Rule | Srv | ids only | Yes | Srv | keep | P0 |

## The order of build (what is built first, from the P0 rows)

1. Job 2, the data model: `features_circle_1_core.sql` (communities,
   memberships, questions, helpful marks, follows, professional profiles,
   community events link, the `posts_select` replacement, home stats) and
   `features_circle_2_post_listing.sql` (R3).
2. Job 3, Circle end to end: `/circle` home with live counts (F2), tabs
   (N4), community pages (N6), Ask (C1) and Create a community (C2) on
   StepFrame, helpful and accept (I1, I2), follow a question (I3), join and
   leave (I4), notifications T1, T2, T7, the Feed button (N3), side nav (N2).
3. Job 4, property-powered posts: R1, R3, R4, the data for R2.
4. Then the P1 rows in this order: M12, M14 with C8 and I10, P1 to P3 with
   C11, M6 to M8, D4, D7, R7, R8, T3 to T5, M13 with S4.

Total: 119 recommendations (12 + 10 + 11 + 11 + 11 + 14 + 7 + 9 + 9 + 8 + 7
+ 10), deduplicated: where two areas touched one thing it is listed once and
the other row points to it (C4 and F8, R5 and D11 are the two deliberate
pairs: one is the flow, the other the platform rule it relies on).
