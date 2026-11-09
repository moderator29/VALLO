import "@/app/(app)/circle/circle.css";
import { CreateCommunityFlow } from "@/app/(app)/circle/_parts/CreateCommunityFlow";

/** Create a community, prefilled as a starter suggestion opens it. */
export const dynamic = "force-dynamic";

export default function PreviewCircleNew() {
  return <CreateCommunityFlow prefill={{ name: "Lekki renters", category: "renting" }} />;
}
