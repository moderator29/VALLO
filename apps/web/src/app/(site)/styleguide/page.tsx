import type { Metadata } from "next";
import { getDictionary, DEFAULT_LOCALE } from "@vallo/i18n";
import { SiteHead } from "@/components/site/SiteHead";
import { ButtonSpecimens } from "./ButtonSpecimens";
import { FeedbackSpecimens } from "./FeedbackSpecimens";
import { Chip } from "@/components/ui/Chip";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { Skeleton, SkeletonText, SkeletonCard } from "@/components/ui/Skeleton";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { BRAND, BORDERS, CONTENT, RADII, STATES, SURFACES } from "./tokens";

export const metadata: Metadata = {
  title: "Styleguide",
  description:
    "The tokens, surfaces, states, radii, controls and icons this platform is built from, painted with the real values rather than described.",
  robots: { index: false, follow: false },
};

/**
 * The styleguide.
 *
 * POLISH_PASS item 49. The rules on this page all existed already, spread
 * across a token sheet, a globals file and a dozen primitives, which meant the
 * only way to know what a surface looked like was to find something using it
 * and go and look at that instead. That is how a second blue gets invented: a
 * person needs a slightly raised panel, cannot see what `--nf-surface-raised`
 * actually is, and writes a hex value that looks about right.
 *
 * Every swatch below PAINTS ITS OWN TOKEN. Nothing here prints a colour from a
 * literal, so this page cannot drift from the sheet: change a token and this
 * page changes with it, and a token that is deleted shows up as a swatch that
 * stops painting rather than as a page that quietly keeps lying.
 *
 * The controls are the real primitives, imported and rendered. Not screenshots,
 * not copies. If `Button` grows a variant, it appears here the moment the list
 * in `ButtonSpecimens.tsx` is extended, and if a variant is removed the build
 * fails on that file, which is the correct place for that to hurt.
 *
 * AND THEY WORK. A specimen you cannot press is a picture of a control, not a
 * specimen of one; `ButtonSpecimens.tsx` carries the whole argument, and the
 * list of variants moved there with the behaviour that makes it true. It had
 * drifted, too: the button union grew a sixth variant, `glass`, and this page
 * was still drawing five while claiming it could not drift.
 *
 * Noindex, because this is for the people building the platform.
 */

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section aria-labelledby={id} className="mt-section first:mt-0">
      <h2 id={id} className="nf-h2">
        {title}
      </h2>
      <p className="mt-inline max-w-[62ch] text-[0.9375rem] leading-relaxed text-[var(--nf-content-secondary)]">
        {blurb}
      </p>
      <div className="mt-heading">{children}</div>
    </section>
  );
}

/** A token, painted with itself, with the name a person would type. */
function SwatchRow({
  name,
  note,
  kind,
  on,
}: {
  name: string;
  note: string;
  kind: "surface" | "text" | "border";
  on?: string;
}) {
  return (
    <li className="flex items-center gap-group border-b border-[var(--nf-border-subtle)] py-row last:border-b-0">
      <span
        aria-hidden="true"
        className="h-11 w-11 shrink-0 rounded-md border border-[var(--nf-border-default)]"
        style={
          kind === "surface"
            ? { background: `var(${name})` }
            : kind === "border"
              ? { borderColor: `var(${name})`, borderWidth: 3 }
              : { background: `var(${on ?? "--nf-surface-secondary"})`, color: `var(${name})` }
        }
      >
        {kind === "text" ? (
          <span className="grid h-full w-full place-items-center text-[0.9375rem] font-bold">
            Aa
          </span>
        ) : null}
      </span>
      <span className="min-w-0">
        <code className="block text-[0.8125rem] font-semibold text-[var(--nf-content-primary)]">
          {name}
        </code>
        <span className="mt-inline-tight block text-[0.8125rem] leading-relaxed text-[var(--nf-content-muted)]">
          {note}
        </span>
      </span>
    </li>
  );
}

const STATUS_TONES: StatusTone[] = [
  "success",
  "warning",
  "danger",
  "info",
  "brand",
  "neutral",
];

const ICONS: UiIconName[] = [
  "search", "plus", "minus", "close", "star", "bed", "bath", "pool", "wifi",
  "parking", "heart", "share", "map", "location", "compass", "grid", "sliders",
  "user", "bell", "wallet", "key", "home", "house", "kitchen", "utensils",
  "ticket", "verified", "bot", "document", "panel-left", "chevron-right",
  "chevron-down", "arrow-left", "arrow-right", "shield-stop", "chat-bubble",
  "settings-gear", "calendar-booking", "building-hotel", "building-apartment",
];

