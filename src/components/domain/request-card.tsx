import Link from "next/link";

import { AssetArtwork } from "@/components/domain/asset-artwork";
import { RequestStatus } from "@/components/domain/request-status";
import type { Asset, PrototypeRequest } from "@/types/prototype";

export function RequestCard({
  asset,
  request,
}: {
  asset?: Asset;
  request: PrototypeRequest;
}) {
  return (
    <article className="request-card">
      <Link
        aria-label={`View request ${request.id}`}
        className="request-card__link"
        href={`/requests/${request.id}`}
      >
        {asset ? <AssetArtwork asset={asset} variant="tile" /> : <div className="flex aspect-square items-center justify-center rounded-lg bg-accent p-4 text-center text-sm font-semibold">Custom Booth</div>}
        <div className="request-card__content">
          <div className="request-card__topline">
            <span>{request.id}</span>
            <RequestStatus status={request.status} />
          </div>
          <h3>
            {asset?.name ?? request.projectName ?? "Custom Booth requirement"}
            {request.items.length > 1
              ? ` + ${request.items.length - 1} more`
              : ""}
          </h3>
          <p>
            {request.startDate} — {request.endDate}
          </p>
          <p className="request-card__context">{request.destination}</p>
          {request.status === "Pending approval" ? <p className="text-sm">{request.reviewHistory?.some((entry) => entry.cycle === (request.reviewRound ?? 1) && (entry.action === "Assigned" || entry.action === "Reassigned")) ? "Awaiting reviewer decision" : "Reviewer assignment required"}</p> : request.status === "Needs update" ? <p className="text-sm font-semibold">Revision required · open Request to edit</p> : null}
        </div>
      </Link>
    </article>
  );
}
