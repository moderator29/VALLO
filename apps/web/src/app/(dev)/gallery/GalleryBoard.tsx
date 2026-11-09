"use client";

import { useRef, useState } from "react";

import { getDictionary } from "@vallo/i18n";

import { BackButton } from "@/components/site/BackButton";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyActions } from "@/components/app/EmptyActions";
import { adminUi } from "@/app/admin/_components/ui";
import { QUEUE_EMPTY_MARK } from "@/app/admin/_components/queue-empty";
import "@/app/css/auth.css";

/**
 * The fixtures. Deliberately boring copy: this is for looking at the MATERIAL,
 * and a gallery full of clever sentences is one where nobody notices that the
 * rim is missing on rung three.
 */
const ELEVATION = ["nf-elev-1", "nf-elev-2", "nf-elev-3", "nf-elev-4", "nf-elev-5"];
/*
 * THE FOUR SPACING VALUES THE PRODUCT KEEPS INVENTING, beside the rungs they
 * sit between. Mounted because the decision about them is a decision about
 * whether a 2px difference in padding is visible, and that cannot be settled in
 * a report. 227 off-scale occurrences remain across the product and these four
 * are 176 of them.
 *
 * Each row is the value as written, the rung below it and the rung above it, at
 * the same width, so the question on screen is the only one that matters: can
 * you tell the middle one from its neighbours.
 */
const OFF_SCALE = [
  /*
   * THE FOUR RAW STEPS BELOW ARE THE SPECIMENS, NOT DECISIONS, which is why each
   * carries its own disable rather than the file carrying one. `nf/no-raw-spacing`
   * is right to see them and wrong about what they are: this panel exists to show
   * a reader what `p-1.5` looks like beside the rungs it sits between, and
   * migrating them to the scale would delete the thing being demonstrated. Same
   * shape as `pointer-coarse:text-[16px]` in components/ui/Field.tsx, where 16 is
   * mobile Safari's zoom threshold rather than a rung.
   */
  // eslint-disable-next-line nf/no-raw-spacing -- the specimen being displayed, not a spacing decision.
  { px: 6, uses: 46, lo: "p-2xs", loPx: 4, hi: "p-xs", hiPx: 8, raw: "p-1.5" },
  // eslint-disable-next-line nf/no-raw-spacing -- the specimen being displayed, not a spacing decision.
  { px: 10, uses: 39, lo: "p-xs", loPx: 8, hi: "p-sm", hiPx: 12, raw: "p-2.5" },
  // eslint-disable-next-line nf/no-raw-spacing -- the specimen being displayed, not a spacing decision.
  { px: 14, uses: 30, lo: "p-sm", loPx: 12, hi: "p-md", hiPx: 16, raw: "p-3.5" },
  // eslint-disable-next-line nf/no-raw-spacing -- the specimen being displayed, not a spacing decision.
  { px: 20, uses: 61, lo: "p-md", loPx: 16, hi: "p-lg", hiPx: 24, raw: "p-5" },
];

const GLASS = [
  { cls: "nf-glass nf-glass--thin", label: "thin" },
  { cls: "nf-glass", label: "glass" },
  { cls: "nf-glass nf-glass--strong", label: "strong" },
  { cls: "nf-glass nf-glass--chrome", label: "chrome" },
];

/*
 * THE REGISTER, ON THE FOUR GROUNDS.
 *
 * DESIGN_DIRECTION makes the reference renders the law of the frontend, and
 * tokens.css, glass.css, ambient.css and symbols.css gained the rungs the
 * renders draw and the product did not have a name for: the lit rim, the
 * bloom behind a floating card, the strong edge for the dock and the flip
 * pane, the three glass objects (card, tile, well), the capsule control role
 * the ledger's section 8 amends the 14px law with, the blue star, the aurora
 * with its photograph and the section glow. Every one of them is mounted
 * below on the two grounds each theme has, so that with this board open
 * beside `GOVERNING-feed-plus-bloom.png` and `GOVERNING-chat-booking-card.png`
 * a reader can say whether a rung matches the render rather than whether it
 * compiles. Dark first, then `--light`: canvas and card in each theme are the
 * four grounds of `docs/img/glass-on-four-grounds.png`.
 *
 * The token names are read from the specimens' inline styles on purpose. A
 * class per specimen would be a class nothing else in the product uses, and
 * the point of the board is to show the TOKEN, exactly as a call site would
 * write it.
 */
