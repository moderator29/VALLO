import type { ActionResult } from "../actions/envelope";
import { withTimeout } from "../media/upload";
import { enqueue, entryKey, makeCreateEntry, type CreateKind } from "./outbox";
import { isOffline } from "./connectivity";

/**
 * SEND NOW, OR KEEP IT FOR WHEN THERE IS SIGNAL. V-40.
 *
 * The one path every composer takes. A UUID is minted for this tap and sent
 * as the action's `tapKey`. Offline, or when the request never comes back,
 * the same tap is kept in the outbox under that same UUID, so if the lost
 * request did land, the replay gets the first answer rather than a twin.
 * A server's answer, yes or no, is final here: only a lost request is kept.
 */
export type SendOrKeep<T> =
  | { state: "sent"; result: ActionResult<T> }
  | { state: "kept"; key: string }
  | { state: "not_kept" };

const SEND_DEADLINE_MS = 25_000;

export async function sendOrKeep<T>(
  kind: CreateKind,
  payload: { [key: string]: string | undefined },
  send: (tapKey: string) => Promise<ActionResult<T>>,
): Promise<SendOrKeep<T>> {
  const tapKey = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null;
  const keep = async (): Promise<SendOrKeep<T>> => {
    const fields = Object.fromEntries(Object.entries(payload).filter(([, v]) => typeof v === "string"));
    const entry = tapKey ? makeCreateEntry(kind, tapKey, fields, Date.now()) : null;
    return entry && (await enqueue(entry)) ? { state: "kept", key: entryKey(kind, tapKey!) } : { state: "not_kept" };
  };
  if (isOffline()) return keep();
  try {
    /* A stalled connection never throws, so the wait itself is bounded: past
       SEND_DEADLINE_MS the tap is kept, and its tap key makes a replay of a
       request that did land answer with the first result rather than a twin. */
    return { state: "sent", result: await withTimeout(send(tapKey ?? ""), SEND_DEADLINE_MS) };
  } catch {
    /* The request never came back: the network dropped or stalled under it. */
    return keep();
  }
}
