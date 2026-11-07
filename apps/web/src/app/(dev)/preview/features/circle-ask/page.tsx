import "@/app/(app)/circle/circle.css";
import { PostFlow } from "@/app/(app)/circle/_parts/PostFlow";

/** The Ask flow with sample communities. Publishing in the harness goes to the real action, which refuses without a session. */
export const dynamic = "force-dynamic";

export default function PreviewCircleAsk() {
  return (
    <PostFlow
      mode="question"
      communities={[
        { id: "00000000-0000-4000-8000-000000000001", name: "Lekki renters" },
        { id: "00000000-0000-4000-8000-000000000002", name: "First-time renters in Lagos" },
      ]}
      closeHref="/preview/features"
    />
  );
}
