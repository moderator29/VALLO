# THE FOUNDER'S BRIEF, WORD FOR WORD (6 November 2026)

This is the founder's full message, exactly as written, for the session that
does Platform Grade 1 Readiness. It is the source of truth: where
`PLATFORM_GRADE_1_READINESS.md` and this file disagree, this file wins.

The only change: every em dash was replaced with a colon, because the
repository refuses em dashes (`apps/web/scripts/check-no-em-dash.mjs`).
Spelling, wording and order are otherwise untouched.

The founder writes fast and informally. Read for intent. "hauslet" is the
competitor app Hauslet. "SS" means screenshots. "image 2" refers to a
screenshot sent in the chat.

---

Okay perfect I think we go back to my biggest issues and worries because this is getting over me….  with our capacitor we continue but we upgrade it all to work and clean like hauslet stuffs like "Native feel: Smooth transitions, proper iOS status bars, safe areas, gestures and navigation.
Performance: Fast startup, lazy loading, image optimisation and caching.
Premium design: Consistent typography, spacing, animations and polished screens.
Native integration: Push notifications, camera, location, deep links and other relevant native capabilities.
Reliability: Proper error handling, offline states, secure authentication and crash monitoring."  And I would send you a lot of that hauslet platform screenshot so we have our steps similar like that but ours should even be more better okay ?! But let's pause for that and get our platform cleaner you get me ?! But let's first get this push notification stuffs done you get me ?! And the notification bell stuffs let me go try it okay ?! On this stuffs I would give you more infos and stuffs I need…  that means I don't update our platform screenshot stuffs until we are done with this update ? And we then have the updated so here is the plan go through the entire codebase and give plan for this stuffs so we can get how hauslet works offline etc then you write a masterminded handoff that do everything so a new session can work on it so you know how I feel and what I want and my rules…. So you can get this ready add to the handoff I would be sending a lot of screenshots that it should copy also add all the infos and stuffs you noticed from the hauslet images and other platform so our platform works that way okay ?! All things okay think please I beg you add to the handoff to use 4 agent max I mean for the new session tell it that in the screenshots etc that verification steps way ours should look similar to theirs more pages more stuffs and copy many UX they have also we need to do something even more slick look at this image we copy their exit agent tools and switch to agent tools buttons but ours should be in side nav okay ?! And it should work like that switch also make that switch too work fine and switch on low data or no data those cache etc stuff we would be doing okay ?! Add voice message to our messaging and also reactions too this hands off contain everything you can imagine off okay ? You get what I mean and with this more animations etc also that verification stuffs that take you to our browser website like theirs did so it and also that documents part that says how to list etc all of it would be in the screenshots I would be sending to the new session so you make it understand what it's about to do not rebuilding our platform but upgrading it you get the drill on all this things ?! The slightest to the iOS feel you get me ?! Think for me 


VALLO: PREMIUM NATIVE iOS EXPERIENCE & PLATFORM UPGRADE

You are working on my existing Vallo platform, a premium Nigerian marketplace for properties, accommodation, stays and restaurant reservations.

Your task is to thoroughly audit and upgrade the existing platform to deliver a polished, modern, premium mobile experience that feels as close as possible to a professionally developed native iOS application.

IMPORTANT: Do not rebuild the platform from scratch. Do not replace Capacitor or unnecessarily change the existing architecture. Build upon the existing codebase, features, backend, APIs and design system. Preserve everything that currently works.

1. Native iOS Experience

Make Vallo feel like a genuine iPhone application rather than a website displayed inside an app.

* Implement polished native-feeling navigation and transitions.
* Improve iOS status bar and safe-area handling.
* Create smooth page transitions and gestures.
* Improve scrolling, touch feedback, loading animations and interactions.
* Ensure tabs and navigation behave naturally on iPhone.
* Add appropriate native-feeling bottom navigation.
* Eliminate awkward web-like behaviour wherever possible.

2. Improve Navigation, Tabs & Pages

Audit the entire platform and identify opportunities to improve navigation and discoverability.

* Improve the bottom navigation and tab structure.
* Add useful dedicated pages and subpages where appropriate.
* Make navigation between Property, Vallo Stays, restaurants, bookings, user accounts and other existing services intuitive.
* Improve search, filters, saved properties, booking history, notifications and profile navigation.
* Ensure every important feature is easy to discover.
* Avoid unnecessary tabs, duplicate functionality and clutter.

3. Premium UI/UX Upgrade

Refine the entire platform to feel more sophisticated and consistent.

* Improve spacing, typography, icons, buttons and component consistency.
* Introduce polished micro-interactions and subtle animations.
* Improve cards, listing layouts, image galleries, search interfaces and detail pages.
* Make empty states, loading states and error screens look professionally designed.
* Maintain Vallo's existing brand identity, colours and visual direction.
* Ensure the experience looks excellent across different iPhone screen sizes.

Do not randomly redesign existing screens. Improve them intelligently and maintain a consistent visual language.

4. Native iOS Integrations

