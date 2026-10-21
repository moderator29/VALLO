"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { shareAreaPrices } from "@/lib/price-check/actions";
import { createShareLink } from "@/lib/share/actions";

/**
 * THE BUTTON, AND WHY THERE WAS NOT ONE.
 *
 * Stage one of Price Check shipped with a share enum, a share table, a check
 * constraint and a server action, and with no button, no destination and no
 * image. A feature nobody can find is not a feature, and three walls built to
 * stop an artefact carrying an address had nothing standing behind them,
 * because nothing could mint an artefact at all.
 *
 * ---------------------------------------------------------------------------
 * THE SHARE RULE IS ABSOLUTE AND THE BUTTON MUST NOT BE A HOLE IN IT.
 *
 * A share artefact is AREA LEVEL and TYPE LEVEL and can never carry a specific
 * address, for anybody, ever, including the person who typed it in. Look at
 * what this component's props do NOT contain: no latitude, no longitude, no
 * address, no listing id, no free text hint. It cannot pass one because it is
 * never handed one, and `shareAreaSchema` has no field for one, and
 * `create_price_check_share` has no parameter for one, and
 * `price_check_shares` has no column for one, and
 * `price_check_share_scope` has no label for a property. This is the fifth
 * layer of the same rule and it is the weakest of the five, which is why it is
 * the one with the comment on it.
 *
 * WHAT IT DOES CARRY IS THE SERVER'S SEAL OVER A PLACE NAME AND A TYPE, and the check constraint
 * `price_check_shares_area_is_not_an_address` reads that place name and
 * refuses anything shaped like a street address. Somebody who types their own
 * address into the area field of the ladder gets a refused card rather than a
 * card with their address on it. The probe at
 * `scripts/probes/price_check_share_cannot_carry_an_address.sql` reads that
 * back against the live database, both ways: "14 Admiralty Way" is refused and
 * "Victoria Island" is not.
 *
 * ---------------------------------------------------------------------------
 * AND A REFUSAL MINTS NOTHING, WHICH IS MOST OF WHAT HAPPENS TODAY.
 *
 * An image is a claim and a refusal has nothing to claim. All 64 published
 * listings on this platform are examples and `is_demo = false` sits inside the
 * comparables predicate, so almost every per-property check refuses and the
 * area report is usually empty too. That is the state a person will actually
 * meet, so it is written as a state and not as an error: where there are no
 * figures this renders a sentence saying a card needs three real listings,
 * NOT a disabled button. A control that cannot be pressed teaches nobody why
 * it cannot be pressed.
 *
 * The caller decides which of the two it is by passing `card` or not, and
 * the type makes it impossible to ask for a card without them.
 */

export type ShareAreaCopy = {
  make: string;
  making: string;
  heading: string;
  body: string;
  why: string;
  whyBody: string;
  madeHeading: string;
  madeBody: string;
  copy: string;
  copied: string;
  failed: string;
  nothingYet: string;
  nothingYetBody: string;
  open: string;
};

/**
 * What a card is minted from: the server's seal over the whole card.
 *
 * The page computed the figures, the count and the place, and sealed them
 * (`lib/price-check/share-seal.ts`); this component carries the seal as an
 * opaque string and the action mints only what the seal says. So no figure on
 * a card can come from the browser, and a form edited after the answer
 * arrived cannot pair a new area with the old figures. `seal` is null only
 * where the server could not sign (no service key), and minting then shows
 * its failure line instead of a card.
 */
export type SealedShare = { seal: string | null };

export type ShareAreaProps = {
  copy: ShareAreaCopy;
  variant?: "primary" | "ghost";
};

export function ShareAreaButton({
  card,
  ...rest
}: ShareAreaProps & {
  /** Null is "there is nothing to make a card from", which is a state. */
  card: SealedShare | null;
}) {
  /*
   * NO FIGURES, NO BUTTON, AND A SENTENCE INSTEAD.
   *
   * This is the branch almost every reader meets today, so it is written as
   * the real state rather than as the empty case of the other one. It is also
   * why the two branches are two components: the minting half then takes
   * `SealedShare` and not `SealedShare | null`, so there is no path through
   * it that could mint a card out of nothing.
   */
  if (card === null) {
    return (
      <div className="nf-pc-share nf-pc-share--none">
        <p className="nf-body-sm font-semibold text-[var(--nf-content-secondary)]">
          {rest.copy.nothingYet}
        </p>
        <p className="mt-inline-tight nf-caption text-[var(--nf-content-muted)]">
          {rest.copy.nothingYetBody}
        </p>
      </div>
    );
  }
  return <MintableShare {...rest} card={card} />;
}

