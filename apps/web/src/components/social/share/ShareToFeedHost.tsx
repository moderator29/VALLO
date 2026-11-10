"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const ShareToFeedSheet = dynamic(() => import("./ShareToFeedSheet").then((m) => m.ShareToFeedSheet), { ssr: false });

/**
 * The share sheet for a menu that opens it from a row (a card's menu): the
 * sheet's chunk is fetched the first time it is asked for, and the host stays
 * mounted outside the menu so closing the menu does not close the sheet.
 */
export function ShareToFeedHost({ listingId, open, onClose }: { listingId: string; open: boolean; onClose: () => void }) {
  const [wanted, setWanted] = useState(open);
  if (open && !wanted) setWanted(true);
  return wanted ? <ShareToFeedSheet open={open} onClose={onClose} listingId={listingId} /> : null;
}
