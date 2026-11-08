import Image from "next/image";

/**
 * THE VALLO WATERMARK BEHIND A QUIET CHAT (the founder, 9 November 2026: the
 * assistant, support and messages should read like the system assistant does
 * before you speak to it, a faint brand mark resting in the middle of the
 * canvas that clears the moment the conversation starts).
 *
 * It is Vallo's own mark, not anyone else's, set very faint and large behind
 * the scroll content. It is decorative (`aria-hidden`, never announced), it
 * takes no pointer events, and it fades out with `hidden` so a thread that has
 * messages in it shows none of it. One component for every chat surface, so
 * the mark sits in the same place at the same weight across the platform.
 *
 * `hidden` is the activity flag: pass `true` once the thread has any message
 * (or a draft has been sent), `false` while the canvas is empty.
 */
export function ChatWatermark({ hidden }: { hidden: boolean }) {
  return (
    <div className="nf-chat-watermark" data-hidden={hidden ? "" : undefined} aria-hidden>
      <Image src="/brand/vallo-mark.svg" alt="" width={776} height={664} priority={false} draggable={false} />
    </div>
  );
}
