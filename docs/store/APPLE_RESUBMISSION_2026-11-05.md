# Apple review, build 1.0.0 (10000126), rejected 4 November 2026

Submission ID 7f1fa012-8ee9-434d-b70d-65928df38654. Two findings. Both are fixed in the repository.

## What the red banner means

"Your app version was rejected and no other items submitted can be accepted" only means this
build cannot be approved as it stands. It does not stop a resubmission: after fixing, upload a
NEW build, select it on the version page, and press Resubmit to App Review (it is greyed out
until the issues are addressed: reply to Apple's message and attach the new build first).

## 2.5.4, background audio

Cause: `UIBackgroundModes` declared `audio`. Calls only play sound while Vallo is on screen.
Fix: `audio` removed from `apps/web/ios/App/App/Info.plist`; only `remote-notification` is
left (push). This needs a NEW BUILD (the plist is inside the app binary). Run the iOS
workflow again (`.github/workflows/native-ios.yml`, with the upload option) so the build number
goes up, then pick that build in App Store Connect.

## 3.1.1, Pro subscriptions

Cause: the app showed and sold Vallo Pro and Vallo Business (monthly plans paid outside the app)
with no In-App Purchase.
Fix: plans are switched off everywhere (`apps/web/src/lib/subscriptions/open.ts`,
`SUBSCRIPTIONS_OPEN = false`): the Pro menu row is gone, /pro and /pro/confirm go back to Home,
and the start-trial and checkout actions refuse. Because the app loads the live site, this takes
effect for the existing build as soon as the site is deployed; no new build is needed for it.
Bringing plans back later is one change: set it to `true` (and sell through In-App Purchase on iOS).

## Reply to paste into App Store Connect (Reply to App Review)

> Hello, thank you for the review of build 1.0.0 (10000126).
>
> Guideline 3.1.1: Vallo Pro and Vallo Business, the paid plans you saw, are removed from the
> app. There is no plan screen, no menu entry, no trial and no checkout anywhere in the app now.
> The app offers no paid digital content, subscriptions or functionality. What members pay for
> in Vallo (a rental, a deposit, a stay booking, a table) is a real-world service or good
> delivered outside the app, so In-App Purchase does not apply to it.
>
> Guideline 2.5.4: the "audio" value is removed from UIBackgroundModes. The only background mode
> left is remote-notification, for push notifications. The new build contains this change.
>
> We would also like to explain the delay. Vallo is a company registered in Nigeria and this app
> is our launch: our members, listers and the businesses waiting to join are held until it is
> approved. This is our first submission cycle with this app and it has now been open for about
> a month. Each round has meant a fixed, specific finding which we have corrected the same day.
> We have gone through the build against the full guidelines to avoid another round. If any
> other issue remains, please list all of it in one message so we can fix it in one pass. Thank
> you for your help.

## Notes for the "App Review Information" field (every submission)

> No account is needed to browse. To test signed-in features use the demo account in the Sign-in
> required fields. Vallo is a property and stays marketplace in Nigeria. Payments in the app
> are for real-world services (rent, deposits, stays, restaurant tables) paid to the lister or
> the venue; there are no digital goods, subscriptions or paid features inside the app. Push
> notifications are the only background mode. Voice and video calls work only while the app is
> open.

## Before pressing Resubmit

1. Deploy the site (done when the commit is on main).
2. Run the iOS workflow to make the new build; wait for it to finish processing in App Store Connect.
3. On the version page choose the new build.
4. Reply to Apple's message with the text above.
5. Paste the review notes above and keep the demo account working.
6. Resubmit to App Review.
