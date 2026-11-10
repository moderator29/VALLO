import { UiIcon } from "@/design-system/icons/UiIcon";
import "./docs-kit.css";

/** The tinted "at a glance" panel: three or four bullets for the reader who will not read it all. */
export function DocSummary({ title = "At a glance", points }: { title?: string; points: readonly string[] }) {
  return (
    <section className="nf-dk-summary" aria-label={title}>
      <h2 className="nf-dk-summary__title">{title}</h2>
      <ul>
        {points.map((point) => (
          <li key={point}>
            <UiIcon name="circle-check" size={16} />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
