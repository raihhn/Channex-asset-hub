"use client";

import { RequestFlowScreen } from "@/features/requests/request-flow-screen";
import { usePrototype } from "@/features/prototype/prototype-provider";

export function NewRequestScreen({ initialAssetIds = [], revisionRequestId }: { initialAssetIds?: string[]; revisionRequestId?: string }) {
  const { assets, requests, wbsReferences, bookingLoading, bookingError } = usePrototype();
  if (bookingLoading) return <p className="p-6" role="status">Loading saved requests…</p>;
  if (bookingError) return <p className="p-6" role="alert">Could not load saved requests: {bookingError}</p>;
  const revisionRequest = requests.find((request) => request.id === revisionRequestId);
  if (revisionRequestId && (!revisionRequest || revisionRequest.status !== "Needs update")) return <p className="p-6">This Request is not available for revision. Open it from My requests.</p>;
  const selectedIds = revisionRequest ? revisionRequest.items.map((item) => `${item.assetId}:${item.quantity}`) : initialAssetIds;
  const items = selectedIds.flatMap((assetId) => {
    const asset = assets.find((candidate) => candidate.id === assetId.split(":")[0]);
    return asset ? [{ asset, quantity: Number(assetId.split(":")[1]) || 1 }] : [];
  });
  const initialWbsCodes = revisionRequest?.wbsReferenceIds?.flatMap((id) => { const reference = wbsReferences.find((item) => item.id === id); return reference ? [reference.code] : []; }) ?? [];
  return <RequestFlowScreen items={items} revisionRequest={revisionRequest} initialWbsCodes={initialWbsCodes} />;
}
