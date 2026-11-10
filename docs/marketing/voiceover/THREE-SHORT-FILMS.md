# The three one-minute films: ElevenLabs prompts

Three short films to sit under the two long ones. Together they are a loop:
**get in** (sign up), **bring someone** (referral), **put your place on it**
(list). The third is the one I picked, and that is why: a marketplace's first
month lives or dies on supply, and nothing else in the set speaks to the
people who own the spaces.

Each is written to land at **55 to 60 seconds** at the settings below. Read
the whole line, do not re-cut it: the films are built on the word timings
that come back, so a re-recorded line with different pacing moves every beat
that hangs on it.

---

## Settings for all three

| | |
|---|---|
| Model | **Eleven v3** (or Multilingual v2 if v3 is not on the account) |
| Voice | the same voice as Video One and Video Two, so the set sounds like one brand |
| Stability | **0.45** (enough variation to sound alive, not enough to drift) |
| Similarity | **0.80** |
| Style exaggeration | **0.25** on v3, **0** on Multilingual v2 |
| Speaker boost | on |
| Speed | **0.96** (a touch under, so the figures land) |
| Format | 48 kHz, 192 kbps MP3 or WAV |

Record each film as **one take, one file**. Leave about a second of room
tone at the top and the tail: the mixer needs it.

### How to say it

Nigerian English, warm, unhurried, certain. Not an advert voice. You are a
person explaining something useful to someone you like. Come down at the end
of a sentence, never up. The ellipses are breaths, not pauses for effect.

---

## Film one: "Make your account"

**Direction:** easy and welcoming. The first two lines are almost
conversational; from "No long form" the pace firms up and each item lands.

```
[warm]  Getting on Vallo takes about a minute.

Your name... your email... a password you choose.

[calm]  No long form. No agent to call first. Nothing to pay.

Confirm your email, and the whole platform is open:

homes to rent, homes to buy, hotels, shortlets and restaurants...
all under the one account.

[settled]  Your shortlist, your conversations and your agreements
stay with that account, on every device you open it on.

And if you ever want to list a place of your own,
the same account becomes your workspace.

[warm]  One minute to start.

Vallo. Real estate, done right.
```

---

## Film two: "Bring a friend"

**Direction:** brighter than film one, but still honest. The figures are the
spine: give them room. Do not sell the money; state it.

> **Corrected 17 October, before recording.** The first draft said a friend
> "finishes verifying who they are", that there is "no limit on how many
> friends you bring" and that there is "no small print". The live programme
> (migration `d85_referral_signup_80_invite_and_earn`, applied 8 October, and
> the Rewards screen itself) pays ₦80 when the friend **signs up fully**, and
> counts **up to 1,500 qualified referrals a month**. A film that says "no
> limit" while showing the screen that says 1,500 contradicts itself, so the
> lines now say what the product says. **Record this version, not the first
> one.**

```
[bright]  Vallo pays you to bring people who are serious.

Share your invite link.

When a friend signs up fully with your link, you earn eighty naira.

[calm]  Not for a click. Not for a download.
For a real person, fully signed up.

Your Rewards Balance is what Vallo owes you, and you watch it climb.

At one thousand naira, you can withdraw it to your bank.

[settled]  Up to fifteen hundred friends a month, and the terms
sit on the screen, not in small print.

[warm]  Share the link. Earn as they join.

Vallo. Real estate, done right.
```

---

## Film three: "Put your place on Vallo"

**Direction:** the steadiest of the three. This one is spoken to owners and
agents, so it is matter of fact, not excited. Let "no agency fee" sit.

> **Corrected 17 October, before recording.** The first draft ended that line
> "and it is live". Every workspace on Vallo is an application — the flow's
> own last step is "Check and send", and the Add a workspace screen says each
> workspace "gets its own tools and its own checks" — so a place is not live
> the moment it is described. **Record this version, not the first one.**

```
[calm]  If you own a place, you can list it yourself.

No agency fee. No middle man taking a cut you did not agree to.

Add a workspace, tell Vallo what the place is,
set your price and what it includes...
and send it for its checks.

[settled]  Renters see the whole cost on the listing,
so the people who call you have already seen the real number.

Ask for an inspection. Read the report. Then the agreement is drawn up.

[calm]  When it is paid, your share goes straight to your own bank account,
through our licensed payments provider.
Vallo never holds your money.

[warm]  Your place. Your price. Your account.

Vallo. Real estate, done right.
```

---

## The rules these scripts already keep

`scripts/marketing/DESIGN.md` section 2: every figure is one the product
prints (₦80 a referral, ₦1,000 to withdraw), no promise words, "verified"
never said about a listing, no em dashes, and nothing says "download" while
the iPhone and Android apps are in store review.

## After the recording

Drop the three files in and the mixer does the rest:

```
python3 scripts/marketing/audio/mix.py align --voice <file.mp3> --script <film>.txt
```

That writes the word and sentence timings the films hang their beats on.
