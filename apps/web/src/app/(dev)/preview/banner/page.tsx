import { BannerDeck } from "./BannerDeck";

export const metadata = { title: "Banner" };

export default function BannerPreviewPage() {
  return (
    <main className="nf-shell py-section">
      <h1 className="nf-h2">Banner</h1>
      <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">
        Every tone, with the rail, the plate and the tone glow.
      </p>
      <BannerDeck />
    </main>
  );
}
