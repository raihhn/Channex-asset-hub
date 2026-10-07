import type {
  Asset,
  AssetCondition,
  AssetPhoto,
  MaintenanceRecord,
  MaintenanceStatus,
  PrototypeRequest,
  ReturnReceipt,
} from "@/types/prototype";
import { getVendor } from "@/lib/fixtures/vendors";

export const activeMaintenanceStatuses: MaintenanceStatus[] = [
  "Draft", "Vendor assigned", "In progress", "Work completed", "On hold",
];

export function isActiveMaintenance(record: MaintenanceRecord) {
  return activeMaintenanceStatuses.includes(record.status);
}

export function activeMaintenanceForAsset(records: MaintenanceRecord[], assetId: string) {
  return records.find((record) => record.assetId === assetId && isActiveMaintenance(record));
}

export type MaintenanceOrigin = {
  reason: string;
  issueId?: string;
  sourceRequestId?: string;
  sourceRequestItemId?: string;
};

export function createMaintenanceRecord(
  records: MaintenanceRecord[],
  asset: Asset,
  origin: MaintenanceOrigin,
  actor: string,
  at: string,
  sourceRequest?: PrototypeRequest,
  sourceReceipt?: ReturnReceipt,
): MaintenanceRecord {
  if (asset.trackingType === "Quantity-based")
    throw new Error("Maintenance requires one individually tracked physical Asset.");
  if (activeMaintenanceForAsset(records, asset.id) ||
    (asset.maintenance && asset.maintenance.status !== "Completed" && !records.some((record) => record.assetId === asset.id)))
    throw new Error("This Asset already has active maintenance.");
  if (!origin.reason.trim() && !origin.issueId)
    throw new Error("Enter a reason or link an existing Issue.");
  if (origin.issueId && !asset.issues.some((issue) => issue.id === origin.issueId))
    throw new Error("The linked Issue does not belong to this Asset.");
  if (Boolean(origin.sourceRequestId) !== Boolean(origin.sourceRequestItemId))
    throw new Error("Request and RequestItem context must be supplied together.");
  if (origin.sourceRequestItemId) {
    if (!sourceRequest || sourceRequest.id !== origin.sourceRequestId ||
      !sourceRequest.items.some((item) => item.id === origin.sourceRequestItemId && item.assetId === asset.id) ||
      sourceReceipt?.requestId !== origin.sourceRequestId ||
      sourceReceipt?.assetId !== asset.id ||
      sourceReceipt?.requestItemId !== origin.sourceRequestItemId || !sourceReceipt.receivedAt)
      throw new Error("A returned RequestItem needs confirmed receipt before maintenance handoff.");
  }
  if (!actor.trim()) throw new Error("Maintenance creator is required.");
  return {
    id: `MNT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    assetId: asset.id,
    reason: origin.reason.trim() || asset.issues.find((issue) => issue.id === origin.issueId)!.type,
    status: "Draft",
    sourceRequestId: origin.sourceRequestId,
    sourceRequestItemId: origin.sourceRequestItemId,
    issueId: origin.issueId,
    beforePhotoIds: [],
    afterPhotoIds: [],
    conditionBefore: asset.condition,
    availabilityBefore: asset.availability,
    createdAt: at,
    createdBy: actor.trim(),
    updatedAt: at,
    activity: [{ at, title: "Maintenance created", detail: actor.trim() }],
  };
}

function recordActivity(record: MaintenanceRecord, at: string, title: string, detail: string): MaintenanceRecord {
  return { ...record, updatedAt: at, activity: [{ at, title, detail }, ...record.activity] };
}

export function addMaintenancePhoto(record: MaintenanceRecord, photo: AssetPhoto, at: string) {
  if (!isActiveMaintenance(record) || record.status === "Work completed")
    throw new Error("This maintenance stage cannot accept more evidence.");
  if (photo.maintenanceId !== record.id || !photo.dataUrl?.startsWith("data:image/") || !photo.mimeType?.startsWith("image/"))
    throw new Error("A valid image linked to this Maintenance record is required.");
  if (photo.maintenancePurpose === "Before") {
    if (record.status === "In progress" || record.status === "On hold")
      throw new Error("Before Photo must be added before work starts.");
    return recordActivity({ ...record, beforePhotoIds: [...record.beforePhotoIds, photo.id] }, at, "Before Photo added", photo.caption);
  }
  if (photo.maintenancePurpose === "After") {
    if (record.status !== "In progress") throw new Error("After Photo belongs to work in progress.");
    return recordActivity({ ...record, afterPhotoIds: [...record.afterPhotoIds, photo.id] }, at, "After Photo added", photo.caption);
  }
  throw new Error("Choose Before or After maintenance evidence.");
}

export function assignMaintenanceVendor(record: MaintenanceRecord, vendorId: string, actor: string, at: string) {
  if (!getVendor(vendorId)) throw new Error("Choose a registered Vendor.");
  if (record.status !== "Draft" && record.status !== "Vendor assigned")
    throw new Error("Vendor assignment is only available before work starts.");
  return recordActivity({ ...record, status: "Vendor assigned" as const, vendorId, assignedBy: actor, assignedAt: at }, at, "Vendor assigned", getVendor(vendorId)!.name);
}

export function startMaintenanceWork(record: MaintenanceRecord, photos: AssetPhoto[], at: string) {
  if (record.status !== "Vendor assigned") throw new Error("Assign a Vendor before starting work.");
  if (!record.vendorId || !getVendor(record.vendorId)) throw new Error("A registered Vendor is required.");
  if (!record.beforePhotoIds.some((id) => photos.some((photo) => photo.id === id && photo.maintenanceId === record.id && photo.maintenancePurpose === "Before" && photo.dataUrl)))
    throw new Error("Add a Before Photo before starting work.");
  return recordActivity({ ...record, status: "In progress" as const, workStartedAt: at }, at, "Work started", getVendor(record.vendorId)!.name);
}

export function completeVendorWork(record: MaintenanceRecord, photos: AssetPhoto[], actor: string, at: string) {
  if (record.status !== "In progress") throw new Error("Work must be In progress first.");
  if (!record.afterPhotoIds.some((id) => photos.some((photo) => photo.id === id && photo.maintenanceId === record.id && photo.maintenancePurpose === "After" && photo.dataUrl)))
    throw new Error("Add an After Photo before marking work completed.");
  if (!actor.trim()) throw new Error("Record who reported Vendor work completion.");
  return recordActivity({ ...record, status: "Work completed" as const, workCompletedAt: at, workCompletedBy: actor.trim() }, at, "Vendor work completed", actor.trim());
}

export function holdMaintenance(record: MaintenanceRecord, reason: string, at: string) {
  if (record.status !== "Work completed") throw new Error("Only completed Vendor work can be sent back.");
  if (!reason.trim()) throw new Error("Explain why the result was not accepted.");
  return recordActivity({ ...record, status: "On hold" as const, notes: reason.trim() }, at, "Maintenance sent back", reason.trim());
}

export function resumeMaintenance(record: MaintenanceRecord, at: string) {
  if (record.status !== "On hold") throw new Error("Only held work can resume.");
  return recordActivity({ ...record, status: "In progress" as const, afterPhotoIds: [] }, at, "Rework started", "New After Photo required before completion.");
}

export function cancelMaintenance(record: MaintenanceRecord, reason: string, at: string) {
  if (!isActiveMaintenance(record)) throw new Error("Only active maintenance can be cancelled.");
  if (!reason.trim()) throw new Error("Record why maintenance was cancelled.");
  return recordActivity({ ...record, status: "Cancelled" as const, notes: reason.trim() }, at, "Maintenance cancelled", reason.trim());
}

export type MaintenanceAcceptance = {
  conditionAfter: AssetCondition;
  resolveLinkedIssue: boolean;
  clearInspection: boolean;
};

export function acceptMaintenance(record: MaintenanceRecord, asset: Asset, input: MaintenanceAcceptance, actor: string, at: string) {
  if (record.status !== "Work completed") throw new Error("Vendor work must be completed before internal acceptance.");
  if (!actor.trim() || !input.conditionAfter) throw new Error("Internal acceptance and condition after are required.");
  const accepted = recordActivity({ ...record, status: "Accepted" as const, acceptedAt: at, acceptedBy: actor.trim(), conditionAfter: input.conditionAfter }, at, "Maintenance accepted", actor.trim());
  const issues = asset.issues.map((issue) =>
    input.resolveLinkedIssue && issue.id === record.issueId
      ? { ...issue, status: "Resolved" as const }
      : issue,
  );
  const inspectionState = input.clearInspection ? "Clear" as const : asset.inspectionState;
  const stillBlocked = input.conditionAfter === "Needs review" ||
    issues.some((issue) => issue.blocksUsage && issue.status !== "Resolved") ||
    (inspectionState && inspectionState !== "Clear") ||
    (record.availabilityBefore === "in-use" || record.availabilityBefore === "reserved");
  const updatedAsset: Asset = {
    ...asset,
    condition: input.conditionAfter,
    issues,
    inspectionState,
    maintenance: { reason: record.reason, type: "Corrective", status: "Completed" },
    availability: stillBlocked ? "unavailable" : "available",
    history: [{ date: at, title: "Maintenance accepted", detail: `${getVendor(record.vendorId)?.name ?? "Vendor"} · ${record.conditionBefore} → ${input.conditionAfter}`, kind: "Maintenance" }, ...asset.history],
  };
  return { record: accepted, asset: updatedAsset };
}

/** This projection is the only place new Maintenance status changes Asset readiness. */
export function applyActiveMaintenanceToAsset(asset: Asset, record: MaintenanceRecord): Asset {
  return {
    ...asset,
    availability: "maintenance",
    maintenance: {
      reason: record.reason,
      type: "Corrective",
      status: record.status === "Draft" || record.status === "Vendor assigned" ? "Open" : "In progress",
    },
    history: [{ date: record.updatedAt, title: record.activity[0].title, detail: record.activity[0].detail, kind: "Maintenance" }, ...asset.history],
  };
}

export function applyCancelledMaintenanceToAsset(asset: Asset, record: MaintenanceRecord): Asset {
  return {
    ...asset,
    maintenance: { reason: record.reason, type: "Corrective", status: "Completed" },
    availability: "unavailable",
    history: [{ date: record.updatedAt, title: "Maintenance cancelled", detail: record.notes ?? "Requires reassessment", kind: "Maintenance" }, ...asset.history],
  };
}
