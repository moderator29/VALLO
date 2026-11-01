import Link from "next/link";
import { AI_GLYPH } from "@/lib/assistant/glyphs";

/**
 * "Ask Vallo AI about this place": a quiet link for a signed-in member. It opens
 * the assistant with this listing's id in the address; the server checks the id
 * is a real listing and reads its title itself, so nothing typed here is trusted.
 */
export function AskAiAbout({ listingId }: { listingId: string }) {
  return (
    <Link href={`/assistant?about=${encodeURIComponent(listingId)}`} className="nf-ai-ask" data-testid="ask-ai-about">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={AI_GLYPH.assistant} alt="" width={24} height={24} className="nf-ai-ask__glyph" />
      Ask Vallo AI about this place
    </Link>
  );
}