Audit the existing Capacitor setup and implement appropriate native integrations where useful.

Consider:

* Push notifications.
* Universal Links and deep linking.
* Camera and photo library access.
* Location permissions and location-based discovery.
* Native share functionality.
* Haptic feedback.
* Status bar and splash screen customisation.
* Keyboard behaviour and native input handling.
* App lifecycle and foreground/background handling.

Ensure permissions are requested appropriately and only when necessary.

5. Deep Linking & Navigation Intelligence

Implement proper deep-link support so users can open specific Vallo content directly.

Examples:

* A property listing.
* A hotel or apartment.
* A restaurant.
* A booking or reservation.
* A particular category or search result.
* A user notification destination.

Links should open the correct screen inside Vallo when installed and have an appropriate web fallback when the app is not installed.

Preserve navigation state and ensure links work when the app is already open, running in the background or launched from a closed state.

6. Performance & Loading Optimisation

Make Vallo feel fast and responsive.

* Optimise initial application startup.
* Implement lazy loading and pagination.
* Optimise image delivery, sizing and caching.
* Reduce unnecessary API requests and repeated rendering.
* Improve frontend bundle efficiency.
* Implement appropriate skeleton screens and progressive loading.
* Cache suitable data without displaying outdated or incorrect information.
* Improve network failure handling and offline experiences.

Do not sacrifice functionality or data accuracy for performance.

7. Security, Stability & Reliability

Audit authentication, API communication, permissions, session handling and error management.

* Prevent broken navigation and application crashes.
* Handle expired sessions appropriately.
* Ensure secure handling of sensitive data.
* Improve network error handling.
* Check for memory leaks and performance bottlenecks.
* Add or improve crash reporting where appropriate.
* Ensure existing payment, booking and account functionality remains reliable.

8. Quality Assurance

Test the upgraded application across the important user journeys.

Check:

* App launch and onboarding.
* Registration and login.
* Property discovery and listing details.
* Vallo Stays discovery and booking.
* Restaurant discovery and reservations.
* Search and filters.
* Saved items.
* Notifications.
* Account and settings.
* Deep links.
* Navigation between tabs.
* Backgrounding and reopening the application.

Test on different iPhone screen sizes and ensure the experience remains polished.

9. Development Rules

Before making changes:

1. Inspect the existing architecture and understand how the platform works.
2. Audit the current UI, navigation, Capacitor configuration, APIs and installed plugins.
3. Identify existing problems and opportunities for improvement.
4. Prepare a practical implementation plan.

Then implement the improvements directly in the existing codebase.

Important restrictions:

* Do not remove existing features.
* Do not break existing backend integrations.
* Do not replace working APIs with mock data.
* Do not introduce unnecessary dependencies.
* Do not create duplicate pages or redundant navigation.
* Do not hardcode information that should come from the backend.
* Do not claim a native integration is complete unless it has actually been implemented and tested.
* Maintain compatibility with the existing App Store application and deployment setup.

If additional native plugins, permissions, entitlements, Apple configurations, API changes or external services are required, identify them clearly.

10. Final Deliverables

When finished, provide:

1. A summary of everything upgraded.
2. All new pages, tabs and navigation improvements.
3. All native iOS integrations implemented.
4. Performance improvements made.
5. Bugs discovered and fixed.
6. Any remaining issues or limitations.
7. Any additional plugins, APIs, credentials or Apple Developer configurations required.
8. A list of tests performed and their results.
9. Any steps I need to complete before submitting an updated version to the Apple App Store.

FINAL OBJECTIVE

Vallo should feel like a premium, established iOS marketplace application, with smooth native-feeling interactions, sophisticated navigation, excellent performance and a consistent premium design.

The goal is not simply to make the existing website look better on mobile. The goal is to elevate the entire mobile application experience while preserving the existing product, architecture, business logic and functionality.

Think like a senior iOS engineer, mobile product designer and performance engineer working together on a serious commercial product.


11. CROSS-PLATFORM NATIVE EXPERIENCE: iOS AND ANDROID

Vallo is a cross-platform application distributed on both Apple's App Store and Android through Capacitor.

It is extremely important that this upgrade improves BOTH platforms, not just iOS.

The objective is to make Vallo feel like a professionally engineered mobile application on both operating systems while maintaining one shared codebase wherever practical.

Shared Experience

Maintain a consistent Vallo brand identity, design system, typography, colours, components, business logic and overall product experience across both platforms.

Users should recognise Vallo immediately regardless of whether they use an iPhone or Android device.

iOS Optimisation

Implement platform-appropriate:

* iOS navigation and transitions.
* Safe areas and status bar handling.
* Native-feeling gestures and haptic feedback.
* Keyboard and modal behaviour.
* Universal Links and deep linking.
* iOS permissions and native integrations.

Android Optimisation

Implement platform-appropriate:

* Android navigation and transition behaviour.
* Correct Android system bars and edge-to-edge display.
* Android back-button and predictive-back support where available.
* Android keyboard and window resizing behaviour.
* Material-inspired touch interactions and feedback.
* Android deep links and App Links.
* Android permissions and native integrations.
* Proper handling of different screen densities and device sizes.

