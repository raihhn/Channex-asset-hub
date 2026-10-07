import Link from "next/link";
import { Card, EmptyState as HeroEmptyState } from "@heroui/react";

export function EmptyState({
  title,
  detail,
  actionHref,
  actionLabel,
}: {
  title: string;
  detail: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <Card className="empty-state"><HeroEmptyState>
      <span aria-hidden="true">◌</span>
      <h2>{title}</h2>
      <p>{detail}</p>
      {actionHref && actionLabel ? (
        <Link className="text-link" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </HeroEmptyState></Card>
  );
}
