# VALLO CIRCLE: the design brief (lead, 7 November 2026)

The founder: Vallo Circle is the signature feature, "approached in a more
different way that works side to side with the feed". This is the concept for
him to approve before anything is built. It is built last, on the finished
pieces (WORK_QUEUE.md round 7), but the feed's new look leaves room for it now.

## The idea in one line

**The feed is everyone near you. Your Circle is the people you trust, and
what they know about living, staying and eating well.** Two lenses on one
screen, side by side, one swipe apart.

## How it sits beside the feed

- The Around masthead gets a two-lens switch: **Around** (today's feed,
  unchanged) and **Circle**. Swipe sideways between them, the way a phone
  moves between home screens. The switch is the only new control on the feed.
- A post can be shared to **Everyone** (today) or **My Circle only**, chosen
  in the composer. Nothing posted before Circle changes audience.
- A Circle member's post in the Around feed carries a small Circle mark, so
  the two lenses feel like one place.

## What the Circle lens shows (all from what Vallo already has)

1. **Moving soon** cards: a Circle member looking for a place, with their
   brief (area, budget band, move date) if they chose to share it. "I know a
   place" opens a chat.
2. **Shared shortlists**: a saved collection shared with chosen members, so
   flatmates or a couple shortlist together, with each person's yes or no on a
   place (builds on saved collections, SAV4).
3. **Been there**: stays and restaurants Circle members booked and rated,
   shown as "Ada stayed here in March". Only with the member's own yes.
4. **Plans**: split a stay between members, book a table for the group, a
   viewing two people attend together.
5. **Vouches**: a member can vouch for another ("I have rented with Tunde"),
   shown on the Vallo passport, so trust travels with people.

## The rules that keep it safe

- **Mutual yes before anything is shared.** An invite is accepted before
  either side sees the other's Circle content.
- **Verified members only** can join a Circle (phone confirmed; ID where the
  member has done it, shown as a badge, never required to join).
- **Every share is opt in, per kind** (briefs, bookings, ratings), in the
  Privacy choices screen. Default: nothing shared but posts marked Circle.
- Leave, remove, block and report on every member, one tap each, silent to
  the other person.
- A Circle has at most 150 people (a real circle, not a follower count).

## What it needs underneath (for the lead, later)

`circles`, `circle_members` (status: invited, accepted, left, removed),
`circle_shares` (member, kind, on or off), a `post_audience` column on posts,
`vouches`; RLS on every one through a `private.in_circle(a, b)` helper; a
realtime channel per member with `ownChannelName`. No new paid service.

## What Agent FE does now

Only the room for it, in the feed redesign: the masthead's lens switch
drawn with Around selected and Circle shown as "Coming soon" (not tappable),
and the feed laid out so a second lens can slide in beside it. Nothing else
is built until the founder approves this brief.