Platform-Aware Design

Do not simply copy iOS interface behaviour onto Android or vice versa.

Where appropriate, use platform detection and reusable platform-specific components to adapt interactions, navigation, system UI and other operating-system behaviours.

However, avoid creating two completely separate applications or duplicating the entire frontend.

Keep the experience visually consistent while respecting the conventions of each platform.

Capacitor Architecture

Audit the existing Capacitor configuration, plugins, dependencies and native iOS and Android projects.

Ensure:

* Both applications remain compatible with the existing backend.
* Native integrations work correctly on their respective platforms.
* Platform-specific configurations are correctly implemented.
* Plugins are properly configured for iOS and Android.
* No platform-specific functionality breaks the other platform.
* Both platforms receive equivalent core functionality.

Cross-Platform Testing

Test the application on actual or representative iOS and Android devices.

Specifically verify:

* Launch and splash screens.
* Navigation and bottom tabs.
* Back-button behaviour.
* Safe areas and system bars.
* Keyboard behaviour.
* Search and filters.
* Property and accommodation browsing.
* Booking flows.
* Deep links.
* Push notifications.
* Camera and location permissions.
* Scrolling and animations.
* Performance and application stability.

Final Requirement

Deliver one cohesive, premium Vallo application experience that feels at home on both iPhone and Android.

Do not make Android feel like an inferior version of iOS, and do not make iOS feel like a generic Android web application.

Both platforms must receive the same level of design quality, performance, polish and reliability.


12. DEEP PERFORMANCE AUDIT: iOS WKWebView & ANDROID WEBVIEW

I want a serious, independent performance audit of Vallo's iOS and Android applications.

Do not assume that because the application performs smoothly on one platform, it performs equally well on the other.

Both platforms must be independently inspected, tested and optimised.

A. iOS WKWebView Performance

Audit the actual WKWebView experience on iOS.

Investigate:

* Application startup and time to first usable screen.
* WKWebView initialisation and rendering performance.
* JavaScript execution and main-thread blocking.
* Memory consumption and memory growth.
* Scrolling performance and dropped frames.
* Animation smoothness.
* Image loading and rendering.
* Navigation and page transition performance.
* Backgrounding, foregrounding and application recovery.
* Memory pressure and potential crashes.

Identify and resolve unnecessary rendering, memory leaks, expensive JavaScript operations and other bottlenecks.

B. Android WebView Performance

Independently audit Android's actual WebView performance.

Pay particular attention to lower-end and budget Android devices commonly used in Nigeria.

Investigate:

* Cold-start and warm-start performance.
* WebView initialisation time.
* JavaScript execution and rendering delays.
* Memory consumption and garbage collection.
* CPU utilisation.
* Scrolling responsiveness and dropped frames.
* Animation performance.
* Image decoding and rendering.
* Navigation responsiveness.
* Keyboard and input performance.
* Background and foreground recovery.
* WebView crashes and memory pressure.

Do not optimise Android based solely on results from high-end devices.

C. Real-World Device Testing

Test using a representative range of hardware:

* Older and lower-end Android devices.
* Budget Android devices with limited RAM.
* Mid-range Android devices.
* Modern flagship Android devices.
* Older supported iPhones.
* Modern iPhones.

Where physical devices are unavailable, use realistic device emulation and clearly distinguish simulated results from actual hardware measurements.

D. Startup & Loading Optimisation

Make both applications launch as quickly as reasonably possible.

Investigate:

* Application initialisation.
* Capacitor bridge initialisation.
* WebView creation.
* Frontend bundle loading.
* API request dependencies.
* Authentication and session restoration.
* Initial screen rendering.
* Unnecessary startup scripts and dependencies.

Prioritise showing a usable interface quickly rather than waiting for every API request and resource to finish loading.

E. Memory & Resource Management

Audit memory consumption independently on both platforms.

Look for:

* Memory leaks.
* Unreleased event listeners.
* Unnecessary background processes.
* Excessive image memory usage.
* Duplicate API requests.
* Unnecessary cached objects.
* Large JavaScript bundles.
* Components that remain mounted unnecessarily.
* Expensive animations and rendering operations.

Implement appropriate resource management and caching strategies.

Ensure memory usage remains stable during prolonged browsing and navigation.

F. Performance Budgets & Measurements

Establish measurable performance baselines before making changes.

Track and report:

* Cold-start time.
* Warm-start time.
* Time to first usable screen.
* Time to interactive.
* Memory consumption.
* JavaScript bundle size.
* Image loading performance.
* Scrolling frame performance.
* API response times.
* Crash frequency where monitoring data is available.

Set realistic improvement targets based on actual measurements.

Do not invent performance results or claim improvements without testing.

G. Network & Data Efficiency

Vallo is designed for Nigerian users, including users with slower mobile connections and limited data.

Optimise for:

