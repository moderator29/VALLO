import { MotionScene } from "@/components/ui/MotionScene";
import { FEATURE_ART } from "@/lib/features/art";

import "./roommates-kit.css";

/**
 * THE VERIFICATION HEADER (8 November 2026): a MotionScene banner for the
 * "Add a check" page. A night-blue room plate with the shield and the id-card
 * objects floating over it, the title and the honest line overlaid. It says
 * what a badge is, and nothing more: a badge records what was checked.
 */
export function VerificationBanner({ title, line }: { title: string; line: string }) {
  return (
    <MotionScene
      art={FEATURE_ART.backdrop}
      anchor="center"
      objects={[
        { name: "shield", at: "tr", size: 72 },
        { name: "id-check", at: "bl", size: 52 },
      ]}
      className="nf-rmvb"
      testId="roommates-verify-banner"
    >
      <h2 className="nf-rmvb__title">{title}</h2>
      <p className="nf-rmvb__line">{line}</p>
    </MotionScene>
  );
}
