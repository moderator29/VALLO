/**
 * Assistant wire types.
 *
 * Shared between the /api/assistant route handler and the chat surface, so
 * both sides of the stream agree on every event shape. Client-safe: nothing
 * in here touches the server.
 *
 * The route speaks Server-Sent Events, one JSON object per `data:` line:
 *   text      an incremental slice of the assistant's reply
 *   listings  real catalogue results to render as tappable cards
 *   thread    the server conversation id, once persistence is in play
 *   error     a friendly, already-worded failure the UI can show verbatim
 *   done      the turn is complete
 */

export type AssistantListingItem = {
  id: string;
  title: string;
  city: string;
  kind: string;
  /** Already-formatted display price, e.g. "NGN 185,000 per night". */
  price: string;
  rating: number;
  /**
   * A person at Vallo checked the lister. Read off the row, never asserted,
   * and always false on an example listing (the repository derives it).
   * The card draws its Verified mark from this and from nothing else.
   */
  verified: boolean;
  /** Bedrooms, when the listing states one or more. Absent, never zero. */
  bedrooms?: number;
  /** Bathrooms, when the listing states one or more. Absent, never zero. */
  bathrooms?: number;
  /** Floor area in square metres, when the lister gave one. */
  sizeSqm?: number;
  /**
   * Where this row opens, already built by the route under the SIDE LAW.
   *
   * NOT always "/listing/<id>", and the comment that said so was the reason
   * it stayed wrong: a stay opens at "/stay/<id>", a restaurant at
   * "/restaurant/<id>" and a property at "/listing/<id>". `hrefForListing` in
   * `lib/listings/href.ts` is the one place that decides it. The path forces
   * the shell (`lib/side.constants.ts`), so a client renders this as it
   * arrives; a client that recomputes it calls the same helper and never
   * writes a second rule.
   */
  href: string;
  /** Lead photo URL for the card thumbnail. */
  photo?: string;
};

/**
 * A button the assistant draws. THE SERVER builds every one from a tool result
 * (never the model), so the model cannot fabricate a button, an amount or a
 * proposal id. `link` opens a real address; `ask` sends a fixed prompt back as
 * the person's own words; the rest call a server action that re-verifies the
 * person and their permission.
 */
export type AssistantAction =
  | { id: string; label: string; kind: "link"; href: string }
  | { id: string; label: string; kind: "ask"; prompt: string }
  | { id: string; label: string; kind: "photos" | "slots" | "save" | "unsave"; listingId: string }
  | { id: string; label: string; kind: "confirm" | "cancel" | "retry"; proposalId: string; payloadHash: string }
  | { id: string; label: string; kind: "status"; proposalId: string };

export type AssistantCard = AssistantListingItem & {
  /** Plain reason this was picked, from the member's own saved or viewed activity. */
  reason?: string;
  actions: AssistantAction[];
};

export type AssistantSlot = { slotAt: string; label: string };
export type AssistantSummaryRow = { label: string; value: string; date?: string; status?: string };

export type AssistantStreamEvent =
  | { type: "text"; text: string }
  | { type: "listings"; items: AssistantListingItem[] }
  /** Listing cards with their buttons. */
  | { type: "cards"; title?: string; items: AssistantCard[] }
  /** Loose buttons under an answer. */
  | { type: "actions"; items: AssistantAction[] }
  /** Real open viewing times for one listing, each a tap. */
  | { type: "slots"; listingId: string; title: string; slots: AssistantSlot[] }
  /** A money summary for the member's own records. Read only. */
  | { type: "summary"; title: string; rows: AssistantSummaryRow[]; note?: string }
  /** A payment for the member to review and approve. The only way money moves from here. */
  | {
      type: "payment_review";
      proposalId: string;
      payloadHash: string;
      service: string;
      recipient: string;
      amount: string;
      fees: { label: string; value: string }[];
      total: string;
      expiresAt: string;
    }
  /** A swipeable strip of one listing's real photos. */
  | { type: "photos"; listingId: string; title: string; urls: string[] }
  | { type: "thread"; id: string }
  | { type: "error"; message: string }
  | { type: "done" };

/** Chat turns the client sends up; plain text both ways. */
export type AssistantTurn = { role: "user" | "assistant"; content: string };

/** The 200 JSON body returned when the assistant cannot run yet. */
export type AssistantUnconfigured = { configured: false; message: string };
