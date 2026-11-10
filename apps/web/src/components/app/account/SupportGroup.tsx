import { RowLink, SettingsGroup } from "./rows";

/**
 * THE SUPPORT GROUP (DOCS_AND_PRESENCE_UPGRADE.md 2.9 and 8; R95). The
 * written part of the platform, one tap from the profile tab, signed in AND
 * signed out: a visitor can read every policy before creating an account.
 * Four rows on the shared row shape (a thin line glyph on the plate, a
 * label, a line, a chevron), each to a stable public address.
 *
 * One component for both branches of the profile, so the two can never
 * offer different documents.
 */
export function SupportGroup() {
  return (
    <SettingsGroup label="Support">
      <RowLink href="/help" icon="headset" label="Help centre" sub="FAQs, contact us" testId="support-help" />
      <RowLink href="/guides" icon="file-text" label="Guides" sub="Step by steps and plain reads" testId="support-guides" />
      <RowLink href="/legal" icon="scale" label="Legal and policies" sub="Terms, refunds and every policy, dated" testId="support-legal" />
      <RowLink href="/privacy" icon="shield-lock" label="Privacy" sub="What we keep and your rights" testId="support-privacy" />
    </SettingsGroup>
  );
}
