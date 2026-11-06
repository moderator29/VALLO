/**
 * A realtime channel name that is never one the browser client already holds.
 *
 * `supabase.channel(name)` does not make a new channel when one with that name
 * exists; it hands back the old one. If the old one is already subscribed,
 * adding a listener to it throws "cannot add `postgres_changes` callbacks ...
 * after `subscribe()`", which is how the notification bell crashed on a phone
 * (6 November 2026): leaving the screen starts an asynchronous
 * `removeChannel`, the next visit asks for the same name before it finishes,
 * and the screen fell over.
 *
 * Only for channels that LISTEN TO DATABASE CHANGES. A database listener is
 * matched by its table and filter, never by its name, so a unique name changes
 * nothing it receives. Broadcast channels (typing, calls) are matched BY NAME
 * between people and must keep a shared one.
 */
let counter = 0;

export function ownChannelName(base: string): string {
  counter += 1;
  return `${base}:${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
