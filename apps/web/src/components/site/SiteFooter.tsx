import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import { Logo } from "@/design-system/brand/Logo";
import { SocialLinks } from "@/components/ui/SocialLinks";
import { COMPANY_REGISTERED_OFFICE } from "@/lib/legal/company";
import { NewsletterForm } from "./NewsletterForm";
import { StoreBadges } from "./landing/StoreBadges";
import { storeBadges } from "./landing/store-badges";
import { requestSurface } from "@/lib/auth/surface";
import { JsonLd } from "./JsonLd";
import { organizationLd, websiteLd } from "@/lib/site/structured-data";
import { publicCatalogueEnabled } from "@/lib/catalogue/public-access";
import "@/app/css/site.css";

/**
 * THE WEBSITE'S FOOT (rebuilt 14 November 2026, the founder: "upgrade our
 * down side of website that's infos of our platform ... high end").
 *
 * Four bands, each doing one job, top to bottom:
 *
 *   1. THE HEAD. The lockup and one line about the company at the start; the
 *      apps at the end, under their own small label. Who we are and where to
 *      get it, before any list.
 *   2. THE LINKS. Product, Company, Support: a title in the page's ink, the
 *      links under it in the quieter ink, hairlines between the groups on a
 *      phone so each reads as its own list.
 *   3. STAY CONNECTED. One contained panel: the email field at the start,
 *      Follow Vallo at the end. It was a loose column; it is now one object.
 *   4. THE LEGAL BAR. The copyright with the legal name, the registered
 *      office in an <address>, then the legal links on one wrapping row.
 *
 * VALLO SPACES LTD appears here and in the copyright because a footer's
 * legal line is a legal surface; it appears nowhere else on the page.
 *
 * `variant="app"` is the same foot under the listings a guest lands on (the
 * website has no separate landing page): it sits on the page's own ground
 * with no top bloom, and states who publishes the site for search engines,
 * which the landing page used to do.
 *
 * The social row is `SocialLinks`, read from `lib/brand/socials.ts`: Facebook,
 * Instagram and TikTok today, LinkedIn the day its page address is set. A
 * network with no address is not drawn.
 */
