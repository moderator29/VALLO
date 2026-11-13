import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ICON } from "@/components/app/Screen";
import { RecentSearches } from "@/components/app/search/RecentSearches";
import { PillLanding, PillOrigin } from "@/components/app/search/SearchPillMorph";
import "@/app/css/catalogue.css";

/**
 * "Where are you going?" with the filter glyph beside it, to FD3DFE84.
 *
 * On the home it is the field alone: the dates and the party live in the
 * filter sheet on the search screen, which is where the projection needs
 * them. `compact` is the search screen's own copy, which keeps the sheet
 * button as the real opener rather than a link to itself.
 */
export function StaySearchBar({
  t,
  q = "",
  carried = {},
  filtersHref,
  filtersControl,
}: {
  t: Dictionary;
  q?: string;
  /** Parameters the form must not drop when the text changes. */
  carried?: Record<string, string | undefined>;
  /** Where the filter glyph goes when this bar has no sheet of its own. */
  filtersHref?: string;
  /** The sheet's own opener, on the screen that has one. */
  filtersControl?: React.ReactNode;
}) {
  const copy = t.catalogue.stays;
  const recent = t.catalogue.recent;
  return (
    <div>
    <div className="flex items-center gap-inline">
      {/* Lands from the Stays home's pill (`SearchPillMorph.tsx`). */}
      <PillLanding path="/stays/search" action="/stays/search" method="get" role="search" className="nf-shelf-field">
        <UiIcon name="search" size={ICON.inline} />
        <label htmlFor="stays-q" className="sr-only">
          {copy.search}
        </label>
        <input
          id="stays-q"
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          defaultValue={q}
          placeholder={copy.wherePlaceholder}
          className="nf-shelf-field__input"
        />
        {Object.entries(carried).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        <button type="submit" aria-label={copy.search} className="nf-shelf-field__go">
          <UiIcon name="arrow-right" size={ICON.inline} />
        </button>
        <PillOrigin path="/stays/search" />
      </PillLanding>
      {filtersControl ??
        (filtersHref ? (
          <Link href={filtersHref} aria-label={copy.filters} className="nf-shelf-square">
            <UiIcon name="sliders" size={ICON.inline} />
          </Link>
        ) : null)}
    </div>
    {/* B2: the phone's recent Stays hunts, offered when the field is empty. */}
    <RecentSearches
      inputId="stays-q"
      path="/stays/search"
      copy={{ title: recent.title, clear: recent.clear, clearLabel: recent.clearLabel }}
    />
    </div>
  );
}
