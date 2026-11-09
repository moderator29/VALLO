# Vallo Roommates: 120 product and UX recommendations

Written 8 November 2026 alongside the build. Each row: the problem, the
proposal, what the user gets, what it needs, priority (P0 must, P1 should, P2
could) and phase (Launch, or Later). Rows marked BUILT are in this branch.

| # | Area | Problem | Proposal | User benefit | Needs | Pri | Phase |
|---|---|---|---|---|---|---|---|
| 1 | Onboarding | A long questionnaire loses people | Seven short steps, one idea each, saved as you go, lifestyle all optional (BUILT) | Done in about two minutes | StepFrame, draft saves | P0 | Launch |
| 2 | Onboarding | People do not know which journey fits | Four journey tiles on home and step one (BUILT) | Picks the right path at once | Copy, tiles | P0 | Launch |
| 3 | Onboarding | Empty profiles get no matches | Completeness ring with the next missing item named (BUILT) | Knows exactly what to add | `profileGaps` | P0 | Launch |
| 4 | Onboarding | A profile photo matters most for trust | Ask for the photo with a reason, link to the existing avatar editor | More replies | Avatar editor link | P1 | Launch |
| 5 | Onboarding | Students arrive from school WhatsApp groups | A school landing deep link that preselects the school in step four | One less question | Campus page link param | P1 | Launch |
| 6 | Onboarding | Corps members need speed before camp | An NYSC fast path: state of posting, arrival month, budget, done | Profile live before camp ends | Step skip rules | P1 | Launch |
| 7 | Onboarding | People leave halfway | A reminder notification 24 hours after a draft is left | Finishes the profile | Cron or notify_once | P2 | Later |
| 8 | Discovery | Random lists feel spammy | Server-side match ranking with reasons (BUILT) | Sees the best people first | `roommate_discover` | P0 | Launch |
| 9 | Discovery | A percentage alone means nothing | Top reasons under the figure, and the part bars on the profile (BUILT) | Understands why | MatchView | P0 | Launch |
| 10 | Discovery | No people in a new city on day one | Honest empty state with Save search and the Circle community link (BUILT) | Still has a next step | Saved searches | P0 | Launch |
| 11 | Discovery | Filters hidden behind a sheet are missed | Chip row with the active filters, tap to edit, X to clear (BUILT) | Sees what is applied | Filter chips | P0 | Launch |
| 12 | Discovery | Phones on 3G load slowly | 20 per page with Load more, server paging (BUILT) | Fast first paint | Offset paging | P0 | Launch |
| 13 | Discovery | People search by landmark, not area | Landmark search ("near UNILAG gate", "Ikeja GRA") via the existing landmarks table | Finds the right area | landmarks join | P1 | Later |
| 14 | Discovery | Commute matters more than distance | Commute time to school or work from the area centre | Realistic choices | Map provider routing | P2 | Later |
| 15 | Discovery | Users want to compare two people | Side by side compatibility for two shortlisted people | Easier decision | Compare view | P2 | Later |
| 16 | Discovery | Stale profiles waste time | Active in the last 30 days only by default, "Active today" chip (BUILT data) | Talks to real people | last_active_at | P1 | Launch |
| 17 | Discovery | Swiping is fun but shallow | No swipe deck: cards with reasons keep it considered | Better decisions | None | P1 | Launch |
| 18 | Matching | Weights are a guess | Staff can tune the five weights from admin (BUILT) | Better matches over time | `roommate_match_weights` | P1 | Launch |
| 19 | Matching | Learn from outcomes | Log interest, accept and viewing per score band, review monthly | Evidence-based tuning | Analytics events | P1 | Later |
| 20 | Matching | Budget only by month misleads yearly renters | Compare on the monthly equivalent, show the period the person chose (BUILT) | Fair comparison | `rm_monthly` | P0 | Launch |
| 21 | Matching | Dealbreakers are not all equal | Let a person mark up to two questions as must-match (smoking, pets) | Fewer bad matches | Prefs column, filter | P1 | Later |
| 22 | Matching | Gender preference can be misused | Filter only, both ways, never displayed unless chosen, explained respectfully (BUILT) | Safety without exposure | rm_gender_ok | P0 | Launch |
| 23 | Matching | Students care about course and level | Optional course and level shown with school (BUILT) | Finds classmates | Profile fields | P2 | Launch |
| 24 | Matching | Religion and tribe questions invite discrimination | Never asked, never filterable | Fairness, legal safety | Policy | P0 | Launch |
| 25 | Profiles | Over-sharing risks safety | Address, phone and documents never shown; school and work only when switched on (BUILT) | Privacy | Masked reads | P0 | Launch |
| 26 | Profiles | Badges oversell trust | Each badge names what was checked and when (BUILT) | Honest trust | Badge copy | P0 | Launch |
| 27 | Profiles | Intros are hard to write | Three example openings to start from, never auto-posted | Better intros | Copy | P1 | Launch |
| 28 | Profiles | A pause should not lose everything | Pause and turn back on, connections kept (BUILT) | Control | Status column | P0 | Launch |
| 29 | Profiles | People want to show their real life | Up to four "my space" photos on the profile | More trust | Storage, UI | P2 | Later |
| 30 | Profiles | Voice says more than text | A 20 second voice intro, using the chat voice note recorder | Personality | Voice storage | P2 | Later |
| 31 | Listings | The real cost is hidden | Cost card: share, deposit, agency, legal, service, total to move in (BUILT) | No surprises | moveInCost | P0 | Launch |
| 32 | Listings | Tenants sublet without permission | Authority declaration required to publish a room (BUILT) | Fewer evictions | Live shape check | P0 | Launch |
| 33 | Listings | Duplicate listings flood search | Flag the same photo hash or same title and area from one owner in admin | Clean results | Hashing job | P1 | Later |
| 34 | Listings | Stale rooms stay up | 60 day expiry with a renew button and a nightly job (BUILT expiry) | Fresh results | pg_cron | P0 | Launch |
| 35 | Listings | Owners forget to mark filled | A nudge 30 days after the first accepted viewing | Accurate stock | notify_once | P1 | Later |
| 36 | Listings | Photos are taken in the dark | Upload tips and an automatic brightness warning | Better photos | Client check | P2 | Later |
| 37 | Listings | Rooms inside a Vallo property duplicate data | Link to the existing property listing instead of re-entering it (BUILT) | One source of truth | listing_id | P0 | Launch |
| 38 | Listings | Agents list whole flats | "Good for sharing, up to N people" on property listings (BUILT column) | Groups find suitable flats | Wizard toggle | P1 | Launch |
| 39 | Listings | Video is the best viewing proxy | Allow a short walkthrough video per room | Fewer wasted trips | listing-videos bucket | P1 | Later |
| 40 | Listings | Rules surprise people later | House rules list on the post, shown before interest (BUILT) | Expectations set | house_rules | P0 | Launch |
| 41 | Create | Long forms abandoned | Step flow with a draft on every step and a local copy (BUILT) | Never loses work | localStorage + drafts | P0 | Launch |
| 42 | Create | Irrelevant fields confuse | Fields depend on the purpose chosen (BUILT) | Shorter form | Conditional steps | P0 | Launch |
| 43 | Create | People paste WhatsApp broadcasts | Reuse the listing wizard's broadcast paste to prefill title, rent and area | Faster posting | Parser reuse | P1 | Later |
| 44 | Create | AI can write a cleaner description | AI description from the facts, at most 10 a day (existing AI limit) | Better posts | AI route | P2 | Later |
| 45 | Find together | Strangers need a safe first step | Groups only invite connected people (BUILT) | Safety | roommate_connected | P0 | Launch |
| 46 | Find together | Groups need a place to talk | A group board (BUILT); a true group chat later | Coordination | Group threads | P1 | Launch |
| 47 | Find together | Deciding together is messy | Shortlist with yes, maybe, no votes and counts (BUILT) | Clear consensus | Votes table | P0 | Launch |
| 48 | Find together | Comparing flats is hard | Compare up to four: price, bedrooms, per person cost (BUILT) | Faster decision | splitCosts | P1 | Launch |
| 49 | Find together | Owner leaving strands a group | Ownership passes to the longest member (BUILT) | Group survives | leave function | P0 | Launch |
| 50 | Find together | Open groups help newcomers | Open groups near you with Request to join (BUILT) | Joins a group fast | open groups read | P1 | Launch |
| 51 | Find together | Groups need agents | "Invite an agent" to the group board for one listing, view only | Faster deals | Guest role | P2 | Later |
| 52 | Find together | Who pays what is unclear | Shares per member and the household costs record (BUILT) | Fair split | share_percent | P1 | Launch |
| 53 | Find together | Groups move in and keep using Vallo | Living stage: costs, rules, announcements (BUILT costs) | Retention | Stage | P1 | Launch |
| 54 | Household | Chores cause fights | Chore rota with gentle reminders | Peace at home | Tasks table | P2 | Later |
| 55 | Household | Bills are forgotten | Due dates on recorded costs with a reminder the day before | No late fees | Reminders | P2 | Later |
| 56 | Household | Roommate agreements are informal | A plain roommate agreement template inside the group | Clear terms | Doc template | P2 | Later |
| 57 | Household | Paying each other | Settle up through Vallo's licensed payment partner only after a separate review | Convenience | Money review | P2 | Later |
| 58 | Connections | Unsolicited messages are unsafe | Interest first, chat only on a mutual yes (BUILT) | Control | Interests table | P0 | Launch |
| 59 | Connections | Two people both interested wait | Mutual interest connects instantly (BUILT) | Speed | express_interest | P0 | Launch |
| 60 | Connections | Declined people retry | 30 day cool-off after a decline (BUILT) | No pestering | Check | P0 | Launch |
| 61 | Connections | Requests pile up unanswered | Expire pending requests after 21 days with a quiet notice | Tidy inbox | Expiry job | P1 | Later |
| 62 | Connections | A celebration helps | Subtle connected moment with next steps (BUILT) | Momentum | Motion, reduced motion | P1 | Launch |
| 63 | Messaging | A new chat lacks context | Chat opens with "You matched on Vallo Roommates" and the post card | Clear context | Chat system line | P1 | Later |
| 64 | Messaging | Sharing a room in chat | A room share card kind in messages | Easy sharing | SharedKind | P1 | Later |
| 65 | Messaging | Quick replies save typing | Chips: Is it still available, Can I view it, What is included | Faster talk | Chat chips | P2 | Later |
| 66 | Messaging | Off-platform payment scams | Existing off-platform payment warnings apply to roommate chats (BUILT, reused) | Safety | Existing scanner | P0 | Launch |
| 67 | Viewings | Viewings get forgotten | Request, confirm, reschedule, cancel, done (BUILT) | Reliable viewings | Viewings table | P0 | Launch |
| 68 | Viewings | A request looks like a reservation | "Requesting a viewing does not reserve the room" (BUILT) | No false hope | Copy | P0 | Launch |
| 69 | Viewings | Reminders reduce no-shows | Reminder two hours before a confirmed viewing | Fewer no-shows | Cron | P1 | Later |
| 70 | Viewings | Safety at first meetings | Share live viewing details with a trusted contact | Safety | Share sheet | P1 | Later |
| 71 | Viewings | Video viewings | A video call from the viewing using Vallo calls | Saves travel | Calls link | P2 | Later |
| 72 | Budget | People underestimate move-in cost | Cost splitter for upfront and monthly per person (BUILT) | Plans properly | splitCosts | P0 | Launch |
| 73 | Budget | Rooms differ in size | Weighted split by room (BUILT) | Fair shares | Weights | P1 | Launch |
| 74 | Budget | Electricity is the biggest unknown | Typical band estimates per area from Vallo's own records, labelled | Realistic budget | Data | P2 | Later |
| 75 | Budget | Split from a listing | Open the splitter prefilled from any listing (BUILT link) | One tap | Query params | P1 | Launch |
| 76 | Students | Students trust classmates | School pages with rooms and students (BUILT) | Local discovery | Institutions | P0 | Launch |
| 77 | Students | Fake students | School email check by code (BUILT) and student ID review (BUILT) | Trust | Verifications | P0 | Launch |
| 78 | Students | Session dates drive moves | Move-in by academic session (resumption month) | Better timing | Session field | P2 | Later |
| 79 | Students | Off-campus hostels are not "rooms" | A hostel bed space type | Fits reality | Room type value | P1 | Later |
| 80 | Students | Freshers do not know areas | School guide: areas near the gate, typical rents from Vallo data | Confidence | Content | P1 | Later |
| 81 | Students | Ambassadors grow campuses | Ambassador role with a referral link per school | Growth | Referral engine reuse | P2 | Later |
| 82 | NYSC | Posting letters arrive late | Save a search for the posting state and get alerts (BUILT alerts) | Ready on arrival | Saved searches | P0 | Launch |
| 83 | NYSC | Call-up letters are sensitive | Reviewed privately, never shown, deleted after the check (BUILT flow) | Privacy | Private bucket | P0 | Launch |
| 84 | NYSC | Corps members want each other | Filter "Corps member" plus state (BUILT) | Finds peers | Filters | P0 | Launch |
| 85 | NYSC | PPA areas are unknown | PPA area notes in the NYSC Circle community (BUILT community) | Local knowledge | Circle | P1 | Launch |
| 86 | Relocation | Moving before arriving | Relocation hub: rooms, people, Circle, stays for the first nights | Smooth move | Stays link | P1 | Later |
| 87 | Relocation | First week essentials | Nearby services list from Vallo places (food, laundry, internet) | Settles faster | Places data | P2 | Later |
| 88 | Safety | Scams target newcomers | Safety centre with plain rules (BUILT) | Fewer losses | Page | P0 | Launch |
| 89 | Safety | Report and block everywhere | Report profile and post, block person (BUILT, reused) | Control | Reports, blocks | P0 | Launch |
| 90 | Safety | Repeat offenders | Auto-hold a profile after three upheld reports | Faster protection | Rule in admin | P1 | Later |
| 91 | Safety | Payment requests in posts | Flag posts with account numbers for review | Fewer scams | Scanner reuse | P1 | Later |
| 92 | Safety | Identity matters for hosts | Identity verified badge reused from Vallo's KYC (BUILT) | Trust | Badge read | P0 | Launch |
| 93 | Verification | Codes can be brute forced | Five tries, 15 minute expiry, three codes an hour (BUILT) | Security | Code table | P0 | Launch |
| 94 | Verification | Badges age | School checks expire after a year (BUILT) | Current trust | expires_at | P1 | Launch |
| 95 | Verification | Schools change domains | Staff edit domains and switch checks per school (BUILT admin) | Accurate | Admin desk | P0 | Launch |
| 96 | Verification | Work verification | Work email domain check like schools | Trust for professionals | Domain list | P2 | Later |
| 97 | Feed | Roommate posts flood the feed | Own card, at most one share per post per week (BUILT) | Feed stays calm | Share rule | P0 | Launch |
| 98 | Feed | Some people do not want roommate content | "Show fewer roommate posts" mute in the feed | Control | Mute target | P1 | Later |
| 99 | Feed | Agents want reach | Agents share a property as good for sharing with the listing card | Supply | Showcase + flag | P1 | Later |
| 100 | Circle | Questions belong in community | Three Vallo-started communities (BUILT) | Answers from peers | Seed | P0 | Launch |
| 101 | Circle | Linking talk to listings | "Ask about this area" from a room post into the right community | Context | Deep link | P1 | Later |
| 102 | Saved | Bookmarks scattered | Roommate kinds in the universal collections (BUILT schema) | One saved place | Kinds | P1 | Launch |
| 103 | Saved | Saved searches need control | Toggle alerts, delete, open (BUILT) | Control | Hub tab | P0 | Launch |
| 104 | Notifications | Generic logo on alerts | Sender's face from `from=` in every roommate link (BUILT) | Recognisable | faceLookup | P0 | Launch |
| 105 | Notifications | Too many alerts | One saved-search alert per six hours (BUILT) | Calm | last_alert_at | P0 | Launch |
| 106 | Admin | Moderation needs one desk | Posts, profiles, verification, reports, schools, weights (BUILT) | Ops speed | Admin desk | P0 | Launch |
| 107 | Admin | Decisions must be traceable | Every staff action written to the audit log (BUILT) | Accountability | audit_log | P0 | Launch |
| 108 | Admin | Demand and supply gaps | Searches with no results by city and school | Where to grow | Analytics | P1 | Later |
| 109 | Analytics | Funnel unknown | Events: view, profile live, interest, accept, chat, viewing, filled | Know drop-offs | Funnel module | P1 | Later |
| 110 | Performance | Low-end Android | Cards without heavy blur on data-motion-lite, images at 640w | Smooth scroll | CSS gates | P0 | Launch |
| 111 | Performance | Weak networks | Previously loaded lists stay, cached copy labelled as possibly changed | No blank screens | Offline layer | P1 | Later |
| 112 | Accessibility | Screen readers | Every card a labelled link, chips as toggles with pressed state | Inclusive | aria | P0 | Launch |
| 113 | Accessibility | Motion sickness | All motion honours reduced motion (BUILT) | Comfort | Gates | P0 | Launch |
| 114 | Retention | People leave after finding a room | Household tools keep the group on Vallo | Retention | Living stage | P1 | Launch |
| 115 | Retention | Moving out again | "Moving soon" prompt a month before a recorded tenancy end | Repeat use | Date field | P2 | Later |
| 116 | Growth | Shareable links | Room posts and school pages open on the web (BUILT public reads) | Viral reach | Public reads | P0 | Launch |
| 117 | Growth | WhatsApp is where students are | Share sheet with a clean preview image per room | More clicks | OG image route | P1 | Later |
| 118 | Monetisation | Paywalls kill early growth | Contact stays free; later Spotlight for room posts via existing promotion tiers | Revenue without friction | lib/promotion | P2 | Later |
| 119 | Monetisation | Agents pay for reach | Featured "good for sharing" listings on school pages | Revenue | Promotion | P2 | Later |
| 120 | Legal | NDPR and fair housing | Privacy notice section for Roommates; no protected-attribute filters | Compliance | Legal copy | P0 | Launch |
