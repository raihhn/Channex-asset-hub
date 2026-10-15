import type { Asset, AssetCondition } from "@/types/prototype";
import type { TransferPlan, Person } from "@/types/identity";
import { getRegisteredLocation } from "@/lib/fixtures/registered-locations";

function internalLocation(type: Asset["locationType"]) {
  return [
    "Internal warehouse",
    "Vendor warehouse",
    "Vendor storage",
    "Vendor workshop",
  ].includes(type);
}
export function dispatchTransfer(
  plan: TransferPlan,
  asset: Asset,
  actor: Person,
  senderPic: string,
  at: string,
): TransferPlan {
  const destination =
    plan.destinationSnapshot ?? getRegisteredLocation(plan.destinationId);
  if (actor.status !== "ACTIVE")
    throw new Error("An active recording user is required.");
  if (plan.dispatchedAt || plan.receivedAt)
    throw new Error("This transfer has already been dispatched.");
  if (!senderPic.trim()) throw new Error("Enter the actual sending PIC.");
  if (asset.id !== plan.assetId || !destination)
    throw new Error("Asset or governed destination is unavailable.");
  if (
    !internalLocation(asset.locationType) ||
    !internalLocation(destination.type)
  )
    throw new Error(
      "Transfers are between warehouses and workshops; event returns belong to their booking.",
    );
  if (asset.location !== plan.sourceLocation)
    throw new Error(
      "The asset has moved since this plan. Create a new plan with its current source.",
    );
  if (asset.location === destination.name)
    throw new Error(
      "Choose a destination different from the current location.",
    );
  if (
    !["available", "reserved"].includes(asset.availability) ||
    asset.inspectionState === "On hold" ||
    asset.inspectionState === "Inspection pending" ||
    (asset.maintenance && asset.maintenance.status !== "Completed") ||
    asset.issues.some(
      (issue) => issue.blocksUsage && issue.status !== "Resolved",
    )
  )
    throw new Error(
      "This asset is in use, in transit or awaiting operational clearance.",
    );
  return {
    ...plan,
    dispatchedAt: at,
    dispatchedByUserId: actor.id,
    senderPic: senderPic.trim(),
    availabilityBefore: asset.availability,
  };
}
export function receiveTransfer(
  plan: TransferPlan,
  actor: Person,
  receiverPic: string,
  condition: AssetCondition,
  at: string,
): TransferPlan {
  if (actor.status !== "ACTIVE")
    throw new Error("An active recording user is required.");
  if (!plan.dispatchedAt || plan.receivedAt)
    throw new Error(
      "Confirm dispatch first; a received transfer cannot be received twice.",
    );
  if (
    !receiverPic.trim() ||
    !["Good", "Fair", "Needs review"].includes(condition)
  )
    throw new Error("Receiving PIC and observed condition are required.");
  if (Date.parse(at) < Date.parse(plan.dispatchedAt))
    throw new Error("Receipt cannot precede dispatch.");
  return {
    ...plan,
    receivedAt: at,
    receivedByUserId: actor.id,
    receiverPic: receiverPic.trim(),
    conditionAtReceipt: condition,
  };
}
export function applyTransferReceipt(asset: Asset, plan: TransferPlan): Asset {
  const destination =
    plan.destinationSnapshot ?? getRegisteredLocation(plan.destinationId);
  if (
    !destination ||
    !plan.receivedAt ||
    !plan.receiverPic ||
    !plan.conditionAtReceipt ||
    asset.id !== plan.assetId
  )
    throw new Error("Recorded transfer receipt is required.");
  const needsHold =
    plan.conditionAtReceipt === "Needs review" ||
    asset.inspectionState === "On hold" ||
    asset.inspectionState === "Inspection pending" ||
    Boolean(asset.maintenance && asset.maintenance.status !== "Completed") ||
    asset.issues.some(
      (issue) => issue.blocksUsage && issue.status !== "Resolved",
    );
  return {
    ...asset,
    location: destination.name,
    locationType: destination.type,
    currentCustodian: plan.receiverPic,
    condition: plan.conditionAtReceipt,
    availability: needsHold
      ? "unavailable"
      : (plan.availabilityBefore ?? "unavailable"),
    inspectionState:
      plan.conditionAtReceipt === "Needs review"
        ? "On hold"
        : asset.inspectionState,
    history: [
      {
        date: plan.receivedAt,
        title: "Transfer received",
        detail: `${plan.sourceLocation} → ${destination.name} · ${plan.receiverPic}`,
        kind: "Movement",
      },
      ...asset.history,
    ],
  };
}