* Slow and unstable mobile networks.
* High-latency connections.
* Interrupted requests.
* Efficient image delivery.
* Lazy loading.
* Pagination.
* Intelligent caching.
* Retry handling.
* Reduced unnecessary network traffic.

The application should remain usable even when connectivity is poor.

H. Final Performance Report

Provide separate iOS and Android reports.

For each platform, document:

1. Initial performance measurements.
2. Major bottlenecks discovered.
3. Optimisations implemented.
4. Final measurements.
5. Memory usage before and after.
6. Startup performance before and after.
7. Devices and testing environments used.
8. Remaining limitations.

FINAL PERFORMANCE OBJECTIVE

Vallo must deliver a consistently smooth, responsive and reliable experience across both iOS and Android.

Do not prioritise flagship devices while neglecting budget Android phones.

I want Vallo optimised for real-world Nigerian mobile conditions, not just ideal development environments.

Performance, responsiveness, stability and efficient resource usage must be treated as core product requirements, not optional improvements.

VALLO: COMPLETE NATIVE MOBILE EXPERIENCE TRANSFORMATION

Premium iOS + Android | Capacitor | Deep UX Engineering | Native Interactions | Offline Experience

You are upgrading the existing Vallo application, a premium Nigerian property, accommodation, stays and restaurant marketplace.

This is a major product-quality upgrade, not a simple visual redesign.

I want you to study the attached Hauslet and X screenshots carefully. Treat them as important design and interaction references. Study their layouts, navigation, notifications, icons, feedback, forms, overlays, offline experiences and general attention to detail.

Our objective is to bring Vallo to that level of quality and, wherever possible, exceed it.

The application must feel like a professionally engineered native iPhone and Android application, even though we are retaining our existing Capacitor architecture.

Do not rebuild the platform from scratch. Do not remove working functionality. Do not replace Capacitor unnecessarily. Work with the existing codebase, backend, APIs, database and product architecture.

⸻

1. CREATE A DEDICATED UX RESEARCH AND RECOMMENDATION AGENT

Before implementation, establish a dedicated Agent 1 whose responsibility is to investigate how Vallo can become significantly more polished, intuitive, professional and native-feeling.

If your environment supports multiple agents or subagents, use them.

Agent 1 must act as a senior mobile product designer, UX researcher and mobile interaction specialist.

Its responsibilities:

* Study every attached reference screenshot.
* Inspect the entire existing Vallo application.
* Identify features and interactions that are missing.
* Identify existing experiences that feel web-like, amateur, outdated or unnecessarily complicated.
* Study how premium mobile applications handle similar interactions.
* Identify opportunities for new screens, dedicated pages, navigation improvements, tools, components and user conveniences.
* Produce at least 100 meaningful, actionable UX and product-quality recommendations.

These 100+ recommendations must not be random ideas. They must be grounded in Vallo's actual features, architecture and user journeys.

Organise them into categories:

1. Navigation and application structure.
2. Native iOS interactions.
3. Native Android interactions.
4. Notifications and feedback.
5. Offline experiences.
6. Saving, favourites and collections.
7. Property discovery.
8. Vallo Stays.
9. Restaurant discovery and reservations.
10. Messaging and communication.
11. Booking management.
12. Property publishing and management.
13. Forms and input experiences.
14. Search and filtering.
15. User accounts and profiles.
16. Onboarding and authentication.
17. Loading and performance.
18. Visual design and animations.
19. Accessibility.
20. Security and reliability.

For every recommendation, explain:

* What should be improved or introduced.
* Why it improves the user experience.
* Where it belongs in Vallo.
* How it should work.
* Whether it requires frontend, backend, API, Capacitor or native implementation.

Prioritise recommendations according to user impact, implementation complexity and business value.

IMPORTANT: Do not stop after producing the recommendations. Agent 1 must also take responsibility for ensuring the approved high-value recommendations are actually implemented and verified.

Do not create 100 unnecessary pages simply to satisfy a number. Recommend dedicated pages where they genuinely improve navigation and functionality.

2. GLOBAL NATIVE INTERACTION FEEDBACK SYSTEM

This is one of my highest priorities.

Study the notification and confirmation references carefully.

I want Vallo to have a consistent application-wide feedback system.

Whenever a user successfully performs an action, show a polished notification banner at the top of the current screen, similar to the attached Hauslet and X references.

Examples:

* Property saved.
* Property removed from saved items.
* Message sent.
* Reply sent.
* Booking confirmed.
* Reservation submitted.
* Profile updated.
* Password changed.
* Account created.
* Login successful.
* Listing published.
* Photos uploaded.
* Changes saved.
* Review submitted.
* Notification preferences updated.

Examples of actual presentation:

"✓ Property saved"

"✓ Message sent"

"✓ Booking confirmed"

"✓ Welcome to Vallo"

"✓ Your profile has been updated"

The notification system should have:

* A wide, elegant rectangular presentation.
* Rounded corners.
* A subtle border or shadow.
* A clean success, error or information icon.
* Clear, readable text.
* Smooth entrance and exit animations.
* Proper positioning below the iOS or Android system status bar.
* Correct safe-area handling.
* Consistent presentation throughout the application.