const RADII = [
  { token: "--nf-radius-xs", label: "xs 6", square: false },
  { token: "--nf-radius-sm", label: "sm 10", square: false },
  { token: "--nf-radius-md", label: "md 14", square: false },
  { token: "--nf-radius-lg", label: "lg 18", square: false },
  { token: "--nf-radius-xl", label: "xl 22", square: false },
  { token: "--nf-radius-2xl", label: "2xl 32", square: false },
  /* `--nf-radius-pill` is still here because it is still real: it is what an
     avatar, a dot, a ring, a range track and a loading bar are drawn with.
     What it is NOT is a control shape. `--nf-radius-control-pill` used to sit
     on the next line as a second control role and it has been deleted with the
     amendment that created it, because the governing images it cited do not
     contain a single capsule. Ledger section 13. */
  { token: "--nf-radius-pill", label: "pill, for shapes and never for a control", square: false },
  { token: "--nf-radius-control", label: "control, and every control that carries text", square: false },
  { token: "--nf-radius-circle", label: "circle", square: true },
  { token: "--nf-radius-squircle", label: "squircle", square: true },
];

const GLOW = [
  { token: "--nf-glow-wash", label: "wash" },
  { token: "--nf-glow-1", label: "1 hint" },
  { token: "--nf-glow-2", label: "2 halo" },
  { token: "--nf-glow-3", label: "3 working" },
  { token: "--nf-glow-4", label: "4 strong" },
];

const EDGES = [
  { token: "--nf-brand-edge-soft", label: "edge-soft" },
  { token: "--nf-brand-edge", label: "edge" },
  { token: "--nf-brand-edge-strong", label: "edge-strong" },
  { token: "--nf-glow-brand-rim", label: "brand-rim" },
  { token: "--nf-rim-lit-ink", label: "rim-lit-ink" },
];

const RECIPES = [
  { token: "--nf-rim-lit", label: "rim-lit", note: "the top edge on every render card" },
  { token: "--nf-bloom-card", label: "bloom-card", note: "behind a floating card" },
  { token: "--nf-glow-edge-strong", label: "glow-edge-strong", note: "the dock and the flip pane only" },
  { token: "--nf-glow-brand", label: "glow-brand", note: "the primary's hover, unchanged" },
  { token: "--nf-glow-accent", label: "glow-accent", note: "the accent bloom, unchanged" },
];

const STARS = [5, 4.5, 3, 1];

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="mt-section">
      <h2 className="nf-h3">{title}</h2>
      <p className="mt-xs max-w-measure-body text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
        {note}
      </p>
      <div className="mt-heading">{children}</div>
    </section>
  );
}

/*
 * The two grounds a theme has: the canvas and a card on it. In the dark theme
 * they are `#000010` and `#000020`, in daylight `#F4F5F7` and `#FFFFFF`, which
 * is the set every glass object in this product has been measured against.
 * Children are rendered twice, once on each, so a specimen never has to be
 * written twice and the two cannot drift.
 */
function Grounds({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-group">
      <div className="rounded-xl bg-[var(--nf-surface-canvas)] p-card-sm">
        <p className="nf-overline mb-inline">canvas</p>
        {children}
      </div>
      <div className="rounded-xl border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-primary)] p-card-sm">
        <p className="nf-overline mb-inline">card</p>
        {children}
      </div>
    </div>
  );
}

/* A label under a specimen. Overline size, muted, centred. */
function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-inline-tight text-center text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
      {children}
    </p>
  );
}

/*
 * The renders' card, assembled from the three objects and the star, so the
 * board shows them together the way the booking card in the chat render
 * does: the card, its stars and its place line, the tile row from the
 * wallet render, and the well from the composer. Boring copy, on purpose.
 */
