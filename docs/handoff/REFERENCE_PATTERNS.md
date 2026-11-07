# REFERENCE PATTERNS (HAUSLET AND OTHERS)

One entry per screenshot the founder sends, numbered in the order received.
Each entry: what it is, the pattern worth learning, and what Vallo does
instead (better, in Vallo's own identity). We learn patterns, never copy
branding, logos, wording or assets.

Privacy: no screenshot showing a real person's ID, document number or email
is ever copied into the repository, docs or help pages. Help-centre images use
demo data only.

---

## Batch 1 (7 November 2026, 15 images)

### R1. GitHub Actions: Native iOS run #156 (not Hauslet)
- **What it is.** The founder's proof that the native iOS workflow compiled
  and produced a signed archive (2 artifacts, 4m 19s, commit `cba7422`,
  Xcode 26.3).
- **Takeaway.** Build 1.0.1 exists. No action in this upgrade; any change
  that needs a new native build goes to `NATIVE_BUILD_QUEUE.md` and ships in
  one planned build.

### R2. Privacy choices sheet (first launch)
- **Pattern.** A full screen, plain-language consent: "Help us improve your
  experience". What is measured, why, that essential services are always on,
  that the OS will also ask about tracking, that choices are per device and
  changeable later. Three actions, equal weight: Accept all, Only necessary,
  Manage preferences (text link). A policy link.
- **Vallo.** Vallo has a consent surface already (audit). Upgrade it to the
  same honesty and calm: one screen, two equal pill buttons (no dark pattern
  where "Accept" is louder), a quiet "Choose what to share" link to a sheet of
  switches, and it never appears before the first useful screen on a cold
  start. Better: show a one-line summary of what was chosen in Settings,
  Privacy, with the date.

### R3. Search tab (signed out)
- **Pattern.** A big pill search field with a placeholder that is a real
  example ("Serviced apartment in Ikoyi"), a three-way segmented control
  (Shortlets, Rentals, Sales) with the active segment as a raised white pill
  and a thin accent icon, "Near me" row with a round icon tile, then
  "Suggested searches": each row a soft square icon tile, title, and a grey
  meta line ("Popular . 2 beds . Apartment"), hairline separators. Bottom
  tabs: five, thin line icons with labels, the active one filled in accent.
- **Vallo.** Search opens on the same calm structure but fed by Vallo's real
  data: recent searches first (on device), saved searches with alert state,
  then popular areas from real listing counts. Segments match Vallo's
  verticals (Rent, Buy, Stays, Tables). "Near me" asks for location only on
  tap, with a Vallo pre-prompt.

### R4. Sign-in completion: "Confirm your information" sheet
- **Pattern.** After Apple sign-in: a success banner at the top ("Signed in
  successfully." with an X in a grey square), the page behind blurred and
  dimmed, a bottom sheet with grabber, title, close X, one sentence of why
  ("make sure your name matches your government-issued ID"), an info card
  about the private Apple relay email, one large labelled field, a tall
  accent primary pill and a pale secondary pill "Skip for now".
- **Vallo.** Same stacked-sheet onboarding: banner, then sheet, with the
  page behind still visible. Vallo adds: name pre-filled from the provider,
  a live "This is how hosts will see you" preview line, and the relay email
  note linking straight to Settings, Account.

### R5. "Add a profile photo" sheet
- **Pattern.** The next banner replaces the previous one ("Thanks, your
  profile is confirmed."), the next sheet rises: title, one sentence saying
  it is optional, a large tinted circle with a thin person glyph, dark
  primary "Choose a photo", pale "Skip for now".
- **Vallo.** Same sheet, plus "Take a photo" on native (camera), a crop
  circle preview, and an honest note that the photo is shown to people you
  deal with. Banners replace, never stack (FeedbackBanner queue).

### R6. Community commitment (full page)
- **Pattern.** Soft tinted header with a large faint outline of the brand
  shape, small brand mark, uppercase grey eyebrow, a huge bold headline ending
  in an accent full stop, a lead sentence, a tinted card with a round tick and
  the pledge text, an accent "Learn more" link with arrow, and a sticky bottom
  bar: pale "Decline" and accent "Agree and continue" side by side.
- **Vallo.** A Vallo Community Promise in Vallo's own words and art, same
  structure. Accent full stop in headlines is a strong, cheap identity device:
  Vallo adopts its own version (the Vallo mark colour on the final stop of
  page titles on hero screens only, not everywhere).

### R7 and R8. "About the commitment" policy sheet
- **Pattern.** A tall bottom sheet over the blurred page: grabber, close X,
  big bold title with accent stop, Q and A sections (bold question, grey
  answer, accent bullets), inline accent links, an external-link row at the
  end, and a sticky pale "Go Back" pill.
- **Vallo.** Policies and explainers open as `Sheet` with a sticky footer.
  Long legal pages keep their own full routes for the web and search
  engines; the sheet shows the summary and links to the full page.

### R9. "Never miss an update" (notification pre-prompt)
- **Pattern.** After the welcome banner, on the profile page behind a blur:
  a sheet with a tinted bell tile, one sentence of what you get (messages,
  booking updates, viewing reminders), a small grey note ("You'll choose on
  the next screen. Your marketing preferences stay unchanged."), dark
  "Enable notifications", pale "Not now".
- **Vallo.** Already built as the `notify` beat of first run (P0.4b). Polish
  to this standard: bell tile, the exact list of what Vallo will send, the
  "you choose next" honesty line, and a success banner after Yes.

### R10. The system prompt, then the profile
- **Pattern.** The OS prompt appears only after the app's own Yes. Behind it:
  Profile with a big bold title, a bell button top right, a large rounded
  profile card (avatar, name, "Member since", three stats in a sunken strip:
  Reviews, Rating, New Member), a "Complete your profile" tinted card with
  rows and a dismiss X, a "List on Hauslet" promo row, list rows with thin
  icons and chevrons, and a floating dark pill "Switch to Agent Tools" over
  the content above the tab bar. Avatar letter as the Account tab.
- **Vallo.** Profile hub keeps Vallo's richer content (passport, trust
  score) inside the same calm card. The role switch lives in the side nav
  (founder's ruling) AND as a floating pill on the mobile profile. "Complete
  your profile" becomes a real checklist (photo, phone, ID, passcode) with a
  progress ring, each dismissible.

### R11 and R12. "What do you manage?" sheet (agent side, first entry)
- **Pattern.** Over a blurred dashboard: four big option cards (icon, bold
  title, one grey line): Rentals, Shortlets, Sales, A mix of services. The
  selected card gets a tinted fill, accent border and a tick on the right.
  Accent "Continue" and pale "Skip for now (use All)".
- **Vallo.** Same first-entry sheet on the agent side, using Vallo's
  verticals (Rentals, Sales, Stays, Restaurants, Everything), writing to the
  dashboard focus preference. Changeable from "Customise" on the dashboard.

### R13. Agent calendar
- **Pattern.** Big title, an "All" filter pill top right, month name with an
  accent full stop, a chevron month picker, year in grey, prev and next round
  buttons, a "Month" view pill and a round property filter button. A white
  rounded card holds a grid of rounded day cells (today tinted with an accent
  border, other months greyed). A legend of sparkle glyphs with counts:
  Check-in, Check-out, Viewing, Blocked. Agent tab bar: Dashboard, Listings,
  Activity, Calendar, Account (avatar letter).
- **Vallo.** Vallo's agent calendar adopts the rounded-cell grid and the
  legend-with-counts, fed by real bookings, viewings and blocks, with tap a
  day to open a sheet of that day's events and quick block or unblock.

### R14. Agent activity
- **Pattern.** Big title, "All" filter pill, a segmented control (Bookings,
  Applications, Viewings), then a scrolling underline tab row with counts
  (All (0), Pending (0), Upcoming (0), Ongoing (0), Completed), a sunken
  search field "Search by listing or booking ref", and a centred empty state:
  thin calendar glyph and one grey line.
- **Vallo.** One Activity inbox on the agent side with the same two-level
  filter, counts from real data, and designed empty states with one action
  ("Share your listing").

### R15. Help guide page on the website (in-app browser)
- **Pattern.** A docs site ("Pages") with brand mark, search, a tinted tip
  callout with a bulb icon, "Before you start" bullet checklist, numbered
  "Step 1: Start a new listing" sections, inline accent links, and a real
  screenshot strip of the app's action chips (Add listing, Applications, Find
  leads, Calendar). States that app and web steps are the same.
- **Vallo.** A Vallo Help Centre (P1.7) with the same article anatomy: tip
  callouts, "Before you start", numbered steps with Vallo's own screenshots
  taken after the upgrade with demo data, and deep links that open the real
  screen in the app.

---

## Patterns that repeat across this batch (the language to adopt)

1. Success banner at the top, replaced not stacked, with a dismiss X.
2. Stacked bottom sheets over a blurred, dimmed page for one-question
   onboarding steps.
3. One primary (accent or ink) plus one pale secondary pill, both full width
   and about 56px tall.
4. Huge bold titles; accent full stop on hero titles.
5. Thin line icons in soft square tiles; tinted circles for hero glyphs.
6. Segmented controls as a sunken track with a raised white active pill.
7. Big rounded white cards with hairline borders, almost no shadow.
8. Honest small grey notes under actions ("You'll choose on the next screen").
9. Empty states: one thin glyph, one grey sentence, centred.
10. Counts inside filter tabs, in grey, the active count in accent.
