import { getDictionary } from "@vallo/i18n";
import { assistantCopyOf } from "@/components/app/assistant/assistant-copy";
import { getLocale } from "@/lib/locale";
import { AssistantChat } from "@/components/app/assistant/AssistantChat";
import type { Thread } from "@/components/app/assistant/threads";
import type { AssistantListingItem } from "@/lib/assistant/types";
import { PERSON } from "../../_fixtures/people";

/**
 * Vallo AI mid-conversation, seeded from fixtures, for the side-by-side with
 * `BF49B814`.
 *
 * The two results are deliberately one of each SIDE: a hotel and a flat. The
 * hotel proves the side law on the card, because its destination must be the
 * Stays shell and not the property shell, and the only way to see that is to
 * photograph a card that has one. The seed is never written to the device.
 */
const NOW = Date.now();
/* Written the way the model often writes a step, to show it is drawn without one. */
const DASH = String.fromCharCode(0x2014);
const at = (minutesAgo: number) => NOW - minutesAgo * 60_000;

const RESULTS: AssistantListingItem[] = [
  {
    id: "00000000-0000-4000-8000-0000000000a1",
    title: "Grand Vista Hotel, Victoria Island",
    city: "Victoria Island, Lagos",
    kind: "hotel",
    price: "₦185,000 per night",
    rating: 4.7,
    verified: true,
    bedrooms: 1,
    bathrooms: 1,
    sizeSqm: 38,
    href: "/listing/00000000-0000-4000-8000-0000000000a1",
    photo: "/brand/photos/bedroom-01.jpg",
  },
  {
    id: "00000000-0000-4000-8000-0000000000a2",
    title: "2 Bedroom Apartment, Lekki Phase 1",
    city: "Lekki, Lagos",
    kind: "apartment",
    price: "₦1,650,000 per year",
    rating: 4.6,
    verified: true,
    bedrooms: 2,
    bathrooms: 2,
    sizeSqm: 116,
    href: "/listing/00000000-0000-4000-8000-0000000000a2",
    photo: "/brand/photos/living-room-day.jpg",
  },
];

const THREAD: Thread = {
  id: "preview-thread-f4",
  title: "Somewhere to stay in Victoria Island this weekend",
  createdAt: at(5),
  updatedAt: at(1),
  messages: [
    {
      id: "m1",
      role: "user",
      text: "Somewhere to stay in Victoria Island this weekend",
      at: at(5),
    },
    {
      id: "m2",
      role: "assistant",
      text: "Here is a room on the Stays side and a flat on the Property side, both listed on Vallo:",
      at: at(4),
      listings: RESULTS,
    },
    {
      id: "m3",
      role: "assistant",
      text: "Shall I check what the room costs for two nights, or work out what moving into the flat would come to?",
      at: at(2),
    },
    { id: "m4", role: "user", text: "The room, for two nights", at: at(1) },
  ],
};

/* `?view=rich`: an answer written the way the model writes, with headings,
   bold leads, a numbered list, a sub-item and a table, so the formatted answer
   can be seen (the founder's screenshot of 15 November 2026). */
const RICH: Thread = {
  ...THREAD,
  id: "preview-thread-rich",
  messages: [
    { id: "r1", role: "user", text: "Why should I use Vallo?", at: at(3) },
    {
      id: "r2",
      role: "assistant",
      at: at(2),
      text: [
        "Good question! A few honest reasons people use Vallo:",
        "",
        "## What you get",
        "",
        "- **Everything in one place**: rentals, sales, land, shops and offices, plus shortlets, hotels and restaurant bookings.",
        "- **Free to browse, message, inspect and pay**: no fees for renters or guests at any step.",
        "- **Transparent trust ladder**: every lister shows exactly what has been checked.",
        "  - Identity, address and bank account, each shown on its own.",
        "",
        "## How to start",
        "",
        `Step 1 ${DASH} Find the place`,
        "",
        "1. Open **Stays** or **Property** and set where and when.",
        "2. Message the lister and book a viewing inside Vallo.",
        "3. Agree and pay in the app, never outside it.",
        "",
        "| Side | What you can do |",
        "| --- | --- |",
        "| Property | Rent, buy, land, shops |",
        "| Stays | Shortlets and hotels |",
        "",
        "**My verdict:**",
        "Start with Stays if you need a bed this week; Property if you are moving.",
        "",
        "> Never pay anyone outside Vallo. A real lister never asks you to.",
        "",
        "See [Stays](/stays) to start looking.",
      ].join("\n"),
    },
  ],
};

/* `?view=choice`: viewing times as the choice card (radio rows and one
   Continue), under a short answer. */
const CHOICE: Thread = {
  ...THREAD,
  id: "preview-thread-choice",
  messages: [
    { id: "c1", role: "user", text: "Can I see the Lekki flat this week?", at: at(3) },
    {
      id: "c2",
      role: "assistant",
      at: at(2),
      text: "Yes. These are the lister's open times this week. Pick one and I will set it up for you to confirm.",
      blocks: [
        {
          type: "slots",
          listingId: "00000000-0000-4000-8000-0000000000a2",
          title: "2 Bedroom Apartment, Lekki Phase 1",
          slots: [
            { slotAt: "2026-11-17T09:00:00Z", label: "Tue 17 Nov, 10:00" },
            { slotAt: "2026-11-18T13:00:00Z", label: "Wed 18 Nov, 14:00" },
            { slotAt: "2026-11-20T10:00:00Z", label: "Fri 20 Nov, 11:00" },
          ],
        },
      ],
    },
  ],
};

export default async function AssistantPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const locale = await getLocale();
  const view = (await searchParams).view;
  const rich = view === "rich";
  return (
    <main id="main" className="flex h-dvh min-w-0 flex-col overflow-hidden">
      <AssistantChat
        locale={locale}
        viewer={{ initials: PERSON.name.slice(0, 1), avatarUrl: PERSON.avatarUrl }}
        seed={rich ? { threads: [RICH] } : view === "choice" ? { threads: [CHOICE] } : { threads: [THREAD], thinking: true }}
        t={assistantCopyOf(getDictionary(locale))}
      />
    </main>
  );
}
