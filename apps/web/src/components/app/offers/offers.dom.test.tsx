import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined, replace: () => undefined }), usePathname: () => "/" }));

import { OfferFigures, PriceBlockView, EligibilityCard } from "./OfferParts";
import { OfferFlow } from "./OfferFlow";
import { OfferConfirmation } from "./OfferConfirmation";
import { OffersWorkspace } from "./OffersWorkspace";
import { DealRoomView } from "../deal-room/DealRoomView";
import * as F from "@/lib/offers/fixtures";

const html = (node: React.ReactElement) => renderToString(node);

describe("the honest price block", () => {
  it("shows the asking price and says other costs are not itemised when nothing is configured", () => {
    const out = html(<PriceBlockView price={F.FIXTURE_PRICE_BARE} />);
    expect(out).toContain("85,000,000");
    expect(out).toContain("not yet itemised");
    expect(out).not.toContain("data-testid=\"price-total\"");
  });
  it("never prints a total while a component is missing, and labels every known cost", () => {
    const out = html(<PriceBlockView price={F.FIXTURE_PRICE_PARTIAL} />);
    expect(out).not.toContain("data-testid=\"price-total\"");
    expect(out).toContain("not yet itemised");
    expect(out).toContain("Survey plan fee");
    expect(out).toContain("Confirmed");
  });
  it("prints a total only when it is complete, with the breakdown one tap away", () => {
    const out = html(<PriceBlockView price={F.FIXTURE_PRICE_COMPLETE} />);
    expect(out).toContain("price-total");
    expect(out).toContain("Optional");
    expect(out).toContain("Paid directly to a third party");
    expect(out).toContain("See how the total is made up");
  });
});

describe("the offer against asking", () => {
  it("says the direction in words and gives an amount and a percentage", () => {
    const above = html(<OfferFigures amountMinor={87_000_000_00} askingMinor={85_000_000_00} />);
    expect(above).toContain("Above asking");
    expect(above).toContain("2.4%");
    const below = html(<OfferFigures amountMinor={80_000_000_00} askingMinor={85_000_000_00} />);
    expect(below).toContain("Below asking");
    expect(html(<OfferFigures amountMinor={85_000_000_00} askingMinor={85_000_000_00} />)).toContain("At asking");
  });
});

describe("requirements", () => {
  it("offers Fix only where the member can act", () => {
    const out = html(<EligibilityCard eligibility={F.FIXTURE_REVIEW} />);
    expect(out).toContain("Needs review");
    expect(out).not.toContain("fix-government_id");
    expect(html(<EligibilityCard eligibility={F.FIXTURE_BLOCKED} />)).toContain("fix-government_id");
  });
});

describe("the offer flow", () => {
  const props = { listingId: "l1", listingTitle: "A house", price: F.FIXTURE_PRICE_PARTIAL, mandate: F.FIXTURE_MANDATE, reason: null };
  it("keeps the form visible and Send disabled, with the reason, while a requirement is unmet", () => {
    const out = html(<OfferFlow {...props} eligibility={F.FIXTURE_BLOCKED} canOffer={false} initialStep={3} initialDraft={{ amount: "80000000", step: 3 }} />);
    expect(out).toContain("requirements are not met yet");
    expect(out).toMatch(/data-testid="offer-send"[^>]*disabled|disabled[^>]*data-testid="offer-send"/);
  });
  it("shows the resolved figure when the amount is left blank", () => {
    const out = html(<OfferFlow {...props} eligibility={F.FIXTURE_ELIGIBLE} canOffer initialStep={1} />);
    expect(out).toContain("Left blank, so this is the asking price.");
    expect(out).toContain("85,000,000");
  });
  it("states that nothing is charged and that Vallo does not verify title on the summary", () => {
    const out = html(<OfferFlow {...props} eligibility={F.FIXTURE_ELIGIBLE} canOffer initialStep={3} initialDraft={{ step: 3 }} />);
    expect(out).toContain("Nothing is charged. The seller reviews it and responds.");
    expect(out).toContain("does not verify title");
  });
});

describe("the confirmation", () => {
  it("says the offer was sent and agreed nothing", () => {
    const out = html(<OfferConfirmation room={F.ROOM_BUYER_WAITING} />);
    expect(out).toContain("Offer sent");
    expect(out).toContain("Nothing is agreed yet");
    expect(out).toContain("View Deal Room");
    expect(out).toContain("Return to Property");
  });
});

describe("my offers", () => {
  it("draws an invitation, not a blank, when there are no offers", () => {
    const none = { rows: [], counts: F.countsFor([], "buyer") };
    const out = html(<OffersWorkspace made={none} received={none} initialTab="made" nowMs={F.FIXTURE_NOW_MS} />);
    expect(out).toContain("You have not made an offer yet");
    expect(out).toContain("Browse homes for sale");
  });
  it("shows the true counts on the tabs", () => {
    const out = html(<OffersWorkspace made={{ rows: F.BUYER_ROWS, counts: F.countsFor(F.BUYER_ROWS, "buyer") }} received={{ rows: F.SELLER_ROWS, counts: F.countsFor(F.SELLER_ROWS, "seller") }} initialTab="made" nowMs={F.FIXTURE_NOW_MS} />);
    expect(out).toContain("Awaiting you");
    expect(out).toContain(">6<");
    expect(out).toContain(">5<");
  });
});

describe("what the Deal Room may and may not say", () => {
  const rooms = Object.values({ ...F.ROOMS_BY_STATE, c: F.ROOM_BUYER_COUNTER, s: F.ROOM_SELLER_RESPOND, as: F.ROOM_AGREED_SELLER });
  it("never calls a document, funds or a property verified or sold", () => {
    for (const room of rooms) {
      const out = html(<DealRoomView room={room} nowMs={F.FIXTURE_NOW_MS} initialTab="documents" />).replace(/<[^>]+>/g, " ");
      expect(out, room.offer.reference).not.toMatch(/\bverified\b/i);
      expect(out, room.offer.reference).not.toMatch(/\bsold\b/i);
      expect(out, room.offer.reference).not.toMatch(/funds (are|have been) (verified|checked)/i);
    }
  });
  it("answers the four questions on the overview", () => {
    const out = html(<DealRoomView room={F.ROOM_BUYER_COUNTER} nowMs={F.FIXTURE_NOW_MS} />);
    for (const q of ["What has happened", "What is waiting", "Whose turn it is", "Deadline"]) expect(out).toContain(q);
    expect(out).toContain("expires on 14 Nov 2026");
  });
  it("says an agreed offer is not a sale", () => {
    const out = html(<DealRoomView room={F.ROOM_AGREED_BUYER} nowMs={F.FIXTURE_NOW_MS} />);
    expect(out).toContain("not a sale");
    expect(out).toContain("Terms agreed");
  });
  it("states no deadline when the data has none", () => {
    expect(html(<DealRoomView room={F.ROOM_BUYER_WAITING} nowMs={F.FIXTURE_NOW_MS} />)).toContain("No deadline has been set on this offer.");
  });
  it("shows six distinct document chips", () => {
    const out = html(<DealRoomView room={F.ROOM_AGREED_BUYER} nowMs={F.FIXTURE_NOW_MS} initialTab="documents" />);
    for (const w of ["Requested", "Uploaded", "Under review", "Approved", "Rejected", "More information needed"]) expect(out).toContain(w);
  });
  it("offers one primary action to the seller who has to respond", () => {
    const out = html(<DealRoomView room={F.ROOM_SELLER_RESPOND} nowMs={F.FIXTURE_NOW_MS} />);
    expect(out).toContain("Respond to this offer");
  });
});
