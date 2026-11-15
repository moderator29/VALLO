"use client";

import { useSyncExternalStore } from "react";
import "@/app/css/ported.css";
import { Sheet } from "@/components/ui/Sheet";
import { Icon3D } from "@/components/ui/Icon3D";
import { Button } from "@/components/ui/Button";
import {
  subscribeSaveEducation,
  saveEducationPending,
  dismissSaveEducation,
} from "@/lib/saved/save-education";

/**
 * THE FIRST-SAVE EDUCATION SHEET (founder, 14 November 2026).
 *
 * A bottom sheet shown once per device, the first time a person taps a heart
 * anywhere in the app. The saved-heart clay icon on a radial wash, a title,
 * one body line, and a full-width "Got it" button. Inspired by the Airbnb
 * "Save your favourites in one place" moment: teach once, then never again.
 *
 * Mounted in the app layout so it is present on every page. The reactive
 * trigger (`save-education.ts`) is called from the save flow after the
 * optimistic flip and the quick pill, with a short delay so the heart and
 * the pill are seen first.
 */
export function SaveEducation() {
  const show = useSyncExternalStore(
    subscribeSaveEducation,
    saveEducationPending,
    () => false,
  );

  if (!show) return null;

  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) dismissSaveEducation();
      }}
      title="Save your favourites"
      hideTitle
      testId="save-education"
    >
      <div className="nf-asi__head">
        <div className="nf-asi__ground" aria-hidden="true">
          <Icon3D name="saved-heart" size={96} />
        </div>
        <h2 className="nf-asi__title">Save your favourites</h2>
        <p className="nf-asi__body">
          Tap the heart on any place and it waits for you here, ready to
          compare and book.
        </p>
      </div>
      <div className="nf-asi__dismiss">
        <Button
          variant="primary"
          size="lg"
          full
          onClick={dismissSaveEducation}
          data-testid="save-education-got-it"
        >
          Got it
        </Button>
      </div>
    </Sheet>
  );
}
