import { LogoMark } from "@/design-system/brand/Logo";
import "./door.css";

/**
 * THE DOOR'S FRAME (V-07). Deliberately almost nothing.
 *
 * A door is not inside the platform, so it carries none of the platform's
 * chrome: no tab bar, no side navigation, no search. It is not the marketing
 * site either, so it carries no site header, footer or newsletter field. It is
 * the mark, one card and one button, which is what a stranger arriving from a
 * WhatsApp thread needs and all the 23 September ruling allows them to have.
 *
 * The mark is not a link to `/`. The door's one way forward is its button;
 * a second exit to the landing page would be a second decision for a person
 * who came to look at one home.
 */
export default function DoorLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="nf-door">
      <div className="nf-sdoor__mark">
        <LogoMark size={40} title="Vallo" />
      </div>
      <div className="nf-door__stage">{children}</div>
    </main>
  );
}
