import { DocFeedbackView } from "@/app/admin/doc-feedback/DocFeedbackView";

/**
 * The "Pages that fail" desk in the state it is in today: the read function
 * is in a pending SQL file, so the desk says it is not switched on yet. No
 * answers are drawn here, because none exist to draw.
 */
export default function DocFeedbackPreview() {
  return (
    <main className="mx-auto max-w-4xl p-md">
      <DocFeedbackView read={{ state: "not-switched-on" }} days={30} />
    </main>
  );
}
