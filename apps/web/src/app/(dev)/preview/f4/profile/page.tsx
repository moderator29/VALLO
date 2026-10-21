import { AccountHero } from "@/app/(app)/profile/AccountHero";
import { sheetWordsOf } from "@/components/social/sheet-words";
import { AccountBody } from "@/app/(app)/profile/AccountBody";
import { RoleSwitcher } from "@/components/roles/RoleSwitcher";
import { getDictionary } from "@vallo/i18n";
import { PERSON } from "../../_fixtures/people";
import { FEED_POSTS } from "../fixtures";

/**
 * The account page as its owner sees it, from fixtures, for the side-by-side
 * with `50E032EA`. The real hero and body, with the counts and identity a
 * claimed handle carries.
 */
export default function ProfilePreview() {
  const t = getDictionary("en");
  return (
    <main id="main" className="nf-shell pt-xl">
      <div className="mx-auto max-w-2xl">
        <AccountHero
          userId={PERSON.id}
          displayName={PERSON.name}
          email="seyi@example.com"
          avatarUrl={PERSON.avatarUrl}
          identity={{
            handle: PERSON.handle,
            coverUrl: "",
            followerCount: 12400,
            followingCount: 482,
            postCount: 36,
            isAgent: PERSON.verified,
            bio: PERSON.bio,
          }}
          metaLine={{ place: "", joined: "" }}
          locale="en"
        />
        <AccountBody
          sheet={sheetWordsOf(t)}
          counts={{ trips: 3, saved: 12, reviews: 2 }}
          copy={{
            bookings: t.nav.bookings,
            saved: t.nav.saved,
            agreements: t.nav.agreements,
            messages: t.nav.messages,
            settings: t.nav.settings,
            belongings: t.socialProfile.belongings,
            posts: t.socialProfile.posts,
            myBookings: t.socialProfile.myBookings,
            myBookingsSub: t.socialProfile.myBookingsRow,
            savedSub: t.socialProfile.savedRow,
            agreementsSub: t.socialProfile.agreementsSub,
          }}
          email="seyi@example.com"
          placeLabel="Eti-Osa, Lagos"
          occupationName="Product designer"
          details={{ firstName: "Seyi", surname: "Omojuni", nickname: "", phone: "" }}
          posts={FEED_POSTS}
          handle={PERSON.handle}
          hasBio
          locale="en"
          roleSwitch={
            <RoleSwitcher
              roles={[
                { id: "renter", setUp: true, verified: false },
                { id: "owner", setUp: false, verified: false },
                { id: "professional", setUp: true, verified: true },
              ]}
              current="renter"
              variant="row"
            />
          }
        />
      </div>
    </main>
  );
}
