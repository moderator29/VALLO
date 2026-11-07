# VALLO CIRCLE: spec v3, a real estate community (Agent FEATURES, 7 November 2026)

**The founder decided (7 November 2026, `FEED_AND_CIRCLE_BRIEF.md`): Vallo
Circle is a real estate community** of buyers, tenants, landlords, owners,
agents, developers, investors, managers, architects, designers and other
professionals: ask, share knowledge, discuss areas, exchange experiences, find
opportunities. A professional community, not a timeline, and not the private
trust list of v2. The visual reference is `refs/feed-and-circle-reference.png`
(right phone). The research pass behind this spec is
`FEED_CIRCLE_RECOMMENDATIONS.md` (119 recommendations, prioritised).

v2's strongest tools are kept inside the community (section 8): Viewing
buddy, Been there, Ask with a listing attached, and its safety rules.

## 1. The idea in one line

**The Feed is where discovery happens; Circle is where the community comes
alive.** Discover a beautiful property on the Feed, save it, ask the
community about the neighbourhood in Circle, get recommendations, contact the
owner.

| | Feed | Circle |
|---|---|---|
| Feels | visual, lifestyle, inspirational, social | professional, informative, organised, trust oriented |
| Verbs | discover, explore, save, follow, share | join, ask, discuss, learn, contribute |
| Cards | image led, edge to edge | title led, topic chip, a smaller image |
| Ranking | personal, following, place | helpful answers, unanswered first where it helps |

Shared infrastructure (posts, reactions, reports, blocks, notifications),
different structures.

## 2. Structure

- **Circle home** `/circle`: the banner (Vallo's own deep navy, a real
  listing photo as the house, member faces, LIVE counts of members, posts and
  people active this week, a Join or Start button), then sections arranged,
  not everything at once: featured and trending discussions, popular
  questions, recommended communities, expert answers, events, insights.
- **Sections as tabs** (`/circle?tab=`): For you, Discussions, Ask,
  Neighbourhoods, Insights, Professionals, Opportunities, Guides, Events, and
  search at the end of the row.
- **Communities** `/circle/c/[slug]`: topic communities (Landlords in Lagos,
  First-time renters, Short let hosts, Investors, Interiors) and neighbourhood
  communities linked to an existing area. Join, leave, request (private),
  rules, posts, announcements pinned, member directory, sort newest, popular,
  unanswered.
- **A post or question** `/circle/p/[id]`: the thread, answers with Helpful,
  the accepted answer first, Follow the question, share, save, report.
- **Flows on StepFrame**: Ask the Community `/circle/ask`, Create a
  community `/circle/new`, Start a discussion `/circle/c/[slug]/new`.
- **Between the two**: the Feed masthead's Circle lens opens `/circle`; the
  Circle header has a Feed button. The bottom bar's centre icon becomes the
  Circle icon (FE); the side nav gets one Circle row after Feed.

## 3. The sections

| Section | What it shows | Built on | Rule |
|---|---|---|---|
| Discussions | Community posts of type discussion | `posts` with `community_id` | Sort newest, popular, unanswered |
| Ask the Community | Questions, answer counts, Answered marks | `posts` kind ASK, replies as answers, `circle_accepted_answers` | Visually distinct; mark helpful, accept, follow |
| Neighbourhoods | The live `areas` (Lekki, Ikoyi, VI, Ikeja, Yaba, Ajah, Abuja, Port Harcourt, Enugu, Ibadan as they exist) with real member and post counts | `areas`, `area_members` | Only sourced facts shown as verified (flood facts, commute reports, with their source) |
| Market Insights | Vallo's own records with source and date (price check bands, listing counts, search demand); member opinion in a separate, labelled list | `price-check`, `demand` | No invented statistics, ever |
| Professionals | Professional profiles: headline, what they do, areas, years, links, helpful answers | `professional_profiles`, `agents`, `credentials`, `businesses` | Verification only from a real check, never automatic |
| Opportunities | Moderated posts (land, partnerships, roles) | `posts` type opportunity, held for review | Disclosure required, no returns promised, phone confirmed |
| Guides | Vallo's guides (`/guides`) and member guides, labelled | `lib/guides/articles.ts`, posts type guide | Member guides marked as members' |
| Events | Upcoming live events from communities and areas | `events`, `event_attendees` (live, no member screen yet) | Going, waitlist, reminder the day before |

## 4. Reputation, never a score

A member's credibility is what they did, in words: "42 helpful answers in
Lekki", "Verified agent, checked against the register on 3 October 2026",
the host's rating summary (C2). No number out of anything, no levels, no
points (V-21: the trust score is gone and stays gone). Helpful marks are one
per person per answer, never on your own, and an accepted answer is chosen
only by the asker.

## 5. Notifications (each opens its exact destination)

