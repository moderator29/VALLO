import Link from "next/link";
import { CookieSettingsPageButton } from "@/components/consent/CookieSettingsPageButton";
import { CookieTable } from "@/components/legal/CookieTable";
import { CATEGORY_ORDER, itemsIn } from "@/lib/consent/inventory";
import { COOKIES_UPDATED_ISO, longDate } from "./versions";

/**
 * The Cookies page, as content rather than as a page (the pattern of
 * `terms.tsx` and `privacy.tsx`): `(site)/cookies` for the public web and
 * `(app)/legal/cookies` inside the product render these same sections.
 *
 * The table of items is NOT written here. It is drawn from the one inventory
 * (`lib/consent/inventory.ts`) by `CookieTable`, and the counts below are read
 * from it, so a cookie added to the app that is not in the inventory fails
 * `inventory.test.ts` before this page can be wrong.
 */

export const COOKIES_UPDATED = longDate(COOKIES_UPDATED_ISO);

const A = "font-semibold text-[var(--nf-content-link)] hover:underline";

export const COOKIES_SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "what",
    title: "1. What this page covers",
    body: (
      <>
        <p>
          Vallo stores small pieces of information on your device so it can work: to keep you
          signed in, to remember your language, to hold a message you were typing. Some of
          this is a cookie (a small text file your browser keeps for our site). Some is device
          storage, which does the same job inside your browser or app. This page lists all of
          it, and says which of it you can switch off.
        </p>
        <p>
          Everything on this page is set by Vallo itself. The one other party named is our
          sign-in provider, Supabase, whose cookie carries your session. There is no
          advertising storage in Vallo and no analytics from a third party. See the{" "}
          <Link href="/privacy#cookies" className={A}>
            Privacy policy
          </Link>{" "}
          for how personal data is handled more widely.
        </p>
      </>
    ),
  },
  {
    id: "kinds",
    title: "2. The three kinds, and your choice",
    body: (
      <>
        <ul>
          <li>
            <strong>Necessary ({itemsIn("necessary").length} items).</strong> Needed for something
            you asked for or to keep Vallo working: signing in, your language and theme, the places
            you saved, a draft you were typing, the offline queue and a record of your cookie
            choice. These are always on. They also include small marks that you have seen a tip,
            so it does not repeat.
          </li>
          <li>
            <strong>Preferences ({itemsIn("preferences").length} items).</strong> Conveniences Vallo
            would remember on its own: your recent searches, the listings you last looked at, the
            search view you used last, and when you last visited. These are off until you agree.
          </li>
          <li>
            <strong>Usage counts ({itemsIn("analytics").length} items).</strong> A random visit
            number for simple, first-party counts of how people move through sign-up, and the
            shared link you opened first so the person who shared it is credited. These are off
            until you agree.
          </li>
        </ul>
        <p>
          When you first visit, Vallo asks. Accept all, Only necessary and Choose carry equal
          weight, and closing the notice means Only necessary. Nothing in the last two kinds is
          stored before you choose. You can change your mind at any time:
        </p>
        <p>
          <CookieSettingsPageButton>Cookie settings</CookieSettingsPageButton>
        </p>
        <p>
          Switching a kind off clears what it had stored on this device. Your choice is kept in a
          cookie called <code>vallo_consent</code> for one year, with the version of this notice you
          saw. If this notice changes in a way that matters, we ask you again.
        </p>
      </>
    ),
  },
  {
    id: "list",
    title: "3. Everything Vallo stores",
    body: (
      <>
        <p>
          This list is the app&rsquo;s own: it is generated from the same list the app uses to
          decide what it may store, so it cannot fall behind. A name ending in * stands for a
          changing ending.
        </p>
        {CATEGORY_ORDER.map((category) => (
          <div key={category}>
            <CookieTable category={category} />
          </div>
        ))}
      </>
    ),
  },
  {
    id: "browser",
    title: "4. Your browser and your device",
    body: (
      <p>
        You can also clear or block cookies and site data in your browser settings. If you block
        the necessary ones, Vallo cannot keep you signed in or remember your language, and some
        screens will not work. Clearing site data removes everything on this page, including your
        cookie choice, so you will be asked again.
      </p>
    ),
  },
  {
    id: "changes",
    title: "5. Changes to this page",
    body: (
      <p>
        If we add or change a kind of storage, this page changes in the same release, and we ask
        for your choice again if it matters. The date above is when this page last changed.
      </p>
    ),
  },
];
