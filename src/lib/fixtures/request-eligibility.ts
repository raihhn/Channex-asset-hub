import type { Asset } from "@/types/prototype";
import {
  getReservationConflicts,
  type OperationalWindow,
  type Reservation,
} from "@/lib/domain/reservations";

export type RequestEligibility = {
  eligible: boolean;
  availableQuantity: number;
  summary: string;
  warnings: string[];
};

/** Step 1 intentionally knows only whether an asset is operationally usable.
 * Booking windows are evaluated later, once the requester has supplied dates. */
export function isOperationallySelectable(asset: Asset) {
  return !(
    asset.availability === "unavailable" ||
    (asset.maintenance && asset.maintenance.status !== "Completed") ||
    asset.inspectionState === "On hold" ||
    asset.inspectionState === "Inspection pending" ||
    asset.issues.some(
      (issue) => issue.blocksUsage && issue.status !== "Resolved",
    )
  );
}

export function getRequestEligibility(
  asset: Asset,
  start: string,
  end: string,
  quantity: number,
  reservations: Reservation[] = [],
  operationalWindow: OperationalWindow = {
    outboundAt: `${start}T00:00`,
    inboundAt: `${end}T23:59`,
  },
): RequestEligibility {
  const warnings: string[] = [];
  const blockingIssue = asset.issues.find(
    (issue) => issue.blocksUsage && issue.status !== "Resolved",
  );
  const blocked = asset.blockedRanges?.find(
    (range) => start <= range.end && end >= range.start,
  );
  const reservationConflicts = getReservationConflicts(
    asset,
    operationalWindow,
    reservations,
  );
  const availableQuantity = asset.supportsQuantity
    ? (asset.availableQuantity ?? 0)
    : 1;
  if (reservationConflicts.length) {
    const conflict = reservationConflicts[0];
    warnings.push(
      conflict.requestStatus === "Completed" && !conflict.actualInboundAt
        ? `Receipt evidence unavailable for completed request ${conflict.requestId}; physical return is not confirmed`
        : `Reserved for ${conflict.activityName} · ${conflict.outboundAt.replace("T", " ")} to ${conflict.inboundAt.replace("T", " ")} · ${conflict.requestId}`,
    );
  }
  if (asset.maintenance && asset.maintenance.status !== "Completed")
    warnings.push(`Maintenance: ${asset.maintenance?.reason}`);
  if (asset.inspectionState && asset.inspectionState !== "Clear")
    warnings.push(asset.inspectionState);
  if (blockingIssue)
    warnings.push(
      `Blocking issue: ${blockingIssue.type} at ${blockingIssue.area}`,
    );
  if (asset.lifecycleNote) warnings.push(asset.lifecycleNote);
  if (
    ["Front", "Left side", "Right side"].some(
      (view) => !asset.photos.some((photo) => photo.view === view),
    )
  )
    warnings.push("Required documentation is incomplete");
  if (blocked) warnings.push(`Schedule conflict: ${blocked.label}`);
  if (quantity > availableQuantity)
    warnings.push(`Only ${availableQuantity} of ${quantity} available`);
  const hardBlock = Boolean(
    blockingIssue ||
    (asset.maintenance && asset.maintenance.status !== "Completed") ||
    asset.inspectionState === "On hold" ||
    asset.inspectionState === "Inspection pending" ||
    blocked ||
    reservationConflicts.length > 0 ||
    quantity > availableQuantity ||
    asset.availability === "unavailable",
  );
  return {
    eligible: !hardBlock,
    availableQuantity,
    summary: hardBlock ? "Not ready to book" : "Ready for selected dates",
    warnings,
  };
}
