import { PasteDeck } from "./PasteDeck";

/**
 * PASTE (founder, 14 November 2026, handoff 6.2). The chips a composer holds
 * a paste in: a wall of words with its length, the same over its limit, a
 * plain address, and a Vallo address named from the address alone with
 * nothing fetched.
 */
export default function PreviewPaste() {
  return (
    <main className="nf-shell py-section">
      <h1 className="nf-h2">Paste</h1>
      <PasteDeck />
    </main>
  );
}
