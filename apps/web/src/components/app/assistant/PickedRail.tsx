"use client";

import { useRouter } from "next/navigation";
import type { AssistantCard } from "@/lib/assistant/types";
import { AssistantBlocks } from "./AssistantBlocks";

/** The "Picked for you by VALLO AI" rail on the Property home. Asking about a card opens the assistant with the question typed in. */
export function PickedRail({ cards }: { cards: AssistantCard[] }) {
  const router = useRouter();
  if (cards.length === 0) return null;
  return (
    <section className="mt-section-tight" data-testid="home-picked-for-you">
      <AssistantBlocks
        blocks={[{ type: "cards", title: "Picked for you by VALLO AI", items: cards }]}
        onAsk={(prompt) => router.push(`/assistant?q=${encodeURIComponent(prompt)}`)}
      />
    </section>
  );
}