Use a suitable native-feeling appearance rather than browser-style alerts.

Notification behaviour

* Automatically disappear after an appropriate duration.
* Allow manual dismissal where appropriate.
* Never block important interactions.
* Handle multiple notifications without creating a pile of overlapping banners.
* Queue or intelligently replace notifications.
* Show meaningful messages rather than generic "Success".
* Ensure failed actions display clear error messages.
* Distinguish success, warning, information and failure states.

For example, if a message fails to send, do not show "Message sent".

Instead:

"Message couldn't be sent. Check your connection and try again."

Where possible, provide an appropriate retry action.

Global implementation

Build a reusable, centralised notification/feedback system.

Every important action throughout Vallo must use the same system rather than every page implementing its own notification design.

The system must work consistently across iOS and Android.

3. NATIVE KEYBOARD AND TYPING EXPERIENCE

I want typing in Vallo to feel like typing inside a genuine native application.

Pay particular attention to the experience shown when a user is typing into search fields, messaging interfaces, forms, property descriptions and other inputs.

Keyboard sounds

I like the subtle sound feedback associated with native mobile typing.

Investigate how to preserve the operating system's native keyboard sound behaviour.

Important:

* Do not introduce loud, artificial keyboard sounds.
* Do not play custom sound effects for every keystroke.
* Respect the user's iOS keyboard sound settings.
* Respect Android sound and touch-feedback settings.
* Do not override system preferences.
* Do not introduce unnecessary sound effects that make Vallo annoying.

Use the native keyboard experience wherever possible.

Keyboard behaviour

Improve:

* Keyboard opening and closing.
* Input focus.
* Automatic scrolling to focused inputs.
* Keyboard dismissal.
* Form navigation.
* Next and Done keyboard actions.
* Search field behaviour.
* Text selection and paste.
* Multiline text editing.
* Keyboard resizing and safe-area handling.

On Android, test window resizing and the relationship between the keyboard, content and bottom navigation.

On iOS, ensure the keyboard does not cover important controls or cause awkward layout jumps.

For messaging, the composer should remain properly positioned above the keyboard.

The user should be able to type, send, dismiss the keyboard and continue browsing without awkward layout changes.

4. OFFLINE MODE, SAVED PAGES AND CONNECTION MANAGEMENT

Study the first attached Hauslet screenshot carefully.

I particularly like the way it communicates offline status and provides access to saved content.

I want Vallo to have a significantly more intelligent version of this experience.

Connection awareness

Vallo should understand the difference between:

* Fully connected.
* Slow connection.
* Unstable connection.
* Temporarily disconnected.
* Reconnected.

Do not simply display a generic browser error when connectivity is lost.

Create a proper Vallo-designed connection experience.

Offline access

Users should be able to access appropriate previously viewed or explicitly saved information when offline.

Consider supporting:

* Saved properties.
* Previously viewed property details.
* Saved accommodation.
* Shortlisted restaurants where appropriate.
* Cached property information.
* Recently viewed listings.
* Previously loaded images where available.
* Relevant booking information that can safely be cached.

The offline experience should clearly identify information that may have changed.

For example:

"Saved on your device. Price and availability may have changed."

Never present cached prices, availability or booking information as confirmed live information.

Offline screen

Create a polished offline interface inspired by the reference.

Include:

* Clear offline status.
* Retry connection action.
* Access to previously saved content.
* Recently viewed content.
* A clear route back home.
* Helpful explanations.
* Automatic recovery when connectivity returns.

Do not make users feel that the application is broken simply because their connection is temporarily unavailable.

Synchronisation

When the connection returns:

* Refresh appropriate information.
* Retry safe failed requests.
* Synchronise eligible queued actions.
* Avoid duplicate bookings, messages or payments.
* Inform users when pending actions have succeeded or failed.
* Preserve unsent user content where possible.

Never automatically submit a payment or booking without the necessary confirmation.

Build a proper offline-aware experience, not just a cached homepage.

5. NATIVE GLASS, OVERLAYS AND PREMIUM CONTAINERS

Study the attached references and improve the visual treatment of Vallo's components.

I want a sophisticated, modern interface with carefully used glass effects.

Consider:

* Subtle translucent containers.
* Controlled background blur.
* Refined floating surfaces.
* Premium modal sheets.
* Clean notification containers.
* Floating search and action controls where useful.
* Subtle borders and shadows.
* Proper visual hierarchy.
* Consistent corner radii.

Do not put glass effects everywhere.

Use them selectively for components such as:

* Floating navigation elements.
* Contextual action panels.
* Certain overlays.
* Modal sheets.
* Selected controls.
* Floating notifications where appropriate.

Keep important content readable.

Ensure blur and transparency do not cause performance problems on lower-end Android devices.

Provide appropriate non-blurred fallbacks where necessary.

6. ICON SYSTEM AND MICRO-INTERACTIONS

I particularly like the slimmer, cleaner icons in the references.