export default function StyleguidePage() {
  return (
    <>
    <SiteHead
      plate="bg-blue-wave"
      icon="report-stats"
      chip="Internal"
      title="Styleguide"
      lede="Every swatch here paints its own token rather than a copied value, so this page cannot drift from the sheet it documents. Switch the theme and it all moves with you, which is the point: these are the same values the product runs on, not a picture of them."
      align="start"
    />
    <div className="nf-shell pb-section">

      <Section
        title="Surfaces"
        blurb="Planes, lowest to highest. A card does not sit on the canvas by having a lighter hex value; it sits on it by using the next surface up. Reach for the next one rather than inventing a shade between two."
      >
        <ul className="nf-panel nf-panel--card block p-card-sm">
          {SURFACES.map((s) => (
            <SwatchRow key={s.name} {...s} kind="surface" />
          ))}
        </ul>
      </Section>

      <Section
        title="Text"
        blurb="Four weights of emphasis and one for brand fills. Muted is for counts and captions and never for a sentence somebody has to act on, because it is the only one that does not clear AA at body size on every surface."
      >
        <ul className="nf-panel nf-panel--card block p-card-sm">
          {CONTENT.map((s) => (
            <SwatchRow key={s.name} {...s} kind="text" />
          ))}
        </ul>
      </Section>

      <Section
        title="Brand"
        blurb="One blue family, and that is the whole palette. There is no orange, amber, gold, purple or magenta anywhere on this platform, and a second accent colour is the fastest way to make a product look like two products."
      >
        <ul className="nf-panel nf-panel--card block p-card-sm">
          {BRAND.map((s) => (
            <SwatchRow key={s.name} {...s} kind="surface" />
          ))}
        </ul>
      </Section>

      <Section
        title="Borders"
        blurb="Four edges. Subtle for dividers inside a surface, default for the edge of one, strong when it has to be seen, brand when the control is active."
      >
        <ul className="nf-panel nf-panel--card block p-card-sm">
          {BORDERS.map((s) => (
            <SwatchRow key={s.name} {...s} kind="border" />
          ))}
        </ul>
      </Section>

      <Section
        title="States"
        blurb="Each state is a pair, and it is only correct as a pair. The text colour alone on a card is a coloured word, not a state, and every one of these was measured against its own surface rather than against the page."
      >
        <ul className="grid gap-row sm:grid-cols-2">
          {STATES.map((s) => (
            <li
              key={s.name}
              className="nf-panel nf-panel--card block p-card-sm"
              style={{ background: `var(${s.surface})`, color: `var(${s.name})` }}
            >
              <p className="text-[0.9375rem] font-bold">{s.label}</p>
              <p className="mt-inline-tight text-[0.8125rem] leading-relaxed opacity-90">{s.note}</p>
              <code className="mt-inline block text-[0.75rem] opacity-80">{s.name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Radii"
        blurb="Seven, and nothing between them. A radius typed as a pixel value is the single most common way a card stops matching the card beside it."
      >
        <ul className="flex flex-wrap gap-group">
          {RADII.map((r) => (
            <li key={r.name} className="w-[9.5rem]">
              <span
                aria-hidden="true"
                className="block h-16 w-full border border-[var(--nf-border-default)] bg-[var(--nf-surface-secondary)]"
                style={{ borderRadius: `var(${r.name})` }}
              />
              <code className="mt-inline block text-[0.75rem] font-semibold text-[var(--nf-content-primary)]">
                {r.name.replace("--nf-radius-", "")}
              </code>
              <span className="mt-inline-tight block text-[0.75rem] leading-snug text-[var(--nf-content-muted)]">
                {r.note}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Buttons"
        blurb="Six variants and three heights, 44, 48 and 56px. No other button heights exist on this platform. Every one of these is the real primitive and every one of them works: press a specimen and it copies the line that draws it, and the two states have a switch each rather than a frozen picture."
      >
        <ButtonSpecimens />
      </Section>

      <Section
        title="Feedback"
        blurb="Five kinds and nothing else. A settled payment must feel different from a tap, and a refusal different from both. The native app uses the system's own patterns, Android web a distinct pulse per kind, and iOS web nothing, because it has no vibration. A button press is silent; the outcome is felt when the result sheet opens."
      >
        <FeedbackSpecimens copy={getDictionary(DEFAULT_LOCALE).platform.feedback} />
      </Section>

      <Section
        title="Chips and pills"
        blurb="A chip is a choice a person makes. A status pill is a fact the system states. They look related on purpose and they are never interchangeable: nothing that reports a state should be tappable, and nothing tappable should look like a report."
      >
        <div className="nf-panel nf-panel--card block space-y-heading p-card-sm">
          <div>
            <p className="nf-overline mb-inline">Chips</p>
            <div className="flex flex-wrap items-center gap-inline">
              <Chip size="sm">Small</Chip>
              <Chip size="md">Medium</Chip>
              <Chip size="md" icon="verified">
                With a mark
              </Chip>
            </div>
          </div>
          <div>
            <p className="nf-overline mb-inline">Status pills</p>
            <div className="flex flex-wrap items-center gap-inline">
              {STATUS_TONES.map((tone) => (
                <StatusPill key={tone} tone={tone}>
                  {tone}
                </StatusPill>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Loading"
        blurb="Skeletons shaped like the thing that is coming, never a spinner. A spinner says something is happening; a skeleton says what is about to be there, which is the difference between waiting and waiting for something."
      >
        <div className="nf-panel nf-panel--card block space-y-heading p-card-sm">
          <div>
            <p className="nf-overline mb-inline">Text</p>
            <SkeletonText lines={3} />
          </div>
          <div>
            <p className="nf-overline mb-inline">Shapes</p>
            <div className="flex items-center gap-row">
              <Skeleton className="h-11 w-11 rounded-pill" />
              <Skeleton className="h-11 w-40" />
            </div>
          </div>
          <div>
            <p className="nf-overline mb-inline">Card</p>
            <div className="max-w-sm">
              <SkeletonCard />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Icons"
        blurb="UiIcon is for navigation and controls: one stroke weight, one 24 box, drawn as paths so they inherit colour and never carry their own. BrandIcon is for content and is a separate tier. Icon3D is retired and must not appear anywhere."
      >
        <ul className="nf-panel nf-panel--card grid grid-cols-3 gap-row p-card-sm sm:grid-cols-5 lg:grid-cols-8">
          {ICONS.map((name) => (
            <li
              key={name}
              className="flex flex-col items-center gap-inline rounded-md bg-[var(--nf-surface-secondary)] px-inline py-row text-center"
            >
              <UiIcon name={name} size={20} />
              <code className="text-[0.75rem] leading-tight text-[var(--nf-content-muted)]">
                {name}
              </code>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Glass"
        blurb="One treatment, used for chrome that floats over content: the header, the filter opener, a drawer footer. It is a backdrop filter, which makes any element carrying it the containing block for fixed descendants, so a full-screen overlay inside one must be portalled to the body or it will be trapped and clipped."
      >
        <div className="relative overflow-hidden rounded-lg">
          <div
            aria-hidden="true"
            className="h-40 w-full"
            style={{
              background:
                "linear-gradient(120deg, var(--nf-brand-primary), var(--nf-surface-canvas) 70%)",
            }}
          />
          <div className="nf-glass absolute inset-x-4 bottom-4 rounded-md px-group py-row">
            <p className="text-[0.875rem] font-semibold text-[var(--nf-content-primary)]">
              nf-glass
            </p>
            <p className="text-[0.8125rem] text-[var(--nf-content-secondary)]">
              Chrome that floats, over content that moves underneath it.
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Targets"
        blurb="Every interactive element is at least 44px in both directions. A control may be painted smaller than that, and several are, but the target it accepts a press on never is: the extra area comes from a pseudo-element rather than from inflating the box, so a 36px chip still catches a thumb."
      >
        <div className="nf-panel nf-panel--card flex flex-row flex-wrap items-center gap-group p-card-sm">
          <span className="grid h-11 w-11 place-items-center rounded-md border border-dashed border-[var(--nf-border-strong)] text-[0.75rem] text-[var(--nf-content-muted)]">
            44
          </span>
          <p className="max-w-[46ch] text-[0.875rem] leading-relaxed text-[var(--nf-content-secondary)]">
            The dashed square is the floor. Measure the box a press actually
            lands on, not the ink, and measure it in the browser rather than in
            the source: a rect-based check on the source has reported a dead
            target that a pseudo-element had already extended.
          </p>
        </div>
      </Section>
    </div>
    </>
  );
}
