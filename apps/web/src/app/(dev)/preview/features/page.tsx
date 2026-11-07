import Link from "next/link";

/* The FEATURES deck index (route-files guard: every deck has one). */
const PAGES = ["reminders", "reminders?live=0"];

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
