import type { AssistantAction, AssistantCard, AssistantListingItem } from "./types";

/**
 * THE BUTTONS UNDER A LISTING, BUILT BY THE SERVER.
 *
 * `View listing` opens the real page; `More pictures`, `Viewing times`, `Save`
 * and `Compare` are fixed kinds the screen knows how to run. The model never
 * writes a label, an address or an id into a button: they all come from the row.
 */
export function cardFor(
  item: AssistantListingItem,
  opts: { reason?: string; saved?: boolean; viewings?: boolean; example?: boolean } = {},
): AssistantCard {
  const actions: AssistantAction[] = [{ id: `view-${item.id}`, label: "View listing", kind: "link", href: item.href }];
  if (!opts.example) {
    actions.push({ id: `photos-${item.id}`, label: "More pictures", kind: "photos", listingId: item.id });
    if (opts.viewings) actions.push({ id: `slots-${item.id}`, label: "Request viewing", kind: "slots", listingId: item.id });
    actions.push(
      opts.saved
        ? { id: `unsave-${item.id}`, label: "Saved", kind: "unsave", listingId: item.id }
        : { id: `save-${item.id}`, label: "Save", kind: "save", listingId: item.id },
    );
  }
  actions.push({
    id: `compare-${item.id}`,
    label: "Compare",
    kind: "ask",
    prompt: `Compare this place with the others you showed me: ${item.title}`,
  });
  return { ...item, ...(opts.reason ? { reason: opts.reason } : {}), actions };
}
