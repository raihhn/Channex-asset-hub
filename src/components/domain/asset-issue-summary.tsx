import Link from "next/link";
import { AppIcon } from "@/components/ui/app-icon";
import type { Asset } from "@/types/prototype";

export function AssetIssueSummary({ asset }: { asset: Asset }) {
  if (!asset.issues.length)
    return (
      <section className="issue-summary issue-summary--clear">
        <AppIcon name="condition" />
        <div>
          <strong>No reported issues</strong>
          <span>Condition records are clear in this prototype.</span>
        </div>
      </section>
    );
  const issue = asset.issues[0];
  return (
    <section className="issue-summary">
      <AppIcon name="issue" />
      <div>
        <p>
          {asset.issues.length} reported issue
          {asset.issues.length > 1 ? "s" : ""}
        </p>
        <strong>
          {issue.type} · {issue.area}
        </strong>
        <span>
          {issue.severity} severity · {issue.status}
        </span>
      </div>
      <Link href={`/assets/${asset.id}/issue`}>View</Link>
    </section>
  );
}
