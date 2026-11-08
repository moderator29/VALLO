"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { listingOptions, type ListingOption } from "@/lib/features/post-listing/actions";
import { banner } from "@/lib/ui/toast";

/**
 * FEATURE A LISTING (the brief, part 2.2: property-powered posts). The
 * composer's door into a real Vallo listing: paste a Vallo link, or pick from
 * the places you saved and your own live listings. Every row is a listing the
 * server read as published and open (`listingOptions`), so a post can never
 * feature a made-up or taken-down place. A listing with no stated price shows
 * no price line rather than a zero.
 */
const WORDS = {
  title: "Feature a listing",
  description: "Paste a Vallo link, or pick a place you saved or your own listing.",
  linkLabel: "Vallo link",
  linkPlaceholder: "Paste a listing link",
  find: "Find",
  linked: "From your link",
  saved: "Saved places",
  mine: "Your listings",
  empty: "Nothing to feature yet. Save a place, or paste a Vallo listing link.",
  linkMissed: "That link is not a live Vallo listing.",
  failed: "Your places could not be read. Try again.",
  close: "Close",
} as const;

const SOURCES: ListingOption["source"][] = ["link", "saved", "mine"];
const HEADINGS: Record<ListingOption["source"], string> = { link: WORDS.linked, saved: WORDS.saved, mine: WORDS.mine };

export function ListingPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose(): void;
  onPick(option: ListingOption): void;
}) {
  const [options, setOptions] = useState<ListingOption[] | null>(null);
  const [link, setLink] = useState("");
  const [looking, setLooking] = useState(false);
  const loaded = useRef(false);

  const load = async (fromLink: string | null) => {
    setLooking(true);
    try {
      const result = await listingOptions({ link: fromLink });
      if (!result.ok) {
        banner.error(result.error || WORDS.failed);
        return;
      }
      setOptions(result.data.options);
      if (fromLink && !result.data.options.some((option) => option.source === "link")) banner.error(WORDS.linkMissed);
    } catch {
      /* Offline or a dropped request: the same calm sentence, and the field
         stays so a second tap can try again. */
      banner.error(WORDS.failed);
    } finally {
      setLooking(false);
    }
  };

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    void load(null);
  }, [open]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={WORDS.title}
      description={WORDS.description}
      closeLabel={WORDS.close}
      detents={[0.8]}
      testId="listing-picker"
    >
      <div className="nf-lpick">
        <form
          className="nf-lpick__link"
          onSubmit={(event) => {
            event.preventDefault();
            if (link.trim()) void load(link.trim());
          }}
        >
          <label className="sr-only" htmlFor="nf-lpick-link">
            {WORDS.linkLabel}
          </label>
          <input
            id="nf-lpick-link"
            className="nf-field"
            type="url"
            inputMode="url"
            enterKeyHint="search"
            autoComplete="off"
            placeholder={WORDS.linkPlaceholder}
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
          <button type="submit" className="nf-btn nf-btn--glass nf-btn--sm" disabled={!link.trim() || looking}>
            {WORDS.find}
          </button>
        </form>


        {options === null ? (
          <div className="nf-lpick__list" aria-hidden="true">
            {[0, 1, 2].map((n) => (
              <div key={n} className="nf-lpick__row">
                <Skeleton width="3.5rem" height="3.5rem" radius="md" />
                <span className="nf-lpick__text">
                  <Skeleton width="70%" height="0.875rem" radius="xs" />
                  <Skeleton width="40%" height="0.75rem" radius="xs" />
                </span>
              </div>
            ))}
          </div>
        ) : options.length === 0 ? (
          <p className="nf-lpick__note">{WORDS.empty}</p>
        ) : (
          SOURCES.map((source) => {
            const rows = options.filter((option) => option.source === source);
            if (rows.length === 0) return null;
            return (
              <section key={source} className="nf-lpick__group" aria-label={HEADINGS[source]}>
                <h3 className="nf-lpick__head">{HEADINGS[source]}</h3>
                <ul className="nf-lpick__list">
                  {rows.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        className="nf-lpick__row nf-lpick__pick"
                        onClick={() => onPick(option)}
                        data-testid="listing-picker-option"
                      >
                        <ListingThumb option={option} />
                        <span className="nf-lpick__text">
                          <span className="nf-lpick__title">{option.title}</span>
                          <span className="nf-lpick__line">
                            {option.area ? <span>{option.area}</span> : null}
                            {option.priceLabel ? (
                              <span className="nf-numeric">
                                {option.priceLabel} {option.periodLabel}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <UiIcon name="chevron-right" size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </Sheet>
  );
}

function ListingThumb({ option }: { option: ListingOption }) {
  return (
    <span className="nf-lpick__thumb" aria-hidden="true">
      {option.photoUrl ? (
        <RemoteImage src={option.photoUrl} alt="" width={112} height={112} sizes="56px" />
      ) : (
        <UiIcon name="home" size={20} />
      )}
    </span>
  );
}

/** The chosen listing, on the composer: the same row with an X to take it off. */
export function PickedListing({ option, onRemove, disabled }: { option: ListingOption; onRemove(): void; disabled?: boolean }) {
  return (
    <div className="nf-lpick__row nf-lpick__picked" data-testid="composer-listing">
      <ListingThumb option={option} />
      <span className="nf-lpick__text">
        <span className="nf-lpick__title">{option.title}</span>
        <span className="nf-lpick__line">
          {option.area ? <span>{option.area}</span> : null}
          {option.priceLabel ? (
            <span className="nf-numeric">
              {option.priceLabel} {option.periodLabel}
            </span>
          ) : null}
        </span>
      </span>
      <button type="button" className="nf-icon-btn" onClick={onRemove} disabled={disabled} aria-label={`Remove ${option.title}`}>
        <UiIcon name="close" size={18} />
      </button>
    </div>
  );
}
