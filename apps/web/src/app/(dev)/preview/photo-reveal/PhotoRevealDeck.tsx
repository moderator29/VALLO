"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/* A slow data URL cannot be simulated, so the deck simply mounts the image
   on demand: that is the moment a lazy photograph has when it decodes. */
const PHOTO = "/brand/scenes/hotel.jpg";

export function PhotoRevealDeck() {
  const [round, setRound] = useState(0);
  return (
    <div className="mt-md grid gap-md">
      <Button variant="secondary" size="sm" onClick={() => setRound((n) => n + 1)}>
        Load the photographs again
      </Button>
      <div className="grid grid-cols-2 gap-sm">
        <figure className="grid gap-2xs">
          <span className="nf-caption">Lazy: settles in</span>
          <span className="nf-card-photos__slide relative block aspect-[4/3] overflow-hidden rounded-[var(--nf-radius-lg)] bg-[var(--nf-surface-inset)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`lazy-${round}`}
              src={`${PHOTO}?r=${round}`}
              alt=""
              data-reveal="true"
              onLoad={(event) => {
                event.currentTarget.dataset.shown = "true";
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </span>
        </figure>
        <figure className="grid gap-2xs">
          <span className="nf-caption">Eager: never fades</span>
          <span className="nf-card-photos__slide relative block aspect-[4/3] overflow-hidden rounded-[var(--nf-radius-lg)] bg-[var(--nf-surface-inset)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`eager-${round}`}
              src={`${PHOTO}?e=${round}`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </span>
        </figure>
      </div>
    </div>
  );
}
