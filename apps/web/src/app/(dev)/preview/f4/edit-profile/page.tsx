import { PageHeader } from "@/components/app/PageHeader";
import { ProfileEditor } from "@/components/social/profile/ProfileEditor";
import { ProfilePhotos } from "@/components/social/profile/ProfilePhotos";
import { AREA_OPTIONS, EDITOR_PROFILE } from "../fixtures";

/**
 * Editing a profile, from fixtures: the photos block that writes on its own
 * above the one form that writes on Save, exactly as `/u/[handle]/edit`
 * composes them in its `editing` state.
 */
export default function EditProfilePreview() {
  return (
    <main id="main" className="nf-shell mx-auto max-w-2xl pb-4xl pt-md">
      <PageHeader
        title="Edit your profile"
        subtitle={`@${EDITOR_PROFILE.handle}`}
        fallback={`/u/${EDITOR_PROFILE.handle}`}
      />
      <div className="mb-sm">
        <ProfilePhotos
          userId={EDITOR_PROFILE.userId}
          handle={EDITOR_PROFILE.handle}
          coverUrl={EDITOR_PROFILE.coverUrl}
          avatarUrl={EDITOR_PROFILE.avatarUrl}
          displayName={EDITOR_PROFILE.displayLabel}
        />
      </div>
      <ProfileEditor
        profile={EDITOR_PROFILE}
        initialHandle={EDITOR_PROFILE.handle}
        areas={AREA_OPTIONS}
      />
    </main>
  );
}
