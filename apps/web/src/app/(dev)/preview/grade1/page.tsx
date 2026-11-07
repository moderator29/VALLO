/* Screenshot harness for the Platform Grade 1 shared pieces (docs/UX_SYSTEM.md):
   the real components with fixture props, drawn with no session.
   `?s=step` (StepFrame, step 3 of 12), `step-saving`, `offer` (the passcode
   offer on a home-like page), `banner-success`, `banner-error`, `banner-info`,
   `banner-warning`, `page` (PageFrame with tabs). Closed outside development
   by the preview layout's own guard. */
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PasscodeOfferCard } from "@/components/passcode/PasscodeOfferCard";
import { PageFrame } from "@/components/app/PageFrame";
import { Grade1Step, Grade1Banner } from "./Grade1Fixtures";

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s = "step" } = await searchParams;
  const copy = getDictionary(await getLocale()).protect;
  if (s === "step" || s === "step-saving") return <Grade1Step saving={s === "step-saving"} />;
  if (s.startsWith("banner-")) {
    return (
      <div className="mx-auto max-w-lg px-gutter py-section">
        <Grade1Banner tone={s.slice("banner-".length)} />
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">The page behind the banner.</p>
      </div>
    );
  }
  if (s === "page") {
    return (
      <PageFrame title="Saved" subtitle="Places you kept, on every device" fallback="/home">
        <section className="nf-panel p-card">A section of the page.</section>
        <section className="nf-panel p-card">Another section of the page.</section>
      </PageFrame>
    );
  }
  return (
    <div className="mx-auto max-w-lg px-gutter">
      <PasscodeOfferCard title={copy.offerTitle} body={copy.offerBody} action={copy.offerAction} dismiss={copy.offerDismiss} />
      <h1 className="nf-h1 mt-lg">Good afternoon, Ada</h1>
    </div>
  );
}