function RenderCard() {
  return (
    <div className="nf-glass nf-glass--card p-card-sm">
      <p className="nf-h4">A booking card</p>
      <span
        className="nf-stars mt-inline-tight text-[length:var(--nf-text-body)]"
        role="img"
        aria-label="Rated 5 out of 5"
      />
      <p className="mt-inline-tight text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
        Victoria Island, Lagos
      </p>
      <div className="mt-group grid grid-cols-4 gap-inline">
        {["Send", "Receive", "Top up", "Swap"].map((label) => (
          <div
            key={label}
            className="nf-glass nf-glass--tile grid aspect-square place-items-center text-[length:var(--nf-text-caption)]"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="nf-glass nf-glass--well mt-group flex h-12 items-center px-md text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
        Type a message
      </div>
    </div>
  );
}

export function GalleryBoard() {
  const [sheet, setSheet] = useState<null | "plain" | "detents" | "focus">(null);
  const amountRef = useRef<HTMLInputElement | null>(null);
  /* English, because the gallery is for looking at the material and a reviewer
     reading four languages at once is reading none of them. The locale is a
     prop everywhere it matters, so switching this line switches the board. */
  const ui = adminUi(getDictionary("en"), "en");

  return (
    <main className="nf-shell py-section">
      {/* `/gallery` declares `/` above it in `lib/nav/route-parents.ts` and drew
          no back control. The board is gated by `previewHarnessIsOpen` in
          `page.tsx`, so this arrow is only ever met by somebody who opened the
          harness, which is the one place it is wanted anyway. */}
      <BackButton fallback="/" />
      <h1 className="nf-h1 mt-sm">Gallery</h1>
      <p className="mt-sm max-w-measure-lede text-[var(--nf-content-secondary)]">
        Components that live behind a session, mounted with fixtures so they can be
        looked at. Development only. Nothing here asserts anything: it is a place to
        see, not a test.
      </p>
      <p className="mt-row max-w-measure-lede text-[var(--nf-content-secondary)]">
        The first five sections are the register the reference renders ask for, on
        the canvas and on a card, in this theme. Open the board beside the feed and
        the booking-card renders and read them together.
      </p>

      <Section
        title="The renders' glass objects"
        note="The card, the tile and the well, as the feed and chat renders draw them: a pane of the canvas with light let in, a blue-white rim on the top edge, a uniform brand hairline and a bloom behind. The tile is the card a step smaller with no bloom of its own; the well is a trough with no blur and no specular. The thing to look for is whether the card reads as lit glass beside the render's booking card rather than as frost, and whether the well reads as cut into the card rather than laid on it."
      >
        <Grounds>
          <RenderCard />
        </Grounds>
      </Section>

      <Section
        title="The light, as recipes"
        note="Three shadow lists the renders draw on every floating surface, beside the two glow recipes the product already had. rim-lit is the blue-white top edge; bloom-card is two layers, a tight halo and a wide faint field; glow-edge-strong is for the dock and the flip pane only. Read them on the card ground as well as the canvas: a bloom that reads on one and not the other is half a bloom."
      >
        <Grounds>
          <div className="flex flex-wrap gap-group">
            {RECIPES.map((r) => (
              <div key={r.token} className="w-32">
                <div
                  className="h-20 rounded-xl border border-[var(--nf-border-subtle)] bg-[var(--nf-glass-card-fill)]"
                  style={{ boxShadow: `var(${r.token})` }}
                />
                <Caption>{r.label}</Caption>
                <Caption>{r.note}</Caption>
              </div>
            ))}
          </div>
        </Grounds>
      </Section>

      <Section
        title="The glow scale and the edges"
        note="Six depths of one light, then the five edge inks. The blooms are painted as a radial to transparent, the edges as a 1px inset ring, because that is what each is for: a bloom is light in the space around an object and an edge is the object's own outline. In daylight the blooms step down and the edges do not."
      >
        <Grounds>
          <div className="flex flex-wrap gap-group">
            {GLOW.map((g) => (
              <div key={g.token} className="w-20">
                <div
                  className="h-20 w-20 rounded-circle"
                  style={{ background: `radial-gradient(circle, var(${g.token}) 0%, transparent 70%)` }}
                />
                <Caption>{g.label}</Caption>
              </div>
            ))}
          </div>
          <div className="mt-group flex flex-wrap gap-group">
            {EDGES.map((e) => (
              <div key={e.token} className="w-24">
                <div
                  className="h-14 rounded-lg bg-[var(--nf-glass-card-fill)]"
                  style={{ boxShadow: `inset 0 0 0 1px var(${e.token})` }}
                />
                <Caption>{e.label}</Caption>
              </div>
            ))}
          </div>
        </Grounds>
      </Section>

      <Section
        title="Radius, with the control law amended"
        note="Every rung, then the two control roles. control is the 14px rectangle the owner asked for and it stands; control-pill is the capsule the governing renders draw on chips, segments and the bloom lozenges, added by the ledger's section 8 rather than by changing the first. Both derive from a rung, so neither is a number written twice."
      >
        <Grounds>
          <div className="flex flex-wrap items-end gap-group">
            {RADII.map((r) => (
              <div key={r.token} className={r.square ? "w-16" : "w-28"}>
                <div
                  className={`${r.square ? "h-16 w-16" : "h-12 w-28"} border border-[var(--nf-brand-edge)] bg-[var(--nf-glass-card-fill)]`}
                  style={{ borderRadius: `var(${r.token})` }}
                />
                <Caption>{r.label}</Caption>
              </div>
            ))}
          </div>
        </Grounds>
      </Section>

      <Section
        title="The rating, in blue"
        note="One element, five stars from a mask, lit to the value it is given. Gold in the renders, brand blue here by rule 8. The half star should be cut down its middle, not faded, and the muted rail behind the lit stars should read as absent stars rather than as grey ones."
      >
        <Grounds>
          <div className="flex flex-wrap items-center gap-group">
            {STARS.map((value) => (
              <div key={value} className="text-center">
                <span
                  className="nf-stars text-[length:var(--nf-text-h3)]"
                  role="img"
                  aria-label={`Rated ${value} out of 5`}
                  style={{ "--nf-stars-value": value } as React.CSSProperties}
                />
                <Caption>{value} of 5</Caption>
              </div>
            ))}
          </div>
        </Grounds>
      </Section>

      <Section
        title="The ambient layer"
        note="The aurora with its photograph, and the section glow behind a headline. The plate is the sign-in render's wave through a CSS background, dimmed into the canvas colour and dissolved through the mask stops the canvas already uses; it is a modifier of the aurora, so in daylight it is off with every other ambient layer and the box below is the plain ground there. Neither moves: the one ambient animation a viewport is allowed stays with the canvas bloom."
      >
        <div className="relative isolate min-h-64 overflow-hidden rounded-xl bg-[var(--nf-surface-canvas)]">
          <div className="nf-aurora nf-aurora--plate" aria-hidden="true" />
          <div className="relative z-10 p-card">
            <p className="nf-overline">nf-aurora nf-aurora--plate</p>
            <div className="nf-section-glow mt-group py-md text-center">
              <h3 className="nf-h2">A headline with the section glow</h3>
              <p className="mt-row text-[var(--nf-content-secondary)]">nf-section-glow, one per headline</p>
            </div>
            {/* Glass ON the photograph: the sign-in card's recipe as a rung,
                at the two plate fills, so the two can be read against the
                plate they were written for. */}
            <div className="mt-group grid gap-inline">
              <div className="nf-glass nf-glass--plate rounded-2xl p-card-sm">
                <p className="nf-h4">nf-glass--plate</p>
                <p className="mt-inline-tight text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
                  The canvas at 58, the lit brand rim, the bloom outside.
                </p>
              </div>
              <div className="nf-glass nf-glass--plate nf-glass--plate-strong rounded-2xl p-card-sm">
                <p className="nf-h4">nf-glass--plate-strong</p>
                <p className="mt-inline-tight text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
                  The canvas at 70, for a tile carrying a figure over a picture.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-group">
          <Grounds>
            <div className="nf-section-glow py-md text-center">
              <h3 className="nf-h3">The section glow on its own</h3>
            </div>
          </Grounds>
        </div>
      </Section>

      <Section
        title="Sheet"
        note="The most-used overlay in the product and the one nobody has seen this sprint. Open each: the first is plain, the second rests at half height before the near-full detent, the third puts the keyboard on the amount field instead of on Close, which is what initialFocus exists for."
      >
        <div className="flex flex-wrap gap-inline">
          <button type="button" className="nf-btn nf-btn--glass" onClick={() => setSheet("plain")}>
            Plain sheet
          </button>
          <button type="button" className="nf-btn nf-btn--glass" onClick={() => setSheet("detents")}>
            Two detents
          </button>
          <button type="button" className="nf-btn nf-btn--glass" onClick={() => setSheet("focus")}>
            initialFocus
          </button>
        </div>
      </Section>

      <Section
        title="Elevation"
        note="The five rungs, each with its rim. A rung is a PAIR, the shadow and the rim together, and the thing to look for is whether the steps between them read as even."
      >
        <div className="flex flex-wrap gap-group">
          {ELEVATION.map((cls) => (
            <div
              key={cls}
              className={`${cls} grid h-24 w-32 place-items-center rounded-lg bg-[var(--nf-surface-elevated)] text-[length:var(--nf-text-caption)]`}
            >
              {cls.replace("nf-", "")}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Glass"
        note="Three tiers. Each changes fill, blur and rim together, which is the whole point: a modifier that changes two of the three is a depth modifier modifying two thirds of the depth."
      >
        <div className="flex flex-wrap gap-group">
          {GLASS.map(({ cls, label }) => (
            <div
              key={label}
              className={`${cls} grid h-24 w-32 place-items-center rounded-lg text-[length:var(--nf-text-caption)]`}
            >
              {label}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Empty state"
        note="One anatomy, both actions full width and stacked, primary then quiet. The second action has to be relevant: the wallet offers how the wallet works, not explore places."
      >
        <div className="nf-card p-card">
          <EmptyActions
            primary={{ label: "Add money", href: "#" }}
            secondary={{ label: "How the wallet works", href: "#" }}
          />
        </div>
      </Section>

      <Section
        title="An empty queue, all three of them"
        note="THE THING TO LOOK AT IS WHETHER THESE READ AS THREE THINGS AT A GLANCE. A test can prove they are three different identifiers; it cannot prove they are three different marks. Only one of the three is allowed to be good news: cleared is emerald with a tick, and the other two are neutral, because a queue nothing ever arrived at and a filter that matched nothing are both facts about nothing rather than achievements. Read them at 390 in dark, then in light."
      >
        <div className="grid gap-group md:grid-cols-3">
          {(
            [
              ["cleared", "Nothing is waiting", "Every application that has arrived has been decided."],
              ["never", "No application has arrived", "The first person to apply appears here."],
              ["no-match", "Nothing matched", "No row matches that filter. The queue behind it is unchanged."],
            ] as const
          ).map(([state, title, body]) => (
            <div key={state}>
              <p className="nf-overline mb-inline-tight">
                {state} · {QUEUE_EMPTY_MARK[state].icon}
              </p>
              <ui.QueueEmpty title={title} body={body} state={state} />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="The four spacing values with no rung"
        note="227 spacing utilities in the product sit between two rungs, and these four are 176 of them. Each row shows the value as written between the rung below and the rung above, on the same box at the same width. The question is not whether the scale is tidy, it is whether you can see the middle box differ from the two beside it: if you cannot, 176 call sites should move to the nearest rung and the scale stays six steps at the bottom; if you can, the scale is too coarse there and the product has been telling us so 176 times. The 20px row is the one to look at hardest, because 39 of its 61 uses are card padding and it sits in the only doubled gap in the ladder, 16 to 24."
      >
        <div className="flex flex-col gap-group">
          {OFF_SCALE.map((r) => (
            <div key={r.px}>
              <p className="nf-overline mb-inline-tight">
                {r.px}px, {r.uses} uses, between {r.loPx} and {r.hiPx}
              </p>
              <div className="flex flex-wrap items-start gap-inline">
                {[
                  { label: `${r.lo} (${r.loPx})`, cls: r.lo },
                  { label: `${r.raw} (${r.px})`, cls: r.raw },
                  { label: `${r.hi} (${r.hiPx})`, cls: r.hi },
                ].map((box) => (
                  <div key={box.label} className="text-center">
                    <div className={`nf-card ${box.cls}`}>
                      <div className="h-8 w-16 rounded-sm bg-[var(--nf-brand-tint-2)]" />
                    </div>
                    <p className="mt-inline-tight text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                      {box.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Sheet open={sheet === "plain"} onOpenChange={(o) => setSheet(o ? "plain" : null)} title="A plain sheet">
        <p className="text-[var(--nf-content-secondary)]">
          One detent, opening near full height. Drag the grab handle down to dismiss.
        </p>
      </Sheet>

      <Sheet
        open={sheet === "detents"}
        onOpenChange={(o) => setSheet(o ? "detents" : null)}
        title="Two detents"
        detents={[0.5, 0.92]}
        footer={
          <button type="button" className="nf-btn nf-btn--primary w-full" onClick={() => setSheet(null)}>
            Done
          </button>
        }
      >
        <p className="text-[var(--nf-content-secondary)]">
          Opens at the last detent and rests at the first. A footer stays put while the
          body scrolls.
        </p>
      </Sheet>

      <Sheet
        open={sheet === "focus"}
        onOpenChange={(o) => setSheet(o ? "focus" : null)}
        title="Withdraw"
        initialFocus={amountRef}
      >
        <label className="block">
          <span className="text-[length:var(--nf-text-body-sm)]">Amount</span>
          <input ref={amountRef} className="nf-field mt-xs w-full" inputMode="numeric" placeholder="0" />
        </label>
        <p className="mt-sm text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
          Without initialFocus the keyboard lands on Close, which is the dismiss control,
          on every wallet drawer in the product.
        </p>
      </Sheet>
    </main>
  );
}
