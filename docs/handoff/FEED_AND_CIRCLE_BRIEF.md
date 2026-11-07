# VALLO FEED + VALLO CIRCLE: the founder's brief (7 November 2026)

A faithful condensed record of the founder's message, part by part. The
visual reference is `refs/feed-and-circle-reference.png` (follow its layout
and feel deeply; never copy its bottom nav or branding). The before and after
of the first feed pass, which he judged "not upgraded enough", is
`refs/feed-first-pass-before-after.png`.

## His words on the screenshots
- Not upgraded enough. Cleaner, less stuff. Comment, repost and bookmark
  icons smaller and refined.
- Follow image 2 deeply for the feed AND Circle. Enter Circle from the feed
  and the feed from Circle, a button for each; the two complement each other.
- The Circle banner (members, posts, active): Vallo's own and MORE beautiful,
  with a house from our real listing samples, creative animation, and the
  counts LIVE, never mock.
- More tools. Users can feature a listing in their post, shown as a card with
  a View property button.
- The stories stay at the top of the feed. The What's on your mind composer
  stays.
- The bottom nav's centre icon becomes the Circle icon, polished, exactly as
  in the reference. Do not copy the reference's bottom nav otherwise.

## Part 1, the vision
Two distinct experiences. **Feed**: premium visual discovery of properties,
homes, stays, restaurants, neighbourhoods, professionals, lifestyle and useful
content; not X's text timeline, not generic Instagram; a Vallo blend of
property discovery, lifestyle publishing, editorial and social. Content kinds
include showcases, new listings, luxury homes, tours, short lets, hotels,
restaurants, neighbourhoods, investment, tips, interiors, architecture,
landlord and tenant experiences, agent recommendations, market updates,
renovations, management insights, videos, questions. Organised, not dumped.
Category navigation (For you, Following, Properties, Stays, Lifestyle,
Neighbourhoods, Professionals; choose what fits the modules), uncrowded.
Presentation varies (large editorial cards, asymmetric grids, full-width
showcases, horizontal collections, video previews, compact updates, featured
stories, location sections, recommendations) inside one coherent system.
Avoid needless gradients, heavy glass, thick borders, oversized icons.

## Part 2, feed tools
1. A premium composer per post type (text, images, gallery, video, property,
   stay, restaurant, location, poll, question, recommendation, tip, review,
   announcement), contextual fields per type; drafts kept.
2. **Property-powered posts**: attach a genuine listing; the embedded card
   shows photo, title, location, price, beds and baths, key amenities,
   verification where real, View property, Save. Never fake listing data.
3. Interactions: reactions, comments, nested replies, comment likes,
   mentions, hashtags, reposts, bookmarks, share, follow, report, hide,
   block, mute, moderation. Tasteful, uncluttered.
4. Creator tools: edit, delete, pin, manage comments, stats (views,
   engagement) without exposing private data, visibility, drafts.
5. Discovery intelligence: personal, followed, location, listing relevance,
   recent popular, new professionals, categories, interests, trending
   neighbourhood talk; small creators get seen; controls to tune it.
6. Discovery search: people, agents, landlords, properties, stays,
   restaurants, posts, hashtags, neighbourhoods, topics; suggestions, recent,
   filters; connected to the existing search.

## Part 3 and 4, Circle: a real estate community
Buyers, tenants, landlords, owners, agents, developers, investors, managers,
architects, designers, professionals. Ask, share knowledge, discuss areas,
exchange experiences, find opportunities. A professional community, not a
timeline. **Circle home**: welcome, featured and trending discussions,
recommended communities, popular questions, expert contributions,
announcements, events, insights; arranged sections, not everything at once.
**Sections**: Discussions (categories, replies, helpful, sort); Ask the
Community (topic, photos, property, location, answers, mark helpful, accept,
follow, visually distinct); Neighbourhoods (Lekki, Ikoyi, VI, Ikeja, Yaba,
Ajah, Abuja, Port Harcourt, Enugu, Ibadan and more; only sourced facts shown
as verified); Market Insights (opinion clearly apart from verified data, no
invented statistics); Professionals (profiles, credentials, portfolios,
areas; verification only through a real process, never automatic);
Opportunities (moderated, disclosures, not an unmoderated investment board);
Guides and Learning; Events and Meetups (details, registration, attendance,
reminders, share).

## Part 5, Circle tools
Create a community (name, description, cover, category, public or private,
rules, moderators, membership); join, leave, request; posts, announcements,
pinned, member directory, search; sort newest, popular, unanswered; filter,
follow, save, share, report; professional credibility; reputation that
rewards helpful answers, never meaningless scores or engagement farming.

## Part 6, the two must feel different
Feed: visual, modern, lifestyle, inspirational, social, dynamic (discover,
explore, save, follow, share, engage). Circle: professional, informative,
organised, trust oriented (topic, join, ask, discuss, learn, contribute).
Shared infrastructure, different structures.

## Part 7, design direction
Study Hauslet (forms, confirmations, hierarchy), Pinterest (visual
discovery), Instagram (media, creation), Reddit (communities, Q and A),
LinkedIn (credibility), Airbnb (property imagery), editorial magazines
(type and spacing), for strengths only, never their branding. Premium
layouts, beautiful images, refined cards, clean type, refined icons at a
consistent weight, subtle glass where purposeful, elegant sheets, empty and
skeleton states, smooth transitions, safe areas, light and dark. Avoid
crowded cards, oversized icons, too many borders, needless gradients, random
glass, too many floating buttons, generic templates.

## Part 8, creation flows
Feed post: Create, type, text or media, attach listing, stay, restaurant or
location, tags, preview, publish, the universal banner, open the post. Ask:
question, topic, attachments, location or property, preview, publish,
confirmation, follow. Create a community: name, description, category,
cover, visibility, rules, preview, create, open. Drafts survive interruption.
On StepFrame.

## Part 9, notifications and deep links
Comments, replies, mentions, followers, community activity, answers to
followed questions, invitations, event reminders, professional interactions;
each opens its exact destination; the existing notification and message
systems, no duplicates; universal links for shareable content.

## Part 10, performance and Capacitor
Image and video loading, infinite scroll with pagination and limits, memory,
scroll and animation performance, keyboard, transitions, background and
foreground, weak network, offline, cache, upload interruption, deep link
restoration; WKWebView and Android WebView tested separately; budget
Android; virtualise long feeds where it helps.

## Part 11, backend and security
Reuse existing tables first. Data for posts, media, reactions, comments,
replies, follows, saves, communities, memberships, discussions, questions,
answers, helpful marks, professional profiles, events, reports, moderation,
notifications: foreign keys, indexes, RLS, private communities protected,
owners only edit, secure media, moderation workflows, no private data
exposed, no duplication.

## Part 12 to 14, research and delivery
A product research pass of 100+ recommendations across 12 areas (visual,
navigation, discovery, creation, interactions, community, professional,
property integration, notifications, performance, accessibility, trust and
safety), each with what, why, where, how, exists or not, layer, priority;
deduplicated, prioritised, then the best built. Final deliverables: audits,
the catalogue, final structures, features built, components, backend,
API, iOS and Android, deep links, security, performance, regression results,
limits; built apart from proposed; nothing claimed without testing.

**Vision**: discover a beautiful property on the Feed, save it, ask the
community about the neighbourhood in Circle, get recommendations, contact
the owner. Feed is where discovery happens; Circle is where the community
comes alive.