Audit Vallo's entire icon system.

Replace inconsistent, oversized, cartoonish or visually heavy icons with a cohesive professional icon family.

Aim for:

* Thin and elegant line icons.
* Consistent stroke weights.
* Consistent sizing.
* Clean visual alignment.
* Appropriate active and inactive states.
* Proper spacing.
* Recognisable symbols.

Avoid mixing unrelated icon families.

Interaction details

Introduce subtle feedback for:

* Tapping a button.
* Saving a property.
* Selecting a tab.
* Opening a menu.
* Expanding a section.
* Sending a message.
* Completing a booking.
* Selecting filters.
* Changing favourites.

Use subtle animations and appropriate haptic feedback.

The interface should feel responsive without becoming excessively animated.

Respect reduced-motion accessibility settings.

7. BOTTOM NAVIGATION AND APPLICATION STRUCTURE

Study the X screenshot's bottom navigation and the general efficiency of its mobile layout.

Audit Vallo's existing navigation.

Create a clear, professional and consistent navigation structure.

Consider the best arrangement of:

* Home.
* Discover/search.
* Property.
* Vallo Stays.
* Restaurants.
* Saved items.
* Bookings.
* Messages.
* Notifications.
* Profile.

Do not put every feature into the bottom bar.

Determine which destinations deserve primary navigation and which should live inside dedicated sections.

Make it easy to move between major sections without constantly returning home.

The bottom navigation must:

* Feel appropriate on iOS.
* Feel appropriate on Android.
* Have clean icons and readable labels.
* Show clear active states.
* Handle badges for unread messages and notifications.
* Respect system safe areas.
* Avoid keyboard overlap.
* Preserve appropriate navigation state.
* Work correctly when deep links open specific screens.

Use platform-aware behaviour while keeping Vallo's overall design consistent.

8. PROPERTY PUBLISHING AND FORMS

Study the second Hauslet screenshot very carefully.

I like the clean form design, progress indicator, title and description editing, AI assistance, undo functionality and clear continuation flow.

Bring these quality standards into Vallo's property publishing experience.

Audit every property publishing step.

Improve:

* Progress indicators.
* Form layout.
* Field labels.
* Input borders.
* Input focus states.
* Validation.
* Character counters.
* Description editing.
* Photo uploading.
* AI-assisted descriptions.
* Save and continue.
* Draft management.
* Confirmation messages.
* Undo actions where appropriate.

Make long forms feel manageable.

Use intelligent sections, helpful explanations and appropriate progressive disclosure.

Preserve entered information when users navigate backwards or temporarily leave a form.

For AI-assisted actions, show exactly what has changed and provide a way to undo or edit the result.

Apply the same quality principles to registration, profile editing, booking, restaurant reservations and other forms.

9. MESSAGES AND COMMUNICATION

Give messaging special attention.

Build a polished native-feeling communication experience.

Consider:

* Immediate sending feedback.
* Message sending states.
* Sent and failed states.
* Retry options.
* Unread indicators.
* Clean conversation lists.
* Proper timestamps.
* Typing indicators where supported.
* Attachment previews.
* Image upload progress.
* Keyboard-aware message composer.
* Smooth conversation scrolling.
* Empty conversation states.
* Offline message handling.

Never claim a message has been delivered when it has only been queued locally.

Use accurate message states based on actual backend confirmation.

10. LOADING, STARTUP AND TRANSITION EXPERIENCE

I do not want users waiting five seconds before Vallo becomes usable.

Audit the entire launch experience.

Optimise:

* Native splash screen.
* Capacitor initialisation.
* WebView startup.
* Frontend bundle loading.
* Authentication restoration.
* API dependencies.
* Initial rendering.
* Home screen loading.

Show the interface as quickly as possible.

Use skeleton loading where it genuinely improves perceived responsiveness.

Avoid unnecessary full-screen loading spinners.

Load secondary content progressively.

Preserve a smooth experience when moving between sections.

Do not hide slow underlying performance with artificial loading animations.

Measure real startup and interaction performance before and after improvements.

11. CROSS-PLATFORM NATIVE QUALITY

Every improvement must be evaluated on both iOS and Android.

For iOS:

* WKWebView.
* Safe areas.
* Native keyboard.
* Haptics.
* Status bar.
* Native-feeling sheets.
* Universal Links.
* Push notifications.

For Android:

* Android WebView.
* System bars.
* Edge-to-edge display.
* Back-button handling.
* Predictive back where supported.
* Native keyboard.
* Haptics.
* Android App Links.
* Push notifications.

Do not simply copy the iOS experience onto Android.

Respect each operating system's conventions while maintaining the same Vallo identity.

Pay special attention to lower-end Android devices used in Nigeria.

12. ACCESSIBILITY AND FINISHING DETAILS

Audit the entire application for small details that make the experience feel professional.

Consider:

* Readable font sizes.
* Dynamic text where appropriate.
* Touch target sizes.
* Screen reader labels.
* Contrast.
* Reduced motion.
* Accessible form errors.
* Clear focus states.
* Proper empty states.
* Helpful error messages.
* Consistent spacing.
* Correct device orientation behaviour.
* Different screen sizes and densities.

