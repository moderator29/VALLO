import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@vallo/i18n";
import { PageFrame } from "@/components/app/PageFrame";
import { RowLink, SettingsGroup } from "@/components/app/account/rows";
import { MessagesGroup } from "@/components/support/MessagesRow";
import { SupportHero } from "@/components/support/SupportHero";
import { getShellIdentity } from "@/lib/app/shell-queries";
import { aiConsentForViewer } from "@/lib/ai/consent-server";
import { loadMyReports } from "@/lib/reports/my-reports";
import { loadMyTickets } from "@/lib/support/my-tickets";
import { FAQS, POPULAR_QUESTIONS, TRUST_LINKS } from "@/lib/support/help-articles";
import { popularArticles } from "@/lib/support/help-search";
import { RESPONSE_COMMITMENTS } from "@/lib/trust/standards";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import { MyReports } from "../settings/help/MyReports";
import { SupportSearch } from "./SupportSearch";

export const metadata: Metadata = { title: "Help and support" };

/** The trust pages as rows, with a line glyph each (the help centre draws them as cards). */
const TRUST_ICON: Record<string, UiIconName> = {
  "/safety": "shield-stop",
  "/standards": "verified",
  "/cancellations": "calendar-booking",
};

/**
 * Help and support, the in-app home.
 *
 * The top is one navy block with one primary action, Ask a question, which
 * opens the AI helper; it answers from the help articles and hands over to a
 * person with the conversation attached. Under it: report a problem, write to
 * the team, the help centre. Then the member's own conversations with the
 * unread badge, a search over the help centre's answers, their reports, the
 * trust pages and the legal pages store reviewers look for.
 *
 * `/help` stays as the public help centre, reachable signed out; this page is
 * behind the gate like the rest of the app, so the signed-out branches only
 * run when the gate is open, and they send the person to sign in or to the
 * public contact form.
 */
export default async function SupportPage() {
  const locale = await getLocale();
  /* The client islands get their words from here, never from a client
     dictionary read (W13: that read shipped the whole index on /support). */
  const inboxWords = getDictionary(locale).experienceInbox;
  const [identity, tickets, reports, aiConsented] = await Promise.all([
    getShellIdentity(),
    loadMyTickets(50),
    loadMyReports(),
    aiConsentForViewer(),
  ]);
  const signedIn = identity.signedIn;
  /* The shell's name is the first word of the nickname, first name or display
     name, and falls back to "Guest" when a profile has none of them: a member
     is never greeted as a guest, so that fallback reads as no name at all. */
  const name = signedIn && identity.userName !== "Guest" ? identity.userName : "";
  const home = inboxWords.support.home;
  const promise = home.promise
    .replace("{standard}", RESPONSE_COMMITMENTS.standard.label.toLowerCase())
    .replace("{urgent}", RESPONSE_COMMITMENTS.urgent.label.toLowerCase());
  const popular = popularArticles(FAQS, POPULAR_QUESTIONS);

  return (
    /* E2 (round 3): Back lives in the page's own header, beside the title,
       never alone at the screen edge above the hero. */
    <div className="pb-[env(safe-area-inset-bottom)]">
      <PageFrame title={getDictionary(locale).settings.hub.help} fallback="/home" width="narrow">
        <SupportHero
          greeting={name ? home.greetingNamed.replace("{name}", name) : home.greeting}
          promise={promise}
          aiConsented={aiConsented}
          signedIn={signedIn}
          assistantCopy={inboxWords.assistant}
          copy={home}
        />

        <MessagesGroup tickets={tickets} signedIn={signedIn} copy={home} locale={locale} />

        <SupportSearch articles={FAQS} popular={popular} supportCopy={inboxWords.support} />

        <MyReports list={reports} locale={locale} />

        <SettingsGroup label={home.safety}>
          {TRUST_LINKS.map((link) => (
            <RowLink
              key={link.href}
              href={link.href}
              icon={TRUST_ICON[link.href] ?? "info"}
              label={link.title}
              sub={link.body}
            />
          ))}
        </SettingsGroup>

        <SettingsGroup label={home.legal}>
          <RowLink href="/terms" icon="document" label={home.terms} />
          <RowLink href="/privacy" icon="eye-off" label={home.privacy} />
          <RowLink href="/delete-account" icon="trash" label={home.deleteAccount} sub={home.deleteAccountSub} />
        </SettingsGroup>
      </PageFrame>
    </div>
  );
}
