# Email banners, by kind of email (4 November 2026)

Every email Vallo sends is one of the 69 kinds in `apps/web/src/lib/email/icons.ts`, grouped
into ten families. Today the banner is chosen in `apps/web/src/lib/email/banners.ts`
(`bannerFor`): security and sign-in emails get `email-banner-2` ("Safe from the first tap."),
every other ordinary email gets `email-banner-1` ("Space, without the runaround."), and the
two families that are money and documents (payments, agreements) carry no banner on purpose.

## What exists

| Banner file | Used by |
|---|---|
| email-banner-1 | every ordinary email with no banner of its own yet |
| email-banner-2 | security and sign-in (codes, password, new device, recovery, deletion, staff access) |
| welcome-1, welcome-2, welcome-3 | the welcome email |
| newsletter-1, -2, -3 | the newsletter |

## Banners still to make (8), one per family, so each email feels like its own

| File to save as | Used for these kinds | Headline on the picture |
|---|---|---|
| listing-review.jpg | listingSubmitted, listingPassedReview, listingChangesRequested, listingRejected | Your listing is in review. |
| listing-live.jpg | listingApproved (the "it is live" email) | Your listing is live. |
| verification.jpg | agentApplicationApproved / Rejected / NeedsMore, verificationRungPassed / Failed | Verified, step by step. |
| viewing.jpg | inspectionScheduled / Proposed / Declined / Withdrawn / Completed | See it before you commit. |
| stay.jpg | bookingRequested, bookingConfirmed, stayArrivalDetails, bookingCancelled, bookingRefunded, stayReviewRequest | Your stay, sorted. |
| table.jpg | reservationConfirmed, reservationCancelled | Your table is waiting. |
| support.jpg | newEnquiry, supportTicketFiled, supportReplied | We have your message. |
| message.jpg | unreadMessages | You have a new message. |

Payments and agreements keep the plain sheet. A receipt is not the place for a picture.

## The prompt (paste this first in every ChatGPT request, with the Vallo logo attached)

> Premium dark banner for "Vallo", a marketplace for homes, stays and restaurant tables. Deep midnight navy background (#010118 to #000030) with a soft electric-blue glow (#0C6AEF) and a thin lit blue rim light (#2768C4), plus a small warm orange accent. Use the attached Vallo logo exactly as given, small and clear at top-centre. Do not redraw or recolour it. Large bold white headline in a clean modern sans-serif on the left, with the full stop in orange. Glossy 3D glass-and-chrome objects on the right, soft reflections on a glossy dark floor, a thin glowing blue and orange line curving behind. Clean, calm, high-end, lots of empty space. No people's faces, no flags, no other logos, no tiny text, no watermarks. Wide 5:2 banner, 1200x480.

Then add the line for the banner you want:

- **listing-review**: Headline "Your listing is in review." Objects: a glass house with a magnifying glass over it and a small check-list card.
- **listing-live**: Headline "Your listing is live." Objects: a glossy 3D house with a glowing green-blue check badge, tiny light rays, a "live" signal ring around it.
- **verification**: Headline "Verified, step by step." Objects: a glass shield with a check mark and three small glowing steps rising like stairs.
- **viewing**: Headline "See it before you commit." Objects: a glossy 3D house key and a small calendar card with a clock, a door slightly open behind them.
- **stay**: Headline "Your stay, sorted." Objects: a glass hotel bed with a small suitcase and a glowing confirmed-check card.
- **table**: Headline "Your table is waiting." Objects: a glossy 3D table set with two plates and a warm candle glow.
- **support**: Headline "We have your message." Objects: two glass chat bubbles, one with a small check mark, and a headset.
- **message**: Headline "You have a new message." Objects: a glass chat bubble with three dots and a small bell with a notification dot.

Save each as a 1200x480 JPEG or PNG with the file name above and send it back. Wiring one in is a
two-line change in `banners.ts`.
