/**
 * A listing or a booking, shared into a chat, as a message body.
 *
 * WHY THE CARD RIDES A PLAIN MESSAGE. `message_attachments` carries one
 * shape: an image path with a width and a height. There is no attachment
 * kind and no row that can point at a listing or a booking, and that table
 * belongs to the messaging worker. Rather than wait, a shared card is sent
 * as an ordinary text message whose body is a Vallo path the thread page
 * recognises and expands into the rich card, exactly the way every messaging
 * product turns a link into a preview. The body is honest on every surface
 * that does not expand it: the inbox preview, the realtime row before a
 * refresh and a notification all read "Shared a listing" and a path that
 * opens the thing.
 *
 * THE SEAM. When `message_attachments` grows a `kind` and a `ref_id` (the
 * exact migration is in the F5 report), `shareBody` becomes the attachment
 * insert and `parseShare` reads the row instead of the text. Nothing else
 * in the thread changes, because everything above this file only ever sees
 * a `SharedRef`.
 *
 * Client-safe: no imports, pure string work, tested.
 */

/**
 * `stay` IS ITS OWN KIND, and it is not a listing with a different name.
 *
 * `/stay/<id>` takes an ACCOMMODATION id when a host has onboarded one and a
 * catalogue listing id otherwise, and the two live in different tables with
 * different readers. Sharing an accommodation-backed stay as a listing
 * resolved nothing, so the bubble fell back to a bare path: that is the seam
 * the founder hit. A third kind costs one branch in `resolveCard` and makes
 * the card real on both.
 */
/**
 * `roommate` is a Vallo Roommates post (`/roommates/r/<id>`), shared from its
 * Share menu: a room on offer, a roommate wanted, or a find-together post.
 */
export type SharedKind = "listing" | "booking" | "stay" | "roommate";

export type SharedRef = { kind: SharedKind; id: string };

/**
 * A member's Vallo passport, shared into a chat. Its own kind, apart from
 * `SharedKind`, because it is not a thing the picker offers or the forward
 * control carries: it is the sender's own passport, posted from the options
 * sheet, and the thread draws it as a card only for the member who sent it.
 */
export type PassportRef = { kind: "passport"; id: string };

/** Every body the thread turns into a card. */
export type ParsedShare = SharedRef | PassportRef;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** The first line of a share body, which is also its inbox preview. */
export const SHARE_LEAD: Record<SharedKind | "passport", string> = {
  listing: "Shared a listing",
  booking: "Shared a booking",
  stay: "Shared a stay",
  roommate: "Shared a room",
  passport: "Shared a passport",
};

/** Where each kind opens. `/bookings/<id>` is the trips hub's own detail route. */
export function shareHref(ref: ParsedShare): string {
  if (ref.kind === "listing") return `/listing/${ref.id}`;
  if (ref.kind === "stay") return `/stay/${ref.id}`;
  if (ref.kind === "roommate") return `/roommates/r/${ref.id}`;
  /* The Vallo passport of the account `id`. A card draws only for the member
     who sent it (`cards.ts`), and the page it opens answers to the owner's
     switches and to blocks, so the path is safe to carry in a body. */
  if (ref.kind === "passport") return `/passport/${ref.id}`;
  return `/bookings/${ref.id}`;
}

/** The body a share sends. Two lines: what it is, then the path that opens it. */
export function shareBody(ref: ParsedShare): string {
  return `${SHARE_LEAD[ref.kind]}\n${shareHref(ref)}`;
}

/* Each segment is written exactly as `shareHref` writes it, so `bookings`
   plural and `stay` singular are both spelled out rather than inferred. */
const SHARE_RE = new RegExp(
  `^(?:Shared a (?:listing|booking|stay|room|passport)\\n)?/(listing|bookings|stay|passport|roommates/r)/(${UUID})$`,
  "i",
);

/**
 * The share a body carries, or null for an ordinary message.
 *
 * Strict on purpose: the whole body has to be the two lines above, or the
 * bare path. A sentence that happens to mention a listing path is prose and
 * stays prose.
 */
export function parseShare(body: string): ParsedShare | null {
  const match = SHARE_RE.exec(body.trim());
  if (!match) return null;
  const segment = match[1]!.toLowerCase();
  const id = match[2]!.toLowerCase();
  if (segment === "passport") return { kind: "passport", id };
  if (segment === "roommates/r") return { kind: "roommate", id };
  const kind: SharedKind = segment === "listing" ? "listing" : segment === "stay" ? "stay" : "booking";
  return { kind, id };
}

/**
 * THE ONE RULE FOR "DOES THIS MESSAGE DRAW AS A CARD". The thread page uses it
 * when it expands the messages it loaded (`messages/[id]/cards.ts`) and the
 * open thread uses it when a message arrives over realtime
 * (`ThreadView.tsx`), so a message turns into a card on the same terms
 * whichever way it reached the screen.
 *
 * A listing, a stay or a booking card draws for whoever the share reaches. A
 * passport card is the SENDER'S own: a body that points at somebody else's
 * passport (typed, or forwarded) is words and a path, never a card, so nobody
 * can post another member's passport as if they were showing it.
 */
export function cardRefFor(message: { body: string; senderId?: string | null }): ParsedShare | null {
  const ref = parseShare(message.body);
  if (!ref) return null;
  if (ref.kind === "passport" && message.senderId !== ref.id) return null;
  return ref;
}

/** What the inbox row says for a share, instead of printing a path. */
export function sharePreview(body: string): string | null {
  const ref = parseShare(body);
  return ref ? SHARE_LEAD[ref.kind] : null;
}
