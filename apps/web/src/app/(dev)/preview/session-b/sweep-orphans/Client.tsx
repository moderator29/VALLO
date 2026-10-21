"use client";

import { useState } from "react";
import type { BookingView } from "@/lib/bookings/queries";
import { CancelBookingSheet, type CancelBookingWords } from "@/components/app/bookings/CancelBookingSheet";
import { KycFlow, type KycCopy } from "@/components/verification/KycFlow";
import { DistrictChips, type DistrictChip } from "@/components/social/feed/DistrictHeader";

/*
 * The two views whose real component takes a function prop, which a server
 * page cannot hand across. Both functions do nothing: this is a proof of how
 * the screen is drawn, and the harness never submits anything.
 */
export function CancelSheetFixture({ booking, words }: { booking: BookingView; words: CancelBookingWords }) {
  return <CancelBookingSheet booking={booking} onClose={() => {}} words={words} />;
}

export function KycFlowFixture({ copy }: { copy: KycCopy }) {
  return (
    <KycFlow
      copy={copy}
      submit={async () => ({ ok: false, message: "This harness does not send anything." })}
    />
  );
}

/* The district feed's filter tabs (SW-O2), with the chosen tab held here as
   the feed holds it. The counts are fixture numbers. */
export function DistrictChipsFixture() {
  const [active, setActive] = useState<DistrictChip>("all");
  return (
    <DistrictChips active={active} counts={{ apartments: 3, stories: 2, reviews: 1 }} onPick={setActive} />
  );
}
