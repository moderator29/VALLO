# Feature backlog (27 October 2026)

Small features and tools that fit Vallo and the Nigerian market. **Status** is
what a search of the code found on 28 October 2026 ("exists" means a
implementation is present and was not re-tested here; it is not a claim that it
is finished or good). **Value** and **Effort** are H, M or L. **Priority** is
the order to build, 1 first. Nothing in the "New" rows was built in the
27 October session: that session went to the founder's reported defects first
(see `docs/PAGE_SWEEP.md` and the session report).

| # | Feature | Status | Value | Effort | Priority |
|---|---|---|---|---|---|
| 1 | Invited member's next-step card | Built 27 Oct | H | L | done |
| 2 | Wallet opens itself after phone confirmation | Built 27 Oct | H | M | done |
| 3 | Call failure log (`__valloCallLog`) | Built 27 Oct | M | L | done |
| 4 | Share to WhatsApp from listings, stays, posts and invites | Exists | H | L | review copy |
| 5 | Saved searches with alerts | Exists | H | M | review |
| 6 | Price drop alerts on saved places | Exists | H | M | review |
| 7 | Compare listings side by side | **Built 29 Oct** (compare tray on every member page, "Add to compare" on the listing page and the card menu, `/compare?ids=` page; shares the Saved compare table) | H | M | done |
| 8 | Recently viewed shelf | **Built 30 Oct** (stays and restaurants join the recently viewed memory, each opening at its own page) | M | L | done |
| 9 | Command palette (Cmd K) on desktop | Exists (member keys) | M | M | review |
| 10 | Keyboard shortcuts on desktop | Exists (`MemberKeys`) | M | L | document them in Help |
| 11 | Data saver mode | Exists | H | M | review |
| 12 | Offline pack of saved screens | Exists (service worker, kept pages) | H | M | measure |
| 13 | QR code for a listing or an invite | **Built 29 Oct** (invite already had one; the listing share sheet now draws a QR of the share door, in the browser) | M | L | done |
| 14 | Add a viewing or a stay to the phone calendar (.ics) | Exists | M | L | review |
| 15 | Listing completeness meter for hosts and agents | **Built 29 Oct** (steps done out of eight on every card in My listings, with the one next step as a link; not a score) | H | M | done |
| 16 | Host response time on a listing | Exists | H | M | review |
| 17 | Undo toasts on destructive taps | Exists | M | L | audit coverage |
| 18 | Pull to refresh on lists | Exists | M | L | review |
| 19 | Copy address / open in maps | Partial | M | L | 4 |
| 20 | Report a problem on any screen | **Built 30 Oct** (Settings, Help, "Report a problem" files a support ticket of kind problem with the screen named) | M | L | done |
| 21 | Language switch (English, Yoruba, Hausa, Igbo) | Exists | H | M | translations still English in places |
| 22 | Map and list kept in sync while panning | Exists in search | M | M | review |
| 23 | Quick filters strip (price, beds, type) | Exists | H | L | review |
| 24 | Skeleton states for every list | Mostly | M | M | audit with the five width sweep |
| 25 | Verified by mechanism badges with a "how" sheet | Exists | H | M | keep claims test green |
| 26 | Rent affordability line ("move-in total as a share of monthly income") | **Built 29 Oct** (arithmetic only on a tenancy page, income typed by the reader and kept on their device) | H | M | done |
| 27 | Neighbourhood notes: power, water, security reported by members | New | H | H | 12 |
| 28 | Generator and power backup filter and badge | Exists (the filter drawer has Backup power and Band A; the card and the page say it) | H | L | done, found already built |
| 29 | Move-in checklist (keys, meter, agreement) | New | M | M | 13 |
| 30 | Pay rent in instalments schedule view (read only) | New | H | H | needs money design |
| 31 | Verified phone and NIN status on a host card (mechanism stated) | Exists | H | M | review |
| 32 | Re-share a listing to a group with one tap and a short link | **Built 30 Oct** (the share sheet sends the short share link to a WhatsApp group in one tap) | M | L | done |
| 33 | "Last updated" and "still available" on every listing | **Built 29 Oct** ("Confirmed available 3 days ago" beside "Listed 12 days ago" while the lister's confirmation is under 30 days old; migration `20261029134320` grants the date to anon) | H | M | done |
| 34 | Viewing reminder 2 hours before, with the host's number hidden until confirmed | Exists | H | M | review |
| 35 | Saved places collections ("Lagos shortlist") | **Built 30 Oct** (named lists on Saved over listings, stays and tables; migration `20261030101036`) | M | M | done |
| 36 | Voice note in messages | New | M | M | 15 |
| 37 | Auto-translate a message to the reader's language | New | M | H | 20 |
| 38 | Photo order drag and drop for hosts | **Built 30 Oct** (drag or buttons to reorder host photographs; migration `20261030101303`) | M | M | done |
| 39 | Bulk reply templates for agents | **Built 30 Oct** (saved replies in agent settings, shown as chips above the message box; migration `20261030101535`) | M | L | done |
| 40 | Agent availability hours on profile | **Built 30 Oct** (hours in agent settings, shown on the listing as "Usually available"; same migration) | M | L | done |
| 41 | "Is this price fair" band from area price pages | Partial (`/areas`) | H | M | 19 |
| 42 | Dark and light follow the system for first run only | Exists (default dark by ruling) | L | L | none |
| 43 | Large text and high contrast settings | Exists (`ContrastSync`) | M | L | review |
| 44 | Reduced motion respected everywhere | Exists | M | L | keep tests |
| 45 | Install prompt for the web app (Android Chrome) | New | M | L | 21 |
| 46 | Share receipt as image or PDF | Partial | M | M | 22 |
| 47 | Landlord reference letter from a completed tenancy | New | H | M | 23 |
| 48 | Scam warning interstitial when a message asks for money off Vallo | Partial (scanner) | H | M | 24 |
| 49 | Report a no-show with evidence (host and guest) | Exists | M | M | review |
| 50 | Restaurant table map with seated status for hosts | Exists (`TableSeatingPanel`) | M | M | review |
| 51 | Menu photo gallery with prices | Partial | M | M | 25 |
| 52 | Opening hours "open now" chip everywhere | Partial | M | L | 26 |
| 53 | Event and group booking enquiry for venues | New | M | M | 27 |
| 54 | Referral leaderboard (private, own rank only) | New | L | L | none, risks gaming |
| 55 | Pidgin language option | New | M | H | founder decision |
| 56 | Weekly "new near you" digest email | Partial | M | M | 28 |

## Built on 29 October 2026 (Fork D), and what is left of the order

Done, each with tests, both themes and axe where it draws: 7, 13, 15, 26, 33
(28 turned out to exist already). Not built, in the order to take them:

| Next | Rows | Note |
|---|---|---|
| 1 | 8 recently viewed shelf | Exists with few call sites; a sweep, not a build |
| 2 | 32 re-share to a group with a short link | Partial; the share door exists |
| 3 | 20 report a problem on any screen | Partial; `ReportSheet` exists, add the entry point |
| 4 | 35 saved collections, 38 photo drag and drop, 39 bulk reply templates, 40 agent hours | Each is M or L with no dependency |
| Skipped | 30, 37, 55 | Need a design or provider decision from the founder; 54 is deliberately not built |

## How to read the priorities

1 to 3 are the next builds: finish **compare**, the **completeness meter** and
copy address. Rows marked "review" exist and should be looked at with the five
width sweep and a real phone, not rebuilt. Rows 30 and 37 need a design or a
provider decision from the founder first. Rows 54 is deliberately not
recommended: a public ranking pays people to game the referral engine.