No important interaction should feel unfinished.

13. IMPLEMENTATION STRATEGY

Do not attempt a careless application-wide redesign in one untested change.

Work in controlled phases.

Phase 1: Full audit

Inspect the entire Vallo application, architecture, pages, components, Capacitor configuration, APIs, navigation and design system.

Phase 2: Reference analysis

Analyse all attached screenshots and document the design patterns and interaction behaviours that should inspire Vallo.

Phase 3: Recommendations

Agent 1 produces the 100+ recommendation catalogue and prioritises it.

Phase 4: Architecture

Identify reusable components, global services and platform-specific implementations needed.

Phase 5: Implementation

Implement the improvements in manageable groups, preserving existing functionality.

Phase 6: Performance

Measure and optimise iOS WKWebView and Android WebView independently.

Phase 7: Testing

Test actual user journeys and cross-platform behaviour.

Phase 8: Final polish

Inspect every updated screen and interaction for visual consistency and quality.

If subagents are available, distribute appropriate independent tasks, such as:

* Agent 1: UX research, recommendations and design quality.
* Agent 2: Native iOS and Android behaviour.
* Agent 3: Performance and offline architecture.
* Agent 4: UI implementation and interaction systems.
* Agent 5: Quality assurance and regression testing.

Use one coordinating lead to review changes and prevent conflicting implementations.

14. FINAL QUALITY STANDARD

I want you to approach this as if Vallo were being prepared for a major international product launch.

Do not settle for "it works".

Ask:

* Does it feel premium?
* Does it feel native?
* Is the interaction immediate?
* Is the navigation intuitive?
* Is the feedback clear?
* Is the design consistent?
* Does it behave properly offline?
* Does it work well on budget Android devices?
* Does it feel as polished as established mobile applications?
* Is there anything that still makes it feel like a website inside an application?

If the answer to any of these is no, identify and improve the relevant experience.

Preserve Vallo's identity. Do not copy Hauslet or X's branding, logos, exact screens or proprietary assets. Learn from their design quality, interaction patterns and attention to detail, then create a distinct Vallo implementation.

The finished product should feel like Vallo, not a clone of another application.

THE FINAL VISION:

A customer opens Vallo and immediately experiences a fast, polished, beautifully designed mobile application.

They browse properties, save listings, send messages, book accommodation, discover restaurants and manage their accounts with smooth interactions and clear feedback.

They lose their connection and Vallo handles it intelligently.

They type and the keyboard feels natural.

They tap Save and receive immediate, elegant confirmation.

They send a message and understand its delivery state.

They navigate between pages without unnecessary loading or awkward transitions.

Everything feels deliberate, responsive, consistent and professional on both iPhone and Android.

I want users to love using Vallo.

Do not merely improve the appearance. Improve the actual product experience from the moment the application launches until the user closes it.



And also important first thing to do it VALLO  should be removing passcode from first page of platform to get into it you get me ?! Also phone number should be removed from sign up you get me should be removed okay ?!  It should be like how hauslet did theirs look image 2  you get what I mean now and they need to do that too it's compulsory before making any deal or stuffs like that… you get me ?! This should be clean!! All of it you think be it for videos should work cache etc like native iOS or be it android too you get the whole sebqng think all of it many many more things tell it to have subagents to do more deeper clean work…, you get me ?! Reaudit in each work you know the drill and also all work should be to a new branch named platform grade 1 readiness okay ?! It should never do vercel preview to touch it should all be in the GitHub because you do some preview or the session would do some preview and it would hit on vercel and it costing me money limits like really money and my budget is skin ink many things you get me ?! That's the whole ideas you get ?! But the end goal should be to help VALLO be better and cleaner on android iOS and web please you get that ?!!!! Don't change our platform to theirs but the whole goal is to get ideas from theirs via the screenshots and then elevate it and add ours and be better in more ideas features tools and positioning on ux this lines are very much important you get ?! Let's make them be a small platform when it comes to comparing in platform ends and users flow  and everything wide around in features flow and users friendly and industry standard for all use and everyone you get ?! okay ?! 

