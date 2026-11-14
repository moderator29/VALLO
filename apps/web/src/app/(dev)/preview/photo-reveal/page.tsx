import { PhotoRevealDeck } from "./PhotoRevealDeck";

/**
 * THE PHOTOGRAPH SETTLING IN (the founder's brief, section 6). Tap Load to
 * watch a card's photograph crossfade up over its well, and compare it with
 * the eager one, which is the page's largest paint and never fades.
 */
export default function PreviewPhotoReveal() {
  return (
    <main className="nf-shell py-section">
      <h1 className="nf-h2">A card photograph settling in</h1>
      <PhotoRevealDeck />
    </main>
  );
}
