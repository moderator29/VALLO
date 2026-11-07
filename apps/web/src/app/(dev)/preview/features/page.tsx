import Link from "next/link";

/* The FEATURES deck index (route-files guard: every deck has one). */
const PAGES = [
  "reminders",
  "reminders?live=0",
  "circle",
  "circle?first=1",
  "circle-ask",
  "circle-new",
  "circle-community",
  "circle-community?as=visitor",
  "circle-community?as=private",
  "circle-community?as=owner&empty=1",
  "circle-thread",
  "circle-thread?kind=discussion",
  "circle-thread?kind=empty",
  "circle-thread?kind=visitor",
  "circle-manage",
  "circle-manage?empty=1",
  "circle-discussion",
];

export default function PreviewFeaturesIndex() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="nf-h2">Preview: Features</h1>
      <ul className="mt-md flex flex-col gap-xs">
        {PAGES.map((p) => (
          <li key={p}>
            <Link className="nf-link" href={`/preview/features/${p}`}>
              {p}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
