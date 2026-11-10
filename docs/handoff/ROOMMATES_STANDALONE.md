# Vallo Roommates as its own product area

Branch platform-grade-1-readiness, 10 November 2026. No SQL was written and none applied.

## Audit: what was already there

- 17 routes under /roommates (home, discover, new, profile, me, groups, campus, nysc, safety, split, verify, p/[userId], r/[id] and its edit page), with the reads and writes in lib/features/roommates.
- One nav row, added after Circle and People in the docked group of components/app/nav-model.ts (two places, Property and Stays), plus a Create sheet row and a Circle home card and a Feed promo.
- Share to chat and share to the Feed already existed on a post (ListingActions). Report and block already existed on every profile and post (SafetyRows).
- Banners already carried every outcome (useRun, the action components).

## Gaps found

1. On a phone the Roommates row was invisible: its section is `hideWhenDocked` (the dock repeats Home, Search, Feed), so the drawer dropped it. Only the Create sheet reached it.
2. The nav row lit only on exactly /roommates, not on any page inside it.
3. There was no `roommates` switch (the shell had one for Around only).
4. No sub-navigation: each page found its own way back.
5. The home had a "pending" link but no next best action and no entry cards for Split, Verify, Schools, Corps members.
6. The "Near a school" picker was a bare search with eight results, no browse, no logos, no state grouping.
7. No Undo on any reversible Roommates action.
8. Circle communities for roommates or student housing had no way into Roommates.

## What changed

- Nav: Roommates is its own section (not docked, so the phone drawer and the desktop rail both show it) at the same level as Circle, on both sides. `isCurrent` lights it on every /roommates page. Files: components/app/nav-model.ts.
- Switch: `roommates` added to FeatureKey in lib/flags.ts (fails open like the others). app/(app)/layout.tsx drops `roommatesEntry` when it is off, which removes the nav row and the Create row; app/(app)/roommates/layout.tsx shows the "not open" line for the pages. To switch it off: `insert into public.feature_flags (key, enabled) values ('roommates', false) on conflict (key) do update set enabled = false;` (a missing row reads as on).
- Sub-navigation: _parts/SubNav.tsx in the roommates layout. Tabs: Home, Discover, Groups, Schools, Corps members, My roommates, Safety. The active tab comes from lib/features/roommates/home-dashboard.ts (`activeRoommatesTab`). Profile, post, verify and split sit under My roommates; a person or a post sits under Discover. Scrolls sideways on a phone and keeps the active tab centred.
- Home dashboard: _parts/Dashboard.tsx replaces the old pending link. Next best action in priority order (requests, group invites, viewings, profile, matches, post, sign in), counts from the existing home read, and eight entry cards. Empty states say "Nothing is waiting on you." The profile steps stay with the existing first-run and finish-profile cards.
- School picker: components/roommates/SchoolPicker.tsx. Search field with its clear control inside the pill, all schools grouped by state when empty, logo (InstitutionLogo) and short name on each row, chosen school as a chip with remove, no-result and empty-list states, list height capped to 45% of the viewport for the phone keyboard. Pure list logic in school-list.ts.
- Undo through the banner: send interest (withdraws it), withdraw interest (sends it again), save and unsave, pause and resume a post (profile and post), mark filled, saved-search alert on and off. Groups' `useRun` takes an `undo` option. Irreversible ones (delete, send a message, report, block) keep a plain banner.
- Connections: Circle community pages for the Roommates and Student housing categories show a door into Roommates (CommunityScreen.tsx, additive). Already present and kept: Circle home card, Circle post type picker, Create sheet row, Feed promo, share to Feed, share to chat.

## Connections skipped

- Share to a Circle community: Circle posts are authored in Circle's own composer and there is no share-a-link write into a community, so none was invented.
- Invite a connection to a Circle: Circle's invite list is for private communities by member lookup, not a Roommates connection picker.
- "Roommates near here" on a school or area community linking to its campus page: a Circle community holds an areaId and no school link, so the student housing door goes to the schools list instead.
- Unread messages on the dashboard: the count is a client read of the inbox; the home read has none. Kept out rather than faked.
- Leave group Undo: rejoining is an invite or a request, not an inverse, so it keeps its confirm and a plain banner.

## Tests

nav-model.roommates.test.ts (own row, not docked, not under Circle, hidden when off, active state), home-dashboard.test.ts (next action, counts, tab for each path), school-list.test.ts, _parts/Dashboard.dom.test.tsx (new, ready, empty, signed out).
