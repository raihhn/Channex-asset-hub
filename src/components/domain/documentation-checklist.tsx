import { AppIcon } from "@/components/ui/app-icon";
import Link from "next/link";
import type { Asset } from "@/types/prototype";

const required = ["Front", "Left side", "Right side"] as const;
export function DocumentationChecklist({ asset }: { asset: Asset }) {
  return (
    <section className="documentation-checklist">
      <div>
        <p>Asset photos</p>
        <h2>Documentation</h2>
        <span>
          Required views show the full, unobstructed structure in adequate
          light.
        </span>
      </div>
      <ul>
        {required.map((view) => {
          const photo = asset.photos.find((item) => item.view === view);
          return (
            <li key={view} className={photo ? "is-complete" : "is-missing"}>
              {photo ? "✓" : "○"}
              <span>{view}</span>
              <small>{photo ? "Documented" : "Missing"}</small>
            </li>
          );
        })}
      </ul>
      <p className="documentation-guidance">
        <AppIcon name="camera" /> Capture full views; add clear close-ups for
        any damage. Avoid unnecessary people in frame.
      </p>
      <Link
        className="documentation-checklist__action"
        href={`/assets/${asset.id}/photos`}
      >
        Maintain documentation
      </Link>
    </section>
  );
}
