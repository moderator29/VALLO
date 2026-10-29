/**
 * THE DELIVERY STATE OF MY MESSAGES: one tick (sent), two muted ticks
 * (delivered), two blue ticks (read).
 *
 * Pure so the rule is tested without a browser. What the platform stores:
 *
 * - SENT: the row exists (the server took it). Every settled message of mine.
 * - DELIVERED: the other side's device or inbox took it. The messages table has
 *   no column for this today, so a row never carries `delivered` yet; the
 *   state is wired and waits for the column (see the report that came with it).
 * - READ: the row's `read_at` (set when the other side opens the thread), OR
 *   the other side has written anything after it. A reply is proof it was seen,
 *   and it flips the tick at once even when the `read_at` update has not
 *   reached this screen yet.
 *
 * A bubble still on its way (sending, waiting, failed) has no tick at all, and
 * neither does a call marker, which is not a message anybody reads.
 */
export type Delivery = "sent" | "delivered" | "read";

export type DeliveryInput = {
  id: string;
  mine: boolean;
  state?: "sending" | "failed" | "waiting";
  read?: boolean;
  delivered?: boolean;
  call?: unknown;
};

export function deliveryStates(items: readonly DeliveryInput[]): Map<string, Delivery> {
  let lastTheirs = -1;
  items.forEach((m, i) => {
    if (!m.mine && !m.call && !m.state) lastTheirs = i;
  });
  const out = new Map<string, Delivery>();
  items.forEach((m, i) => {
    if (!m.mine || m.call || m.state) return;
    out.set(m.id, m.read || i < lastTheirs ? "read" : m.delivered ? "delivered" : "sent");
  });
  return out;
}