function MintableShare({
  card,
  copy,
  variant = "ghost",
}: ShareAreaProps & { card: SealedShare }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "making" | "made" | "failed">("idle");
  const [doorPath, setDoorPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /*
   * THE CARD TRAVELS AS ITS DOOR (V-07). `/price/area/<id>` is inside the
   * platform, so since 23 September it answers a stranger, and every link
   * unfurler, with a sign-in redirect: the card this component mints was
   * unreachable by the people it was minted for. `/s/<token>` is the public
   * door onto the same stored row, drawn by the same `shareLines`, with no
   * address because the row has none. If the door cannot be made the sheet
   * says so; it never falls back to the gated address.
   */
  const href = doorPath;

  async function mint() {
    setState("making");
    setCopied(false);
    /*
     * THE SEAL IS THE WHOLE CARD. The scope, the place and the figures were
     * decided on the server when the answer was computed; nothing here can
     * change them.
     */
    if (card.seal === null) {
      setState("failed");
      return;
    }
    const result = await shareAreaPrices({ seal: card.seal });
    if (!result.ok) {
      setState("failed");
      return;
    }
    const door = await createShareLink({ kind: "price_area", targetId: result.data.id });
    if (!door.ok) {
      /* No door, no link. The in-app address answers a stranger with a
         sign-in page, so offering it would be offering a dead card. */
      setState("failed");
      return;
    }
    setDoorPath(door.data.path);
    setState("made");
  }

  async function copyLink() {
    if (href === null) return;
    const url = `${window.location.origin}${href}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* A refused clipboard is not an error worth a sentence: the link is on
         the screen and selectable, which is the fallback every browser has. */
      setCopied(false);
    }
  }

  return (
    <div className="nf-pc-share">
      <Button
        variant={variant}
        full
        leadingIcon="share"
        onClick={() => {
          setOpen(true);
          if (state === "idle") void mint();
        }}
      >
        {copy.make}
      </Button>

      <Sheet open={open} onOpenChange={setOpen} title={copy.heading} detents={[0.62, 0.92]}>
        <div className="flex flex-col gap-row">
          {/* THE RULE IS SAID OUT LOUD, BEFORE THE LINK. A person who wanted
              to send their own address deserves to be told why the product
              will not, rather than to find the option missing and assume
              somebody forgot it. */}
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.body}</p>

          {/* NOT BEHIND A TAP. `Disclosure` opens a sheet of its own and this
              is already inside one, and more to the point the reason a card
              carries no address is the thing a person is most likely to want
              and least likely to go looking for. It is four lines. It stays on
              the surface. */}
          <div className="nf-pc-share__why">
            <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">{copy.why}</p>
            <p className="mt-inline-tight nf-body-sm text-[var(--nf-content-secondary)]">
              {copy.whyBody}
            </p>
          </div>

          {state === "making" && (
            <p className="nf-body-sm text-[var(--nf-content-muted)]">{copy.making}</p>
          )}

          {state === "failed" && (
            <p className="nf-body-sm text-[var(--nf-state-error)]">{copy.failed}</p>
          )}

          {state === "made" && href !== null && (
            <div className="nf-pc-share__link">
              <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">
                {copy.madeHeading}
              </p>
              <p className="mt-inline-tight nf-caption text-[var(--nf-content-muted)]">
                {copy.madeBody}
              </p>
              {/* SELECTABLE TEXT, not only a copy button. `navigator.clipboard`
                  is refused outright in several in-app browsers people in this
                  market actually use, and a copy button that silently does
                  nothing is worse than a link they can read. */}
              <p className="nf-pc-share__url nf-caption mt-inline">{href}</p>
              <div className="mt-block flex flex-col gap-row">
                <Button variant="primary" full onClick={() => void copyLink()}>
                  {copied ? copy.copied : copy.copy}
                </Button>
                <ButtonLink href={href} variant="ghost" full>
                  {copy.open}
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}
