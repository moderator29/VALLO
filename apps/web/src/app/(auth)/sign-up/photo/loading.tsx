import { AuthScreenSkeleton } from "@/components/auth/AuthScreenSkeleton";

/** The wait before the photo step: the auth layout's bowl and ring stay painted around it. */
export default function LoadingSignUpPhoto() {
  return <AuthScreenSkeleton fields={[]} links={0} />;
}