| Event | Words (header / line) | Opens |
|---|---|---|
| An answer to your question | "New answer" / "@tunde answered: ..." | `/circle/p/[q]#a-[answer]` |
| An answer on a question you follow | "New answer" / "A question you follow has a new answer: ..." (one an hour per question) | same |
| Your answer marked helpful | "Marked helpful" / "Someone found your answer helpful." (one a day per answer) | same |
| Your answer accepted | "Answer accepted" / "Your answer was accepted: ..." | same |
| A reply or mention in Circle | the existing words, the Circle destination | `/circle/p/[thread]` |
| A join request (owners, moderators) | "Join request: [name]" | `/circle/c/[slug]/manage` |
| Your request accepted | "Welcome to [name]" | `/circle/c/[slug]` |

All through `private.notify` and `notify_social` (blocks and mutes
honoured), kind `social`, never SMS. The existing reply and mention notice is
upgraded in place, so nobody gets two for one event.

## 6. The data model (`supabase/migrations/pending/features_circle_1_core.sql`)

Checked against the live schema on 7 November 2026, and applied and
exercised on a throwaway local Postgres with a stub of the live objects
(never on the live database).

**Reused**: `posts` (discussions, questions, answers, guides,
opportunities), `post_reactions` (likes, saves), `areas` and `area_members`
(Neighbourhoods), `events` and `event_attendees`, `reports`, `blocks`,
`mutes`, `notifications`, `confirmed_phones`, `agents`, `credentials`.

**New**

| Table | Purpose | RLS |
|---|---|---|
| `circle_communities` | name, slug, description, category, optional area, cover, public or private, rules, status, counters, "Started by Vallo" | Live ones readable by all (a private one is a closed door, not a hidden one); written only through functions |
| `circle_memberships` | role (owner, moderator, member), status (active, requested), muted, rules accepted | Own row; members see the directory (blocks hidden); owners and moderators see requests; leave is a delete of your own row |
| `post_helpful` | one helpful mark per person per answer | Own rows; insert only on someone else's visible Circle answer |
| `circle_accepted_answers` | the asker's chosen answer | Readable where the question is visible; written by `circle_accept_answer` |
| `circle_question_follows` | follow a question | Own rows; the asker follows automatically |
| `professional_profiles` | headline, kinds (closed list), areas, years, bio, links, listed | Listed ones readable; own row write; verification never stored here |

**Columns on `posts`**: `community_id`, `circle_type` (discussion, question,
guide, opportunity, announcement), `title`, `helpful_count`.

**Rules held in the database**: a reply takes its thread's community; a new
Circle post needs an active member, a title and a type; an announcement
needs an owner or moderator; an opportunity needs a confirmed phone and is
HELD for review; Circle posts cannot be quoted or reposted; the community and
type of a post, and its helpful count, cannot be changed by its author.

**The one trap**: `posts_select` is a single permissive policy, so a
private community's rule goes INSIDE it (replaced with the same text plus
`private.can_see_community(community_id)`); a second policy would OR with it
and leak. `private.can_see_post` (which guards reactions and media) gets the
same rule.

**Doors**: `circle_create_community` (phone confirmed, 3 a week, slug unique,
cover from your own folder, staff may mark "Started by Vallo"),
`circle_join` (public: active; private: requested and owners told),
`circle_leave` (the last owner cannot leave), `circle_decide_request`,
`circle_accept_answer`, and the aggregates `circle_home_stats` and
`circle_community_active` that feed the LIVE counts (counts only, no rows).

The app degrades to nothing until this SQL is live: every read probes and
returns empty, `/circle` shows its sections' empty states and the counts are
not drawn rather than drawn as zero or as invented numbers.

## 7. Property-powered posts (`features_circle_2_post_listing.sql`, job 4)

A Feed post can feature a genuine listing: the card shows the photo, title,
area, price, beds and baths, two key amenities, verification where real,
View property and Save (FE draws it; FEATURES supplies the data). The
listing must be PUBLISHED when the post is written; one taken down later
turns the post back into words. Found on the way: the existing post listing
read selects two columns that do not exist, so the plate has never rendered.

## 8. Kept from v2, inside the community

- **Ask with a listing attached**: "Ask the community about this place" on a
  listing opens Ask with the listing and its area filled in.
- **Been there**: "2 people in this community stayed here", only with each
  person's own yes (a later step, P2).
- **Viewing buddy**: send the existing viewing safety share
  (`inspection_safety_shares`) to someone you know on Vallo, who is told the
  area, the slot and the time you expect to be back (P2).
- **Safety**: blocked people never see each other; report on every card and
  member; leave and mute are silent; logs never name a person; private
  communities' posts never leave them (no repost, no quote, no search for
  non-members); guests never verify ID for stays.

## 9. Build order

1. SQL core (this spec section 6) for the founder.
2. `/circle` home with LIVE counts, tabs, community pages, the thread page,
   Ask and Create a community on StepFrame, helpful, accept, follow, join and
   leave, the notifications above, the Feed button and the side nav row.
3. Property-powered posts (section 7).
4. Then, from the recommendations' P1 rows: Insights, Events with going and
   reminders, professional profiles, community management, search.

## What Agent FE does (unchanged rule, new pieces)

FE builds the shared Circle visuals: the banner with the house and the
animation (reduced motion holds it still), the Circle card variants
(discussion, question, community, event), the bottom bar's centre Circle
icon, and the listing card for property-powered posts. FEATURES wires them
to live data and builds the pages, flows, actions and SQL.