The end goal is to get us ready for launch!!! For platform go out live and all this should not scatter or make our delay on our App Store new submission you get to get us up…, please !!!! So it should be all clean also we should copy and upgrade our docs in UX and ui than the hauslet on tell the session it should get ideas and flow from theirs and then think ours and build it all you get me ?! Some identity stuffs think bro make ours attractive and more serious looking…. Wide platform glass containers looks and clean you get me ?! Unified platform looks you get me! Containers buttons flows bigger containers vibes some areas more prettier looks also think of how we approach our feed entire uk flow and vibes and bringing the inner sides and like an identity feature for VALLO you get like how hauslet has their hausmates this one would be ours more thinks of how we brand it give it a unique name for our platform and make ours more cools looks should be legendary slick and high quality you get think bro tell the session should burst my brain and impress me so bad you get me like can't you fucking see how hauselet fucking looks that platforms giving joy even seeing it I want this new session should arrange my platform well like you get me arrange it fucking well the api pipeline backend areas fronted uniformed like a project that had a proper RPD before starting that covers everything that we have now!! Are you getting what I mean ? That's the end goal too that any little update or new things added into the platform would just be making it more lovely also more animations in pages in success pages or chats also you get what I mean more animations more motions in many areas inside the platform when the platform is online and ready to actually work you get what I mean many many many things like please!! Just make this hands off be the best of the best you have done for VALLO to the best level it can go with this session finished work bro mostly also fronted!!! Like fronted UX/UI More discipline and clean don't scatter our own rn but instead add more things to upgrade it and build around more pages more cleaner fronted like 2030 generation you feel me ?? Like to that level that's the whole point and where we driving at like many things same as our ai too bro all this should be wide platform every single place in the entire platform I repeat every single page in the platform than needs the uniforms enhancing and looks and professionalism look and way you get me like all wide platform MUST BE EVERY SINGLE PAGE you get this enhancement not too much not too small you get me like high fucking end that hauslet is a fucking big and legendary reference in UI/UX and in platform generally and approach generally and quality generally they are amazing!!!  Use same type of map they using too and flow you get me ?! More cleaner containers looks and vibes and cool not all places glass containers but clean also you see in part of the images where screenshots of support being in chat too when they talking to support okay and also there should be a chat opening there like she's chatting with normal person but it's the ai another place users can chat our ai assistant you get me ?! And inside should have a button that she click inside that takes her to a support chat we build the new session build it that support chat should look clean and sharp too but like an inner page inside the ai assistant in messages inbox too you get permanently there even if no chat been initiated users to users you get me ?! We upgrading so this should be simple and slick the FRONTEND AND UX AND UI WORK but use your best model in this and make it fucking lovely the screenshots number is scattered don't know the image 2 SS but you you have these few ones and see into that and includes and make the new session know I would be sending about 60 images so it should click also it should see that chat gpt chat bottom place to type and voice message icon and send button you get me let make something similar slime and clean in our inbox messages users like message feature inside you and someone's chat you get I'm speaking my best language for you to get me well you get me you know all I'm saying and also in all our ai assistant button and ai support buttons make docs so more detailed and should follow all the new platform informations up to date informations of the platform okay and all areas in admin panel should be created and all docs also create a support/business developer table okay in admin panel for me to add them via their account in platform like a desk of all tools and access and she can also approve Listing and review listing too should be included and more other things support have so as she in onboarding users from real life or online if they come across issues with the issues or need to review and onboard the users quick she can do that and also the social media manager desk too to upload all things a social media of a magnitude of the platform can have access too it should have premium access to our ai too all premium stiff you get me and access a support and can reply to support message you get me ?! Bro I want this platform to have a clean architecture like a proper preparation before building you get that approach that it then clean and next level you get me ?! More things that thing more UX should be like reporting listing or users or stuffs or transaction and it should get to the appropriate okay ?! Also tell it to build our identity verification steps more like the hauslet people own but ours should be like an upgrade of our current you get and more 2030 gen slick and cool sharp you get me ?! Like more clean more cleaner step pages full tabs pop op pages from down from up you get me many things bro many many many things l!!! More motions fast clean motion in platform like how all this native apps is you know the drill bro make this hands off cover many many things detailed the longest ever same as the prompt to paste in the chat tell it to load supabase session and approve all things also you get same as vercel too! Okay load and run things!! Okay but no work should run on vercel that would cost me cost in vercel should all be in GitHub branch you get me because that's why my cost went up the last time for 96$ for nothing in vercel you get until I say push to main all preview looks and fitting should all be in the working branch for that session okay ?! You feel me like I want this to feel elequent okay! Like so lovely users can react to stuffs in message like chat of others and theirs can react to voice call voice message video call etc …. Many many things…. More places Face ID is needed or used you get or you feel also the app don't need by default to turn on passcode okay you can create your account and sign in and enter the app without setting up the passcode but it should be like a small long notification message in top dashboard like a alert and then can remove it like the x stuff to cancel or remove it from there not compulsory but essential Okay so faceid should be used when appropriate like the places needed… 



Don't start yet sending another images set for you do fast and get the handoff and prompt to send as first message to next session bro and also be specific and detailed in the handoff so the next session don't go scatter our platform claiming he's upgrading you get what I mean also I need many more motions animations a mascots for serious motions animations if no mascot which I think be hard more moving and cleaner motions of our platform moving like a videos stuffs some to images of flow more areas that platform view screenshots should be and be in docs to specific and show users…… make the handoff detailed get all detailed and all like all one by one send part of this prompt to it too so it can get it all and do what is expected of him send him this entire message in an area it should brief briefly and detailed and entirely so it get things all more too with your handoff of all things okay you get me ?!

---

## FOLLOW-UP MESSAGE (sent with the second batch of screenshots)

More from hauslet tell the session I would be sending all of them and more of them…
