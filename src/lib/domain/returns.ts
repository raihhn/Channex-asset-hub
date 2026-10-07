import type {
  Asset,
  AssetCondition,
  PrototypeRequest,
  ReturnReceipt,
} from "@/types/prototype";
import type { RegisteredLocation } from "@/lib/fixtures/registered-locations";

export function findReturnReceipt(
  receipts: ReturnReceipt[],
  requestItemId: string,
) {
  return receipts.find((receipt) => receipt.requestItemId === requestItemId);
}

/** Legacy records are accepted only when exactly one item matches the old keys. */
export function normalizeLegacyReturnReceipts(
  records: Array<
    Omit<ReturnReceipt, "requestItemId"> & { requestItemId?: string }
  >,
  requests: PrototypeRequest[],
) {
  const receipts: ReturnReceipt[] = [];
  const unresolved: typeof records = [];
  for (const record of records) {
    const request = requests.find((item) => item.id === record.requestId);
    const matches =
      request?.items.filter((item) =>
        record.requestItemId
          ? item.id === record.requestItemId && item.assetId === record.assetId
          : item.assetId === record.assetId,
      ) ?? [];
    if (
      matches.length !== 1 ||
      receipts.some((item) => item.requestItemId === matches[0].id)
    ) {
      unresolved.push(record);
      continue;
    }
    receipts.push({ ...record, requestItemId: matches[0].id });
  }
  return { receipts, unresolved };
}

function assertPhysicalItem(request: PrototypeRequest, requestItemId: string) {
  const item = request.items.find(
    (candidate) => candidate.id === requestItemId,
  );
  if (!item) throw new Error("This RequestItem is not in the request.");
  return item;
}

/** Initiation is a holder action, never physical receipt evidence. */
export function initiateReturn(
  receipts: ReturnReceipt[],
  request: PrototypeRequest,
  requestItemId: string,
  initiatedBy: string,
  initiatedAt: string,
) {
  const item = assertPhysicalItem(request, requestItemId);
  if (!initiatedBy.trim()) throw new Error("Return initiator is required.");
  if (findReturnReceipt(receipts, requestItemId)) {
    throw new Error("Return has already been initiated for this item.");
  }
  return [
    ...receipts,
    {
      id: `return:${requestItemId}`,
      requestId: request.id,
      requestItemId,
      assetId: item.assetId,
      initiatedAt,
      initiatedBy: initiatedBy.trim(),
    },
  ];
}

export type ConfirmReceiptInput = {
  receivedBy: string;
  receivingLocationId: string;
  conditionAtReceipt: AssetCondition;
  notes?: string;
};

/** Only this explicit receiver action may create the canonical actual inbound. */
export function confirmReturnReceived(
  receipts: ReturnReceipt[],
  request: PrototypeRequest,
  requestItemId: string,
  input: ConfirmReceiptInput,
  receivedAt: string,
) {
  assertPhysicalItem(request, requestItemId);
  const prior = findReturnReceipt(receipts, requestItemId);
  if (!prior) throw new Error("Start Return before confirming receipt.");
  if (prior.receivedAt) throw new Error("This item was already received.");
  if (!input.receivedBy.trim() || !input.receivingLocationId) {
    throw new Error("Receiving PIC and location are required.");
  }
  if (Date.parse(receivedAt) < Date.parse(prior.initiatedAt)) {
    throw new Error("Receipt cannot precede return initiation.");
  }
  return receipts.map((receipt) =>
    receipt.id === prior.id
      ? {
          ...receipt,
          receivedAt,
          receivedBy: input.receivedBy.trim(),
          receivingLocationId: input.receivingLocationId,
          conditionAtReceipt: input.conditionAtReceipt,
          notes: input.notes?.trim() || undefined,
        }
      : receipt,
  );
}

export function completeReturnInspection(
  receipts: ReturnReceipt[],
  request: PrototypeRequest,
  requestItemId: string,
  outcome: "Clear" | "On hold",
  inspectedAt: string,
) {
  assertPhysicalItem(request, requestItemId);
  const prior = findReturnReceipt(receipts, requestItemId);
  if (!prior?.receivedAt)
    throw new Error("Receipt is required before inspection.");
  if (prior.inspectedAt) throw new Error("Inspection is already recorded.");
  return receipts.map((receipt) =>
    receipt.id === prior.id
      ? { ...receipt, inspectedAt, inspectionOutcome: outcome }
      : receipt,
  );
}

export function getReturnProgress(
  receipt: ReturnReceipt | undefined,
  plannedInboundAt: string,
  now: string,
) {
  if (receipt?.receivedAt) {
    return receipt.inspectionOutcome === "Clear"
      ? "Received · inspection clear"
      : receipt.inspectionOutcome === "On hold"
        ? "Received · on hold"
        : "Received · inspection pending";
  }
  if (receipt)
    return now > plannedInboundAt
      ? "Return in progress · overdue"
      : "Return in progress";
  if (now > plannedInboundAt) return "Overdue";
  return now.slice(0, 10) === plannedInboundAt.slice(0, 10)
    ? "Return due"
    : "Upcoming";
}

export function applyReceiptToAsset(
  asset: Asset,
  receipt: ReturnReceipt,
  location: RegisteredLocation,
): Asset {
  if (
    !receipt.receivedAt ||
    !receipt.receivedBy ||
    !receipt.conditionAtReceipt
  ) {
    throw new Error("Authoritative receipt details are required.");
  }
  return {
    ...asset,
    location: location.name,
    locationType: location.type,
    currentCustodian: receipt.receivedBy,
    condition: receipt.conditionAtReceipt,
    availability: "unavailable",
    inspectionState: "Inspection pending",
    history: [
      {
        date: receipt.receivedAt,
        title: "Physical return received",
        detail: `${location.name} · ${receipt.receivedBy} · ${receipt.conditionAtReceipt}`,
        kind: "Movement",
      },
      ...asset.history,
    ],
  };
}

export function applyInspectionToAsset(
  asset: Asset,
  outcome: "Clear" | "On hold",
  inspectedAt: string,
): Asset {
  const operationalBlock =
    outcome === "On hold" ||
    (asset.maintenance && asset.maintenance.status !== "Completed") ||
    asset.issues.some(
      (issue) => issue.blocksUsage && issue.status !== "Resolved",
    );
  return {
    ...asset,
    inspectionState: outcome,
    availability: operationalBlock ? "unavailable" : "available",
    history: [
      {
        date: inspectedAt,
        title: "Return inspection completed",
        detail: outcome,
        kind: "Condition",
      },
      ...asset.history,
    ],
  };
}