export async function SiteFooter({ t, variant = "site" }: { t: Dictionary; variant?: "site" | "app" }) {
  /*
   * THE STORE BADGES, ON EVERY PAGE OF THE WEBSITE AND NOT ONLY THE LANDING
   * (the founder, 13 November 2026: "we are up and going on Play Store and
   * App Store now, so update the link on our websites so people can click
   * from our website and download, anywhere that says we are not live").
   *
   * They were drawn in two bands of the landing page and nowhere else, so a
   * visitor reading About, Help, For hosts or any of the other public doors
   * was never told the apps exist. The footer is the one surface all of them
   * share.
   *
   * `storeBadges()` decides what is drawn, here as on the landing: the
   * official artwork either way, a link only when that store's URL is set and
   * is that store's own address, and nothing at all inside a native shell,
   * where an install badge is noise at best and a rejection at worst. The
   * surface is read the same way the landing reads it, from the user agent,
   * so the two cannot disagree. The site layout already withholds this whole
   * footer from a shell; the landing renders it either way, which is why the
   * check lives here rather than in a caller.
   */
  const badges = storeBadges({
    /* `NEXT_PUBLIC_*` is inlined at build time, so a newly set store URL
       needs a redeploy before the badge becomes a link. */
    appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL,
    playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL,
    native: (await requestSurface()) !== "web",
  });
  const f = t.landing.footer;
  const face = t.landing.face;
  const doors = t.publicDoors.nav;
  /*
   * THREE COLUMNS, on the founder's ruling of 19 September, matching the
   * render: Product, Company, Support.
   *
   * The fourth column was Legal, and it held Terms, Privacy and Cookies. All
   * three already sit in the legal line at the very foot of the page, which
   * is where the render puts them, so the column was printing the same three
   * links twice on one screen. Dropping it is what makes the layout the
   * render's, and it loses no destination.
   *
   * Every entry points at a route that exists, checked against app/(site) and
   * the sitemap. The render also lists Blog and Press under Company; there is
   * no blog and no press room, and a link labelled Blog that opens the docs
   * is a picture of a feature, so those two wait for the pages.
   */
  const columns = [
    {
      title: f.product,
      /* NOT PREFETCHED (C6, R3-18 round 2). These four open the product,
         and a footer link in view prefetches its whole route: on a short
         public page (/check measured) the footer is on the first screen at
         390, and the Buy link alone pulled the search screen's code, about
         120 KB, into a stranger's first load. They load when tapped. Every
         other footer link is a public page of a few KB and keeps its
         prefetch. */
      app: true,
      links: [
        /* Markets, not categories (V-26): `type=home` showed houses to let
           under Buy, and `type=rental` missed every flat to let. */
        { href: "/search?market=buy", label: face.footer.buy },
        { href: "/search?market=rent", label: face.footer.rent },
        { href: "/stays", label: face.nav.stays },
        /* The render's Product column lists Invest, pointing at land. Vallo
           sells no investment product, so the slot carries Restaurants,
           which is a shipped surface. Land is still a door on the landing's
           category grid and in the search filters. */
        { href: "/restaurants", label: face.footer.restaurants },
        { href: "/assistant", label: face.footer.ai },
      ],
    },
    {
      title: f.company,
      links: [
        { href: "/about", label: face.footer.aboutUs },
        { href: "/careers", label: f.careers },
        /* A9: the supply front doors, public pages rather than a sign-in
           wall (the old "Become an agent" / "List your property" entry went
           to `/agents`, which redirected a stranger to sign in). */
        { href: "/for-agents", label: doors.forAgents },
        { href: "/for-hosts", label: doors.forHosts },
        { href: "/for-landlords", label: doors.forLandlords },
        { href: "/contact", label: f.contact },
      ],
    },
    {
      title: f.support,
      /* Nine links: two columns of its own on a phone and a tablet. */
      wide: true,
      links: [
        { href: "/help", label: face.footer.helpSupport },
        /* A7: the two checks a stranger can run with no account. */
        { href: "/check", label: doors.checkAgent },
        { href: "/r", label: doors.checkReceipt },
        { href: "/move-in-cost", label: doors.moveInCost },
        { href: "/guides", label: doors.guides },
        { href: "/docs", label: f.docs },
        { href: "/safety", label: face.footer.safety },
        { href: "/standards", label: face.footer.standards },
        { href: "/cancellations", label: face.footer.cancellations },
      ],
    },
  ];

  const year = new Date().getFullYear();

  return (
    <footer className={variant === "app" ? "nf-site-footer nf-site-footer--app" : "nf-site-footer"} data-testid="site-footer">
      {/* A13: who publishes this site, stated once, where a stranger now
          lands (the landing page carried it until 14 November 2026). */}
      {variant === "app" ? <JsonLd data={[organizationLd(), websiteLd({ searchOpen: publicCatalogueEnabled() })]} /> : null}
      <div className="nf-shell nf-foot">
        {/* 1. The head: who we are, and where to get it. */}
        <div className="nf-foot__head">
          <div className="nf-foot__brand">
            <Link href="/" aria-label={t.a11y.logoHome} className="nf-tap inline-flex">
              <Logo size={40} wordSize={19} />
            </Link>
            <p className="nf-foot__line">{face.footer.legalLine}</p>
          </div>
          {badges.length > 0 ? (
            <div className="nf-foot__apps">
              <p className="nf-foot__label">{face.app.eyebrow}</p>
              {/* The official artwork, drawn inline (StoreBadges.tsx). Nothing
                  is rendered when the list is empty, which is every native
                  request. */}
              <StoreBadges badges={badges} labels={t.landingRooms.badges} className="nf-site-footer__badges" />
            </div>
          ) : null}
        </div>

        {/* 2. The links. */}
        <div className="nf-foot__cols">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className={"wide" in col && col.wide ? "nf-foot__col nf-foot__col--wide" : "nf-foot__col"}>
              <h2 className="nf-foot__title">{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={`${l.href}-${l.label}`}>
                    <Link href={l.href} prefetch={"app" in col && col.app ? false : undefined} className="nf-site-footer-link">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* 3. Stay connected: one contained panel. */}
        <div className="nf-foot__connect">
          <div className="nf-foot__news">
            <h2 className="nf-foot__title">{face.footer.stayConnected}</h2>
            <p className="nf-foot__note">{face.footer.newsletterBody}</p>
            <NewsletterForm
              label={face.footer.emailLabel}
              placeholder={face.footer.emailPlaceholder}
              submit={face.footer.subscribe}
              note={face.footer.newsletterNote}
              done={face.footer.subscribed}
            />
          </div>
          <SocialLinks className="nf-foot__follow" heading={face.footer.followUs} template={face.footer.onNetwork} />
        </div>

        {/* 4. The legal bar. No skyline and no shield (UIUX item 11): one
            hairline above it is the whole division. */}
        <div className="nf-foot__legal">
          <div className="nf-foot__owner">
            <p>
              &copy; <span className="nf-numeric">{year}</span> {face.footer.legalName}. {f.rights}
            </p>
            {/*
              THE REGISTERED OFFICE, IN AN <address> ELEMENT.

              A marketplace that asks a stranger to send a deposit owes them
              a real place the company can be found, so this is a trust
              surface before it is a legal one. The element is `address`
              because that is what it is: a screen reader announces it as
              contact information and a search engine reads it as the
              business location, which a `p` gives neither.

              `not-italic` because the user agent italicises `address` by
              default and nothing else in this footer is italic.
            */}
            <address className="not-italic">
              <span className="sr-only">{face.footer.registeredOfficeLabel}: </span>
              {COMPANY_REGISTERED_OFFICE}
            </address>
          </div>
          {/*
            DELETE ACCOUNT SITS BESIDE PRIVACY AND TERMS, AND IT IS A STORE
            REQUIREMENT RATHER THAN A COURTESY.

            Google Play will not pass a submission without a publicly
            reachable page that explains how to request account deletion and
            what is destroyed against what is kept, and a reviewer looks for
            it in the legal line at the foot of the site.
          */}
          <ul className="nf-foot__terms">
            <li>
              <Link href="/terms" className="nf-site-footer-link">
                {f.terms}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="nf-site-footer-link">
                {f.privacy}
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="nf-site-footer-link">
                {t.cookies.footerPolicy}
              </Link>
            </li>
            <li>
              <CookieSettingsButton className="nf-site-footer-link">{t.cookies.footerLink}</CookieSettingsButton>
            </li>
            <li>
              <Link href="/disclaimer" className="nf-site-footer-link">
                {f.disclaimer}
              </Link>
            </li>
            <li>
              <Link href="/delete-account" className="nf-site-footer-link">
                {f.deleteAccount}
              </Link>
            </li>
            <li>
              <Link href="/community" className="nf-site-footer-link">
                {f.community}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
