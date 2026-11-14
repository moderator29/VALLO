import { liveSocials, type SocialKey } from "@/lib/brand/socials";

/**
 * THE SOCIAL ROW (28 October 2026, updated 14 November 2026).
 *
 * Each network's own brand icon and colour on a disc: Facebook blue, the
 * Instagram gradient, TikTok black and LinkedIn blue. White marks on each
 * network's real ground, in both themes. Each is a real link to Vallo's page,
 * opened in a new tab, named for a screen reader, 44 pixels to tap, with a
 * visible keyboard focus. Nothing is drawn for a network with no address.
 */
const BRAND_COLOR: Record<SocialKey, string> = {
  facebook: "#1877F2",
  instagram: "linear-gradient(135deg, #FD5 0%, #FF543E 25%, #C837AB 50%, #5B51D8 100%)",
  tiktok: "#000000",
  linkedin: "#0A66C2",
};

const GLYPH: Record<SocialKey, React.ReactNode> = {
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" />
    </>
  ),
  tiktok: <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />,
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
};

export function SocialMark({ network, size = 20 }: { network: SocialKey; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPH[network]}
    </svg>
  );
}

export function SocialLinks({
  heading,
  template = "Vallo on {network}",
  className,
  size = "md",
}: {
  /** An optional visible line before the marks ("Follow Vallo"). */
  heading?: string;
  /** The accessible name of each link; `{network}` is the network's name. */
  template?: string;
  className?: string;
  size?: "md" | "lg";
}) {
  const accounts = liveSocials();
  if (accounts.length === 0) return null;
  return (
    <div className={["nf-social", className ?? ""].filter(Boolean).join(" ")} data-size={size}>
      {heading ? <p className="nf-overline nf-social__heading">{heading}</p> : null}
      <ul className="nf-social__list">
        {accounts.map((a) => (
          <li key={a.key}>
            <a
              href={a.url}
              className="nf-social__link"
              target="_blank"
              rel="me noopener noreferrer"
              aria-label={template.replace("{network}", a.label)}
              data-network={a.key}
              style={{ background: BRAND_COLOR[a.key] }}
            >
              <SocialMark network={a.key} size={size === "lg" ? 24 : 20} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
