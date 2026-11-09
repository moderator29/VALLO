# Vallo Roommates: the work plan

Started 8 November 2026. Branch `claude/fervent-cray-1vzbp1` (local
`platform-grade-1-readiness`). One lead and two agents, never more.

## The founder's rulings for this build

- Upgrade, never rebuild. Bottom bar and side nav keep their structure.
- Images 1 to 5 of the brief are the governing view: dark glass dashboard
  tiles (roomOS), soft preference cards with range and chip pickers
  (RoomOwl), the dark finding-rooms list with filter chips and the invite
  modal, the CoLiveConnect profile, reviews, favourites and notifications,
  and the saved roommate or accommodation tabs with profile "general info"
  chips. Images 6 to 9 are Vallo's own concept boards (purple there, Vallo
  blue here). Image 10 is the four-journey card. All are translated into
  Vallo's own tokens: one blue family, rounded rectangles for every text
  control (the shape law), no black buttons, no copied branding.
- ALL SQL goes into ONE file at the end: `supabase/migrations/pending/ROOMMATES_ALL.sql`.
  The founder pastes it once. We do NOT apply SQL in this session.
  Until it is pasted every page degrades honestly ("not open on this server
  yet"), never with sample data.
- CI runs from a draft pull request (workflow dispatch returns 403).
- No em dashes anywhere. Banner for every outcome. Notifications show the
  sender's face. Reduced motion honoured. Type-check before every commit.

## The contract (lead owns, agents build against it)

| File | What |
|---|---|
| `apps/web/src/lib/features/roommates/model.ts` | types, enums, limits, money helpers (`monthlyMinor`, `moveInCost`, `splitCosts`), filters from the address, routes |
| `apps/web/src/lib/features/roommates/queries.ts` | server reads (RPC wrappers): home, discover people, search rooms, profile view, listing view, my profile, my listing draft, hub, group, open groups, institutions, campus page, rooms for a property, my groups, my connections |
| `apps/web/src/lib/features/roommates/actions.ts` | server writes: profile, listings, interests, chat, groups, shortlist, votes, board, expenses, viewings, saved searches, school email check, document check |
| `packages/i18n/src/locales/roommates.en.ts` | every word. Server pages read `getDictionary("en").roommates`; client islands read `useScopedCopy("roommates")` under a `<CopyScope copy={copyScopeOf(t, ["roommates"])}>` set in `app/(app)/roommates/layout.tsx` |
| `supabase/migrations/pending/ROOMMATES_ALL.sql` | the one SQL drop |

A change to the contract goes through the lead.

## Routes

| Route | Page | Owner |
|---|---|---|
| `/roommates` | home: hero, four journeys, live counts, recommended people, rooms, together posts, schools, NYSC strip, how it works, trust | FE-A |
| `/roommates/discover?mode=people\|rooms` | discovery with filter sheet, people and room cards, save search | FE-A |
| `/roommates/p/[userId]` | roommate profile with compatibility, actions | FE-A |
| `/roommates/r/[id]` | room listing with gallery, cost breakdown, viewing, interest | FE-A |
| `/roommates/r/[id]/edit` | edit a post | FE-A |
| `/roommates/new` | create a post (StepFrame) and the published success | FE-A |
| `/roommates/profile` | profile onboarding and edit (StepFrame) and the live success | FE-A |
| `/roommates/campus`, `/roommates/campus/[slug]` | schools directory and a school's page | FE-A |
| `/roommates/nysc` | corps members | FE-A |
| `/roommates/safety` | safety centre | FE-A |
| `/roommates/me` | the hub: requests, connections, my posts, groups, viewings, searches, verification | FE-B |
| `/roommates/groups`, `/roommates/groups/new`, `/roommates/groups/[id]` | find together: list, create, dashboard (members, shortlist with votes, board, costs, cost split) | FE-B |
| `/roommates/split` | cost splitter | FE-B |
| `/roommates/verify` | school email and document checks | FE-B |
| `/admin/roommates` | moderation desk: posts, profiles, verification queue, reports, institutions | FE-B |

## Queues

### Lead
1. [x] Audit (frontend and schema).
2. [x] Contract: model, queries, actions, words.
3. [ ] `ROOMMATES_ALL.sql`: part 1 core tables (drafted), part 2 matching engine and reads, part 3 writes and notifications, part 4 integrations (feed column, listing shared-living flags, Circle category, report kinds), part 5 institutions seed with checked email domains.
4. [ ] Verify every institution email domain against the school's public website.
5. [ ] Notification faces: `?from=<user id>` in roommate hrefs, read by `faceLookup`.
6. [ ] Review every agent diff; run type-check, lint, tests; commit and push.
7. [ ] Screenshots of the real screens (iPhone and Android sizes) and send them.
8. [ ] Draft PR for CI; read the results; fix.
9. [ ] Handover: implemented, partial, proposed; 100+ recommendations; launch checklist.

### FE-A (frontend lead: discovery, profiles, posts)
1. `app/(app)/roommates/layout.tsx` (CopyScope, css), `roommates.css`, `components/roommates/*` visual kit: hero, journey tiles, stat tiles, RoommateCard, RoomCard, MatchRing and reasons, badges row, lifestyle chips, filter sheet, empty and skeleton states.
2. Home.
3. Discover (people and rooms) with the filter sheet and save search.
4. Profile view with compatibility and actions (interest, message once connected, save, share, report, block, invite to group).
5. Listing view: gallery, cost breakdown, household, rules, viewing request sheet, interest, add to group shortlist, linked property.
6. Profile onboarding (StepFrame) and live success.
7. Create and edit post (StepFrame) with photo upload and reorder, draft save, review, publish success.
8. Campus directory and page, NYSC page, safety centre.

### FE-B (integration, groups, hub, admin, QA)
1. Route plumbing: `ROUTE_PARENTS`, route labels, `KNOWN_TOP_SEGMENTS`, `TAB_BAR_ROUTES`, static href checks.
2. Hub `/roommates/me`.
3. Groups: list, create, dashboard (members, invites, join requests, shortlist with votes and compare, board, costs, shares), cost splitter `/roommates/split`.
4. Verification page `/roommates/verify`.
5. Entry points: side nav row, profile row, Circle tab or banner door, CreateDock "Find a roommate", feed card for roommate posts, property page "Find roommates for this home" and "Add to group shortlist", Saved kinds, report targets, chat share kind for a room.
6. Admin desk `/admin/roommates` on the rail.
7. Guard tests green; unit tests for model helpers; QA sweep of every flow.
