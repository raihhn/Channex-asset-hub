import type {
  Asset,
  AssetCondition,
  OutboundDispatch,
  PrototypeRequest,
  RequestDocument,
  ReturnReceipt,
} from "@/types/prototype";
import type { Person } from "@/types/identity";

export function outboundGroups(request: PrototypeRequest) {
  return request.fulfillmentGroups?.length
    ? request.fulfillmentGroups
    : [
        {
          id: "outbound-default",
          destination: request.destination,
          destinationType: request.destinationType,
          destinationLocationId: request.destinationLocationId,
          itemIds: request.items.map((item) => item.id),
        },
      ];
}

function assertActor(actor: Person) {
  if (actor.status !== "ACTIVE")
    throw new Error("An active account must record this handover.");
}

function assertItems(itemIds: string[]) {
  if (!itemIds.length || new Set(itemIds).size !== itemIds.length)
    throw new Error("Select distinct request items for this handover.");
}

export function dispatchOutbound(
  records: OutboundDispatch[],
  request: PrototypeRequest,
  assets: Asset[],
  returns: ReturnReceipt[],
  actor: Person,
  input: {
    id: string;
    groupId: string;
    itemIds: string[];
    senderPic: string;
    loadingInLetters: RequestDocument[];
    at: string;
  },
): OutboundDispatch {
  assertActor(actor);
  assertItems(input.itemIds);
  if (!input.id.trim() || records.some((record) => record.id === input.id))
    throw new Error("Use a unique outbound dispatch ID.");
  if (!["Approved", "Ready", "In use"].includes(request.status))
    throw new Error("Only an approved request can dispatch assets.");
  if (
    request.status === "In use" &&
    !records.some((record) => record.requestId === request.id)
  )
    throw new Error(
      "Historical in-use requests cannot create retrospective dispatch evidence.",
    );
  if (!input.senderPic.trim()) throw new Error("Enter the actual sending PIC.");
  if (!Number.isFinite(Date.parse(input.at)))
    throw new Error("Invalid dispatch timestamp.");
  const group = outboundGroups(request).find(
    (group) => group.id === input.groupId,
  );
  if (!group?.destination.trim())
    throw new Error("Choose an approved fulfillment destination.");
  if (
    !input.loadingInLetters.length ||
    input.loadingInLetters.length > 5 ||
    input.loadingInLetters.some(
      (file) =>
        file.category !== "Loading-in letter" ||
        !file.dataUrl ||
        !file.name.trim() ||
        file.size <= 0 ||
        file.size > 5 * 1024 * 1024 ||
        !(
          file.mimeType === "application/pdf" ||
          file.mimeType.startsWith("image/")
        ),
    )
  )
    throw new Error(
      "Attach a loading-in letter: PDF or image, up to 5 files of 5 MB each.",
    );
  const items = input.itemIds.map((id) => {
    const item = request.items.find((item) => item.id === id);
    if (!item || !group.itemIds.includes(id))
      throw new Error("Item does not belong to this fulfillment group.");
    const asset = assets.find((asset) => asset.id === item.assetId);
    if (!asset) throw new Error("Asset not found.");
    if (
      records.some((record) =>
        record.items.some((entry) => entry.requestItemId === id),
      ) ||
      returns.some((receipt) => receipt.requestItemId === id)
    )
      throw new Error(
        "This request item already has physical movement evidence.",
      );
    if (
      !["available", "reserved"].includes(asset.availability) ||
      asset.inspectionState === "Inspection pending" ||
      asset.inspectionState === "On hold" ||
      (asset.maintenance && asset.maintenance.status !== "Completed") ||
      asset.issues.some(
        (issue) => issue.blocksUsage && issue.status !== "Resolved",
      )
    )
      throw new Error(`${asset.name} is not physically ready to dispatch.`);
    if (
      records.some((record) =>
        record.items.some(
          (entry) =>
            entry.assetId === asset.id &&
            !returns.some(
              (receipt) =>
                receipt.requestItemId === entry.requestItemId &&
                receipt.receivedAt,
            ),
        ),
      )
    )
      throw new Error(`${asset.name} has an outstanding outbound movement.`);
    return {
      requestItemId: item.id,
      assetId: item.assetId,
      quantity: item.quantity,
      sourceLocation: asset.location,
      sourceCustodian: asset.currentCustodian,
    };
  });
  if (new Set(items.map((item) => item.assetId)).size !== items.length)
    throw new Error("An asset cannot occur twice in a dispatch.");
  return {
    id: input.id,
    requestId: request.id,
    groupId: group.id,
    destination: group.destination,
    destinationType:
      group.destinationType === "Other"
        ? "Other"
        : (group.destinationType ?? "Other"),
    destinationLocationId: group.destinationLocationId,
    dispatchedAt: input.at,
    dispatchedByUserId: actor.id,
    senderPic: input.senderPic.trim(),
    loadingInLetters: input.loadingInLetters.map((file) => ({ ...file })),
    items,
  };
}

export function receiveOutbound(
  record: OutboundDispatch,
  actor: Person,
  input: {
    itemIds: string[];
    receiverPic: string;
    condition: AssetCondition;
    at: string;
  },
): OutboundDispatch {
  assertActor(actor);
  assertItems(input.itemIds);
  if (!input.receiverPic.trim())
    throw new Error("Enter the actual receiving PIC.");
  if (!["Good", "Fair", "Needs review"].includes(input.condition))
    throw new Error("Choose the observed receipt condition.");
  if (
    !Number.isFinite(Date.parse(input.at)) ||
    Date.parse(input.at) < Date.parse(record.dispatchedAt)
  )
    throw new Error("Receipt must be at or after dispatch.");
  for (const id of input.itemIds) {
    const item = record.items.find((item) => item.requestItemId === id);
    if (!item || item.receivedAt)
      throw new Error("Select dispatched items that have not been received.");
  }
  return {
    ...record,
    items: record.items.map((item) =>
      input.itemIds.includes(item.requestItemId)
        ? {
            ...item,
            receivedAt: input.at,
            receivedByUserId: actor.id,
            receiverPic: input.receiverPic.trim(),
            conditionAtReceipt: input.condition,
          }
        : item,
    ),
  };
}

export function applyOutboundReceipt(
  asset: Asset,
  record: OutboundDispatch,
  requestItemId: string,
): Asset {
  const item = record.items.find(
    (item) => item.requestItemId === requestItemId,
  );
  if (
    !item?.receivedAt ||
    !item.receiverPic ||
    !item.conditionAtReceipt ||
    item.assetId !== asset.id
  )
    throw new Error("Confirmed outbound receipt is required.");
  return {
    ...asset,
    location: record.destination,
    locationType: record.destinationType,
    currentCustodian: item.receiverPic,
    condition: item.conditionAtReceipt,
    availability: "in-use",
    history: [
      {
        date: item.receivedAt,
        title: "Received at usage destination",
        detail: `${record.requestId} · ${record.destination} · ${item.receiverPic}`,
        kind: "Movement",
      },
      ...asset.history,
    ],
  };
}
